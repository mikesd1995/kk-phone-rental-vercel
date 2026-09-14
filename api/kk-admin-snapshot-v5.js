// KK Phone Rental — Admin Snapshot Upstream Error Preservation v5
// Handles read-only snapshot/snapshotHealth before the booking guard so upstream
// Apps Script failures are preserved instead of being rewritten as invalid arrays.

const { Readable } = require('stream');
const GuardAdmin = require('./kk-admin-guard.js');
const SnapshotHealth = require('../admin/snapshot-health.js');

const ADAPTER_VERSION = 'admin-snapshot-upstream-error-v5';
const DEFAULT_SHEET_ID = '12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU';
const SNAPSHOT_ACTIONS = new Set(['snapshot', 'snapshotHealth']);

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-KK-App-Version', SnapshotHealth.VERSION);
  res.setHeader('X-KK-Snapshot-Adapter-Version', ADAPTER_VERSION);
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.end(JSON.stringify(Object.assign({
    proxy_version: SnapshotHealth.VERSION,
    snapshot_adapter_version: ADAPTER_VERSION
  }, body || {})));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 6 * 1024 * 1024) {
        reject(new Error('Request too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

function clonedRequest(req, raw) {
  const clone = Readable.from([raw || '']);
  clone.method = req.method;
  clone.url = req.url;
  clone.headers = req.headers || {};
  return clone;
}

function looksLikeAppsScriptUrl(value) {
  try {
    const u = new URL(String(value || ''));
    return u.protocol === 'https:' && u.host === 'script.google.com' && /\/macros\/s\/[^/]+\/exec$/.test(u.pathname);
  } catch (_) {
    return false;
  }
}

function safeUrlHost(value) {
  try { return new URL(String(value || '')).host || ''; }
  catch (_) { return ''; }
}

function compactNonJsonError(text, contentType, urlHost) {
  const raw = String(text || '');
  const titleMatch = raw.match(/<title>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : 'Non-JSON response';
  if (/drive|docs\.google|google drive/i.test(raw) || /drive|docs\.google/i.test(String(urlHost))) {
    return 'Apps Script URL seems to point to Google Drive/Docs or returned a Google Drive page, not JSON. Check KK_ADMIN_SCRIPT_URL in Vercel.';
  }
  if (/<!doctype html|<html/i.test(raw)) {
    return 'Apps Script returned HTML instead of JSON (' + title + '). Check Web App deployment URL and access setting.';
  }
  return 'Apps Script returned a non-JSON response' + (contentType ? ' (' + contentType + ')' : '') + '.';
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs || 55000);
  try {
    const response = await fetch(url, Object.assign({}, options || {}, { signal: controller.signal }));
    const body = await response.text();
    return { ok: response.ok, status: response.status, headers: response.headers, body };
  } finally {
    clearTimeout(timer);
  }
}

function requestAction(req, payload) {
  if (req.method === 'GET') {
    const u = new URL(req.url || '/api/kk-admin', 'http://localhost');
    return String(u.searchParams.get('action') || 'snapshot');
  }
  return String(payload && payload.action || '');
}

async function handleSnapshot(req, res, payload, action) {
  const adminPin = String(process.env.KK_ADMIN_PIN || '').trim();
  const providedPin = String(req.headers && req.headers['x-admin-pin'] || '').trim();
  if (!adminPin) {
    return json(res, 500, {
      ok: false,
      error: 'Admin API is not configured. Set KK_ADMIN_PIN in Vercel Environment Variables.',
      error_code: 'ADMIN_CONFIG_MISSING'
    });
  }
  if (providedPin !== adminPin) return json(res, 401, { ok: false, error: 'Invalid admin PIN' });

  const scriptUrl = String(process.env.KK_ADMIN_SCRIPT_URL || '').trim();
  const apiKey = String(process.env.KK_ADMIN_API_KEY || '').trim();
  const envSheetId = String(process.env.GOOGLE_SHEET_ID || '').trim();
  const frontendSheetId = envSheetId || DEFAULT_SHEET_ID;
  const sheetIdSource = envSheetId ? 'env' : 'default-fallback';

  if (!scriptUrl || !apiKey) {
    return json(res, 500, {
      ok: false,
      error: 'Admin API is not configured. Set KK_ADMIN_SCRIPT_URL and KK_ADMIN_API_KEY in Vercel Environment Variables.',
      error_code: 'ADMIN_CONFIG_MISSING'
    });
  }
  if (!looksLikeAppsScriptUrl(scriptUrl)) {
    return json(res, 500, {
      ok: false,
      error: 'KK_ADMIN_SCRIPT_URL is not an Apps Script Web App URL. It must look like https://script.google.com/macros/s/.../exec',
      error_code: 'ADMIN_SCRIPT_URL_INVALID'
    });
  }

  const upstreamPayload = Object.assign({}, payload || {}, {
    action: 'snapshot',
    apiKey,
    proxyVersion: SnapshotHealth.VERSION,
    frontendSheetId,
    sheetIdSource
  });

  const startedAt = Date.now();
  let upstream;
  try {
    upstream = await fetchWithTimeout(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(upstreamPayload)
    }, 55000);
  } catch (err) {
    const isTimeout = !!(err && err.name === 'AbortError');
    return json(res, 500, {
      ok: false,
      error: isTimeout
        ? 'Apps Script request timed out for snapshot. The proxy waited up to 55000 ms.'
        : (err && err.message ? err.message : String(err)),
      error_code: isTimeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_ERROR',
      proxy_upstream_ms: Date.now() - startedAt,
      proxy_timeout_ms: 55000
    });
  }

  const elapsed = Date.now() - startedAt;
  const contentType = upstream.headers && upstream.headers.get ? (upstream.headers.get('content-type') || '') : '';
  let data;
  try {
    data = JSON.parse(upstream.body);
  } catch (_) {
    return json(res, 502, {
      ok: false,
      error: compactNonJsonError(upstream.body, contentType, safeUrlHost(scriptUrl)),
      error_code: 'SNAPSHOT_UPSTREAM_NON_JSON',
      upstream_status: upstream.status,
      proxy_upstream_ms: elapsed,
      proxy_timeout_ms: 55000
    });
  }

  if (!upstream.ok || !data || data.ok !== true) {
    return json(res, upstream.ok ? 502 : upstream.status, {
      ok: false,
      error: data && data.error ? String(data.error) : 'Apps Script snapshot request failed',
      error_code: 'SNAPSHOT_UPSTREAM_FAILED',
      upstream_status: upstream.status,
      backend_version: data && (data.admin_api_version || (data.data && data.data.admin_api_version)) || '',
      proxy_upstream_ms: elapsed,
      proxy_timeout_ms: 55000
    });
  }

  if (!data.data || typeof data.data !== 'object' || Array.isArray(data.data)) {
    return json(res, 502, {
      ok: false,
      error: 'Apps Script returned ok=true but snapshot data is missing',
      error_code: 'SNAPSHOT_PAYLOAD_MISSING',
      upstream_status: upstream.status,
      proxy_upstream_ms: elapsed,
      proxy_timeout_ms: 55000
    });
  }

  const health = SnapshotHealth.assess(data.data);
  health.latency_ms = elapsed;
  health.checked_at = new Date().toISOString();
  health.backend_version = data.data.admin_api_version || data.admin_api_version || '';
  health.proxy_version = SnapshotHealth.VERSION;
  if (health.backend_version !== SnapshotHealth.BACKEND) {
    health.warnings.push('Apps Script revision differs from observed 9_5_9; inspect deployed source, never downgrade to repository 9_5_8');
  }
  if (data.data.spreadsheet_id !== frontendSheetId) {
    health.ok = false;
    health.issues.push('Snapshot spreadsheet_id does not match configured sheet');
  }

  if (action === 'snapshotHealth') {
    return json(res, 200, {
      ok: true,
      data: health,
      proxy_upstream_ms: elapsed,
      proxy_timeout_ms: 55000
    });
  }

  if (!health.ok) {
    return json(res, 502, {
      ok: false,
      error: 'Snapshot rejected: ' + health.issues.join('; '),
      error_code: 'INVALID_SNAPSHOT',
      snapshot_health: health,
      proxy_upstream_ms: elapsed,
      proxy_timeout_ms: 55000
    });
  }

  data.snapshot_health = health;
  data.frontend_sheet_id = frontendSheetId;
  data.frontend_sheet_id_source = sheetIdSource;
  data.frontend_proxy_version = SnapshotHealth.VERSION;
  data.proxy_upstream_ms = elapsed;
  data.proxy_timeout_ms = 55000;
  data.data.frontend_sheet_id = frontendSheetId;
  data.data.frontend_sheet_id_source = sheetIdSource;
  data.data.frontend_proxy_version = SnapshotHealth.VERSION;

  return json(res, 200, data);
}

module.exports = async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return GuardAdmin(req, res);

  if (req.method === 'GET') {
    const action = requestAction(req, null);
    if (!SNAPSHOT_ACTIONS.has(action)) return GuardAdmin(req, res);
    return handleSnapshot(req, res, {}, action);
  }

  let raw = '';
  try {
    raw = await readBody(req);
  } catch (err) {
    return json(res, 413, { ok: false, error: err.message || String(err), error_code: 'REQUEST_TOO_LARGE' });
  }

  let payload;
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch (_) {
    return GuardAdmin(clonedRequest(req, raw), res);
  }

  const action = requestAction(req, payload);
  if (!SNAPSHOT_ACTIONS.has(action)) return GuardAdmin(clonedRequest(req, raw), res);
  return handleSnapshot(req, res, payload, action);
};

module.exports._test = { looksLikeAppsScriptUrl, compactNonJsonError, requestAction, handleSnapshot };
