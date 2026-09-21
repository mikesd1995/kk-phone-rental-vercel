const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('stream');

const handler = require('../api/kk-admin-snapshot-v5.js');
const AdminSheetFallback = require('../server/admin-sheet-fallback.js');

const ORIGINAL_ENV = { ...process.env };
const ORIGINAL_FETCH = global.fetch;
const ORIGINAL_BUILD_SNAPSHOT = AdminSheetFallback.buildSnapshot;

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
  AdminSheetFallback.buildSnapshot = ORIGINAL_BUILD_SNAPSHOT;
});


test('caps snapshot upstream wait before entering safe read-only fallback', () => {
  assert.equal(handler._test.SNAPSHOT_UPSTREAM_TIMEOUT_MS, 12000);
  assert.equal(handler._test.WRITE_HEALTH_TIMEOUT_MS, 4000);
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
  assert.equal(out.headers['x-kk-snapshot-adapter-version'], 'admin-snapshot-upstream-error-v5.3');
});


function minimalFallbackSnapshot() {
  return {
    events: [{ event_id: 'EVT-1', event_name: 'Test', event_date: '2026-09-21', venue: 'Venue' }],
    bookings: [{ booking_id: 'BK-1', booking_status: 'confirmed', event_id: 'EVT-1' }],
    current_bookings: [{ booking_id: 'BK-1', booking_status: 'confirmed', event_id: 'EVT-1' }],
    assets: [{ asset_id: 'PHONE-1' }],
    health: [],
    spreadsheet_id: process.env.GOOGLE_SHEET_ID,
    admin_api_version: AdminSheetFallback.FALLBACK_VERSION,
    degraded_read_only: true,
    write_actions_enabled: false,
    snapshot_source: 'direct-sheet-gviz-readonly-fallback',
    fallback_reader: 'public-gviz',
    fallback_private_attempted: false,
    fallback_private_error_code: ''
  };
}

test('keeps writes enabled when fallback read is used but lightweight write-path health passes', async () => {
  AdminSheetFallback.buildSnapshot = async () => minimalFallbackSnapshot();
  mockUpstream({
    body: {
      ok: true,
      data: {
        admin_api_version: 'v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX',
        spreadsheet_id: process.env.GOOGLE_SHEET_ID
      }
    }
  });

  const out = responseCapture();
  await handler._test.respondWithDirectSheetFallback(
    out.res,
    'snapshot',
    process.env.GOOGLE_SHEET_ID,
    'env',
    { code: 'UPSTREAM_TIMEOUT', error_code: 'UPSTREAM_TIMEOUT', upstream_ms: 12001 },
    Date.now(),
    process.env.KK_ADMIN_SCRIPT_URL,
    process.env.KK_ADMIN_API_KEY
  );

  assert.equal(out.res.statusCode, 200);
  assert.equal(out.body.ok, true);
  assert.equal(out.body.read_degraded, true);
  assert.equal(out.body.degraded_read_only, false);
  assert.equal(out.body.write_actions_enabled, true);
  assert.equal(out.body.write_path_health.ok, true);
  assert.equal(out.body.data.read_degraded, true);
  assert.equal(out.body.data.degraded_read_only, false);
  assert.equal(out.body.data.write_actions_enabled, true);
  assert.equal(out.body.snapshot_health.write_actions_enabled, true);
});

test('keeps writes blocked when lightweight write-path identity does not match production', async () => {
  AdminSheetFallback.buildSnapshot = async () => minimalFallbackSnapshot();
  mockUpstream({
    body: {
      ok: true,
      data: {
        admin_api_version: 'v16.7.0_CRM_PRO_PHASE3_9_5_8_SNAPSHOT_TIMEOUT_STABILITY_FIX',
        spreadsheet_id: process.env.GOOGLE_SHEET_ID
      }
    }
  });

  const out = responseCapture();
  await handler._test.respondWithDirectSheetFallback(
    out.res,
    'snapshot',
    process.env.GOOGLE_SHEET_ID,
    'env',
    { code: 'UPSTREAM_TIMEOUT', error_code: 'UPSTREAM_TIMEOUT', upstream_ms: 12001 },
    Date.now(),
    process.env.KK_ADMIN_SCRIPT_URL,
    process.env.KK_ADMIN_API_KEY
  );

  assert.equal(out.res.statusCode, 200);
  assert.equal(out.body.ok, true);
  assert.equal(out.body.degraded_read_only, true);
  assert.equal(out.body.write_actions_enabled, false);
  assert.equal(out.body.write_path_health.ok, false);
  assert.equal(out.body.write_path_health.error_code, 'WRITE_HEALTH_IDENTITY_MISMATCH');
  assert.equal(out.body.data.degraded_read_only, true);
  assert.equal(out.body.data.write_actions_enabled, false);
});


test('keeps writes blocked when lightweight write-path reports a different backend Sheet', async () => {
  AdminSheetFallback.buildSnapshot = async () => minimalFallbackSnapshot();
  mockUpstream({
    body: {
      ok: true,
      data: {
        admin_api_version: 'v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX',
        spreadsheet_id: 'different-sheet-id'
      }
    }
  });

  const out = responseCapture();
  await handler._test.respondWithDirectSheetFallback(
    out.res,
    'snapshot',
    process.env.GOOGLE_SHEET_ID,
    'env',
    { code: 'UPSTREAM_TIMEOUT', error_code: 'UPSTREAM_TIMEOUT', upstream_ms: 12001 },
    Date.now(),
    process.env.KK_ADMIN_SCRIPT_URL,
    process.env.KK_ADMIN_API_KEY
  );

  assert.equal(out.res.statusCode, 200);
  assert.equal(out.body.degraded_read_only, true);
  assert.equal(out.body.write_actions_enabled, false);
  assert.equal(out.body.write_path_health.ok, false);
  assert.equal(out.body.write_path_health.error_code, 'WRITE_HEALTH_IDENTITY_MISMATCH');
  assert.equal(out.body.write_path_health.spreadsheet_id, 'different-sheet-id');
});


test('uses direct-Sheet read-only fallback when Apps Script deployment is missing and GViz is healthy', async () => {
  const csv = {
    '01_Events': '"event_id","event_name","event_date","venue","poster_image_url","event_status","active_on_web","event_note","data_health"\n"EV1","Test","19/09/2026","Venue","","open","TRUE","","OK"\n',
    '00_Master_Booking': '"booking_id","created_at","booking_status","event_id","customer_name","customer_contact","customer_phone","channel","package_type","phone_asset_id","lens_asset_id","pickup_time","return_time","payment_status","amount_received","return_status","file_transfer_status","drive_link","damage_fee","staff_note"\n"BK1","","confirmed","EV1","A","","","LINE","phone_only","P1","","12:00","","paid","690","","","","0",""\n',
    '02_Assets': '"asset_id","asset_type","model_group","serial_no","status","notes","rentable_now"\n"P1","phone","VIVO_X300_PRO","","available","","TRUE"\n',
    '03_Packages': '"template_id","model_group","package_type","lens_group","standard_price","display_name","package_note","active","sort_order","use_case"\n"TPL1","VIVO_X300_PRO","phone_only","NONE","690","Vivo X300 Pro","","TRUE","1",""\n',
    '04_Event_Overrides': '"event_id","template_id","override_price","active_override","override_note","sort_order_override","use_case_override"\n',
    '08_Web_Ready': '"event_id","event_name","event_date_text","venue","poster_image_url","event_note","available_phone_count","available_lens_count","booking_status_for_web","action_for_web","line_message_template"\n',
    '09_Web_Packages': '"package_id","event_id","package_type","model_group","model_display","lens_group","lens_display","price","available_count","package_status","sort_order","web_note","raw_available_count","use_case"\n',
    '11_Customer_Stats': '"customer_key","customer_name","customer_contact","customer_phone","rental_count","first_rental_date","last_rental_date","last_event_name"\n',
    '10_Admin_Health_Check': '"Check","Count","Status","What to fix"\n"Source count — Events","1","OK",""\n"Source count — Bookings","1","OK",""\n"Source count — Assets","1","OK",""\n',
    'Model_Master': '"model_group","model_display","asset_type","active","notes"\n"VIVO_X300_PRO","Vivo X300 Pro","phone","TRUE",""\n'
  };
  global.fetch = async (url) => {
    if (String(url).startsWith('https://script.google.com/')) {
      return { ok:false, status:404, headers:{get:()=> 'text/html; charset=utf-8'}, async text(){ return '<html><title>Page not found</title></html>'; } };
    }
    const u = new URL(String(url));
    const sheet = u.searchParams.get('sheet');
    const spec = Object.values(AdminSheetFallback.SPECS).find(item => item.sheet === sheet);
    assert.ok(spec, 'unexpected fallback sheet '+sheet);
    assert.equal(u.searchParams.get('range'), spec.range);
    assert.ok(Object.prototype.hasOwnProperty.call(csv, sheet), 'unexpected fallback sheet '+sheet);
    return { ok:true, status:200, headers:{get:()=> 'text/csv'}, async text(){ return csv[sheet]; } };
  };
  const out=responseCapture();
  await handler(reqFor('snapshot'),out.res);
  assert.equal(out.res.statusCode,200);
  assert.equal(out.body.ok,true);
  assert.equal(out.body.degraded_read_only,true);
  assert.equal(out.body.data.degraded_read_only,true);
  assert.equal(out.body.data.write_actions_enabled,false);
  assert.equal(out.body.data.events.length,1);
  assert.equal(out.body.data.bookings.length,1);
  assert.equal(out.body.data.current_bookings.length,1);
  assert.equal(out.body.data.assets.length,1);
  assert.equal(out.body.snapshot_health.ok,true);
  assert.equal(out.body.fallback_trigger.upstream_failure_class,'APPS_SCRIPT_DEPLOYMENT_NOT_FOUND');
  assert.equal(out.body.proxy_timeout_ms,12000);
  assert.equal(typeof out.body.proxy_upstream_ms,'number');
  assert.equal(typeof out.body.fallback_ms,'number');
  assert.equal(typeof out.body.proxy_round_trip_ms,'number');
});
