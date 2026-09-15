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
  '08_Web_Ready': new Set(['A4:K']),
  '09_Web_Packages': new Set(['A4:N', 'A4:M', 'A4:L']),
  '03_Packages': new Set(['A4:J']),
  '04_Event_Overrides': new Set(['A4:G']),
};

function isTrue(value) {
  return ['1', 'true', 'yes', 'on'].includes(String(value || '').trim().toLowerCase());
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
  csvHeaderLooksValid,
  privateReaderConfigured,
};
