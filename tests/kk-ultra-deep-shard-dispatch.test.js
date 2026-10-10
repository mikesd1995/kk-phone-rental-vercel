'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Handler=require('../api/kk-scanner-dispatch.js');
const Control=require('../server/admin-write-control-oidc.js');
const Monthly=require('../server/kk-ultra-deep-month-shard-runner.js');
const commandId='123e4567-e89b-42d3-a456-426614174000';
const DISPATCH_SECRET='kk-scanner-queue-test-secret-with-minimum-32-character-strength';
const oldDispatchSecret=process.env.KK_ULTRA_DEEP_DISPATCH_SECRET;
process.env.KK_ULTRA_DEEP_DISPATCH_SECRET=DISPATCH_SECRET;
test.after(()=>{if(oldDispatchSecret===undefined)delete process.env.KK_ULTRA_DEEP_DISPATCH_SECRET;else process.env.KK_ULTRA_DEEP_DISPATCH_SECRET=oldDispatchSecret;});

function res(){
 return {statusCode:200,headers:{},body:'',
  setHeader(k,v){this.headers[k]=v;},end(s){this.body=s?JSON.parse(s):null;}};
}
const command=state=>({command_id:commandId,month:'2026-10',commit:false,
 command_kind:'SHARDED_READ_ONLY',state});
test('queue OIDC running shard dispatch only stores zero-write next checkpoint, never claims Full',async(t)=>{
 let invoked=0;
 t.mock.method(Control,'shardCommandInspect',async()=>({ok:true,authenticated:true,command:command('RUNNING')}));
 t.mock.method(Monthly,'nextReadonlyShard',async(input,options)=>{
  invoked++;assert.equal(input.month,'2026-10');
  assert.equal(input.command_id,commandId);
  assert.equal(options.shardBudgetMs,18000);
  return {status:'SHARD_STORED_CONTINUE',phase:'KNOWN_MISS',start:0,end:16,production_writes:0};
 });
 const reply=res();
 await Handler({method:'GET',headers:{authorization:'Bearer '+DISPATCH_SECRET},url:'/api/kk-scanner-dispatch?shard_command_id='+commandId},reply);
 assert.equal(invoked,1);
 assert.equal(reply.statusCode,202);
 assert.equal(reply.body.ok,true);
 assert.equal(reply.body.status,'SHARD_STORED_CONTINUE');
 assert.equal(reply.body.full,false);
 assert.equal(reply.body.business_writes,0);
});
test('PENDING shard command is claimed only after OIDC verifies intended kind and read-only scope',async(t)=>{
 const actions=[];
 t.mock.method(Control,'shardCommandInspect',async()=>({ok:true,authenticated:true,command:command('PENDING')}));
 t.mock.method(Control,'call',async(action,payload)=>{
  actions.push(action);
  assert.equal(payload.command_id,commandId);
  return {ok:true,authenticated:true,command:command('RUNNING')};
 });
 t.mock.method(Monthly,'nextReadonlyShard',async()=>({
  status:'SHARDS_ASSEMBLED_NEEDS_VERIFIER',remaining:['LIVE_SOURCE_VALIDATION'],production_writes:0
 }));
 const reply=res();
 await Handler({method:'GET',headers:{authorization:'Bearer '+DISPATCH_SECRET},url:'/?shard_command_id='+commandId},reply);
 assert.deepEqual(actions,['commandClaim']);
 assert.equal(reply.statusCode,202);
 assert.equal(reply.body.full,false);
 assert.equal(reply.body.ready_for_verifier,false);
 assert.deepEqual(reply.body.remaining,['LIVE_SOURCE_VALIDATION']);
});
test('wrong-kind and unauthenticated attempts fail before scanning or control-plane claims',async(t)=>{
 let attempted=0;
 t.mock.method(Monthly,'nextReadonlyShard',async()=>{attempted++;throw Error('should not execute');});
 t.mock.method(Control,'shardCommandInspect',async()=>({ok:false,authenticated:false,error_code:'OIDC_VERIFY_FAILED'}));
 t.mock.method(Control,'call',async()=>{attempted++;throw Error('should not claim');});
 const reply=res();
 await Handler({method:'GET',headers:{authorization:'Bearer '+DISPATCH_SECRET},url:'/?shard_command_id='+commandId},reply);
 assert.equal(reply.statusCode,409);
 assert.equal(reply.body.error_code,'SHARDED_COMMAND_NOT_AUTHORIZED');
 assert.equal(reply.body.business_writes,0);
 assert.equal(attempted,0);
});
test('shard failure cannot write data or falsely mark parent command COMPLETE',async(t)=>{
 t.mock.method(Control,'shardCommandInspect',async()=>({ok:true,authenticated:true,command:command('RUNNING')}));
 t.mock.method(Monthly,'nextReadonlyShard',async()=>{throw Object.assign(new Error('simulated timeout'),{code:'SHARD_RUNTIME_TIMEOUT'});});
 let completion=0;
 t.mock.method(Control,'call',async()=>{completion++;return {ok:false};});
 const reply=res();
 await Handler({method:'GET',headers:{authorization:'Bearer '+DISPATCH_SECRET},url:'/?shard_command_id='+commandId},reply);
 assert.equal(reply.statusCode,503);
 assert.equal(reply.body.full,false);
 assert.equal(reply.body.business_writes,0);
 assert.equal(reply.body.error_code,'SHARD_RUNTIME_TIMEOUT');
 assert.equal(completion,0,'no auto commandComplete on retryable shard error');
});
test('duplicated read-only and sharded command route cannot execute either path',async(t)=>{
 let called=0;
 t.mock.method(Control,'shardCommandInspect',async()=>{called++;return {};});
 const reply=res();
 await Handler({method:'GET',headers:{authorization:'Bearer '+DISPATCH_SECRET},url:'/?shard_command_id='+commandId+'&readonly_command_id='+commandId},reply);
 assert.equal(reply.statusCode,400);
 assert.equal(reply.body.error_code,'COMMAND_ROUTE_AMBIGUOUS');
 assert.equal(called,0);
});

test('public shard UUID without dispatch bearer cannot invoke Supabase OIDC or scan',async t=>{
 let count=0;
 t.mock.method(Control,'shardCommandInspect',async()=>{count++;return {ok:true};});
 t.mock.method(Monthly,'nextReadonlyShard',async()=>{count++;return {};});
 const reply=res();
 await Handler({method:'GET',url:'/?shard_command_id='+commandId},reply);
 assert.equal(reply.statusCode,401);
 assert.equal(reply.body.error_code,'SHARDED_DISPATCH_AUTH_REQUIRED');
 assert.equal(count,0);
 const wrong=res();
 await Handler({method:'GET',headers:{authorization:'Bearer incorrect-secret'},
  url:'/?shard_command_id='+commandId},wrong);
 assert.equal(wrong.statusCode,401);
 assert.equal(count,0);
});
