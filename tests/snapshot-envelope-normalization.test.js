'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {Readable}=require('stream');
const handler=require('../server/legacy/kk-admin-snapshot-v5.js');

const ORIGINAL_ENV={...process.env};
const ORIGINAL_FETCH=global.fetch;
const SHEET='12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU';
const BACKEND='v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX';

function reqFor(action='snapshot'){
  const req=Readable.from([JSON.stringify({action})]);
  req.method='POST';
  req.url='/api/kk-admin';
  req.headers={'x-admin-pin':'1234'};
  return req;
}

function responseCapture(){
  let body;
  const headers={};
  return {
    res:{
      statusCode:200,
      setHeader(k,v){headers[String(k).toLowerCase()]=v;},
      end(v){body=v?JSON.parse(v):null;}
    },
    get body(){return body;},
    get headers(){return headers;}
  };
}

function snapshotData(){
  return {
    events:[{event_id:'EVT-1'}],
    bookings:[{booking_id:'BK-1',booking_status:'confirmed'}],
    current_bookings:[{booking_id:'BK-1',booking_status:'confirmed'}],
    assets:[{asset_id:'PHONE-1'}],
    spreadsheet_id:SHEET,
    admin_api_version:BACKEND
  };
}

function mockUpstream(body){
  global.fetch=async()=>({
    ok:true,
    status:200,
    headers:{get(name){return String(name).toLowerCase()==='content-type'?'application/json':'';}},
    async text(){return JSON.stringify(body);}
  });
}

function setEnv(){
  process.env.KK_ADMIN_PIN='1234';
  process.env.KK_ADMIN_API_KEY='api-key';
  process.env.KK_ADMIN_SCRIPT_URL='https://script.google.com/macros/s/test-deployment/exec';
  process.env.GOOGLE_SHEET_ID=SHEET;
  process.env.KK_ADMIN_READ_MODE='apps-script-first';
}

test.beforeEach(setEnv);
test.afterEach(()=>{
  process.env={...ORIGINAL_ENV};
  global.fetch=ORIGINAL_FETCH;
});

test('keeps the canonical Apps Script snapshot envelope unchanged',async()=>{
  mockUpstream({ok:true,data:snapshotData(),admin_api_version:BACKEND});
  const out=responseCapture();
  await handler(reqFor(),out.res);
  assert.equal(out.res.statusCode,200);
  assert.equal(out.body.data.events.length,1);
  assert.equal(out.body.snapshot_health.contract_path,'$.data');
});

test('normalizes a double-data snapshot envelope without weakening validation',async()=>{
  const nested=snapshotData();
  delete nested.spreadsheet_id;
  delete nested.admin_api_version;
  mockUpstream({
    ok:true,
    admin_api_version:BACKEND,
    data:{
      spreadsheet_id:SHEET,
      data:nested
    }
  });
  const out=responseCapture();
  await handler(reqFor(),out.res);
  assert.equal(out.res.statusCode,200);
  assert.equal(out.body.data.events[0].event_id,'EVT-1');
  assert.equal(out.body.data.spreadsheet_id,SHEET);
  assert.equal(out.body.data.admin_api_version,BACKEND);
  assert.equal(out.body.snapshot_health.contract_path,'$.data.data');
});

test('normalizes a named nested snapshot envelope',async()=>{
  const nested=snapshotData();
  mockUpstream({ok:true,data:{spreadsheet_id:SHEET,snapshot:nested}});
  const out=responseCapture();
  await handler(reqFor(),out.res);
  assert.equal(out.res.statusCode,200);
  assert.equal(out.body.data.bookings[0].booking_id,'BK-1');
  assert.equal(out.body.snapshot_health.contract_path,'$.data.snapshot');
});

test('nested snapshot with a different spreadsheet id remains fail-closed',async()=>{
  const nested=snapshotData();
  nested.spreadsheet_id='wrong-sheet';
  mockUpstream({ok:true,data:{spreadsheet_id:SHEET,data:nested}});
  const out=responseCapture();
  await handler(reqFor(),out.res);
  assert.equal(out.res.statusCode,502);
  assert.equal(out.body.error_code,'INVALID_SNAPSHOT');
  assert.match(out.body.error,/events: missing or invalid array/);
  assert.ok(out.body.upstream_contract);
});

test('contract diagnostics expose only shape metadata, not row contents',()=>{
  const marker='PRIVATE-CUSTOMER-VALUE';
  const d=handler._test.snapshotEnvelopeDiagnostics({
    ok:true,
    data:{data:{events:[{customer_name:marker}],bookings:[],current_bookings:[],assets:[]}}
  });
  assert.equal(JSON.stringify(d).includes(marker),false);
  assert.equal(d.nested_data.types.events,'array');
});
