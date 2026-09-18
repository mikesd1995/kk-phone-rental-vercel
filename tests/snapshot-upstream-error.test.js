const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('stream');

const handler = require('../api/kk-admin-snapshot-v5.js');

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = global.fetch;

function reqFor(action, pin='1234') {
  const req = Readable.from([JSON.stringify({ action })]);
  req.method = 'POST';
  req.url = '/api/kk-admin';
  req.headers = { 'x-admin-pin': pin };
  return req;
}

function responseCapture() {
  let body;
  const headers = {};
  return {
    res: {
      statusCode: 200,
      setHeader(k, v) { headers[String(k).toLowerCase()] = v; },
      end(v) { body = v ? JSON.parse(v) : null; }
    },
    get body() { return body; },
    get headers() { return headers; }
  };
}

function mockUpstream({ ok=true, status=200, contentType='application/json', body }) {
  global.fetch = async () => ({
    ok,
    status,
    headers: { get(name) { return String(name).toLowerCase() === 'content-type' ? contentType : ''; } },
    async text() { return typeof body === 'string' ? body : JSON.stringify(body); }
  });
}

function setEnv() {
  process.env.KK_ADMIN_PIN = '1234';
  process.env.KK_ADMIN_API_KEY = 'api-key';
  process.env.KK_ADMIN_SCRIPT_URL = 'https://script.google.com/macros/s/test-deployment/exec';
  process.env.GOOGLE_SHEET_ID = '12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU';
}

function validSnapshot() {
  return {
    ok: true,
    data: {
      events: [{ event_id: 'EVT-1' }],
      bookings: [{ booking_id: 'BK-1', booking_status: 'confirmed' }],
      current_bookings: [{ booking_id: 'BK-1', booking_status: 'confirmed' }],
      assets: [{ asset_id: 'PHONE-1' }],
      health: [],
      spreadsheet_id: '12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU',
      admin_api_version: 'v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX'
    }
  };
}

test.beforeEach(() => {
  setEnv();
});

test.afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  global.fetch = ORIGINAL_FETCH;
});

test('preserves Apps Script JSON error instead of rewriting it as missing arrays', async () => {
  mockUpstream({ body: { ok: false, error: 'API key mismatch' } });
  const out = responseCapture();
  await handler(reqFor('snapshot'), out.res);

  assert.equal(out.res.statusCode, 502);
  assert.equal(out.body.ok, false);
  assert.equal(out.body.error_code, 'SNAPSHOT_UPSTREAM_FAILED');
  assert.equal(out.body.error, 'API key mismatch');
  assert.equal(String(out.body.error).includes('missing or invalid array'), false);
});

test('reports non-JSON Apps Script response as upstream protocol failure', async () => {
  mockUpstream({ contentType: 'text/html', body: '<html><title>Sign in</title></html>' });
  const out = responseCapture();
  await handler(reqFor('snapshot'), out.res);

  assert.equal(out.res.statusCode, 502);
  assert.equal(out.body.error_code, 'SNAPSHOT_UPSTREAM_NON_JSON');
  assert.equal(out.body.upstream_failure_class, 'GOOGLE_AUTH_HTML');
  assert.match(out.body.error, /sign-in\/auth page instead of JSON/);
  assert.match(out.body.suggestion, /incognito/i);
});

test('preserves HTTP 404 Apps Script deployment-not-found as the upstream root cause', async () => {
  mockUpstream({ ok: false, status: 404, contentType: 'text/html; charset=utf-8', body: '<html><title>Page not found</title><body>Not Found</body></html>' });
  const out = responseCapture();
  await handler(reqFor('snapshotHealth'), out.res);

  assert.equal(out.res.statusCode, 502);
  assert.equal(out.body.error_code, 'SNAPSHOT_UPSTREAM_NON_JSON');
  assert.equal(out.body.upstream_failure_class, 'APPS_SCRIPT_DEPLOYMENT_NOT_FOUND');
  assert.equal(out.body.upstream_status, 404);
  assert.match(out.body.error, /deployment returned HTTP 404/i);
  assert.match(out.body.suggestion, /Manage deployments/);
  assert.equal(String(out.body.error).includes('missing or invalid array'), false);
});

test('keeps INVALID_SNAPSHOT only for ok=true payloads whose snapshot shape is actually invalid', async () => {
  mockUpstream({ body: { ok: true, data: { spreadsheet_id: process.env.GOOGLE_SHEET_ID } } });
  const out = responseCapture();
  await handler(reqFor('snapshot'), out.res);

  assert.equal(out.res.statusCode, 502);
  assert.equal(out.body.error_code, 'INVALID_SNAPSHOT');
  assert.match(out.body.error, /events: missing or invalid array/);
});

test('passes a healthy snapshot and attaches snapshot health metadata', async () => {
  mockUpstream({ body: validSnapshot() });
  const out = responseCapture();
  await handler(reqFor('snapshot'), out.res);

  assert.equal(out.res.statusCode, 200);
  assert.equal(out.body.ok, true);
  assert.equal(out.body.data.events.length, 1);
  assert.equal(out.body.snapshot_health.ok, true);
  assert.equal(out.body.data.frontend_sheet_id, process.env.GOOGLE_SHEET_ID);
  assert.equal(out.headers['x-kk-snapshot-adapter-version'], 'admin-snapshot-upstream-error-v5.1');
});
