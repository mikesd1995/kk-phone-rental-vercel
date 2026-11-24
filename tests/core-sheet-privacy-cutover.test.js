'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Core=require('../server/core-sheet-private-reader.js');
const privateSheets=require('../api/lib/private-google-sheets.js');
const publicProxy=require('../api/kk-data.js');
const AdminFallback=require('../server/admin-sheet-fallback.js');

const publicCsv=[
  'event_id,event_name,event_date_text,venue,poster_image_url,event_note,available_phone_count,available_lens_count,booking_status_for_web,action_for_web,line_message_template',
  'EVT-20261218-EXAMPLE,Test Event,18/12/2026,Example Hall,,OWNER_LOCKED_INTERNAL_ONLY,2,2,เปิดจอง,show,เลือกวันจอง'
].join('\n');
function res(){
  const headers={};return {
    statusCode:200,headers,body:'',
    setHeader(k,v){headers[String(k).toLowerCase()]=String(v);},
    end(s){this.body=String(s==null?'':s);}
  };
}
async function envChange(patch,fn){
  const saved=Object.fromEntries(Object.keys(patch).map(k=>[k,process.env[k]]));
  for(const [key,value] of Object.entries(patch)){
    if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
  try{return await fn();}
  finally{
    for(const [key,value] of Object.entries(saved)){
      if(value===undefined)delete process.env[key];else process.env[key]=value;
    }
  }
}
const strict={
  KK_CORE_SHEET_REQUIRE_PRIVATE:'1',
  KK_CORE_PRIVATE_TRANSPORT:'service-account',
  GOOGLE_SHEET_ID:'test-core-sheet-id',
  KK_CRM_SHEET_ID:'different-private-crm-id',
  KK_PUBLIC_SHEET_REQUIRE_PRIVATE:undefined,
  GOOGLE_SERVICE_ACCOUNT_EMAIL:undefined,
  GOOGLE_CLIENT_EMAIL:undefined,
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:undefined,
  GOOGLE_PRIVATE_KEY:undefined,
  GOOGLE_SERVICE_ACCOUNT_JSON:undefined
};
const authorized={...strict,GOOGLE_SERVICE_ACCOUNT_EMAIL:'reader@example.invalid',GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:'test-key-only-no-real-key'};
const request={method:'GET',query:{sheet:'08_Web_Ready',range:'A4:K'}};
test('Core privacy flag is opt-in and never guesses a missing Core ID',()=>{
  assert.equal(Core.enabled({}),false);
  assert.equal(Core.state(strict).configured,false);
  assert.throws(()=>Core.requireExplicitPrivateSource(strict.GOOGLE_SHEET_ID,strict),e=>e.code==='CORE_PRIVATE_CREDENTIALS_NOT_CONFIGURED');
  assert.throws(()=>Core.requireExplicitPrivateSource('wrong',{...authorized}),e=>e.code==='CORE_PRIVATE_SHEET_ID_MISMATCH');
  assert.throws(()=>Core.requireExplicitPrivateSource('default',{...authorized,GOOGLE_SHEET_ID:undefined}),e=>e.code==='CORE_PRIVATE_SHEET_ID_NOT_CONFIGURED');
});
test('private Core and private CRM sheet IDs can differ when explicit Core cutover is enabled',()=>{
  assert.equal(Core.requireExplicitPrivateSource(strict.GOOGLE_SHEET_ID,authorized),strict.GOOGLE_SHEET_ID);
  assert.equal(Core.verifiedRange('08_Web_Ready','A4:K'),'08_Web_Ready!A4:K');
  assert.throws(()=>Core.verifiedRange('00_Master_Booking','A1:Z;DROP'),e=>e.code==='CORE_PRIVATE_RANGE_INVALID');
});
test('exact private Core allowlist is enforced for all 19 Core pairs before provider I/O',async()=>{
  const {RANGE_SPECS}=require('../server/core-private-range-contract.js');
  assert.equal(RANGE_SPECS.length,19);
  for(const spec of RANGE_SPECS){
    assert.equal(Core.verifiedRange(spec.sheet,spec.range),spec.sheet+'!'+spec.range,spec.dataset);
  }
  for(const [sheet,range] of [
    ['00_Master_Booking','A4:Z'], // valid A1 syntax, but extra customer columns
    ['00_Master_Booking','A1:X'], // a shifted booking header
    ['08_Web_Ready','A4:Z'],
    ['09_Web_Packages','A4:N500'],
    ['Unreviewed_Internal','A4:K'],
    ['08_Web_Ready','A4:K999'],
  ]){
    assert.throws(()=>Core.verifiedRange(sheet,range),e=>e.code==='CORE_PRIVATE_RANGE_INVALID',sheet+'!'+range);
  }
  const original={csv:privateSheets.readValuesCsv,values:privateSheets.readValues};
  let calls=0;
  privateSheets.readValuesCsv=async()=>{calls++;throw Error('UNSAFE_PROVIDER_CALLED')};
  privateSheets.readValues=async()=>{calls++;throw Error('UNSAFE_PROVIDER_CALLED')};
  try{
    await assert.rejects(Core.readCsv({sheetId:authorized.GOOGLE_SHEET_ID,sheet:'00_Master_Booking',range:'A4:Z',env:authorized}),e=>e.code==='CORE_PRIVATE_RANGE_INVALID');
    await assert.rejects(Core.readValues({sheetId:authorized.GOOGLE_SHEET_ID,sheet:'Unreviewed_Internal',range:'A4:K',env:authorized}),e=>e.code==='CORE_PRIVATE_RANGE_INVALID');
    assert.equal(calls,0,'provider I/O must be zero for out-of-contract Core ranges');
  }finally{
    privateSheets.readValuesCsv=original.csv;
    privateSheets.readValues=original.values;
  }
});

test('validates immutable Booking header order for every actual runtime Core read',async()=>{
  const {RANGE_SPECS}=require('../server/core-private-range-contract.js');
  const spec=RANGE_SPECS.find(s=>s.dataset==='bookings');
  assert.ok(spec);
  const original=privateSheets.readValues;
  const canonical=Array.from(spec.orderedHeaders);
  let calls=0;
  try{
    privateSheets.readValues=async()=>{calls++;return [canonical,['SYNTHETIC_BOOKING_ID','SYNTHETIC_PRIVATE_CONTACT']];};
    const query={sheetId:authorized.GOOGLE_SHEET_ID,sheet:spec.sheet,range:spec.range,env:authorized};
    const csv=await Core.readCsv(query);
    const values=await Core.readValues(query);
    assert.equal(values[0][5],canonical[5]);
    assert.match(csv,/booking_id,created_at,booking_status/);
    assert.equal(calls,2);
    const shifted=canonical.slice();[shifted[5],shifted[6]]=[shifted[6],shifted[5]];
    privateSheets.readValues=async()=>[shifted,['SECRET_PII_SHOULD_NOT_LEAK']];
    for(const call of [()=>Core.readCsv(query),()=>Core.readValues(query)]){
      await assert.rejects(call(),e=>e.code==='CORE_PRIVATE_SCHEMA_INVALID'&&
        !/SECRET_PII|customer_phone|customer_contact/.test(e.message));
    }
  }finally{privateSheets.readValues=original;}
});

test('strict /api/kk-data responds 503 with NO public GViz when service-account credential is absent',async()=>{
  const old=global.fetch;
  let network=0;global.fetch=async()=>{network++;throw new Error('public network must never be contacted');};
  try{
    await envChange(strict,async()=>{
      const response=res();await publicProxy(request,response);
      assert.equal(response.statusCode,503);
      assert.equal(response.headers['x-kk-sheet-source'],'private-not-configured');
      assert.equal(response.headers['x-kk-private-reader-strict'],'1');
      assert.equal(network,0);
      assert.doesNotMatch(JSON.stringify(response.headers),/test-core-sheet-id|reader@example/);
    });
  }finally{global.fetch=old;}
});
test('strict /api/kk-data uses ONLY authenticated Core reader when CRM Sheet ID differs',async()=>{
  const old=privateSheets.readValues,fetchOld=global.fetch;
  const reads=[];global.fetch=async()=>{throw new Error('GViz must not be used');};
  privateSheets.readValues=async args=>{reads.push(args);return publicCsv.split('\n').map(row=>row.split(','));};
  try{
    await envChange(authorized,async()=>{
      const response=res();await publicProxy(request,response);
      assert.equal(response.statusCode,200);
      assert.equal(response.headers['x-kk-sheet-source'],'private-service-account');
      assert.equal(response.headers['x-kk-private-reader-sheet-state'],'CORE_SHEET_ID_EXPLICIT');
      assert.equal(reads.length,1);
      assert.equal(reads[0].sheetId,'test-core-sheet-id');
      assert.equal(reads[0].range,'08_Web_Ready!A4:K');
      assert.doesNotMatch(response.body,/OWNER_LOCKED_INTERNAL_ONLY|customer_phone|booking_id/);
      assert.doesNotMatch(JSON.stringify(response.headers),/test-core-sheet-id|reader@example/);
    });
  }finally{privateSheets.readValues=old;global.fetch=fetchOld;}
});
test('strict mode never silently falls back to public if private read fails',async()=>{
  const old=privateSheets.readValues,fetchOld=global.fetch;
  let network=0;global.fetch=async()=>{network++;throw new Error('public forbidden');};
  privateSheets.readValues=async()=>{const e=new Error('simulated private outage');e.code='SIMULATED_PRIVATE_FAILURE';throw e;};
  try{
    await envChange(authorized,async()=>{
      const response=res();await publicProxy(request,response);
      assert.equal(response.statusCode,503);
      assert.equal(response.headers['x-kk-sheet-source'],'private-read-failed');
      assert.equal(network,0);
      assert.doesNotMatch(response.body,/simulated private outage|test-key/);
    });
  }finally{privateSheets.readValues=old;global.fetch=fetchOld;}
});
test('Admin snapshot fallback inherits Core private requirement, including cache/read guard',async()=>{
  let network=0;
  await assert.rejects(
    ()=>AdminFallback.buildSnapshot({sheetId:strict.GOOGLE_SHEET_ID,env:strict,cache:false,fetchImpl:async()=>{network++;throw Error('public forbidden');}}),
    e=>e.code==='CORE_PRIVATE_CREDENTIALS_NOT_CONFIGURED'
  );
  assert.equal(network,0);
});
test('browser API-only path blocks direct fallback for packages as well as events',()=>{
  const script=fs.readFileSync(path.join(__dirname,'../script.js'),'utf8');
  const config=fs.readFileSync(path.join(__dirname,'../config.js'),'utf8');
  assert.doesNotMatch(script,/12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU/);
  assert.doesNotMatch(script,/docs\.google\.com\/spreadsheets\/d\//);
  assert.match(script,/function directSheetUrl\(\)\{ throw new Error\("Direct Google Sheets browser access is disabled/);
  assert.match(config,/disableDirectFallback:\s*true/);
  assert.match(config,/publicDataMode:\s*"api-only"/);
  assert.doesNotMatch(script,/disableDirectFallback\s*&&\s*name\s*!==\s*PKG_SHEET/);
  assert.match(script,/if\(APP\.disableDirectFallback\) throw e/);
  assert.match(script,/if\(APP\.disableDirectFallback \|\| APP\.publicDataMode==='api-only'\)/);
});
test('all core analytics and admin lean reads have an explicit Core private branch',()=>{
  const paths=[
    'server/rental-dashboard-core.js','server/legacy/kk-rental-dashboard-v5.js',
    'server/admin-sheet-fallback.js','server/admin-proxy.js',
    'api/kk-admin-guard.js','api/kk-rental-dashboard-v6.js'
  ];
  for(const p of paths){
    const source=fs.readFileSync(path.join(__dirname,'..',p),'utf8');
    assert.match(source,/CorePrivacy\.enabled/,p);
    assert.match(source,/CorePrivacy\.(?:readCsv|readValues|requireExplicitPrivateSource)/,p);
  }
});


test('Core-vs-CRM health and rental reconciliation use private Core without a GViz attempt',async()=>{
  const CoreReader=require('../server/core-sheet-private-reader.js');
  const CRMReader=require('../api/lib/private-google-sheets.js');
  const Recon=require('../api/lib/crm-reconciliation.js');
  const Dashboard=require('../api/kk-rental-dashboard-v6.js');
  const Health=require('../api/kk-intelligence-health.js');
  const saved={core:CoreReader.readValues,crm:CRMReader.readValues,public:Recon.fetchPublicValues};
  const calls=[];let publicCalls=0;
  CoreReader.readValues=async x=>{calls.push({source:'CORE_PRIVATE',sheetId:x.sheetId,range:x.range});return [['id','event'],['A','B']];};
  CRMReader.readValues=async x=>{calls.push({source:'CRM_PRIVATE',sheetId:x.sheetId,range:x.range});return [['id','event'],['A','B']];};
  Recon.fetchPublicValues=async()=>{publicCalls++;throw Error('PUBLIC_CORE_GVIZ_FORBIDDEN');};
  const opts={coreSheetId:'test-core-sheet-id',crmSheetId:'different-private-crm-id',env:authorized};
  try{
    for(const mod of [Dashboard,Health]){
      await mod._test.reconcileRuntimeDatasets(opts);
    }
    assert.equal(publicCalls,0);
    assert.equal(calls.filter(c=>c.source==='CORE_PRIVATE'&&c.sheetId===opts.coreSheetId).length,4);
    assert.equal(calls.filter(c=>c.source==='CRM_PRIVATE'&&c.sheetId===opts.crmSheetId).length,4);
    assert.equal(calls.filter(c=>c.sheetId!==opts.coreSheetId&&c.sheetId!==opts.crmSheetId).length,0);
  }finally{
    CoreReader.readValues=saved.core;
    CRMReader.readValues=saved.crm;
    Recon.fetchPublicValues=saved.public;
  }
});
test('Core security source contract includes private Health endpoint and forbids a browser Core identifier',()=>{
  const health=fs.readFileSync(path.join(__dirname,'../api/kk-intelligence-health.js'),'utf8');
  const proxy=fs.readFileSync(path.join(__dirname,'../api/kk-data.js'),'utf8');
  const browser=fs.readFileSync(path.join(__dirname,'../script.js'),'utf8');
  assert.match(health,/CorePrivacy\.enabled\(env\)/);
  assert.match(health,/CorePrivacy\.readValues\(/);
  assert.match(proxy,/if\(corePrivateStrict\)\{/);
  assert.doesNotMatch(browser,/12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU/);
});

test('missing transport never silently selects a service account despite present legacy credentials',()=>{
 const missing={...authorized,KK_CORE_PRIVATE_TRANSPORT:undefined};
 const state=Core.state(missing);
 assert.equal(state.transport,'none');
 assert.equal(state.configured,false);
 assert.equal(state.authMode,'none');
 assert.throws(()=>Core.requireExplicitPrivateSource(missing.GOOGLE_SHEET_ID,missing),
   e=>e.code==='CORE_PRIVATE_TRANSPORT_NOT_CONFIGURED');
 assert.equal(Core.state(authorized).transport,'service-account');
});
test('invalid private transport is redacted and never authorizes provider reads',async()=>{
 const marker='SYNTHETIC_PRIVATE_TRANSPORT_TOKEN';
 const env={...authorized,KK_CORE_PRIVATE_TRANSPORT:marker};
 const preflight=require('../scripts/core-private-cutover-preflight.cjs');
 const state=Core.state(env);let calls=0;
 assert.equal(state.transport,'invalid');assert.equal(state.configured,false);
 assert.equal(state.transportReady,false);assert.equal(state.authMode,'none');
 assert.doesNotMatch(JSON.stringify(state),/SYNTHETIC_PRIVATE_TRANSPORT_TOKEN/);
 assert.throws(()=>Core.requireExplicitPrivateSource(env.GOOGLE_SHEET_ID,env),
  e=>e.code==='CORE_PRIVATE_TRANSPORT_INVALID');
 const result=await preflight.probe({env,reader:async()=>{calls++;throw Error('MUST_NOT_READ');}});
 assert.equal(result.transport,'invalid');assert.equal(result.status,'NOT_READY');
 assert.equal(result.datasets_checked,0);assert.equal(calls,0);
 assert.doesNotMatch(JSON.stringify(result),/SYNTHETIC_PRIVATE_TRANSPORT_TOKEN/);
 assert.equal(preflight.classify({code:'CORE_PRIVATE_TRANSPORT_INVALID'}),'CORE_PRIVATE_TRANSPORT_INVALID');
});
