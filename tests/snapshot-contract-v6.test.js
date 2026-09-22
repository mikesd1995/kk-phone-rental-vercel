const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('stream');

const handler = require('../api/kk-admin-snapshot-v6.js');

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

function mockUpstream(body) {
  global.fetch = async () => ({
    ok: true,
    status: 200,
    headers: { get(name) { return String(name).toLowerCase() === 'content-type' ? 'application/json' : ''; } },
    async text() { return JSON.stringify(body); }
  });
}

function setEnv() {
  process.env.KK_ADMIN_PIN = '1234';
  process.env.KK_ADMIN_API_KEY = 'api-key';
  process.env.KK_ADMIN_SCRIPT_URL = 'https://script.google.com/macros/s/test-deployment/exec';
  process.env.GOOGLE_SHEET_ID = '12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU';
  process.env.KK_ADMIN_READ_MODE = 'apps-script-first';
}

function validSnapshot() {
  return {
    ok: true,
    data: {
      events: [{ event_id: 'EVT-1' }],
      bookings: [{ booking_id: 'BK-1' }],
      current_bookings: [{ booking_id: 'BK-1' }],
      assets: [{ asset_id: 'PHONE-1' }],
      spreadsheet_id: process.env.GOOGLE_SHEET_ID,
      admin_api_version: 'v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX'
    }
  };
}

test.beforeEach(setEnv);
test.afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  global.fetch = ORIGINAL_FETCH;
});

test('classifies all-null System Guard snapshot contract without treating Sheet as empty', async () => {
  mockUpstream({ ok: true, data: { spreadsheet_id: process.env.GOOGLE_SHEET_ID } });
  const out = responseCapture();
  await handler(reqFor('snapshotHealth'), out.res);

  assert.equal(out.res.statusCode, 200);
  assert.equal(out.body.ok, true);
  assert.equal(out.body.data.ok, false);
  assert.equal(out.body.contract_classification, 'SNAPSHOT_CONTRACT_ALL_REQUIRED_ARRAYS_INVALID_AND_BACKEND_VERSION_MISSING');
  assert.match(out.body.data.warnings.join(' '), /Contract classifier/);
  assert.equal(out.headers['x-kk-snapshot-adapter-version'], 'admin-snapshot-contract-repair-v6');
});

test('keeps healthy snapshotHealth classified as valid', async () => {
  mockUpstream(validSnapshot());
  const out = responseCapture();
  await handler(reqFor('snapshotHealth'), out.res);

  assert.equal(out.res.statusCode, 200);
  assert.equal(out.body.data.ok, true);
  assert.equal(out.body.contract_classification, 'SNAPSHOT_CONTRACT_VALID');
  assert.equal(out.body.snapshot_adapter_version, 'admin-snapshot-contract-repair-v6');
});

test('keeps invalid snapshot write path fail-closed while adding classification', async () => {
  mockUpstream({ ok: true, data: { spreadsheet_id: process.env.GOOGLE_SHEET_ID } });
  const out = responseCapture();
  await handler(reqFor('snapshot'), out.res);

  assert.equal(out.res.statusCode, 502);
  assert.equal(out.body.ok, false);
  assert.equal(out.body.error_code, 'INVALID_SNAPSHOT');
  assert.equal(out.body.contract_classification, 'SNAPSHOT_CONTRACT_ALL_REQUIRED_ARRAYS_INVALID_AND_BACKEND_VERSION_MISSING');
});
