'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Direct=require('../server/kk-ultra-deep-direct-zero-cost');
const Control=require('../server/admin-write-control-oidc');
const handler=require('../api/kk-scanner-dispatch');
const command_id='11111111-1111-4111-8111-111111111111';
for(const method of ['GET','POST']) test(method+' machine preserves failed discovery diagnostic and zero-write terminal receipt',async t=>{
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
