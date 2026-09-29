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
  process.env.KK_ADMIN_READ_MODE = 'apps-script-first';
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
  handler._test.clearUpstreamCircuit();
  if (handler._test.clearWriteHealthCache) handler._test.clearWriteHealthCache();
  if (AdminSheetFallback.clearSnapshotCache) AdminSheetFallback.clearSnapshotCache();
});

test.afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  global.fetch = ORIGINAL_FETCH;
  AdminSheetFallback.buildSnapshot = ORIGINAL_BUILD_SNAPSHOT;
  handler._test.clearUpstreamCircuit();
  if (handler._test.clearWriteHealthCache) handler._test.clearWriteHealthCache();
  if (AdminSheetFallback.clearSnapshotCache) AdminSheetFallback.clearSnapshotCache();
});


test('caps snapshot upstream wait before entering safe read-only fallback', () => {
  assert.equal(handler._test.SNAPSHOT_UPSTREAM_TIMEOUT_MS, 12000);
  assert.equal(handler._test.WRITE_HEALTH_TIMEOUT_MS, 10000);
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
  assert.equal(out.headers['x-kk-snapshot-adapter-version'], 'admin-snapshot-upstream-error-v5.6');
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

test('marks a pure write-health timeout as transient-attempt instead of deterministic read-only', async () => {
  AdminSheetFallback.buildSnapshot = async () => minimalFallbackSnapshot();
  handler._test.rememberWriteHealth(process.env.KK_ADMIN_SCRIPT_URL, process.env.GOOGLE_SHEET_ID, {
    checked:true, skipped:false, ok:false, status:0, latency_ms:10000,
    error_code:'WRITE_HEALTH_TIMEOUT', backend_version:'', spreadsheet_id:''
  }, Date.now());

  const out = responseCapture();
  await handler._test.respondWithDirectSheetFallback(
    out.res,
    'snapshot',
    process.env.GOOGLE_SHEET_ID,
    'env',
    { code:'DIRECT_SHEET_PRIMARY', primary_read:true, upstream_ms:0 },
    Date.now(),
    process.env.KK_ADMIN_SCRIPT_URL,
    process.env.KK_ADMIN_API_KEY
  );

  assert.equal(out.res.statusCode, 200);
  assert.equal(out.body.write_actions_enabled, false);
  assert.equal(out.body.degraded_read_only, true);
  assert.equal(out.body.legacy_write_attempt_allowed, true);
  assert.equal(out.body.write_admission_mode, 'transient-attempt');
  assert.equal(out.body.data.legacy_write_attempt_allowed, true);
  assert.equal(out.body.data.write_admission_mode, 'transient-attempt');
  assert.equal(out.body.snapshot_health.legacy_write_attempt_allowed, true);
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
    'Model_Master': '"model_group","model_display","asset_type","active","notes"\n"VIVO_X300_PRO","Vivo X300 Pro","phone","TRUE",""\n',
    '18_Event_Visibility_Locks': '"lock_id","event_id","event_name","event_date","venue","identity_key","lock_state","lock_reason","first_locked_at","last_changed_at","changed_by","explicit_reopen_required","source_evidence","notes"\n'
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


test('skips redundant write-health probe after deterministic Apps Script deployment failure', async () => {
  AdminSheetFallback.buildSnapshot = async () => minimalFallbackSnapshot();
  let upstreamCalls = 0;
  global.fetch = async () => {
    upstreamCalls++;
    throw new Error('write-health probe should have been skipped');
  };
  const out = responseCapture();
  await handler._test.respondWithDirectSheetFallback(
    out.res,
    'snapshot',
    process.env.GOOGLE_SHEET_ID,
    'env',
    {
      code: 'APPS_SCRIPT_DEPLOYMENT_NOT_FOUND',
      error_code: 'SNAPSHOT_UPSTREAM_NON_JSON',
      upstream_failure_class: 'APPS_SCRIPT_DEPLOYMENT_NOT_FOUND',
      upstream_status: 404,
      upstream_ms: 25
    },
    Date.now(),
    process.env.KK_ADMIN_SCRIPT_URL,
    process.env.KK_ADMIN_API_KEY
  );
  assert.equal(out.res.statusCode, 200);
  assert.equal(out.body.ok, true);
  assert.equal(out.body.write_actions_enabled, false);
  assert.equal(out.body.write_path_health.checked, false);
  assert.equal(out.body.write_path_health.skipped, true);
  assert.equal(out.body.write_path_health.error_code, 'WRITE_HEALTH_UPSTREAM_UNAVAILABLE');
  assert.equal(upstreamCalls, 0);
});

test('upstream circuit is URL-scoped and expires fail-safe', () => {
  const url = process.env.KK_ADMIN_SCRIPT_URL;
  const other = 'https://script.google.com/macros/s/other-deployment/exec';
  handler._test.clearUpstreamCircuit();
  assert.equal(handler._test.activeUpstreamCircuit(url, 1000), null);
  handler._test.openUpstreamCircuit(url, 'UPSTREAM_TIMEOUT', 1000);
  const active = handler._test.activeUpstreamCircuit(url, 1001);
  assert.equal(active.code, 'UPSTREAM_TIMEOUT');
  assert.equal(active.retry_after_ms, handler._test.UPSTREAM_CIRCUIT_TTL_MS - 1);
  assert.equal(handler._test.activeUpstreamCircuit(other, 1001), null);
  assert.equal(handler._test.activeUpstreamCircuit(url, 1000 + handler._test.UPSTREAM_CIRCUIT_TTL_MS + 1), null);
});


test('direct-Sheet is the default primary snapshot path and skips the 12s Apps Script snapshot call', async () => {
  process.env.KK_ADMIN_READ_MODE = 'direct-sheet-primary';
  AdminSheetFallback.buildSnapshot = async () => minimalFallbackSnapshot();
  const actions = [];
  global.fetch = async (_url, options) => {
    const body = JSON.parse(String(options && options.body || '{}'));
    actions.push(body.action || '');
    return {
      ok: true,
      status: 200,
      headers: { get: () => 'application/json; charset=utf-8' },
      async text() {
        return JSON.stringify({
          ok: true,
          data: {
            admin_api_version: 'v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX',
            spreadsheet_id: process.env.GOOGLE_SHEET_ID
          }
        });
      }
    };
  };
  const out = responseCapture();
  await handler(reqFor('snapshot'), out.res);
  assert.equal(out.res.statusCode, 200);
  assert.equal(out.body.ok, true);
  assert.equal(out.body.read_degraded, false);
  assert.equal(out.body.read_mode, 'direct-sheet-primary');
  assert.equal(out.body.data.read_degraded, false);
  assert.equal(out.body.data.read_mode, 'direct-sheet-primary');
  assert.equal(out.body.proxy_upstream_ms, 0);
  assert.equal(out.body.fallback_trigger.code, 'DIRECT_SHEET_PRIMARY');
  assert.equal(out.body.write_actions_enabled, true);
  assert.deepEqual(actions, ['phase1Health']);
  assert.equal(out.headers['x-kk-admin-read-mode'], 'direct-sheet-primary');
});

test('direct-Sheet primary read remains available when legacy Apps Script configuration is missing', async () => {
  process.env.KK_ADMIN_READ_MODE = 'direct-sheet-primary';
  delete process.env.KK_ADMIN_SCRIPT_URL;
  delete process.env.KK_ADMIN_API_KEY;
  AdminSheetFallback.buildSnapshot = async () => minimalFallbackSnapshot();
  let networkCalls = 0;
  global.fetch = async () => { networkCalls++; throw new Error('legacy Apps Script should not be required for primary reads'); };
  const out = responseCapture();
  await handler(reqFor('snapshot'), out.res);
  assert.equal(out.res.statusCode, 200);
  assert.equal(out.body.ok, true);
  assert.equal(out.body.read_degraded, false);
  assert.equal(out.body.read_mode, 'direct-sheet-primary');
  assert.equal(out.body.degraded_read_only, true);
  assert.equal(out.body.write_actions_enabled, false);
  assert.equal(out.body.write_path_health.skipped, true);
  assert.equal(networkCalls, 0);
});

test('apps-script-first remains an explicit rollback mode', () => {
  assert.equal(handler._test.adminReadMode({}), 'direct-sheet-primary');
  assert.equal(handler._test.adminReadMode({KK_ADMIN_READ_MODE:'apps-script-first'}), 'apps-script-first');
  assert.equal(handler._test.adminReadMode({KK_ADMIN_READ_MODE:'unknown'}), 'direct-sheet-primary');
});


test('write-health cache reuses a recent healthy identity result and expires on schedule',()=>{
  const url=process.env.KK_ADMIN_SCRIPT_URL;
  const sheet=process.env.GOOGLE_SHEET_ID;
  const remembered=handler._test.rememberWriteHealth(url,sheet,{
    checked:true,skipped:false,ok:true,status:200,latency_ms:120,
    error_code:'',failure_class:'',backend_version:'v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX',
    spreadsheet_id:sheet
  },1000);
  assert.equal(remembered.cache_status,'miss');
  const hit=handler._test.activeWriteHealthCache(url,sheet,1001);
  assert.equal(hit.ok,true);
  assert.equal(hit.cache_status,'hit');
  assert.equal(hit.cache_age_ms,1);
  assert.equal(handler._test.activeWriteHealthCache(url,sheet,1000+handler._test.WRITE_HEALTH_OK_CACHE_TTL_MS+1),null);
});


test('write-health stability tolerates only the first transient failure after a recent verified success',()=>{
  const url=process.env.KK_ADMIN_SCRIPT_URL;
  const sheet=process.env.GOOGLE_SHEET_ID;
  const healthy=handler._test.stabilizeWriteHealth(url,sheet,{
    checked:true,skipped:false,ok:true,status:200,latency_ms:180,
    error_code:'',backend_version:'v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX',
    spreadsheet_id:sheet
  },1000);
  assert.equal(healthy.ok,true);
  assert.equal(healthy.stability_state,'healthy');

  const first=handler._test.stabilizeWriteHealth(url,sheet,{
    checked:true,skipped:false,ok:false,status:0,latency_ms:10000,
    error_code:'WRITE_HEALTH_TIMEOUT',backend_version:'',spreadsheet_id:''
  },2000);
  assert.equal(first.ok,true);
  assert.equal(first.grace_used,true);
  assert.equal(first.probe_error_code,'WRITE_HEALTH_TIMEOUT');
  assert.equal(first.transient_failures,1);
  assert.equal(first.stability_state,'transient-grace');
  assert.equal(first.backend_version,healthy.backend_version);
  assert.equal(first.spreadsheet_id,sheet);

  const second=handler._test.stabilizeWriteHealth(url,sheet,{
    checked:true,skipped:false,ok:false,status:0,latency_ms:10000,
    error_code:'WRITE_HEALTH_TIMEOUT',backend_version:'',spreadsheet_id:''
  },3000);
  assert.equal(second.ok,false);
  assert.equal(second.grace_used,false);
  assert.equal(second.transient_failures,2);
  assert.equal(second.stability_state,'transient-fail-closed');
  assert.equal(second.error_code,'WRITE_HEALTH_TIMEOUT');
});

test('write-health stability never masks deterministic identity or protocol failures',()=>{
  const url=process.env.KK_ADMIN_SCRIPT_URL;
  const sheet=process.env.GOOGLE_SHEET_ID;
  handler._test.stabilizeWriteHealth(url,sheet,{
    checked:true,ok:true,status:200,latency_ms:100,error_code:'',
    backend_version:'v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX',spreadsheet_id:sheet
  },1000);
  const hard=handler._test.stabilizeWriteHealth(url,sheet,{
    checked:true,ok:false,status:404,latency_ms:50,
    error_code:'APPS_SCRIPT_DEPLOYMENT_NOT_FOUND',backend_version:'',spreadsheet_id:''
  },1100);
  assert.equal(hard.ok,false);
  assert.equal(hard.grace_used,false);
  assert.equal(hard.stability_state,'hard-fail');
  assert.equal(hard.error_code,'APPS_SCRIPT_DEPLOYMENT_NOT_FOUND');
});

test('write-health stability requires a recent healthy identity before transient grace',()=>{
  const url=process.env.KK_ADMIN_SCRIPT_URL;
  const sheet=process.env.GOOGLE_SHEET_ID;
  const timeout=handler._test.stabilizeWriteHealth(url,sheet,{
    checked:true,ok:false,status:0,latency_ms:10000,
    error_code:'WRITE_HEALTH_TIMEOUT',backend_version:'',spreadsheet_id:''
  },1000);
  assert.equal(timeout.ok,false);
  assert.equal(timeout.grace_used,false);
  assert.equal(timeout.stability_state,'transient-no-recent-good');
});

test('transient-grace cache is intentionally short so a second probe arrives quickly',()=>{
  const url=process.env.KK_ADMIN_SCRIPT_URL;
  const sheet=process.env.GOOGLE_SHEET_ID;
  const remembered=handler._test.rememberWriteHealth(url,sheet,{
    checked:true,ok:true,status:0,latency_ms:10000,error_code:'',
    probe_error_code:'WRITE_HEALTH_TIMEOUT',backend_version:'v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX',
    spreadsheet_id:sheet,grace_used:true,stability_state:'transient-grace',transient_failures:1
  },5000);
  assert.equal(remembered.cache_status,'miss');
  assert.equal(handler._test.activeWriteHealthCache(url,sheet,5000+handler._test.WRITE_HEALTH_TRANSIENT_CACHE_TTL_MS-1).ok,true);
  assert.equal(handler._test.activeWriteHealthCache(url,sheet,5000+handler._test.WRITE_HEALTH_TRANSIENT_CACHE_TTL_MS+1),null);
});

test('write-health cache uses a shorter TTL for failures',()=>{
  const url=process.env.KK_ADMIN_SCRIPT_URL;
  const sheet=process.env.GOOGLE_SHEET_ID;
  handler._test.rememberWriteHealth(url,sheet,{
    checked:true,skipped:false,ok:false,status:0,latency_ms:4000,
    error_code:'WRITE_HEALTH_TIMEOUT',failure_class:'UPSTREAM_TIMEOUT',backend_version:'',spreadsheet_id:''
  },2000);
  const hit=handler._test.activeWriteHealthCache(url,sheet,2001);
  assert.equal(hit.ok,false);
  assert.equal(hit.cache_status,'hit');
  assert.equal(handler._test.activeWriteHealthCache(url,sheet,2000+handler._test.WRITE_HEALTH_FAIL_CACHE_TTL_MS+1),null);
});

test('direct primary snapshots reuse one recent write-health probe on the same warm runtime',async()=>{
  process.env.KK_ADMIN_READ_MODE='direct-sheet-primary';
  AdminSheetFallback.buildSnapshot=async()=>minimalFallbackSnapshot();
  let phase1Calls=0;
  global.fetch=async(_url,options)=>{
    const body=JSON.parse(String(options&&options.body||'{}'));
    if(body.action==='phase1Health') phase1Calls++;
    return {
      ok:true,status:200,headers:{get:()=> 'application/json; charset=utf-8'},
      async text(){return JSON.stringify({ok:true,data:{
        admin_api_version:'v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX',
        spreadsheet_id:process.env.GOOGLE_SHEET_ID
      }});}
    };
  };

  const a=responseCapture();
  await handler(reqFor('snapshot'),a.res);
  const b=responseCapture();
  await handler(reqFor('snapshot'),b.res);
  assert.equal(a.res.statusCode,200);
  assert.equal(b.res.statusCode,200);
  assert.equal(phase1Calls,1);
  assert.equal(a.body.write_health_cache_status,'miss');
  assert.equal(b.body.write_health_cache_status,'hit');
});
