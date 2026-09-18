'use strict';

const crypto = require('node:crypto');
const UpstreamResponse = require('../server/upstream-response.js');

const DEFAULT_TIMEOUT_MS = 15000;

function fingerprint(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex').slice(0, 16);
}

function validateAppsScriptExecUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return { ok: false, code: 'APPS_SCRIPT_URL_MISSING', message: 'KK_ADMIN_SCRIPT_URL is empty.' };
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, code: 'APPS_SCRIPT_URL_INVALID', message: 'KK_ADMIN_SCRIPT_URL is not a valid URL.' };
  }

  if (url.protocol !== 'https:') {
    return { ok: false, code: 'APPS_SCRIPT_URL_NOT_HTTPS', message: 'Apps Script Web App URL must use HTTPS.' };
  }
  if (url.hostname.toLowerCase() !== 'script.google.com') {
    return { ok: false, code: 'APPS_SCRIPT_URL_WRONG_HOST', message: 'Apps Script Web App URL must use script.google.com.' };
  }
  if (url.search || url.hash) {
    return { ok: false, code: 'APPS_SCRIPT_URL_HAS_QUERY_OR_FRAGMENT', message: 'Use the canonical Web App /exec URL without query or fragment.' };
  }

  const match = url.pathname.match(/^\/macros\/s\/([^/]+)\/exec$/);
  if (!match) {
    return {
      ok: false,
      code: 'APPS_SCRIPT_URL_NOT_EXEC',
      message: 'URL must match https://script.google.com/macros/s/<deployment-id>/exec. Do not use /dev, editor, Drive, or Sheet URLs.'
    };
  }

  return {
    ok: true,
    host: url.hostname.toLowerCase(),
    path_kind: 'exec',
    deployment_fingerprint: fingerprint(match[1]),
    url_fingerprint: fingerprint(raw)
  };
}

function pickSafeBackendMetadata(json) {
  const roots = [json, json && json.data, json && json.result, json && json.payload].filter(
    (x) => x && typeof x === 'object' && !Array.isArray(x)
  );
  const safeKeys = ['version', 'backend', 'backend_version', 'backend_revision', 'script_version'];
  const metadata = {};

  for (const root of roots) {
    for (const key of safeKeys) {
      if (metadata[key] !== undefined) continue;
      const value = root[key];
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        metadata[key] = String(value).slice(0, 160);
      }
    }
  }
  return metadata;
}

function safeJsonStatus(json) {
  const out = {};
  if (json && typeof json === 'object' && !Array.isArray(json)) {
    if (typeof json.ok === 'boolean') out.ok = json.ok;
    if (typeof json.error_code === 'string') out.error_code = json.error_code.slice(0, 120);
    if (typeof json.status === 'string') out.status = json.status.slice(0, 120);
  }
  return out;
}

async function verifyAppsScriptUpstream(options = {}) {
  const scriptUrl = String(options.scriptUrl || '').trim();
  const apiKey = String(options.apiKey || '').trim();
  const validateOnly = Boolean(options.validateOnly);
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  const urlCheck = validateAppsScriptExecUrl(scriptUrl);
  if (!urlCheck.ok) {
    return {
      ok: false,
      stage: 'url_validation',
      classification: urlCheck.code,
      message: urlCheck.message
    };
  }

  const base = {
    host: urlCheck.host,
    path_kind: urlCheck.path_kind,
    deployment_fingerprint: urlCheck.deployment_fingerprint,
    url_fingerprint: urlCheck.url_fingerprint
  };

  if (validateOnly) {
    return {
      ok: true,
      stage: 'url_validation',
      classification: 'APPS_SCRIPT_EXEC_URL_VALID',
      ...base
    };
  }

  if (!apiKey) {
    return {
      ok: false,
      stage: 'configuration',
      classification: 'APPS_SCRIPT_API_KEY_MISSING',
      message: 'KK_ADMIN_API_KEY is required for the read-only snapshotHealth probe.',
      ...base
    };
  }

  if (typeof fetchImpl !== 'function') {
    return {
      ok: false,
      stage: 'transport',
      classification: 'FETCH_UNAVAILABLE',
      message: 'fetch is unavailable in this runtime.',
      ...base
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  let bodyText;
  try {
    response = await fetchImpl(scriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'snapshotHealth', apiKey }),
      signal: controller.signal,
      redirect: 'follow'
    });
    bodyText = await response.text();
  } catch (error) {
    return {
      ok: false,
      stage: 'transport',
      classification: error && error.name === 'AbortError' ? 'APPS_SCRIPT_PROBE_TIMEOUT' : 'APPS_SCRIPT_TRANSPORT_ERROR',
      message: error && error.name === 'AbortError'
        ? 'Read-only snapshotHealth probe timed out.'
        : 'Read-only snapshotHealth probe failed at transport level.',
      ...base
    };
  } finally {
    clearTimeout(timer);
  }

  const contentType = String(response.headers && response.headers.get
    ? response.headers.get('content-type') || ''
    : '').slice(0, 120);

  let json;
  try {
    json = JSON.parse(bodyText);
  } catch {
    const failure = UpstreamResponse.classifyNonJsonResponse(
      bodyText,
      contentType,
      urlCheck.host,
      response.status
    );
    return {
      ok: false,
      stage: 'protocol',
      classification: failure.code,
      upstream_status: Number(response.status || 0),
      content_type: contentType,
      message: failure.message,
      suggestion: failure.suggestion,
      ...base
    };
  }

  const status = safeJsonStatus(json);
  return {
    ok: response.ok && status.ok !== false,
    stage: 'json_response',
    classification: status.ok === false ? 'APPS_SCRIPT_JSON_APP_ERROR' : 'APPS_SCRIPT_JSON_RESPONSE',
    upstream_status: Number(response.status || 0),
    content_type: contentType,
    ...status,
    backend_metadata: pickSafeBackendMetadata(json),
    ...base
  };
}

function parseCli(argv) {
  const args = new Set(argv.slice(2));
  const validateOnly = args.has('--validate-only');
  const unknown = [...args].filter((x) => x !== '--validate-only');
  if (unknown.length) {
    return { error: 'Unknown arguments: ' + unknown.join(', ') };
  }
  return { validateOnly };
}

async function main() {
  const parsed = parseCli(process.argv);
  if (parsed.error) {
    process.stderr.write(JSON.stringify({ ok: false, classification: 'CLI_ARGUMENT_ERROR', message: parsed.error }) + '\n');
    process.exitCode = 2;
    return;
  }

  const report = await verifyAppsScriptUpstream({
    scriptUrl: process.env.KK_ADMIN_SCRIPT_URL,
    apiKey: process.env.KK_ADMIN_API_KEY,
    validateOnly: parsed.validateOnly
  });

  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  process.exitCode = report.ok ? 0 : 1;
}

if (require.main === module) {
  main().catch(() => {
    process.stderr.write(JSON.stringify({
      ok: false,
      stage: 'internal',
      classification: 'RECOVERY_VERIFIER_INTERNAL_ERROR',
      message: 'Verifier failed unexpectedly. No secret or response body was printed.'
    }) + '\n');
    process.exitCode = 1;
  });
}

module.exports = {
  fingerprint,
  validateAppsScriptExecUrl,
  pickSafeBackendMetadata,
  verifyAppsScriptUpstream
};
