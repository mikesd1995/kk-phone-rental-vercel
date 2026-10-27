'use strict';

// KK Phone Rental public-data proxy.
// Transitional security model:
//   1) Prefer authenticated read-only Google Sheets API when service-account credentials exist.
//   2) Keep the historical public GViz fallback until private-reader acceptance is proven.
//   3) KK_PUBLIC_SHEET_REQUIRE_PRIVATE=1 fails closed and disables the public fallback.
// This lets production migrate the Core workbook to private access without coupling the cutover
// to an unverified credential/configuration change.

const {installRuntimeWarningTracer}=require('../server/runtime-warning-tracer');
installRuntimeWarningTracer('kk-data');
const privateSheets = require('./lib/private-google-sheets');
const CorePrivacy = require('../server/core-sheet-private-reader.js');
const lineBookingWebhook = require('../server/line-booking-webhook');

const KK_APP_VERSION = 'v16.7.0_CRM_PRO_PHASE3_9_5_4_BOOKING_STOCK_RESERVATION_FIX';
const DEFAULT_SHEET_ID = '12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU';

const ALLOWED = {
  // Customer-facing derived feeds only. Internal package templates and event override tables
  // must never be exposed through this unauthenticated endpoint.
  '08_Web_Ready': new Set(['A4:K']),
  '09_Web_Packages': new Set(['A4:N', 'A4:M', 'A4:L']),
};

function isTrue(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const input = String(text || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function csvCell(value) {
  const text = String(value == null ? '' : value);
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function serializeCsvRows(rows) {
  return rows.map(row => row.map(csvCell).join(',')).join('\n');
}

function looksInternalPublicText(value) {
  const text = String(value == null ? '' : value).normalize('NFKC').trim();
  if (!text) return false;

  // Fail closed on machine-readable/internal annotations. Customer-facing prose should
  // never contain long ALL_CAPS snake-case operational tokens such as
  // OWNER_PRICE_ADJUST_2026-09-28_BIG_EVENT_COLLISION.
  const machineToken = /(?:^|[\s([{|])(?:[A-Z][A-Z0-9-]{1,}|\d{8}_[A-Z0-9-]+)(?:_[A-Z0-9-]+){1,}(?=$|[\s)\]}.,;:|])/;
  if (machineToken.test(text)) return true;

  return /(?:^|\b)v\d+(?:\.\d+){1,3}\b|capacity\s*(?:tight|blocked|readback)|exact\s+capacity|readback|owner[_\s-]?locked|core\s+promotion|promotion\s+repair|reopened\s+after|manifest|write\s+transaction|pass[_\s-]?200|policy\s+version|restored\s+\d{4}-\d{2}-\d{2}|scanner\s+raw|verifier\s+backlog|machine[_\s-]?sot|manual[_\s-]?cutover|internal[_\s-]?(?:note|only)|override[_\s-]?(?:note|reason)/i.test(text);
}

function sanitizePublicTextValue(value) {
  const text = String(value == null ? '' : value).replace(/\[INQUIRY_ONLY\]/ig, '').trim();
  // Prevent contact details accidentally copied into owner-facing notes/templates
  // from becoming public via the derived feeds. Never copy the raw value to logs.
  const contact=/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:\+66|0)[\s().-]?[689](?:[\s().-]?\d){8}\b/i;
  return looksInternalPublicText(text)||contact.test(text) ? '' : text;
}

function sanitizePublicCsv(sheet, text) {
  const rows = parseCsvRows(text);
  if (!rows.length) return {text:'',dropped:0,redacted:0,invalid:true};
  const header = rows[0].map(v => String(v || '').trim().toLowerCase());
  const idx = name => header.indexOf(name);
  let required = [];
  if (sheet === '08_Web_Ready') required = ['event_id', 'event_name'];
  if (sheet === '09_Web_Packages') required = ['package_id', 'event_id', 'package_type'];
  if (!required.length) return {text: String(text || ''), dropped: 0, redacted: 0};

  const requiredIndexes = required.map(idx);
  if (requiredIndexes.some(i => i < 0)) return {text:'',dropped:0,redacted:0,invalid:true};

  const publicTextFields = sheet === '08_Web_Ready'
    ? ['event_note', 'line_message_template']
    : ['web_note', 'package_note', 'use_case'];
  const publicTextIndexes = publicTextFields.map(idx).filter(i => i >= 0);

  const body = rows.slice(1);
  const identityRows = body.filter(row => requiredIndexes.every(i => String(row[i] || '').trim() !== ''));
  const kept = sheet === '09_Web_Packages'
    ? identityRows.filter(row => {
        const statusIndex=idx('package_status');
        const availableIndex=idx('available_count');
        const priceIndex=idx('price');
        const sortIndex=idx('sort_order');
        if(statusIndex<0||availableIndex<0||priceIndex<0) return false;
        const status=String(row[statusIndex]||'').trim().toLowerCase();
        const available=Number(String(row[availableIndex]||'').replace(/,/g,''));
        const price=Number(String(row[priceIndex]||'').replace(/,/g,''));
        const sort=sortIndex<0||String(row[sortIndex]||'').trim()==='' ? 0 : Number(String(row[sortIndex]).replace(/,/g,''));
        return ['available','full','hidden','open'].includes(status) &&
          Number.isFinite(available) && available>=0 &&
          Number.isFinite(price) && price>=0 &&
          Number.isFinite(sort);
      })
    : identityRows;
  let redacted = 0;
  const cleaned = kept.map(row => {
    const next = row.slice();
    for (const i of publicTextIndexes) {
      const before = String(next[i] == null ? '' : next[i]);
      const after = sanitizePublicTextValue(before);
      if (before.trim() && !after) redacted++;
      next[i] = after;
    }
    return next;
  });
  return {
    text: serializeCsvRows([rows[0], ...cleaned]),
    dropped: body.length - kept.length,
    redacted,
  };
}

function bangkokTodayISO(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  const get = type => (parts.find(p => p.type === type) || {}).value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function normalizePublicDate(value) {
  const text = String(value || '').trim();
  let m = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m) {
    let year = Number(m[3]);
    if (year > 2500) year -= 543;
    return `${String(year).padStart(4,'0')}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[1])).padStart(2,'0')}`;
  }
  m = text.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/);
  if (m) {
    let year = Number(m[1]);
    if (year > 2500) year -= 543;
    return `${String(year).padStart(4,'0')}-${String(Number(m[2])).padStart(2,'0')}-${String(Number(m[3])).padStart(2,'0')}`;
  }
  return '';
}

function dateFromEventId(eventId) {
  const m = String(eventId || '').match(/^EVT-(\d{4})(\d{2})(\d{2})-/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

function filterPastPublicCsv(sheet, text, options = {}) {
  if (options.showPast) return {text: String(text || ''), dropped: 0};
  const rows = parseCsvRows(text);
  if (!rows.length) return {text: String(text || ''), dropped: 0};
  const header = rows[0].map(v => String(v || '').trim().toLowerCase());
  const eventIdIndex = header.indexOf('event_id');
  const eventDateIndex = header.indexOf('event_date_text');
  if (eventIdIndex < 0) return {text: String(text || ''), dropped: 0};
  const today = bangkokTodayISO(options.now);
  const body = rows.slice(1);
  const kept = body.filter(row => {
    let date = '';
    if (sheet === '08_Web_Ready' && eventDateIndex >= 0) date = normalizePublicDate(row[eventDateIndex]);
    if (!date) date = dateFromEventId(row[eventIdIndex]);
    return !date || date >= today;
  });
  return {text: serializeCsvRows([rows[0], ...kept]), dropped: body.length - kept.length};
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeShareEventId(value) {
  const id = String(value || '').trim();
  return /^EVT-[A-Za-z0-9_-]{6,160}$/.test(id) ? id : '';
}

function requestQueryValue(req, key) {
  let parsed;
  try { parsed = new URL(String(req && req.url || '/'), 'https://kk-local.invalid'); }
  catch (_err) { parsed = new URL('/', 'https://kk-local.invalid'); }
  const values = parsed.searchParams.getAll(key);
  if (values.length > 1) return '';
  if (values.length === 1) return String(values[0] || '');

  // Unit-test/local compatibility only: read an own data property without
  // touching Vercel's IncomingMessage.prototype query getter.
  try {
    const desc = req && Object.getOwnPropertyDescriptor(req, 'query');
    const query = desc && Object.prototype.hasOwnProperty.call(desc, 'value') ? desc.value : null;
    if (query && typeof query === 'object' && Object.prototype.hasOwnProperty.call(query, key)) {
      const value = query[key];
      return Array.isArray(value) ? '' : String(value || '');
    }
  } catch (_err) {}

  // Preserve the public share route even if the platform exposes the original
  // rewritten pathname rather than destination query parameters.
  if (key === 'eventShare') {
    const match = String(parsed.pathname || '').match(/^\/event\/(EVT-[A-Za-z0-9_-]{6,160})\/?$/);
    if (match) return match[1];
  }
  return '';
}

function renderEventSharePage(eventId, text) {
  const rows = parseCsvRows(text);
  const header = (rows[0] || []).map(v => String(v || '').trim());
  const objects = rows.slice(1).map(row => {
    const out = {};
    header.forEach((key, index) => { out[key] = row[index] == null ? '' : row[index]; });
    return out;
  });
  const event = objects.find(row =>
    String(row.event_id || '').trim() === eventId &&
    String(row.action_for_web || '').trim().toLowerCase() !== 'hide'
  ) || null;
  const site = 'https://kk-phone-rental.vercel.app';
  const target = site + '/?event=' + encodeURIComponent(eventId);
  const shareUrl = site + '/event/' + encodeURIComponent(eventId);
  const title = event && event.event_name ? event.event_name + ' | KK Phone Rental' : 'KK Phone Rental';
  const desc = event
    ? [event.event_name, event.event_date_text ? 'วันที่ ' + event.event_date_text : '', event.venue ? 'ที่ ' + event.venue : '', 'ดูรายละเอียดและจองผ่าน LINE OA กับ KK Phone Rental'].filter(Boolean).join(' · ').slice(0, 280)
    : 'เช่ามือถือสำหรับคอนเสิร์ต แฟนมีท และอีเวนต์ ดูคิวว่างและจองผ่าน LINE OA';
  const image = event && String(event.poster_image_url || '').trim()
    ? String(event.poster_image_url).trim()
    : site + '/assets/kk-brand-hero-final-20260920.png';
  return '<!doctype html><html lang="th"><head>' +
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta name="robots" content="noindex,follow">' +
    '<title>' + escapeHtml(title) + '</title>' +
    '<meta name="description" content="' + escapeHtml(desc) + '">' +
    '<link rel="canonical" href="' + escapeHtml(target) + '">' +
    '<meta http-equiv="refresh" content="0;url=' + escapeHtml(target) + '">' +
    '<meta property="og:type" content="website">' +
    '<meta property="og:site_name" content="KK Phone Rental">' +
    '<meta property="og:locale" content="th_TH">' +
    '<meta property="og:title" content="' + escapeHtml(title) + '">' +
    '<meta property="og:description" content="' + escapeHtml(desc) + '">' +
    '<meta property="og:url" content="' + escapeHtml(shareUrl) + '">' +
    '<meta property="og:image" content="' + escapeHtml(image) + '">' +
    '<meta name="twitter:card" content="summary_large_image">' +
    '<meta name="twitter:title" content="' + escapeHtml(title) + '">' +
    '<meta name="twitter:description" content="' + escapeHtml(desc) + '">' +
    '<meta name="twitter:image" content="' + escapeHtml(image) + '">' +
    '</head><body><p>กำลังเปิดรายละเอียดงาน… <a href="' + escapeHtml(target) + '">เปิด KK Phone Rental</a></p></body></html>';
}

const PUBLIC_FEED_HEADERS=Object.freeze({
  '08_Web_Ready':Object.freeze(['event_id','event_name','event_date_text','venue','poster_image_url','event_note','available_phone_count','available_lens_count','booking_status_for_web','action_for_web','line_message_template']),
  '09_Web_Packages':Object.freeze(['package_id','event_id','package_type','model_group','model_display','lens_group','lens_display','price','available_count','package_status','sort_order','web_note','raw_available_count','use_case'])
});
function validatedPublicFeedRows(sheet,text){
  const expected=PUBLIC_FEED_HEADERS[sheet];
  const rows=parseCsvRows(text);
  if(!expected||rows.length===0)return null;
  const header=rows[0].map(x=>String(x||'').trim().toLowerCase());
  if(header.length<=(sheet==='08_Web_Ready'?10:11)||header.length>expected.length
    ||header.some((name,i)=>name!==expected[i] && !(sheet==='09_Web_Packages' && i===11 && name==='package_note'))
    ||rows.slice(1).some(row=>row.length>header.length))return null;
  return rows;
}
function csvHeaderLooksValid(sheet, text) {
  const firstLine = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/)[0] || '';
  const normalized = firstLine.toLowerCase();
  if (sheet === '08_Web_Ready') {
    return normalized.includes('event_id') && normalized.includes('poster_image_url') && normalized.includes('action_for_web');
  }
  if (sheet === '09_Web_Packages') {
    return normalized.includes('package_id') && normalized.includes('event_id') && normalized.includes('available_count');
  }
  return true;
}

function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 12000);
  return fetch(url, Object.assign({}, options || {}, { signal: controller.signal }))
    .finally(() => clearTimeout(timer));
}

function send(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.statusCode = status;
  res.setHeader('Content-Type', contentType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-KK-App-Version', KK_APP_VERSION);
  res.end(body);
}

function privateReaderConfigured(env = process.env) {
  return !!privateSheets.credentialsFromEnv(env);
}

async function readPrivateCsv(sheetId, sheet, range) {
  return privateSheets.readValuesCsv({
    sheetId,
    range: `${sheet}!${range}`,
  });
}

async function readPublicGvizCsv(sheetId, sheet, range) {
  const url = 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(sheetId) +
    '/gviz/tq?tqx=out:csv&sheet=' + encodeURIComponent(sheet) +
    '&range=' + encodeURIComponent(range) +
    '&t=' + Date.now();
  const upstream = await fetchWithTimeout(url, {
    headers: { 'User-Agent': 'KK-Phone-Rental-Vercel-Proxy/16.7.0' },
  }, 12000);
  const text = await upstream.text();
  if (!upstream.ok) {
    const err = new Error(text || 'Google Sheets upstream error');
    err.httpStatus = upstream.status;
    throw err;
  }
  return text;
}

module.exports = async function handler(req, res) {
  if (requestQueryValue(req, '__kk_line_webhook') === '1') return lineBookingWebhook(req, res);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return send(res, 204, '');
  if (req.method !== 'GET') return send(res, 405, 'Method Not Allowed');

  const eventShareId = safeShareEventId(requestQueryValue(req, 'eventShare'));
  const sheet = eventShareId ? '08_Web_Ready' : String(requestQueryValue(req, 'sheet') || '').trim();
  const range = eventShareId ? 'A4:K' : String(requestQueryValue(req, 'range') || '').trim();
  const showPast = eventShareId ? false : isTrue(requestQueryValue(req, 'showPast'));
  if (!ALLOWED[sheet] || !ALLOWED[sheet].has(range)) {
    return send(res, 400, 'Sheet/range not allowed');
  }

  const envSheetId = String(process.env.GOOGLE_SHEET_ID || '').trim();
  const privateEnvSheetId = String(process.env.KK_CRM_SHEET_ID || '').trim();
  const corePrivateStrict=CorePrivacy.enabled(process.env);
  if(!corePrivateStrict && envSheetId && privateEnvSheetId && envSheetId!==privateEnvSheetId){
    res.setHeader('X-KK-Sheet-Source', 'sheet-id-config-conflict');
    return send(res, 503, 'Public-data reader Sheet ID configuration conflicts.');
  }
  // Private Core and CRM are separate workbooks. In strict Core mode the
  // independent canonical Core ID takes precedence without a false CRM conflict.
  const sheetId = corePrivateStrict ? envSheetId : (envSheetId || privateEnvSheetId || DEFAULT_SHEET_ID);
  const requirePrivate = corePrivateStrict || isTrue(process.env.KK_PUBLIC_SHEET_REQUIRE_PRIVATE);
  const coreState=CorePrivacy.state(process.env);
  const privateState = corePrivateStrict ? {
    configured:coreState.configured,
    authMode:coreState.authMode,
    sheetIdState:coreState.explicitSheetId?'CORE_SHEET_ID_EXPLICIT':'CORE_SHEET_ID_MISSING'
  } : privateSheets.configState(process.env);
  const hasPrivateReader = privateState.configured;

  // Non-secret runtime diagnostics for cutover acceptance. Never expose email, key,
  // token, Sheet ID, or credential material; only coarse readiness classifications.
  res.setHeader('X-KK-Private-Reader-Configured', hasPrivateReader ? '1' : '0');
  res.setHeader('X-KK-Private-Reader-Auth', privateState.authMode);
  res.setHeader('X-KK-Private-Reader-Sheet-State', privateState.sheetIdState);
  res.setHeader('X-KK-Private-Reader-Strict', requirePrivate ? '1' : '0');

  // Deliberately do not expose even a partial Sheet ID in response headers.
  // The old X-KK-Sheet-ID value also used a Unicode ellipsis, which Node rejects as an HTTP header value.
  res.setHeader('X-KK-Sheet-Config', envSheetId ? 'env' : (privateEnvSheetId ? 'private-env' : 'default'));

  if (!sheetId) {
    return send(res, 500, 'Public data source is not configured.');
  }

  let text = '';
  let source = '';
  let privateError = null;

  if (hasPrivateReader) {
    try {
      text = corePrivateStrict
        ? await CorePrivacy.readCsv({sheetId,sheet,range})
        : await readPrivateCsv(sheetId, sheet, range);
      source = corePrivateStrict && coreState.transport==='apps-script' ? 'private-owner-apps-script' : 'private-service-account';
    } catch (err) {
      privateError = err;
      if (requirePrivate) {
        res.setHeader('X-KK-Sheet-Source', 'private-read-failed');
        return send(res, 503, 'Private public-data reader is unavailable.');
      }
    }
  } else if (requirePrivate) {
    res.setHeader('X-KK-Sheet-Source', 'private-not-configured');
    return send(res, 503, 'Private public-data reader is not configured.');
  }

  if (!text) {
    // Never attempt public GViz when the privacy cutover is armed, even if
    // private authentication returned an error or an empty dataset.
    if(corePrivateStrict){
      res.setHeader('X-KK-Sheet-Source','core-private-unavailable');
      return send(res,503,'Private Core reader is unavailable.');
    }
    try {
      text = await readPublicGvizCsv(sheetId, sheet, range);
      source = privateError ? 'public-gviz-fallback-after-private-error' : 'public-gviz-fallback';
    } catch (err) {
      const status = Number(err && err.httpStatus) || 502;
      const message = err && err.name === 'AbortError'
        ? 'Google Sheets public-data proxy timed out.'
        : 'Public data source is unavailable.';
      res.setHeader('X-KK-Sheet-Source', 'unavailable');
      return send(res, status, message);
    }
  }

  if (!csvHeaderLooksValid(sheet, text) || !validatedPublicFeedRows(sheet,text)) {
    res.setHeader('X-KK-Sheet-Source', source || 'unknown');
    return send(res, 502, 'Google Sheets returned an invalid public-data schema.');
  }

  const sanitized = sanitizePublicCsv(sheet, text);
  if(sanitized.invalid){
    res.setHeader('X-KK-Sheet-Source','invalid-public-projection');
    return send(res,502,'Public-data projection schema rejected.');
  }
  text = sanitized.text;
  if (sanitized.dropped > 0) {
    res.setHeader('X-KK-Public-Rows-Dropped', String(sanitized.dropped));
  }
  if (sanitized.redacted > 0) {
    res.setHeader('X-KK-Public-Fields-Redacted', String(sanitized.redacted));
  }
  const futureOnly = filterPastPublicCsv(sheet, text, {showPast});
  text = futureOnly.text;
  if (futureOnly.dropped > 0) {
    res.setHeader('X-KK-Past-Rows-Dropped', String(futureOnly.dropped));
  }

  res.setHeader('X-KK-Sheet-Source', source);
  if (eventShareId) {
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.setHeader('X-Robots-Tag', 'noindex, follow');
    return send(res, 200, renderEventSharePage(eventShareId, text), 'text/html; charset=utf-8');
  }
  if (sheet === '09_Web_Packages') {
    res.setHeader('X-KK-Package-Price-Source', '09_Web_Packages-direct-no-proxy-override');
  }
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  return send(res, 200, text, 'text/csv; charset=utf-8');
};

module.exports._test = {
  ALLOWED,
  validatedPublicFeedRows,
  isTrue,
  parseCsvRows,
  serializeCsvRows,
  looksInternalPublicText,
  sanitizePublicTextValue,
  sanitizePublicCsv,
  filterPastPublicCsv,
  bangkokTodayISO,
  normalizePublicDate,
  dateFromEventId,
  escapeHtml,
  safeShareEventId,
  requestQueryValue,
  renderEventSharePage,
  csvHeaderLooksValid,
  privateReaderConfigured,
};
