'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const ts=require('typescript');
const Bridge=require('../server/make-owner-ledger-bridge'),Ledger=require('../server/make-owner-ledger-plan'),Contract=require('../server/make-owner-transport-contract');
// Execute the actual Edge handler on the supported hosted Node20 runner.
// Only its remote Deno import is replaced by the explicit auth test doubles.
const compiled=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../supabase/functions/kk-runtime-ledger-oidc-probe/index.ts'),'utf8').replace(/^import[^\n]*\n/,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None},reportDiagnostics:true});
assert.deepEqual((compiled.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error),[],'Edge source must transpile without errors');
const source=compiled.outputText;
const TEAM='mikesd1995s-projects',PROJECT='kk-phone-rental-vercel';
function fixture(raw='uat|'+crypto.randomUUID()){
  const now=new Date().toISOString(),row=Object.fromEntries(Bridge.HEADERS.map(h=>[h,'']));
  Object.assign(row,{'Notification ID':raw,'Created At':now,'Change Type':'TRANSPORT_UAT',Priority:'TEST','Quiet Hours Policy':'OWNER_CONTROLLED_UAT',Payload:'ทดสอบระบบแจ้งเตือน เจ้าของเท่านั้น','Audit Event ID':'CONTROLLED_UAT|'+raw,Transport:Bridge.TRANSPORT,Status:'QUEUED','Attempt Count':0,'Dedup Key':'test|'+raw,Notes:'OWNER_AUTHORIZED_TRANSPORT_UAT|'+raw});
  const plan=Ledger.planOwnerLedgerNotification({spreadsheet_id:Bridge.SPREADSHEET_ID,tab:Bridge.TAB,rows:[row],exact_notification_id:raw,fresh_since:new Date(Date.now()-120000).toISOString(),supplied_now:now,existing_mapping_snapshot:[]});
  const binding=JSON.stringify(plan.immutable_binding),audit=row['Audit Event ID'];
  return {raw,plan,binding,audit,gate:{key:'OWNER_TRANSPORT_UAT:'+raw,enabled:true,updated_at:now,note:JSON.stringify({version:'owner-transport-uat-admission-v1',expires_at:new Date(Date.now()+240000).toISOString(),immutable_binding_sha256:Contract.hash(binding),source_audit_event_id:audit,allowed_environment:'preview'})},
    persisted:{immutable_binding_text:binding,source_audit_event_id:audit,descriptor:plan.descriptor,text_sha256:Contract.hash(row.Payload)},
    body:{probe:'owner-notification',version:'v1',operation:'enqueue',parameters:{p_immutable_binding:binding,p_source_audit_event_id:audit,p_descriptor:plan.descriptor,p_fresh_since:new Date(Date.now()-120000).toISOString()}}};
}
function harness(f,{environment='preview',claims={},gate,gateAfter,persisted}={}){
  let handler,gates=0;const calls=[];
  const payload={iss:'https://oidc.vercel.com/'+TEAM,aud:'https://vercel.com/'+TEAM,sub:'owner:'+TEAM+':project:'+PROJECT+':environment:'+environment,owner_id:'team_uaeOdVIjXMSW690ZM2wPuJyt',project_id:'prj_snbAmpya7YGmOuMbv1o8T16ouxl6',project:PROJECT,environment,...claims};
  const sandbox={Request,Response,URL,URLSearchParams,TextEncoder,TextDecoder,AbortSignal,DOMException,Error,Date,console,atob,btoa,crypto:crypto.webcrypto,
    createRemoteJWKSet:()=>({}),decodeJwt:()=>payload,
    jwtVerify:async(_token,_jwks,options)=>{if(options.issuer!==payload.iss||options.audience!==payload.aud||options.subject!==payload.sub)throw new Error('bad claims');return {payload};},
    Deno:{env:{get:key=>key==='SUPABASE_URL'?'https://zehlsagzrpromtfqqflt.supabase.co':key==='SUPABASE_SECRET_KEYS'?JSON.stringify({default:'sb_secret_test_only'}):''},serve:fn=>{handler=fn;}},
    fetch:async(url,init={})=>{
      calls.push({url,init});const u=new URL(url);
      assert.equal(u.origin,'https://zehlsagzrpromtfqqflt.supabase.co');
      assert.equal(init.headers.apikey,'sb_secret_test_only');
      if(u.pathname.endsWith('/kk_control_plane_config')){
        gates++;const selected=gates>1&&gateAfter!==undefined?gateAfter:gate===undefined?[f.gate]:gate;
        return Response.json(selected);
      }
      if(u.pathname.endsWith('/kk_runtime_expectations'))return Response.json([]);
      if(u.pathname.endsWith('/rpc/kk_make_owner_notification_readback'))return Response.json(persisted===undefined?f.persisted:persisted);
      if(u.pathname.endsWith('/rpc/kk_make_owner_notification_enqueue'))return Response.json(f.persisted);
      if(u.pathname.endsWith('/rpc/kk_make_owner_notification_claim'))return Response.json([{receipt_id:crypto.randomUUID(),status:'RESERVED'}]);
      if(u.pathname.endsWith('/rpc/kk_make_owner_notification_ack'))return Response.json([{status:'SENT'}]);
      throw new Error('Unexpected native path '+u.pathname);
    }};
  vm.runInNewContext(source,sandbox,{filename:'owner-edge-under-test.js'});
  return {calls,request:async(body=f.body,headers={'authorization':'Bearer test-token','content-type':'application/json'})=>{
    const r=await handler(new Request('https://example.invalid',{method:'POST',headers,body:JSON.stringify(body)}));
    return {status:r.status,body:await r.json()};
  }};
}
test('executed Edge handler admits exact gated preview owner enqueue through fixed native RPC only',async()=>{
  const f=fixture(),h=harness(f),r=await h.request();
  assert.equal(r.status,200);assert.equal(r.body.authenticated,true);assert.equal(r.body.operation,'enqueue');assert.equal(r.body.provider_sends,0);
  assert.deepEqual(h.calls.map(c=>new URL(c.url).pathname.split('/').pop()),['kk_control_plane_config','kk_make_owner_notification_enqueue','kk_control_plane_config']);
});
test('executed JWT boundary rejects missing token and wrong issuer/audience/subject/project/team without native I/O',async()=>{
  const f=fixture(),missing=harness(f);assert.equal((await missing.request(f.body,{'content-type':'application/json'})).status,401);assert.equal(missing.calls.length,0);
  for(const claims of [{iss:'https://evil.invalid'},{aud:'https://vercel.com/other'},{sub:'owner:other'},{project_id:'prj_other'},{project:'other'},{owner_id:'team_other'},{environment:'development'}]){
    const h=harness(f,{claims}),r=await h.request();assert.equal(r.status,401,JSON.stringify(claims));assert.equal(h.calls.length,0);
  }
});
test('preview cannot call any existing probe while production bounded runtime read still works',async()=>{
  const f=fixture();
  for(const probe of ['runtime-ledger','project-memory','agent-invocation-read','agent-invocation-write']){
    const h=harness(f),r=await h.request({probe,version:'v1'});assert.equal(r.status,401);assert.equal(h.calls.length,0);
  }
  const h=harness(f,{environment:'production'}),r=await h.request({probe:'runtime-ledger',version:'v1'});
  assert.equal(r.status,200);assert.equal(r.body.row_count,0);assert.equal(h.calls.length,1);
});
test('absent, duplicate, disabled, expired, stale or future native gates cannot invoke durable RPC',async()=>{
  const f=fixture(),badGates=[[],[f.gate,f.gate],[{...f.gate,enabled:false}],[{...f.gate,updated_at:new Date(Date.now()+60000).toISOString()}],[{...f.gate,updated_at:new Date(Date.now()-360000).toISOString()}]];
  for(const mutate of [n=>n.expires_at=new Date(Date.now()-1).toISOString(),n=>n.expires_at=new Date(Date.now()+360000).toISOString(),n=>n.allowed_environment='production',n=>n.source_audit_event_id='wrong',n=>n.immutable_binding_sha256='0'.repeat(64),n=>n.extra=true]){
    const note=JSON.parse(f.gate.note);mutate(note);badGates.push([{...f.gate,note:JSON.stringify(note)}]);
  }
  for(const gate of badGates){const h=harness(f,{gate}),r=await h.request();assert.equal(r.status,403);assert.equal(h.calls.filter(c=>c.url.includes('/rpc/')).length,0);}
});
test('unknown and inherited operations or extra RPC fields are rejected before native access',async()=>{
  const f=fixture();
  for(const operation of ['delete','constructor','toString','__proto__']){
    const h=harness(f),r=await h.request({...f.body,operation});assert.equal(r.status,403);assert.equal(r.body.error_code,'OWNER_OPERATION_FORBIDDEN');assert.equal(h.calls.length,0);
  }
  const h=harness(f),r=await h.request({...f.body,parameters:{...f.body.parameters,table:'customers'}});assert.equal(r.status,403);assert.equal(h.calls.length,0);
});
test('gate filter quotes raw identifiers without query or PostgREST grammar injection',async()=>{
  const raw='uat|a",or=(enabled.eq.true)&key=bad\\x',f=fixture(raw),h=harness(f),r=await h.request();assert.equal(r.status,200);
  const u=new URL(h.calls[0].url);assert.equal(u.searchParams.get('key'),'eq."'+('OWNER_TRANSPORT_UAT:'+raw).replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"');
  assert.deepEqual([...u.searchParams.keys()].sort(),['key','limit','select']);
});
test('actual source mapping must remain UAT classified and exact gate hash/audit joined',async()=>{
  const f=fixture();
  for(const indexValue of [[8,'business-event'],[10,'DATE_CHANGED'],[11,'P0'],[12,'BYPASS']]){
    const b=JSON.parse(f.binding);b[indexValue[0]]=indexValue[1];const changed=JSON.stringify(b),note=JSON.parse(f.gate.note);note.immutable_binding_sha256=Contract.hash(changed);
    const h=harness(f,{gate:[{...f.gate,note:JSON.stringify(note)}]}),r=await h.request({...f.body,parameters:{...f.body.parameters,p_immutable_binding:changed}});
    assert.equal(r.status,403);assert.equal(h.calls.length,1);
  }
  const h=harness(f,{persisted:{...f.persisted,source_audit_event_id:'wrong'}}),r=await h.request({probe:'owner-notification',version:'v1',operation:'readback',parameters:{p_source_notification_id:f.raw}});
  assert.equal(r.status,403);assert.equal(h.calls.length,2);
});
test('readback requires the same exact gate and does not mutate or send',async()=>{
  const f=fixture(),h=harness(f),r=await h.request({probe:'owner-notification',version:'v1',operation:'readback',parameters:{p_source_notification_id:f.raw}});
  assert.equal(r.status,200);assert.equal(r.body.read_only,true);assert.equal(r.body.result.immutable_binding_text,f.binding);
  assert.equal(h.calls.filter(c=>c.init.method==='POST').length,1);
});
test('claim only forwards descriptor fields joined to actual native source map',async()=>{
  const f=fixture(),d=f.plan.descriptor,p={p_notification_id:d.notification_id,p_request_id:d.request_id,p_event_type:d.event_type,p_entity_id:d.entity_id,p_content_version:d.content_version,p_text_sha256:f.persisted.text_sha256,p_expires_at:d.expires_at};
  const body={probe:'owner-notification',version:'v1',operation:'claim',parameters:p};
  const valid=harness(f);assert.equal((await valid.request(body)).status,200);
  for(const k of Object.keys(p)){const h=harness(f),r=await h.request({...body,parameters:{...p,[k]:'wrong'}});assert.equal(r.status,403);assert.equal(h.calls.filter(c=>c.url.endsWith('/rpc/kk_make_owner_notification_claim')).length,0);}
});
test('ACK preserves installed receipt CAS and rejects absent or malformed provider evidence before mutation',async()=>{
  const f=fixture(),p={p_notification_id:f.plan.descriptor.notification_id,p_receipt_id:crypto.randomUUID(),p_provider_message_id:'1234567'},body={probe:'owner-notification',version:'v1',operation:'ack',parameters:p};
  const h=harness(f);assert.equal((await h.request(body)).status,200);assert.equal(h.calls.filter(c=>c.url.endsWith('/rpc/kk_make_owner_notification_ack')).length,1);
  for(const changes of [{p_receipt_id:''},{p_provider_message_id:null},{p_provider_message_id:'0'},{p_provider_message_id:'fake'}]){
    const denied=harness(f),r=await denied.request({...body,parameters:{...p,...changes}});assert.equal(r.status,403);assert.equal(denied.calls.filter(c=>c.url.endsWith('/rpc/kk_make_owner_notification_ack')).length,0);
  }
});
test('gate change after a native operation returns uncertainty and cannot return successful admission',async()=>{
  const f=fixture(),h=harness(f,{gateAfter:[{...f.gate,enabled:false}]}),r=await h.request();assert.equal(r.status,403);assert.equal(r.body.ok,false);
  assert.equal(h.calls.filter(c=>c.url.endsWith('/rpc/kk_make_owner_notification_enqueue')).length,1);
});
test('malformed transport identity and oversized request fail closed without provider access',async()=>{
  const f=fixture();
  for(const raw of ['ks1_%%%%%%','ks1_8J-A','ks1_'+Buffer.from('\u0000abcdef').toString('base64url')]){
    const h=harness(f),r=await h.request({probe:'owner-notification',version:'v1',operation:'ack',parameters:{p_notification_id:raw,p_receipt_id:crypto.randomUUID(),p_provider_message_id:'1'}});assert.equal(r.status,403);assert.equal(h.calls.length,0);
  }
  const h=harness(f,{environment:'production'}),r=await h.request({...f.body,extra:'x'.repeat(262144)});assert.equal(r.status,400);assert.equal(h.calls.length,0);
});
