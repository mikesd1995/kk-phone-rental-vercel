'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Bridge=require('../server/runtime-ledger-oidc-bridge');
const attempt='a23e4567-e89b-42d3-a456-426614174000',nonce='123e4567-e89b-42d3-a456-426614174000';
const cfg={gasHealthAttemptId:attempt,deploymentSourceSha:'a'.repeat(40),deploymentId:'dpl_test123',deploymentEnvironment:'production'};
const receipt={ok:true,authenticated:true,probe:'owner-health-attempt-claim',version:'v1',send_allowed:false,provider_sends:0,claimed:true,attempt_id:attempt,nonce,source_sha:'a'.repeat(40),deployment_id:'dpl_test123',environment:'production',control_writes:1,business_writes:0};
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...headers}});
const subject=()=>require('../server/make-owner-health-attempt');
async function run({body={nonce},config=cfg,reply=json(receipt),getTokenImpl=async()=>'oidc-test',signal=new AbortController().signal,fetchImpl}={}){
 const calls=[];const result=await subject().claim(body,config,{signal,getTokenImpl,fetchImpl:fetchImpl||(async(url,init)=>{calls.push({url,init});if(reply instanceof Error)throw reply;return reply;})});return {result,calls};
}
test('dedicated claim sends only fixed control bindings using existing OIDC transport',async()=>{
 const {result,calls}=await run();assert.deepEqual(result,{claimed:true});assert.equal(calls.length,1);
 assert.equal(calls[0].url,Bridge.endpoint());assert.equal(calls[0].init.method,'POST');assert.equal(calls[0].init.redirect,'error');assert.equal(calls[0].init.cache,'no-store');
 assert.deepEqual(JSON.parse(calls[0].init.body),{probe:'owner-health-attempt-claim',version:'v1',attempt_id:attempt,nonce,source_sha:'a'.repeat(40),deployment_id:'dpl_test123'});
 assert.equal(calls[0].init.headers.Authorization,'Bearer oidc-test');
});
test('missing invalid nonproduction runtime bindings never look up token or send a claim',async()=>{
 for(const patch of [{gasHealthAttemptId:''},{gasHealthAttemptId:attempt.toUpperCase()},{deploymentSourceSha:'A'.repeat(40)},{deploymentId:'bad'},{deploymentId:'dpl_'+'x'.repeat(197)},{deploymentEnvironment:'preview'},{deploymentEnvironment:'Production'},{deploymentEnvironment:''}]){
  let tokens=0;const {result,calls}=await run({config:{...cfg,...patch},getTokenImpl:async()=>{tokens++;return 'token';}});assert.deepEqual(result,{claimed:false,error_code:'GAS_HEALTH_ATTEMPT_UNCONFIGURED'});assert.equal(tokens,0);assert.equal(calls.length,0);
 }
});
test('caller nonce cannot choose a new server attempt and noncanonical nonce never reaches OIDC',async()=>{
 for(const nonce of ['new',attempt.toUpperCase(),null]){let tokens=0;const {result,calls}=await run({body:{nonce,attempt_id:'attacker'},getTokenImpl:async()=>{tokens++;return 'token';}});assert.equal(result.claimed,false);assert.equal(tokens,0);assert.equal(calls.length,0);}
 const {calls}=await run({body:{nonce,attempt_id:'attacker'}});assert.equal(JSON.parse(calls[0].init.body).attempt_id,attempt);
});
test('only exact winning receipt permits continuation and exact denial is terminal',async()=>{
 const bad=[{...receipt,extra:true},{...receipt,claimed:true,control_writes:0},{...receipt,claimed:false,control_writes:1},{...receipt,business_writes:1},{...receipt,provider_sends:1},{...receipt,environment:'preview'},{...receipt,nonce:attempt},{...receipt,attempt_id:nonce},{...receipt,source_sha:'b'.repeat(40)},{...receipt,deployment_id:'dpl_other'},{...receipt,authenticated:false},{...receipt,send_allowed:true},[receipt],null];
 for(const value of bad){const {result}=await run({reply:json(value)});assert.deepEqual(result,{claimed:false,error_code:'GAS_HEALTH_ATTEMPT_RESPONSE_INVALID'});}
 assert.deepEqual((await run({reply:json({...receipt,claimed:false,control_writes:0})})).result,{claimed:false,error_code:'GAS_HEALTH_ATTEMPT_DENIED'});
});
test('untrusted transport error content never escapes the fixed local result',async()=>{
 for(const reply of [json({error_code:'secret-canary',error_description:'secret'},403),new Error('secret-canary'),new Response('secret-canary',{status:500}),new Response('redirect',{status:302,headers:{Location:'https://attacker.invalid'}})]){
  const {result,calls}=await run({reply});assert.deepEqual(result,{claimed:false,error_code:'GAS_HEALTH_ATTEMPT_OUTCOME_UNKNOWN'});assert.equal(calls.length,1);assert.ok(!JSON.stringify(result).includes('secret'));
 }
});
test('claim rejects unbounded malformed non-UTF8 wrong-content cached or redirected receipts',async()=>{
 const replies=[json({...receipt,extra:'x'.repeat(17000)}),json(receipt,200,{'Content-Length':'17000'}),new Response('{bad',{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}}),new Response(Buffer.from([0xff]),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}}),new Response('{}',{headers:{'Content-Type':'text/plain','Cache-Control':'no-store'}}),json(receipt,200,{'Cache-Control':'public, max-age=99'})];
 const moved=json(receipt);Object.defineProperty(moved,'redirected',{value:true});replies.push(moved);
 for(const reply of replies){const {result}=await run({reply});assert.equal(result.claimed,false);assert.ok(['GAS_HEALTH_ATTEMPT_RESPONSE_INVALID','GAS_HEALTH_ATTEMPT_OUTCOME_UNKNOWN'].includes(result.error_code));}
});
test('missing oversized invalid OIDC token never sends control request',async()=>{
 for(const value of ['', 'x'.repeat(8193),'bad\r\nheader',{},null]){const {result,calls}=await run({getTokenImpl:async()=>value});assert.equal(result.claimed,false);assert.equal(calls.length,0);}
});
test('aborted or delayed token cannot start claim after cancellation',async()=>{
 let finish;const controller=new AbortController();const pending=run({signal:controller.signal,getTokenImpl:()=>new Promise(resolve=>{finish=resolve;})});await new Promise(setImmediate);controller.abort();const {result,calls}=await pending;assert.equal(result.claimed,false);finish('late-token');await new Promise(setImmediate);assert.equal(calls.length,0);
});
test('lost response consumes control once and later duplicate cannot receive a winning receipt',async()=>{
 let consumed=false,native=0;const fetchImpl=async()=>{native++;if(!consumed){consumed=true;throw Error('lost-after-commit');}return json({...receipt,claimed:false,control_writes:0});};
 assert.equal((await run({fetchImpl})).result.error_code,'GAS_HEALTH_ATTEMPT_OUTCOME_UNKNOWN');assert.equal((await run({fetchImpl})).result.error_code,'GAS_HEALTH_ATTEMPT_DENIED');assert.equal(native,2);assert.equal(consumed,true);
});
test('stalled response reader is cancelled on parent deadline without returning a winning receipt',async()=>{
 let cancelled=0;const controller=new AbortController(),reply=new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{"claimed":'));},cancel(){cancelled++;}}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 const pending=run({signal:controller.signal,reply});await new Promise(setImmediate);controller.abort();const {result}=await pending;assert.equal(result.claimed,false);assert.equal(cancelled,1);
});
test('an invalid declared response size cancels unread body without accepting the receipt',async()=>{
 let cancelled=0;const reply=new Response(new ReadableStream({cancel(){cancelled++;}}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store','Content-Length':'16385'}});
 const {result}=await run({reply});assert.equal(result.claimed,false);assert.equal(cancelled,1);
});
test('bridge transport deadline during a committed receipt is an unknown outcome rather than an invalid grant',async(t)=>{
 const controller=new AbortController();t.mock.method(AbortSignal,'timeout',()=>controller.signal);
 const reply=new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{"claimed":true,'));}}),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
 const pending=run({reply});await new Promise(setImmediate);controller.abort();
 assert.deepEqual((await pending).result,{claimed:false,error_code:'GAS_HEALTH_ATTEMPT_OUTCOME_UNKNOWN'});
});
