'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Direct=require('../server/kk-ultra-deep-direct-zero-cost');
const Control=require('../server/admin-write-control-oidc');
const handler=require('../api/kk-scanner-dispatch');
const command_id='11111111-1111-4111-8111-111111111111';
const DISPATCH_SECRET='kk-scanner-queue-test-secret-with-minimum-32-character-strength';
const oldDispatchSecret=process.env.KK_ULTRA_DEEP_DISPATCH_SECRET;
process.env.KK_ULTRA_DEEP_DISPATCH_SECRET=DISPATCH_SECRET;
test.after(()=>{if(oldDispatchSecret===undefined)delete process.env.KK_ULTRA_DEEP_DISPATCH_SECRET;else process.env.KK_ULTRA_DEEP_DISPATCH_SECRET=oldDispatchSecret;});

for(const method of ['GET','POST']) test(method+' machine preserves failed discovery diagnostic and zero-write terminal receipt',async t=>{
 const completions=[];
 t.mock.method(Control,'call',async(action,payload)=>{
  if(action==='commandClaim')return {ok:true,authenticated:true,command:{month:'2026-10',commit:false}};
  completions.push(payload);return {ok:true};
 });
 const diagnostic={schema:'KK_ULTRA_DEEP_DISCOVERY_DIAGNOSTIC_V1',full:false,blockers:['SOURCE_UNIVERSE_INCOMPLETE'],production_writes:0};
 t.mock.method(Direct,'run',async()=>({status:'BLOCKED_DISCOVERY_NOT_FULL',discovery:{diagnostic},production_writes:0}));
 const res={setHeader(){},end(body){this.body=JSON.parse(body);}};
 await handler({method,headers:{authorization:'Bearer '+DISPATCH_SECRET},url:'/api/kk-scanner-dispatch?readonly_command_id='+command_id,body:{action:'ultraDeepMachineRun',command_id}},res);
 assert.equal(res.statusCode,409);
 assert.deepEqual(res.body.discovery_diagnostic,diagnostic);
 assert.equal(res.body.business_writes,0);
 assert.equal(completions[0].status,'FAILED');
});


test('machine completion persists first inner discovery blocker',async t=>{
 const completions=[];
 t.mock.method(Control,'call',async(action,payload)=>{
  if(action==='commandClaim')return {ok:true,authenticated:true,command:{month:'2026-10',commit:false}};
  completions.push(payload);return {ok:true};
 });
 const diagnostic={schema:'KK_ULTRA_DEEP_DISCOVERY_DIAGNOSTIC_V1',full:false,blockers:['SOURCE_UNIVERSE_INCOMPLETE'],production_writes:0};
 t.mock.method(Direct,'run',async()=>({status:'BLOCKED_DISCOVERY_NOT_FULL',discovery:{diagnostic},production_writes:0}));
 const res={setHeader(){},end(body){this.body=JSON.parse(body);}};
 await handler({method:'GET',headers:{authorization:'Bearer '+DISPATCH_SECRET},url:'/api/kk-scanner-dispatch?readonly_command_id='+command_id,body:{}},res);
 assert.equal(completions[0].error_code,'SOURCE_UNIVERSE_INCOMPLETE');
 assert.equal(completions[0].production_writes,0);
});


test('machine completion persists bounded provider preflight statuses',async t=>{
 const completions=[];
 t.mock.method(Control,'call',async(action,payload)=>{
  if(action==='commandClaim')return {ok:true,authenticated:true,command:{month:'2026-10',commit:false}};
  completions.push(payload);return {ok:true};
 });
 const diagnostic={schema:'KK_ULTRA_DEEP_DISCOVERY_DIAGNOSTIC_V1',full:false,blockers:['UNKNOWN_URL_SEARCH_PREFLIGHT_FAILED'],receipts:{preflight:[{attempts:[{provider:'DDG_HTML',status:'NO_EVIDENCE'},{provider:'BING_HTML',status:'PROVIDER_ERROR'},{provider:'SEARXNG',status:'NOT_BOUND'}]}]},production_writes:0};
 t.mock.method(Direct,'run',async()=>({status:'BLOCKED_DISCOVERY_NOT_FULL',discovery:{diagnostic},production_writes:0}));
 const res={setHeader(){},end(body){this.body=JSON.parse(body);}};
 await handler({method:'GET',headers:{authorization:'Bearer '+DISPATCH_SECRET},url:'/api/kk-scanner-dispatch?readonly_command_id='+command_id,body:{}},res);
 assert.equal(completions[0].error_code,'PREFLIGHT_DDG_HTML_NO_EVIDENCE__BING_HTML_PROVIDER_ERROR__SEARXNG_NOT_BOUND');
 assert.equal(completions[0].production_writes,0);
});


test('machine marks exact V2 read-only READY as COMPLETE with zero writes',async t=>{
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
 await handler({method:'GET',headers:{authorization:'Bearer '+DISPATCH_SECRET},url:'/api/kk-scanner-dispatch?readonly_command_id='+command_id,body:{}},res);
 assert.equal(res.statusCode,200);
 assert.equal(res.body.ok,true);
 assert.equal(completions[0].status,'COMPLETE');
 assert.equal(completions[0].error_code,null);
 assert.equal(completions[0].production_writes,0);
});

test('machine does not treat V2 read-only HOLD as COMPLETE',async t=>{
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
 await handler({method:'GET',headers:{authorization:'Bearer '+DISPATCH_SECRET},url:'/api/kk-scanner-dispatch?readonly_command_id='+command_id,body:{}},res);
 assert.equal(res.statusCode,409);
 assert.equal(res.body.ok,false);
 assert.equal(completions[0].status,'FAILED');
});
