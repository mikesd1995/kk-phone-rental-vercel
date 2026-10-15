'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {Readable}=require('node:stream');
const Bridge=require('../server/admin-make-bridge.js');
const MakeGate=require('../server/admin-make-gate.js');
const Verify=MakeGate._test.handleVerifyActive;

const KEY='test-api-key';
const NOW=new Date('2026-09-20T03:00:00+07:00');
const RID='123e4567-e89b-12d3-a456-426614174000';

function bookingPlan(overrides={}){
  const read="spreadsheets/"+Bridge.CORE_SHEET_ID+"/values/'00_Master_Booking'!B22:T22?valueRenderOption=UNFORMATTED_VALUE";
  return Object.assign({
    action:'updateBooking',
    read_url:read,
    write_method:'PUT',
    write_url:"spreadsheets/"+Bridge.CORE_SHEET_ID+"/values/'00_Master_Booking'!B22:T22?valueInputOption=USER_ENTERED&includeValuesInResponse=true",
    write_body_json:JSON.stringify({range:"'00_Master_Booking'!B22:T22",majorDimension:'ROWS',values:[['2026-09-20','confirmed']]}),
    before_hash:Bridge.stableValuesHash([['before']]),
    after_hash:Bridge.stableValuesHash([['2026-09-20','confirmed']])
  },overrides);
}

function req(body,contentType='application/json'){
  const r=Readable.from([contentType.includes('json')?JSON.stringify(body):new URLSearchParams(body).toString()]);
  r.method='POST';
  r.headers={'content-type':contentType};
  return r;
}
function res(){
  return {
    statusCode:0,headers:{},body:'',
    setHeader(k,v){this.headers[String(k).toLowerCase()]=v;},
    end(v){this.body=String(v||'');},
    json(){return JSON.parse(this.body);}
  };
}

test('signed Make bridge envelope verifies and detects tampering',()=>{
  const env=Bridge.buildEnvelope(bookingPlan(),KEY,NOW,RID);
  assert.equal(Bridge.verifyEnvelope(env,KEY,NOW).ok,true);

  const tampered=Object.assign({},env,{write_url:env.write_url.replace('B22:T22','B23:T23')});
  assert.equal(Bridge.verifyEnvelope(tampered,KEY,NOW).code,'BRIDGE_SIGNATURE_INVALID');
});

test('bridge rejects stale request timestamps',()=>{
  const env=Bridge.buildEnvelope(bookingPlan(),KEY,NOW,RID);
  const later=new Date(NOW.getTime()+Bridge.MAX_CLOCK_SKEW_MS+1000);
  assert.equal(Bridge.verifyEnvelope(env,KEY,later).code,'BRIDGE_TIMESTAMP_INVALID');
});

test('bridge binds actions to approved Core sheet paths',()=>{
  const bad=bookingPlan({
    read_url:"spreadsheets/"+Bridge.CORE_SHEET_ID+"/values/'01_Events'!A5:I5",
    write_url:"spreadsheets/"+Bridge.CORE_SHEET_ID+"/values/'01_Events'!A5:I5?valueInputOption=RAW"
  });
  assert.equal(Bridge.validatePlan(bad).code,'BRIDGE_ACTION_SHEET_MISMATCH');
});

test('health plan is read-only and targets health sheet',()=>{
  const p=Bridge.healthPlan();
  assert.equal(p.action,'healthProbe');
  assert.equal(p.write_method,'GET');
  assert.equal(p.read_url,p.write_url);
  assert.match(p.read_url,/10_Admin_Health_Check/);
});

test('verifier authorizes valid signed envelope without exposing signing key',async t=>{
  const old=process.env.KK_ADMIN_API_KEY;
  t.after(()=>{ if(old===undefined) delete process.env.KK_ADMIN_API_KEY; else process.env.KK_ADMIN_API_KEY=old; });
  process.env.KK_ADMIN_API_KEY=KEY;
  const env=Bridge.buildEnvelope(bookingPlan(),KEY,new Date(),RID);
  env.stage='authorize';
  const out=res();
  await Verify(req(env),out);
  assert.equal(out.statusCode,200);
  const body=out.json();
  assert.equal(body.ok,true);
  assert.equal(body.action,'updateBooking');
  assert.equal(JSON.stringify(body).includes(KEY),false);
});

test('verifier blocks changed precondition before write',async t=>{
  const old=process.env.KK_ADMIN_API_KEY;
  t.after(()=>{ if(old===undefined) delete process.env.KK_ADMIN_API_KEY; else process.env.KK_ADMIN_API_KEY=old; });
  process.env.KK_ADMIN_API_KEY=KEY;
  const env=Bridge.buildEnvelope(bookingPlan(),KEY,new Date(),RID);
  env.stage='precondition';
  env.actual_values_json=JSON.stringify([['changed']]);
  const out=res();
  await Verify(req(env,'application/x-www-form-urlencoded'),out);
  assert.equal(out.statusCode,409);
  assert.equal(out.json().error_code,'BRIDGE_PRECONDITION_CHANGED');
});

test('verifier accepts exact write readback hash',async t=>{
  const old=process.env.KK_ADMIN_API_KEY;
  t.after(()=>{ if(old===undefined) delete process.env.KK_ADMIN_API_KEY; else process.env.KK_ADMIN_API_KEY=old; });
  process.env.KK_ADMIN_API_KEY=KEY;
  const after=[['2026-09-20','confirmed']];
  const plan=bookingPlan({after_hash:Bridge.stableValuesHash(after)});
  const env=Bridge.buildEnvelope(plan,KEY,new Date(),RID);
  env.stage='readback';
  env.write_response_json=JSON.stringify({updatedData:{values:after}});
  const out=res();
  await Verify(req(env,'application/x-www-form-urlencoded'),out);
  assert.equal(out.statusCode,200);
  assert.equal(out.json().ok,true);
});


test('bridge runtime is quarantined while Make Free-plan credits are exhausted',()=>{
  assert.equal(MakeGate._test.BRIDGE_RUNTIME_ENABLED,false);
  const body=MakeGate._test.quarantineBody();
  assert.equal(body.error_code,'BRIDGE_RUNTIME_QUARANTINED');
  assert.equal(body.reason,'MAKE_FREE_CREDITS_EXHAUSTED');
  assert.equal(body.recheck_date,'2026-10-10');
  assert.equal(body.write_actions_enabled,false);
});

test('quarantined verifier rejects before signature or Google execution',async()=>{
  const out=res();
  await MakeGate.handleVerify(req({stage:'authorize'}),out);
  assert.equal(out.statusCode,503);
  assert.equal(out.json().error_code,'BRIDGE_RUNTIME_QUARANTINED');
});

test('quarantined health probe does not call Make transport',async()=>{
  const original=Bridge.callBridge;
  let called=false;
  Bridge.callBridge=async()=>{called=true;throw new Error('must not call');};
  try{
    const r=Readable.from([]);
    r.method='GET';
    r.headers={};
    const out=res();
    await MakeGate.handleHealth(r,out);
    assert.equal(out.statusCode,503);
    assert.equal(out.json().error_code,'BRIDGE_RUNTIME_QUARANTINED');
    assert.equal(called,false);
  }finally{
    Bridge.callBridge=original;
  }
});

test('direct bridge call is quarantined even without using the Make API gate',async()=>{
  let outbound=0;
  const options={
    env:{KK_ADMIN_API_KEY:KEY,KK_ADMIN_DIRECT_WRITER_ENABLED:'1',
      KK_ADMIN_DIRECT_WRITER_ACCEPTED:'1',
      KK_ADMIN_DIRECT_WRITER_WRITE_PROBE_PASSED:'1'},
    fetchImpl:async()=>{outbound++;throw Error('external Make invocation forbidden');}
  };
  for(const plan of [Bridge.healthPlan(),bookingPlan()]){
    await assert.rejects(()=>Bridge.callBridge(plan,options),
      e=>e&&e.code==='BRIDGE_RUNTIME_QUARANTINED');
  }
  assert.equal(outbound,0);
});

test('legacy Make webhook literal is absent and direct-call quarantine is immutable',()=>{
  const fs=require('node:fs'),path=require('node:path');
  const source=fs.readFileSync(path.join(__dirname,'../server/admin-make-bridge.js'),'utf8');
  assert.doesNotMatch(source,/https:\/\/hook\.us2\.make\.com\//);
  assert.match(source,/const LEGACY_TRANSPORT_QUARANTINED=true/);
  assert.match(source,/if\(LEGACY_TRANSPORT_QUARANTINED\)/);
  assert.match(source,/BRIDGE_RUNTIME_QUARANTINED/);
});
