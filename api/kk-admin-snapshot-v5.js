// KK Phone Rental — Admin Snapshot Upstream Error Preservation v5
// Handles read-only snapshot/snapshotHealth before the booking guard so upstream
// Apps Script failures are preserved instead of being rewritten as invalid arrays.

const { Readable } = require('stream');
const GuardAdmin = require('./kk-admin-guard.js');
const SnapshotHealth = require('../admin/snapshot-health.js');
const UpstreamResponse = require('../server/upstream-response.js');
const AdminSheetFallback = require('../server/admin-sheet-fallback.js');
const AdminDirectWriter = require('../server/admin-direct-writer.js');

const ADAPTER_VERSION = 'admin-snapshot-upstream-error-v5.5';
const DEFAULT_READ_MODE = 'direct-sheet-primary';
const SNAPSHOT_UPSTREAM_TIMEOUT_MS = 12000;
const WRITE_HEALTH_TIMEOUT_MS = 4000;
const WRITE_HEALTH_OK_CACHE_TTL_MS = 15000;
const WRITE_HEALTH_FAIL_CACHE_TTL_MS = 5000;
const UPSTREAM_CIRCUIT_TTL_MS = 30000;
const DETERMINISTIC_UPSTREAM_FAILURES = new Set([
  'APPS_SCRIPT_DEPLOYMENT_NOT_FOUND',
  'GOOGLE_AUTH_HTML',
  'GOOGLE_DRIVE_DOCS_HTML'
]);
let upstreamCircuit = { script_url: '', code: '', until_ms: 0 };
let writeHealthCache = { key: '', at_ms: 0, until_ms: 0, result: null };
const DEFAULT_SHEET_ID = '12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU';
const SNAPSHOT_ACTIONS = new Set(['snapshot', 'snapshotHealth']);
const REQUIRED_SNAPSHOT_KEYS = ['events', 'bookings', 'current_bookings', 'assets'];
const ENVELOPE_KEYS = ['data', 'snapshot', 'result', 'payload'];

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

function adminReadMode(env = process.env) {
  const requested = String(env.KK_ADMIN_READ_MODE || '').trim().toLowerCase();
  return requested === 'apps-script-first' ? 'apps-script-first' : DEFAULT_READ_MODE;
}

function isDeterministicUpstreamFailure(code) {
  return DETERMINISTIC_UPSTREAM_FAILURES.has(String(code || ''));
}

function openUpstreamCircuit(scriptUrl, code, nowMs = Date.now()) {
  const normalizedUrl = String(scriptUrl || '').trim();
  const normalizedCode = String(code || '').trim();
  if (!normalizedUrl || !normalizedCode) return null;
  upstreamCircuit = {
    script_url: normalizedUrl,
    code: normalizedCode,
    until_ms: Number(nowMs) + UPSTREAM_CIRCUIT_TTL_MS
  };
  return Object.assign({}, upstreamCircuit);
}

function activeUpstreamCircuit(scriptUrl, nowMs = Date.now()) {
  const normalizedUrl = String(scriptUrl || '').trim();
  if (!normalizedUrl || upstreamCircuit.script_url !== normalizedUrl) return null;
  if (Number(upstreamCircuit.until_ms || 0) <= Number(nowMs)) {
    upstreamCircuit = { script_url: '', code: '', until_ms: 0 };
    return null;
  }
  return {
    code: upstreamCircuit.code,
    retry_after_ms: Math.max(0, Number(upstreamCircuit.until_ms) - Number(nowMs))
  };
}

function clearUpstreamCircuit(scriptUrl) {
  const normalizedUrl = String(scriptUrl || '').trim();
  if (!normalizedUrl || upstreamCircuit.script_url === normalizedUrl) {
    upstreamCircuit = { script_url: '', code: '', until_ms: 0 };
  }
}

function skippedWritePathHealth(trigger) {
  return {
    checked: false,
    skipped: true,
    ok: false,
    status: Number(trigger && trigger.upstream_status || 0),
    latency_ms: 0,
    error_code: 'WRITE_HEALTH_UPSTREAM_UNAVAILABLE',
    failure_class: String(trigger && (trigger.upstream_failure_class || trigger.code) || ''),
    backend_version: '',
    spreadsheet_id: '',
    cache_status: 'skipped',
    cache_age_ms: 0
  };
}

function writeHealthCacheKey(scriptUrl, sheetId) {
  return String(scriptUrl || '').trim() + '|' + String(sheetId || '').trim();
}

function activeWriteHealthCache(scriptUrl, sheetId, nowMs = Date.now()) {
  const key = writeHealthCacheKey(scriptUrl, sheetId);
  if (!key || writeHealthCache.key !== key || !writeHealthCache.result) return null;
  if (Number(writeHealthCache.until_ms || 0) <= Number(nowMs)) {
    writeHealthCache = { key: '', at_ms: 0, until_ms: 0, result: null };
    return null;
  }
  return Object.assign({}, writeHealthCache.result, {
    cache_status: 'hit',
    cache_age_ms: Math.max(0, Number(nowMs) - Number(writeHealthCache.at_ms || 0))
  });
}

function rememberWriteHealth(scriptUrl, sheetId, result, nowMs = Date.now()) {
  const value = Object.assign({}, result || {});
  const ttl = value.ok ? WRITE_HEALTH_OK_CACHE_TTL_MS : WRITE_HEALTH_FAIL_CACHE_TTL_MS;
  writeHealthCache = {
    key: writeHealthCacheKey(scriptUrl, sheetId),
    at_ms: Number(nowMs),
    until_ms: Number(nowMs) + ttl,
    result: value
  };
  return Object.assign({}, value, { cache_status: 'miss', cache_age_ms: 0 });
}

function clearWriteHealthCache() {
  writeHealthCache = { key: '', at_ms: 0, until_ms: 0, result: null };
}

function compactNonJsonError(text, contentType, urlHost) {
  return UpstreamResponse.classifyNonJsonResponse(text, contentType, urlHost).message;
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

async function probeWritePath(scriptUrl, apiKey, frontendSheetId, sheetIdSource) {
  const startedAt = Date.now();
  try {
    const upstream = await fetchWithTimeout(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'phase1Health',
        apiKey,
        proxyVersion: SnapshotHealth.VERSION,
        frontendSheetId,
        sheetIdSource
      })
    }, WRITE_HEALTH_TIMEOUT_MS);

    const contentType = upstream.headers && upstream.headers.get ? (upstream.headers.get('content-type') || '') : '';
    let data;
    try {
      data = JSON.parse(upstream.body);
    } catch (_) {
      const failure = UpstreamResponse.classifyNonJsonResponse(
        upstream.body,
        contentType,
        safeUrlHost(scriptUrl),
        upstream.status
      );
      return {
        checked: true,
        ok: false,
        status: Number(upstream.status || 0),
        latency_ms: Date.now() - startedAt,
        error_code: failure.code || 'WRITE_HEALTH_NON_JSON',
        backend_version: '',
        spreadsheet_id: ''
      };
    }

    const health = isObject(data && data.data) ? data.data : (isObject(data) ? data : {});
    const backendVersion = String(health.admin_api_version || data.admin_api_version || '').trim();
    const spreadsheetId = String(health.spreadsheet_id || '').trim();
    const sameSheet = !!spreadsheetId && spreadsheetId === String(frontendSheetId || '').trim();
    const expectedVersion = String(SnapshotHealth.BACKEND || '').trim();
    const versionOk = !!backendVersion && backendVersion === expectedVersion;
    const ok = !!(upstream.ok && data && data.ok === true && sameSheet && versionOk);

    return {
      checked: true,
      ok,
      status: Number(upstream.status || 0),
      latency_ms: Date.now() - startedAt,
      error_code: ok ? '' : 'WRITE_HEALTH_IDENTITY_MISMATCH',
      backend_version: backendVersion,
      spreadsheet_id: spreadsheetId
    };
  } catch (err) {
    return {
      checked: true,
      ok: false,
      status: 0,
      latency_ms: Date.now() - startedAt,
      error_code: err && err.name === 'AbortError' ? 'WRITE_HEALTH_TIMEOUT' : 'WRITE_HEALTH_ERROR',
      backend_version: '',
      spreadsheet_id: ''
    };
  }
}

function requestAction(req, payload) {
  if (req.method === 'GET') {
    const u = new URL(req.url || '/api/kk-admin', 'http://localhost');
    return String(u.searchParams.get('action') || 'snapshot');
  }
  return String(payload && payload.action || '');
}

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function hasRequiredSnapshotArrays(value) {
  return isObject(value) && REQUIRED_SNAPSHOT_KEYS.every(key => Array.isArray(value[key]));
}

function firstMetadata(sources, key) {
  for (const source of sources) {
    if (!isObject(source)) continue;
    const value = source[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return '';
}

function normalizeSnapshotEnvelope(body, frontendSheetId) {
  if (!isObject(body)) return null;
  const queue = [{ value: body, path: '$', ancestors: [] }];
  const visited = new Set();

  while (queue.length) {
    const node = queue.shift();
    if (!isObject(node.value) || visited.has(node.value)) continue;
    visited.add(node.value);

    if (hasRequiredSnapshotArrays(node.value)) {
      const metadataSources = [node.value].concat(node.ancestors.slice().reverse(), [body]);
      const normalized = Object.assign({}, node.value);
      if (!normalized.spreadsheet_id) normalized.spreadsheet_id = firstMetadata(metadataSources, 'spreadsheet_id');
      if (!normalized.admin_api_version) normalized.admin_api_version = firstMetadata(metadataSources, 'admin_api_version');

      if (!frontendSheetId || String(normalized.spreadsheet_id || '').trim() === String(frontendSheetId).trim()) {
        return { data: normalized, path: node.path };
      }
    }

    const depth = node.path.split('.').length - 1;
    if (depth >= 3) continue;
    for (const key of ENVELOPE_KEYS) {
      if (!isObject(node.value[key])) continue;
      queue.push({
        value: node.value[key],
        path: node.path + '.' + key,
        ancestors: node.ancestors.concat(node.value)
      });
    }
  }
  return null;
}

function objectShape(value) {
  if (!isObject(value)) return { type: Array.isArray(value) ? 'array' : typeof value };
  const keys = Object.keys(value).slice(0, 24);
  const types = {};
  for (const key of keys) {
    const v = value[key];
    types[key] = Array.isArray(v) ? 'array' : (v === null ? 'null' : typeof v);
  }
  return { keys, types };
}

function snapshotEnvelopeDiagnostics(body) {
  const data = isObject(body) ? body.data : null;
  const nestedData = isObject(data) ? data.data : null;
  const snapshot = isObject(data) ? data.snapshot : null;
  const result = isObject(data) ? data.result : null;
  return {
    root: objectShape(body),
    data: objectShape(data),
    nested_data: objectShape(nestedData),
    snapshot: objectShape(snapshot),
    result: objectShape(result)
  };
}

async function respondWithDirectSheetFallback(res, action, frontendSheetId, sheetIdSource, trigger, startedAt, scriptUrl, apiKey) {
  const fallbackStartedAt = Date.now();
  try {
    const failureClass = String(trigger && (trigger.upstream_failure_class || trigger.code) || '');
    const primaryRead = !!(trigger && trigger.primary_read);
    const skipWriteProbe = isDeterministicUpstreamFailure(failureClass) || !looksLikeAppsScriptUrl(scriptUrl) || !apiKey;
    const cachedWriteHealth = skipWriteProbe ? null : activeWriteHealthCache(scriptUrl, frontendSheetId);
    const writeHealthPromise = skipWriteProbe
      ? Promise.resolve(skippedWritePathHealth(trigger))
      : (cachedWriteHealth
        ? Promise.resolve(cachedWriteHealth)
        : probeWritePath(scriptUrl, apiKey, frontendSheetId, sheetIdSource)
            .then(result => rememberWriteHealth(scriptUrl, frontendSheetId, result)));
    const [snapshot, writePathHealth] = await Promise.all([
      AdminSheetFallback.buildSnapshot({ sheetId: frontendSheetId }),
      writeHealthPromise
    ]);
    const writeActionsEnabled = !!(writePathHealth && writePathHealth.ok);
    snapshot.read_degraded = !primaryRead;
    snapshot.read_mode = primaryRead ? DEFAULT_READ_MODE : 'apps-script-fallback';
    snapshot.degraded_read_only = !writeActionsEnabled;
    snapshot.write_actions_enabled = writeActionsEnabled;
    snapshot.write_path_health = writePathHealth;
    snapshot.write_health_cache_status = String(writePathHealth && writePathHealth.cache_status || '');
    snapshot.write_health_cache_age_ms = Number(writePathHealth && writePathHealth.cache_age_ms || 0);
    snapshot.direct_writer_state = AdminDirectWriter.state(process.env);
    snapshot.frontend_sheet_id = frontendSheetId;
    snapshot.frontend_sheet_id_source = sheetIdSource;
    snapshot.frontend_proxy_version = SnapshotHealth.VERSION;
    const health = SnapshotHealth.assess(snapshot);
    const fallbackMs = Date.now() - fallbackStartedAt;
    const upstreamMs = Number(trigger && trigger.upstream_ms || 0);
    health.latency_ms = Date.now() - startedAt;
    health.checked_at = new Date().toISOString();
    health.backend_version = snapshot.admin_api_version || '';
    health.proxy_version = SnapshotHealth.VERSION;
    health.read_degraded = !primaryRead;
    health.read_mode = primaryRead ? DEFAULT_READ_MODE : 'apps-script-fallback';
    health.degraded_read_only = !writeActionsEnabled;
    health.write_actions_enabled = writeActionsEnabled;
    health.write_path_health = writePathHealth;
    health.write_health_cache_status = String(writePathHealth && writePathHealth.cache_status || '');
    health.write_health_cache_age_ms = Number(writePathHealth && writePathHealth.cache_age_ms || 0);
    health.direct_writer_state = snapshot.direct_writer_state;
    health.snapshot_source = snapshot.snapshot_source;
    health.warnings = Array.isArray(health.warnings) ? health.warnings : [];
    health.warnings.push(primaryRead
      ? (writeActionsEnabled
        ? 'Admin reads directly from Google Sheet as the primary path; lightweight Apps Script write-path health passed so writes remain enabled during the writer migration.'
        : 'Admin reads directly from Google Sheet as the primary path; the legacy Apps Script write path is not healthy, so writes remain blocked until an authenticated direct writer is accepted.')
      : (writeActionsEnabled
        ? 'Apps Script snapshot is slow/unavailable; Admin is reading from direct Google Sheet fallback, but lightweight Apps Script write-path health passed so writes remain enabled.'
        : 'Apps Script snapshot is slow/unavailable and lightweight write-path health did not pass; Admin is using direct Google Sheet read-only fallback and writes remain blocked.'));
    if (trigger && trigger.code && !primaryRead) health.warnings.push('Fallback trigger: ' + String(trigger.code));
    health.fallback_reader = snapshot.fallback_reader || '';
    health.fallback_private_attempted = !!snapshot.fallback_private_attempted;
    health.fallback_private_error_code = snapshot.fallback_private_error_code || '';

    if (!health.ok) {
      return json(res, 502, {
        ok: false,
        error: 'Direct-Sheet fallback rejected: ' + health.issues.join('; '),
        error_code: 'DIRECT_SHEET_FALLBACK_INVALID',
        fallback_trigger: trigger || {},
        snapshot_health: health
      });
    }
    res.setHeader('X-KK-Admin-Read-Mode', primaryRead ? DEFAULT_READ_MODE : 'apps-script-fallback');
    console.info(primaryRead ? 'KK_ADMIN_DIRECT_SHEET_PRIMARY' : 'KK_ADMIN_DIRECT_SHEET_FALLBACK', JSON.stringify({
      action,
      read_mode: primaryRead ? DEFAULT_READ_MODE : 'apps-script-fallback',
      trigger_code: String(trigger && trigger.code || ''),
      upstream_status: Number(trigger && trigger.upstream_status || 0),
      fallback_reader: String(snapshot.fallback_reader || ''),
      snapshot_source: String(snapshot.snapshot_source || ''),
      events: Array.isArray(snapshot.events) ? snapshot.events.length : null,
      bookings: Array.isArray(snapshot.bookings) ? snapshot.bookings.length : null,
      current_bookings: Array.isArray(snapshot.current_bookings) ? snapshot.current_bookings.length : null,
      assets: Array.isArray(snapshot.assets) ? snapshot.assets.length : null,
      upstream_ms: upstreamMs,
      fallback_ms: fallbackMs,
      latency_ms: Number(health.latency_ms || 0),
      write_health_ok: writeActionsEnabled,
      write_health_ms: Number(writePathHealth && writePathHealth.latency_ms || 0),
      write_health_error_code: String(writePathHealth && writePathHealth.error_code || ''),
      write_health_cache_status: String(writePathHealth && writePathHealth.cache_status || ''),
      write_health_cache_age_ms: Number(writePathHealth && writePathHealth.cache_age_ms || 0),
      fallback_cache_status: String(snapshot.fallback_cache_status || ''),
      upstream_circuit_open: !!(trigger && trigger.circuit_open)
    }));

    if (action === 'snapshotHealth') {
      return json(res, 200, {
        ok: true,
        data: health,
        degraded_read_only: !writeActionsEnabled,
        write_actions_enabled: writeActionsEnabled,
        read_degraded: !primaryRead,
        read_mode: primaryRead ? DEFAULT_READ_MODE : 'apps-script-fallback',
        write_path_health: writePathHealth,
        write_health_cache_status: String(writePathHealth && writePathHealth.cache_status || ''),
        write_health_cache_age_ms: Number(writePathHealth && writePathHealth.cache_age_ms || 0),
        direct_writer_state: snapshot.direct_writer_state,
        snapshot_source: snapshot.snapshot_source,
        fallback_trigger: trigger || {},
        proxy_upstream_ms: upstreamMs,
        fallback_ms: fallbackMs,
        proxy_round_trip_ms: Number(health.latency_ms || 0),
        proxy_timeout_ms: primaryRead ? WRITE_HEALTH_TIMEOUT_MS : SNAPSHOT_UPSTREAM_TIMEOUT_MS,
        fallback_cache_status: String(snapshot.fallback_cache_status || ''),
        upstream_circuit_open: !!(trigger && trigger.circuit_open)
      });
    }
    return json(res, 200, {
      ok: true,
      data: snapshot,
      snapshot_health: health,
      degraded_read_only: !writeActionsEnabled,
      write_actions_enabled: writeActionsEnabled,
      read_degraded: !primaryRead,
      read_mode: primaryRead ? DEFAULT_READ_MODE : 'apps-script-fallback',
      write_path_health: writePathHealth,
      write_health_cache_status: String(writePathHealth && writePathHealth.cache_status || ''),
      write_health_cache_age_ms: Number(writePathHealth && writePathHealth.cache_age_ms || 0),
      direct_writer_state: snapshot.direct_writer_state,
      snapshot_source: snapshot.snapshot_source,
      fallback_trigger: trigger || {},
      proxy_upstream_ms: upstreamMs,
      fallback_ms: fallbackMs,
      proxy_round_trip_ms: Number(health.latency_ms || 0),
      proxy_timeout_ms: primaryRead ? WRITE_HEALTH_TIMEOUT_MS : SNAPSHOT_UPSTREAM_TIMEOUT_MS,
      fallback_cache_status: String(snapshot.fallback_cache_status || ''),
      upstream_circuit_open: !!(trigger && trigger.circuit_open)
    });
  } catch (err) {
    const originalCode = trigger && trigger.error_code ? String(trigger.error_code) : 'DIRECT_SHEET_FALLBACK_FAILED';
    const originalError = trigger && trigger.error ? String(trigger.error) : 'Apps Script unavailable and direct-Sheet read-only fallback failed';
    const fallbackErrorCode = String(err && err.code || (err && err.name === 'AbortError' ? 'FALLBACK_TIMEOUT' : 'DIRECT_SHEET_FALLBACK_FAILED'));
    const fallbackDataset = String(err && err.dataset || '');
    console.warn('KK_ADMIN_DIRECT_SHEET_FALLBACK_FAILED', JSON.stringify({
      action,
      trigger_code: String(trigger && trigger.code || ''),
      upstream_status: Number(trigger && trigger.upstream_status || 0),
      fallback_error_code: fallbackErrorCode,
      fallback_dataset: fallbackDataset,
      fallback_ms: Date.now() - fallbackStartedAt
    }));
    return json(res, 502, {
      ok: false,
      error: originalError,
      error_code: originalCode,
      upstream_failure_class: trigger && trigger.upstream_failure_class ? String(trigger.upstream_failure_class) : (trigger && trigger.code ? String(trigger.code) : ''),
      upstream_status: Number(trigger && trigger.upstream_status || 0),
      suggestion: trigger && trigger.suggestion ? String(trigger.suggestion) : '',
      fallback_error: err && err.message ? err.message : String(err),
      fallback_error_code: fallbackErrorCode,
      fallback_dataset: fallbackDataset,
      fallback_attempted: true
    });
  }
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
  const readMode = adminReadMode(process.env);

  if (readMode === DEFAULT_READ_MODE) {
    return respondWithDirectSheetFallback(res, action, frontendSheetId, sheetIdSource, {
      code: 'DIRECT_SHEET_PRIMARY',
      error_code: '',
      error: '',
      upstream_failure_class: '',
      upstream_status: 0,
      upstream_ms: 0,
      primary_read: true
    }, Date.now(), scriptUrl, apiKey);
  }

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
  const circuit = activeUpstreamCircuit(scriptUrl, startedAt);
  if (circuit) {
    return respondWithDirectSheetFallback(res, action, frontendSheetId, sheetIdSource, {
      code: circuit.code,
      error_code: 'UPSTREAM_CIRCUIT_OPEN',
      error: 'Apps Script upstream circuit is temporarily open after a recent failure; serving the safe direct-Sheet fallback without repeating the full upstream wait.',
      upstream_failure_class: circuit.code,
      upstream_status: 0,
      upstream_ms: 0,
      circuit_open: true,
      circuit_retry_after_ms: circuit.retry_after_ms
    }, startedAt, scriptUrl, apiKey);
  }

  let upstream;
  try {
    upstream = await fetchWithTimeout(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(upstreamPayload)
    }, SNAPSHOT_UPSTREAM_TIMEOUT_MS);
  } catch (err) {
    const isTimeout = !!(err && err.name === 'AbortError');
    if (isTimeout) openUpstreamCircuit(scriptUrl, 'UPSTREAM_TIMEOUT');
    return respondWithDirectSheetFallback(res, action, frontendSheetId, sheetIdSource, {
      code: isTimeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_ERROR',
      error_code: isTimeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_ERROR',
      error: isTimeout
        ? 'Apps Script request timed out for snapshot. The proxy waited up to ' + String(SNAPSHOT_UPSTREAM_TIMEOUT_MS) + ' ms.'
        : (err && err.message ? err.message : String(err)),
      upstream_ms: Date.now() - startedAt
    }, startedAt, scriptUrl, apiKey);
  }

  const elapsed = Date.now() - startedAt;
  const contentType = upstream.headers && upstream.headers.get ? (upstream.headers.get('content-type') || '') : '';
  let data;
  try {
    data = JSON.parse(upstream.body);
  } catch (_) {
    const failure = UpstreamResponse.classifyNonJsonResponse(upstream.body, contentType, safeUrlHost(scriptUrl), upstream.status);
    console.warn('KK_ADMIN_SNAPSHOT_UPSTREAM_PROTOCOL', JSON.stringify(UpstreamResponse.safeProtocolLog({
      code: failure.code,
      status: upstream.status,
      content_type: contentType,
      host: safeUrlHost(scriptUrl),
      action: 'snapshot'
    })));
    const fallbackEligible = ['APPS_SCRIPT_DEPLOYMENT_NOT_FOUND','GOOGLE_AUTH_HTML','GOOGLE_DRIVE_DOCS_HTML'].includes(String(failure.code || '')) ||
      [408,429].includes(Number(upstream.status || 0)) || Number(upstream.status || 0) >= 500;
    if (fallbackEligible) {
      if (isDeterministicUpstreamFailure(failure.code)) openUpstreamCircuit(scriptUrl, failure.code);
      return respondWithDirectSheetFallback(res, action, frontendSheetId, sheetIdSource, {
        code: failure.code || 'SNAPSHOT_UPSTREAM_NON_JSON',
        error_code: 'SNAPSHOT_UPSTREAM_NON_JSON',
        error: failure.message,
        upstream_failure_class: failure.code || '',
        upstream_status: Number(upstream.status || 0),
        suggestion: failure.suggestion || '',
        upstream_ms: elapsed
      }, startedAt, scriptUrl, apiKey);
    }
    return json(res, 502, {
      ok: false,
      error: failure.message,
      error_code: 'SNAPSHOT_UPSTREAM_NON_JSON',
      upstream_failure_class: failure.code,
      upstream_status: upstream.status,
      suggestion: failure.suggestion,
      proxy_upstream_ms: elapsed,
      proxy_timeout_ms: SNAPSHOT_UPSTREAM_TIMEOUT_MS
    });
  }

  if (!upstream.ok || !data || data.ok !== true) {
    const upstreamStatus = Number(upstream.status || 0);
    const retryable = upstreamStatus === 429 || upstreamStatus === 408 || upstreamStatus >= 500;
    if (retryable) {
      return respondWithDirectSheetFallback(res, action, frontendSheetId, sheetIdSource, {
        code: 'SNAPSHOT_UPSTREAM_FAILED',
        error_code: 'SNAPSHOT_UPSTREAM_FAILED',
        error: data && data.error ? String(data.error) : 'Apps Script snapshot request failed',
        upstream_status: upstreamStatus,
        upstream_ms: elapsed
      }, startedAt, scriptUrl, apiKey);
    }
    return json(res, upstream.ok ? 502 : upstream.status, {
      ok: false,
      error: data && data.error ? String(data.error) : 'Apps Script snapshot request failed',
      error_code: 'SNAPSHOT_UPSTREAM_FAILED',
      upstream_status: upstream.status,
      retryable,
      backend_version: data && (data.admin_api_version || (data.data && data.data.admin_api_version)) || '',
      proxy_upstream_ms: elapsed,
      proxy_timeout_ms: SNAPSHOT_UPSTREAM_TIMEOUT_MS
    });
  }

  clearUpstreamCircuit(scriptUrl);

  if (!data.data || typeof data.data !== 'object' || Array.isArray(data.data)) {
    return json(res, 502, {
      ok: false,
      error: 'Apps Script returned ok=true but snapshot data is missing',
      error_code: 'SNAPSHOT_PAYLOAD_MISSING',
      upstream_status: upstream.status,
      upstream_contract: snapshotEnvelopeDiagnostics(data),
      proxy_upstream_ms: elapsed,
      proxy_timeout_ms: SNAPSHOT_UPSTREAM_TIMEOUT_MS
    });
  }

  const normalized = normalizeSnapshotEnvelope(data, frontendSheetId);
  if (normalized) data.data = normalized.data;

  const health = SnapshotHealth.assess(data.data);
  health.latency_ms = elapsed;
  health.checked_at = new Date().toISOString();
  health.backend_version = data.data.admin_api_version || data.admin_api_version || '';
  health.proxy_version = SnapshotHealth.VERSION;
  health.contract_path = normalized ? normalized.path : '$.data';
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
      proxy_timeout_ms: SNAPSHOT_UPSTREAM_TIMEOUT_MS
    });
  }

  if (!health.ok) {
    return json(res, 502, {
      ok: false,
      error: 'Snapshot rejected: ' + health.issues.join('; '),
      error_code: 'INVALID_SNAPSHOT',
      snapshot_health: health,
      upstream_contract: snapshotEnvelopeDiagnostics(data),
      proxy_upstream_ms: elapsed,
      proxy_timeout_ms: SNAPSHOT_UPSTREAM_TIMEOUT_MS
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

module.exports._test = {
  looksLikeAppsScriptUrl,
  compactNonJsonError,
  requestAction,
  handleSnapshot,
  normalizeSnapshotEnvelope,
  snapshotEnvelopeDiagnostics,
  hasRequiredSnapshotArrays,
  respondWithDirectSheetFallback,
  probeWritePath,
  SNAPSHOT_UPSTREAM_TIMEOUT_MS,
  WRITE_HEALTH_TIMEOUT_MS,
  WRITE_HEALTH_OK_CACHE_TTL_MS,
  WRITE_HEALTH_FAIL_CACHE_TTL_MS,
  UPSTREAM_CIRCUIT_TTL_MS,
  isDeterministicUpstreamFailure,
  openUpstreamCircuit,
  activeUpstreamCircuit,
  clearUpstreamCircuit,
  skippedWritePathHealth,
  activeWriteHealthCache,
  rememberWriteHealth,
  clearWriteHealthCache,
  adminReadMode,
  DEFAULT_READ_MODE
};
