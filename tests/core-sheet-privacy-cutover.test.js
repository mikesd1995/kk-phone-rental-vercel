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
  const old=privateSheets.readValuesCsv,fetchOld=global.fetch;
  const reads=[];global.fetch=async()=>{throw new Error('GViz must not be used');};
  privateSheets.readValuesCsv=async args=>{reads.push(args);return publicCsv;};
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
  }finally{privateSheets.readValuesCsv=old;global.fetch=fetchOld;}
});
test('strict mode never silently falls back to public if private read fails',async()=>{
  const old=privateSheets.readValuesCsv,fetchOld=global.fetch;
  let network=0;global.fetch=async()=>{network++;throw new Error('public forbidden');};
  privateSheets.readValuesCsv=async()=>{const e=new Error('simulated private outage');e.code='SIMULATED_PRIVATE_FAILURE';throw e;};
  try{
    await envChange(authorized,async()=>{
      const response=res();await publicProxy(request,response);
      assert.equal(response.statusCode,503);
      assert.equal(response.headers['x-kk-sheet-source'],'private-read-failed');
      assert.equal(network,0);
      assert.doesNotMatch(response.body,/simulated private outage|test-key/);
    });
  }finally{privateSheets.readValuesCsv=old;global.fetch=fetchOld;}
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
