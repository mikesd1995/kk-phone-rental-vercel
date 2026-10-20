'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Direct=require('../server/kk-ultra-deep-direct-zero-cost');
const Control=require('../server/admin-write-control-oidc');
const Ledger=require('../server/runtime-ledger');
function machineReadyFixture(t){
 const values={KK_EXTERNAL_SCANNER_ENABLED:'true',KK_EXTERNAL_SCANNER_MODE:'execute-readonly',
  KK_EXTERNAL_SCANNER_EXECUTION_ENABLED:'true',KK_EXTERNAL_SCANNER_SECRET:'test-fixture-only'};
 const old=Object.fromEntries(Object.keys(values).map(k=>[k,process.env[k]]));
 Object.assign(process.env,values);
 t.mock.method(Ledger,'configState',()=>({enabled:true,configured:true}));
 t.after(()=>{for(const [k,v] of Object.entries(old)){if(v===undefined)delete process.env[k];else process.env[k]=v;}});
}

const handler=require('../api/kk-scanner-dispatch');
const command_id='11111111-1111-4111-8111-111111111111';
for(const method of ['GET','POST']) test(method+' machine preserves failed discovery diagnostic and zero-write terminal receipt',async t=>{
 machineReadyFixture(t);
 const completions=[];
 t.mock.method(Control,'call',async(action,payload)=>{
  if(action==='commandClaim')return {ok:true,authenticated:true,command:{month:'2026-10',commit:false}};
  completions.push(payload);return {ok:true};
 });
 const diagnostic={schema:'KK_ULTRA_DEEP_DISCOVERY_DIAGNOSTIC_V1',full:false,blockers:['SOURCE_UNIVERSE_INCOMPLETE'],production_writes:0};
 t.mock.method(Direct,'run',async()=>({status:'BLOCKED_DISCOVERY_NOT_FULL',discovery:{diagnostic},production_writes:0}));
 const res={setHeader(){},end(body){this.body=JSON.parse(body);}};
 await handler({method,url:'/api/kk-scanner-dispatch?readonly_command_id='+command_id,body:{action:'ultraDeepMachineRun',command_id}},res);
 assert.equal(res.statusCode,409);
 assert.deepEqual(res.body.discovery_diagnostic,diagnostic);
 assert.equal(res.body.business_writes,0);
 assert.equal(completions[0].status,'FAILED');
});


test('machine completion persists first inner discovery blocker',async t=>{
 machineReadyFixture(t);
 const completions=[];
 t.mock.method(Control,'call',async(action,payload)=>{
  if(action==='commandClaim')return {ok:true,authenticated:true,command:{month:'2026-10',commit:false}};
  completions.push(payload);return {ok:true};
 });
 const diagnostic={schema:'KK_ULTRA_DEEP_DISCOVERY_DIAGNOSTIC_V1',full:false,blockers:['SOURCE_UNIVERSE_INCOMPLETE'],production_writes:0};
 t.mock.method(Direct,'run',async()=>({status:'BLOCKED_DISCOVERY_NOT_FULL',discovery:{diagnostic},production_writes:0}));
 const res={setHeader(){},end(body){this.body=JSON.parse(body);}};
 await handler({method:'GET',url:'/api/kk-scanner-dispatch?readonly_command_id='+command_id,body:{}},res);
 assert.equal(completions[0].error_code,'SOURCE_UNIVERSE_INCOMPLETE');
 assert.equal(completions[0].production_writes,0);
});


test('machine completion persists bounded provider preflight statuses',async t=>{
 machineReadyFixture(t);
 const completions=[];
 t.mock.method(Control,'call',async(action,payload)=>{
  if(action==='commandClaim')return {ok:true,authenticated:true,command:{month:'2026-10',commit:false}};
  completions.push(payload);return {ok:true};
 });
 const diagnostic={schema:'KK_ULTRA_DEEP_DISCOVERY_DIAGNOSTIC_V1',full:false,blockers:['UNKNOWN_URL_SEARCH_PREFLIGHT_FAILED'],receipts:{preflight:[{attempts:[{provider:'DDG_HTML',status:'NO_EVIDENCE'},{provider:'BING_HTML',status:'PROVIDER_ERROR'},{provider:'SEARXNG',status:'NOT_BOUND'}]}]},production_writes:0};
 t.mock.method(Direct,'run',async()=>({status:'BLOCKED_DISCOVERY_NOT_FULL',discovery:{diagnostic},production_writes:0}));
 const res={setHeader(){},end(body){this.body=JSON.parse(body);}};
 await handler({method:'GET',url:'/api/kk-scanner-dispatch?readonly_command_id='+command_id,body:{}},res);
 assert.equal(completions[0].error_code,'PREFLIGHT_DDG_HTML_NO_EVIDENCE__BING_HTML_PROVIDER_ERROR__SEARXNG_NOT_BOUND');
 assert.equal(completions[0].production_writes,0);
});


test('machine marks exact V2 read-only READY as COMPLETE with zero writes',async t=>{
 machineReadyFixture(t);
 const completions=[];
 t.mock.method(Control,'call',async(action,payload)=>{
  if(action==='commandClaim')return {ok:true,authenticated:true,command:{month:'2026-10',commit:false}};
  completions.push(payload);return {ok:true};
 });
 t.mock.method(Direct,'run',async()=>({
  status:'V2_READ_ONLY_READY',
  v2_read_only:{status:'READY'},
  production_writes:0
 }));
 const res={setHeader(){},end(body){this.body=JSON.parse(body);}};
 await handler({method:'GET',url:'/api/kk-scanner-dispatch?readonly_command_id='+command_id,body:{}},res);
 assert.equal(res.statusCode,200);
 assert.equal(res.body.ok,true);
 assert.equal(completions[0].status,'COMPLETE');
 assert.equal(completions[0].error_code,null);
 assert.equal(completions[0].production_writes,0);
});

test('machine does not treat V2 read-only HOLD as COMPLETE',async t=>{
 machineReadyFixture(t);
 const completions=[];
 t.mock.method(Control,'call',async(action,payload)=>{
  if(action==='commandClaim')return {ok:true,authenticated:true,command:{month:'2026-10',commit:false}};
  completions.push(payload);return {ok:true};
 });
 t.mock.method(Direct,'run',async()=>({
  status:'V2_READ_ONLY_HOLD',
  v2_read_only:{status:'HOLD'},
  production_writes:0
 }));
 const res={setHeader(){},end(body){this.body=JSON.parse(body);}};
 await handler({method:'GET',url:'/api/kk-scanner-dispatch?readonly_command_id='+command_id,body:{}},res);
 assert.equal(res.statusCode,409);
 assert.equal(res.body.ok,false);
 assert.equal(completions[0].status,'FAILED');
});

test('disabled deployment cannot claim or execute stale read-only GET/POST queue commands',async t=>{
 const old=process.env.KK_EXTERNAL_SCANNER_ENABLED;process.env.KK_EXTERNAL_SCANNER_ENABLED='false';
 t.after(()=>{if(old===undefined)delete process.env.KK_EXTERNAL_SCANNER_ENABLED;else process.env.KK_EXTERNAL_SCANNER_ENABLED=old;});
 let claims=0,runs=0;
 t.mock.method(Control,'call',async()=>{claims++;throw new Error('QUEUE_CLAIM_MUST_NOT_HAPPEN');});
 t.mock.method(Direct,'run',async()=>{runs++;throw new Error('RUNTIME_MUST_NOT_HAPPEN');});
 for(const method of ['GET','POST']){
  const res={setHeader(){},end(body){this.body=JSON.parse(body);}};
  await handler({method,url:'/api/kk-scanner-dispatch?readonly_command_id='+command_id,body:{action:'ultraDeepMachineRun',command_id}},res);
  assert.equal(res.statusCode,503);
  assert.equal(res.body.error_code,'MACHINE_READONLY_EXECUTION_DISABLED');
  assert.equal(res.body.business_writes,0);
 }
 assert.equal(claims,0);assert.equal(runs,0);
});
test('machine POST rejects commit=true without invoking business runtime, even with scanner enabled',async t=>{
 machineReadyFixture(t);
 const actions=[];let calls=0;
 t.mock.method(Control,'call',async(action,payload)=>{
  actions.push({action,payload});
  return action==='commandClaim'?{ok:true,authenticated:true,command:{month:'2026-10',commit:true}}:{ok:true};
 });
 t.mock.method(Direct,'run',async()=>{calls++;throw new Error('WRITE_MUST_NOT_HAPPEN');});
 const res={setHeader(){},end(body){this.body=JSON.parse(body);}};
 await handler({method:'POST',url:'/api/kk-scanner-dispatch',body:{action:'ultraDeepMachineRun',command_id}},res);
 assert.equal(res.statusCode,405);
 assert.equal(res.body.error_code,'MACHINE_COMMIT_FORBIDDEN');
 assert.equal(res.body.business_writes,0);
 assert.equal(calls,0);
 assert.ok(actions.some(x=>x.action==='commandComplete'&&x.payload.production_writes===0));
});
