'use strict';

// KK Phone Rental public-data proxy.
// Transitional security model:
//   1) Prefer authenticated read-only Google Sheets API when service-account credentials exist.
//   2) Keep the historical public GViz fallback until private-reader acceptance is proven.
//   3) KK_PUBLIC_SHEET_REQUIRE_PRIVATE=1 fails closed and disables the public fallback.
// This lets production migrate the Core workbook to private access without coupling the cutover
// to an unverified credential/configuration change.

const privateSheets = require('./lib/private-google-sheets');

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

function sanitizePublicCsv(sheet, text) {
  const rows = parseCsvRows(text);
  if (!rows.length) return {text: String(text || ''), dropped: 0};
  const header = rows[0].map(v => String(v || '').trim().toLowerCase());
  const idx = name => header.indexOf(name);
  let required = [];
  if (sheet === '08_Web_Ready') required = ['event_id', 'event_name'];
  if (sheet === '09_Web_Packages') required = ['package_id', 'event_id', 'package_type'];
  if (!required.length) return {text: String(text || ''), dropped: 0};

  const requiredIndexes = required.map(idx);
  if (requiredIndexes.some(i => i < 0)) return {text: String(text || ''), dropped: 0};

  const body = rows.slice(1);
  const kept = body.filter(row => requiredIndexes.every(i => String(row[i] || '').trim() !== ''));
  return {
    text: serializeCsvRows([rows[0], ...kept]),
    dropped: body.length - kept.length,
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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return send(res, 204, '');
  if (req.method !== 'GET') return send(res, 405, 'Method Not Allowed');

  const sheet = Array.isArray(req.query && req.query.sheet) ? '' : String((req.query && req.query.sheet) || '').trim();
  const range = Array.isArray(req.query && req.query.range) ? '' : String((req.query && req.query.range) || '').trim();
  const showPast = isTrue(Array.isArray(req.query && req.query.showPast) ? '' : (req.query && req.query.showPast));
  if (!ALLOWED[sheet] || !ALLOWED[sheet].has(range)) {
    return send(res, 400, 'Sheet/range not allowed');
  }

  const envSheetId = String(process.env.GOOGLE_SHEET_ID || '').trim();
  const sheetId = envSheetId || DEFAULT_SHEET_ID;
  const requirePrivate = isTrue(process.env.KK_PUBLIC_SHEET_REQUIRE_PRIVATE);
  const hasPrivateReader = privateReaderConfigured();

  // Deliberately do not expose even a partial Sheet ID in response headers.
  // The old X-KK-Sheet-ID value also used a Unicode ellipsis, which Node rejects as an HTTP header value.
  res.setHeader('X-KK-Sheet-Config', envSheetId ? 'env' : 'default');

  if (!sheetId) {
    return send(res, 500, 'Public data source is not configured.');
  }

  let text = '';
  let source = '';
  let privateError = null;

  if (hasPrivateReader) {
    try {
      text = await readPrivateCsv(sheetId, sheet, range);
      source = 'private-service-account';
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

  if (!csvHeaderLooksValid(sheet, text)) {
    res.setHeader('X-KK-Sheet-Source', source || 'unknown');
    return send(res, 502, 'Google Sheets returned an invalid public-data schema.');
  }

  const sanitized = sanitizePublicCsv(sheet, text);
  text = sanitized.text;
  if (sanitized.dropped > 0) {
    res.setHeader('X-KK-Public-Rows-Dropped', String(sanitized.dropped));
  }
  const futureOnly = filterPastPublicCsv(sheet, text, {showPast});
  text = futureOnly.text;
  if (futureOnly.dropped > 0) {
    res.setHeader('X-KK-Past-Rows-Dropped', String(futureOnly.dropped));
  }

  res.setHeader('X-KK-Sheet-Source', source);
  if (sheet === '09_Web_Packages') {
    res.setHeader('X-KK-Package-Price-Source', '09_Web_Packages-direct-no-proxy-override');
  }
  res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
  return send(res, 200, text, 'text/csv; charset=utf-8');
};

module.exports._test = {
  ALLOWED,
  isTrue,
  parseCsvRows,
  serializeCsvRows,
  sanitizePublicCsv,
  filterPastPublicCsv,
  bangkokTodayISO,
  normalizePublicDate,
  dateFromEventId,
  csvHeaderLooksValid,
  privateReaderConfigured,
};
