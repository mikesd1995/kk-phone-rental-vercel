'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const compiled=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../supabase/functions/kk-runtime-ledger-oidc-probe/index.ts'),'utf8').replace(/^import[^\n]*\n/,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None},reportDiagnostics:true});
assert.deepEqual(compiled.diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error),[]);
const body={probe:'owner-health-attempt-claim',version:'v1',attempt_id:'11111111-1111-4111-8111-111111111111',nonce:'22222222-2222-4222-8222-222222222222',source_sha:'a'.repeat(40),deployment_id:'dpl_123456789012345678901234'};
const receipt=(claimed=true)=>({claimed,attempt_id:body.attempt_id,nonce:body.nonce,source_sha:body.source_sha,deployment_id:body.deployment_id,environment:'production',control_writes:claimed?1:0,business_writes:0});
function harness({environment='production',claims={},result=receipt(),reject=false,loseReply=false}={}){
 let handler,nativeCommitted=false;const calls=[],team='mikesd1995s-projects',project='kk-phone-rental-vercel';
 const payload={iss:'https://oidc.vercel.com/'+team,aud:'https://vercel.com/'+team,sub:`owner:${team}:project:${project}:environment:${environment}`,owner_id:'team_uaeOdVIjXMSW690ZM2wPuJyt',project_id:'prj_snbAmpya7YGmOuMbv1o8T16ouxl6',project,environment,...claims};
 vm.runInNewContext(compiled.outputText,{Request,Response,URL,URLSearchParams,TextEncoder,TextDecoder,AbortSignal,DOMException,Date,Error,console,
 createRemoteJWKSet:()=>({}),decodeJwt:()=>payload,jwtVerify:async(_,__,o)=>{if(o.issuer!==payload.iss||o.audience!==payload.aud||o.subject!==payload.sub)throw Error('bad');return {payload};},
 Deno:{serve:fn=>handler=fn,env:{get:k=>k==='SUPABASE_URL'?'https://zehlsagzrpromtfqqflt.supabase.co':k==='SUPABASE_SECRET_KEYS'?JSON.stringify({default:'sb_secret_synthetic'}):'FALSE'}},
 fetch:async(url,init)=>{calls.push({url,init});assert.equal(url,'https://zehlsagzrpromtfqqflt.supabase.co/rest/v1/rpc/kk_claim_owner_health_attempt_v1');if(loseReply){nativeCommitted=true;throw Error('PRIVATE_RAW_MARKER');}return reject?Response.json({error:'PRIVATE_RAW_MARKER'},{status:500}):Response.json(result);}});
 return {calls,get nativeCommitted(){return nativeCommitted;},request:async(value=body,headers={authorization:'Bearer synthetic','content-type':'application/json'})=>{const r=await handler(new Request('https://example.invalid',{method:'POST',headers,body:JSON.stringify(value)}));return {status:r.status,body:await r.json()};}};
}
test('Production-only exact health claim uses one fixed service RPC while operational flags are OFF',async()=>{
 const h=harness(),r=await h.request();assert.equal(r.status,200);assert.deepEqual(r.body,{ok:true,authenticated:true,probe:body.probe,version:'v1',send_allowed:false,provider_sends:0,...receipt()});assert.equal(h.calls.length,1);
 assert.deepEqual(JSON.parse(h.calls[0].init.body),{p_attempt_id:body.attempt_id,p_nonce:body.nonce,p_source_sha:body.source_sha,p_deployment_id:body.deployment_id,p_environment:'production'});
});
test('claim denial remains safe and never becomes idempotent success',async()=>{const h=harness({result:receipt(false)}),r=await h.request();assert.equal(r.status,200);assert.equal(r.body.claimed,false);assert.equal(r.body.control_writes,0);assert.equal(h.calls.length,1);});
test('deployment ID contract accepts the exact one-to-196 alphanumeric suffix bounds',async()=>{for(const n of [1,196]){const deployment_id='dpl_'+'a'.repeat(n),h=harness({result:{...receipt(),deployment_id}}),r=await h.request({...body,deployment_id});assert.equal(r.status,200);assert.equal(r.body.deployment_id,deployment_id);}});
test('preview missing authentication and wrong identity cannot claim or access native state',async()=>{
 for(const options of [{environment:'preview'},{environment:'development'},{claims:{project_id:'prj_other'}},{claims:{owner_id:'team_other'}},{claims:{project:'other'}},{claims:{sub:'owner:other:project:other:environment:production'}},{claims:{iss:'https://evil.invalid'}},{claims:{aud:'https://vercel.com/other'}}]){const h=harness(options);assert.equal((await h.request()).status,401);assert.equal(h.calls.length,0);}
 const h=harness();assert.equal((await h.request(body,{'content-type':'application/json'})).status,401);assert.equal(h.calls.length,0);
});
test('extra keys wrong versions noncanonical UUIDs sources deployments and arbitrary operations deny before RPC',async()=>{
 for(const bad of [{...body,extra:true},{...body,operation:'reset'},{...body,version:'v2'},{...body,attempt_id:body.attempt_id.toUpperCase().replace('11111111','AAAAAAAA')},{...body,nonce:'bad'},{...body,source_sha:'A'.repeat(40)},{...body,source_sha:'a'.repeat(41)},{...body,deployment_id:'other'},{...body,deployment_id:'dpl_'+ 'a'.repeat(201)}]){const h=harness(),r=await h.request(bad);assert.ok(r.status>=400);assert.equal(h.calls.length,0);}
});
test('final newline never passes an exact canonical identity or deployment check',async()=>{for(const key of ['attempt_id','nonce','source_sha','deployment_id']){const bad={...body,[key]:body[key]+'\n'},h=harness({result:{...receipt(),[key]:bad[key]}}),r=await h.request(bad);assert.equal(r.status,403,key);assert.equal(h.calls.length,0,key);}});
test('malformed mismatched or unsafe native results produce only fixed safe rejection',async()=>{
 for(const result of [null,[],{...receipt(),secret:'PRIVATE_RAW_MARKER'},{...receipt(),nonce:body.attempt_id},{...receipt(),source_sha:'b'.repeat(40)},{...receipt(),environment:'preview'},{...receipt(),control_writes:0},{...receipt(false),control_writes:1},{...receipt(),business_writes:1},{...receipt(),claimed:'true'}]){const h=harness({result}),r=await h.request();assert.equal(r.status,403);assert.equal(r.body.error_code,'HEALTH_ATTEMPT_CLAIM_REJECTED');assert.equal(JSON.stringify(r).includes('PRIVATE_RAW_MARKER'),false);assert.equal(h.calls.length,1);}
});
test('native errors never reflect arbitrary provider or DB content',async()=>{const h=harness({reject:true}),r=await h.request();assert.equal(r.status,403);assert.equal(r.body.error_code,'HEALTH_ATTEMPT_CLAIM_REJECTED');assert.equal(JSON.stringify(r).includes('PRIVATE_RAW_MARKER'),false);});

test('committed claim with a lost or malformed receipt never asserts zero control writes',async()=>{
 for(const options of [{loseReply:true},{result:{...receipt(),extra:'PRIVATE_RAW_MARKER'}}]){
  const h=harness(options),r=await h.request();
  if(options.loseReply)assert.equal(h.nativeCommitted,true);
  assert.equal(h.calls.length,1);assert.equal(r.status,403);
  assert.equal(r.body.error_code,'HEALTH_ATTEMPT_CLAIM_REJECTED');
  assert.equal(Object.hasOwn(r.body,'control_writes'),false);
  assert.equal(r.body.control_write_outcome,'UNKNOWN');
  assert.equal(JSON.stringify(r).includes('PRIVATE_RAW_MARKER'),false);
 }
});
