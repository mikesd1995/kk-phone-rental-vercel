'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const R=require('../server/make-owner-real-acceptance');
const V2=require('../server/make-owner-canonical'),Legacy=require('../server/make-owner-ledger-bridge'),Adapter=require('../server/make-owner-telegram-adapter'),Wire=require('../server/make-owner-transport-contract');
const now=Date.parse('2026-10-29T05:15:01.000Z'),uuid=()=>crypto.randomUUID();
const provider={kind:Adapter.KIND,app_name:'kk-telegram-response-adapter-test',module_id:11,connection_id:456,bot_id:'123456',manifest_sha256:Adapter.MANIFEST_SHA256};
function manifest(){return {version:'kk-owner-real-acceptance-round-v1',round_id:uuid(),source_sha:'a'.repeat(40),environment:'production',cutover_id:uuid(),activated_at:'2026-10-29T05:00:00.000Z',not_before:'2026-10-29T05:00:00.000Z',slot_id:'1',due_at:'2026-10-29T05:15:00.000Z',expires_at:'2026-10-29T05:17:00.000Z',attempt_budget:{TELEGRAM_OWNER_ALERTS:1,LINE_OWNER_ALERTS:1},provider_binding_sha256:Adapter.bindingDigest(provider)};}
function context(m){return {version:'kk-owner-canonical-context-v2',cutover_id:m.cutover_id,activated_at:m.activated_at,policy_version:'v4.9.44',consumer_id:'6176241',max_attempts:'4',script_project_id:Legacy.SCRIPT_PROJECT_ID,spreadsheet_id:Legacy.SPREADSHEET_ID,tab:Legacy.TAB,transport:Legacy.TRANSPORT,environment:'production',poll_id:uuid(),slot_id:'1',due_at:m.due_at,observed_at:new Date(now).toISOString(),nonce:uuid()};}
function row(){return Object.assign(Object.fromEntries(Legacy.HEADERS.map(k=>[k,''])),{'Notification ID':'real-event-123','Created At':'2026-10-29T05:00:01.000Z','Event Family ID':'family','Show ID':'show','Change Type':'MATERIAL_EVENT_UPDATE',Priority:'P1','Quiet Hours Policy':'DEFAULT',Payload:'verified event','Audit Event ID':'audit123',Transport:Legacy.TRANSPORT,Status:'QUEUED','Attempt Count':0,'Dedup Key':'real-dedup-123'});}
function cfg(m){return {canonicalEnabled:true,consumerAuthenticated:true,producerEnabled:true,canonicalSecret:'canonical-test-'.repeat(4),secret:'wire-test-'.repeat(5),ownerChatId:'-123456789',gasProjectId:Legacy.SCRIPT_PROJECT_ID,gasDeploymentId:'AKfycb_testdeployment',gasAccessToken:'test-only-token',storeMode:'vercel-oidc',expectedRef:Legacy.PROJECT_REF,adapterBinding:provider,realAcceptance:R.config({KK_OWNER_REAL_ACCEPTANCE_ENABLED:'TRUE',KK_OWNER_REAL_ACCEPTANCE_MANIFEST_JSON:JSON.stringify(m),KK_OWNER_REAL_ACCEPTANCE_SOURCE_SHA:m.source_sha})};}
test('round validates exact canonical manifest, digest, source pin and sticky disabled fences',()=>{
 const m=manifest(),c=cfg(m);assert.equal(R.active(c.realAcceptance,now).round_id,m.round_id);assert.equal(R.digest(m).length,64);
 assert.equal(R.active(R.config({}),now),null);assert.equal(R.active(R.config({KK_OWNER_REAL_ACCEPTANCE_ENABLED:'FALSE'}),now),null);
 for(const env of [{KK_OWNER_REAL_ACCEPTANCE_ENABLED:'bad'},{KK_OWNER_REAL_ACCEPTANCE_ENABLED:'TRUE'},{KK_OWNER_REAL_ACCEPTANCE_STATE_JSON:'{}'},{KK_OWNER_REAL_ACCEPTANCE_MANIFEST_JSON:JSON.stringify(m)},{KK_OWNER_REAL_ACCEPTANCE_SOURCE_SHA:m.source_sha}])assert.throws(()=>R.active(R.config(env),now));
 for(const bad of [{...m,extra:true},{...m,source_sha:'A'.repeat(40)},{...m,not_before:'2026-10-29T05:00:01.000Z'},{...m,slot_id:'2'},{...m,attempt_budget:{...m.attempt_budget,LINE_OWNER_ALERTS:2}},{...m,expires_at:'2026-10-29T05:18:00.000Z'}])assert.throws(()=>R.validateManifest(bad));
 assert.throws(()=>R.active({...c.realAcceptance,sourceSha:'b'.repeat(40)},now));assert.throws(()=>R.active(c.realAcceptance,now-2000));assert.throws(()=>R.active(c.realAcceptance,Date.parse(m.expires_at)));
 assert.throws(()=>R.active(R.config({KK_OWNER_REAL_ACCEPTANCE_ENABLED:'TRUE',KK_OWNER_REAL_ACCEPTANCE_MANIFEST_JSON:JSON.stringify(m),KK_OWNER_REAL_ACCEPTANCE_SOURCE_SHA:m.source_sha,KK_OWNER_REAL_ACCEPTANCE_STATE_JSON:'{"status":"CLOSED"}'}),now));
 const a=R.attestation(m);assert.deepEqual(R.verifyAttestation(a,m),a);assert.throws(()=>R.verifyAttestation({...a,extra:true},m));assert.throws(()=>R.verifyAttestation({...a,manifest_sha256:'f'.repeat(64)},m));
});
test('round deterministic claim binds eleven immutable fields, round and transport without trimming',()=>{
 const m=manifest(),r=row(),hash=R.immutableSourceHash(r),id=R.claimId(m,r.Transport,hash);
 assert.match(id,/^CLAIM\|[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);assert.equal(id,R.claimId(m,r.Transport,hash));
 assert.notEqual(id,R.claimId({...m,round_id:uuid()},r.Transport,hash));assert.notEqual(hash,R.immutableSourceHash({...r,Payload:r.Payload+' '}));assert.notEqual(hash,R.immutableSourceHash({...r,'Audit Event ID':'other'}));
 const c=context(m),p=V2.planCandidate([r],r['Notification ID'],c,now),b=[...p.binding,id],record={context:c,source_row:r,source_notification_id:r['Notification ID'],attempt_count:1,binding_text:JSON.stringify(b),descriptor:{content_version:Wire.hash(JSON.stringify(b))}};
 assert.equal(R.validateRecord(m,record,provider,now),record);
 for(const bad of [{...record,binding_text:JSON.stringify([...p.binding,'CLAIM|'+uuid()])},{...record,source_row:{...r,'Audit Event ID':'changed'}},{...record,context:{...c,slot_id:'2'}},{...record,context:{...c,extra:'unknown'}},{...record,context:{...c,policy_version:'wrong'}},{...record,attempt_count:2}])assert.throws(()=>R.validateRecord(m,bad,provider,now));
 assert.throws(()=>R.validateSource(m,{...r,'Created At':new Date(now+1).toISOString()},now));
 for(const bad of [{...r,'Notification ID':'KKUAT_fake'},{...r,Priority:'TEST'},{...r,'Change Type':'TRANSPORT_UAT'},{...r,'Audit Event ID':'CONTROLLED_UAT|fake'},{...r,Notes:'CLAIM|'+uuid()}])assert.throws(()=>R.validateSource(m,bad,now));
});
test('sticky round blocks legacy admission and reservation while absent/false config preserves ordinary schemas',async()=>{
 const API=require('../server/kk-make-owner-notify')._test;const env={KK_MAKE_OWNER_TRANSPORT_ENABLED:'TRUE',KK_MAKE_OWNER_TRANSPORT_STORE_MODE:'vercel-oidc',KK_MAKE_OWNER_TRANSPORT_PROJECT_REF:Legacy.PROJECT_REF,KK_MAKE_OWNER_TRANSPORT_SIGNING_SECRET:'test-secret-'.repeat(4),KK_OWNER_TELEGRAM_CHAT_ID:'-123456789',KK_OWNER_REAL_ACCEPTANCE_STATE_JSON:'{"status":"CLOSED"}'};
 let calls=0,out;const res={setHeader(){},end(s){out=JSON.parse(s);}};
 for(const stage of ['prepare','admit']){await API.processRequest({method:'POST',body:{stage}},res,env,async()=>{calls++;throw Error('network');});assert.equal(out.error_code,'REAL_ACCEPTANCE_CANONICAL_REQUIRED');}assert.equal(calls,0);
});
test('bounded admit requires signed round echo and deterministic claim before enqueue',async t=>{
 t.mock.method(Date,'now',()=>now);const m=manifest(),c=cfg(m),ct=context(m),r=row(),ticket=uuid(),a=R.attestation(m),claim=R.claimId(m,r.Transport,R.immutableSourceHash(r));let mode='valid';const calls=[];
 const fetchImpl=async(url,init)=>{const b=JSON.parse(init.body);calls.push(b.operation||b.function);let result;
  if(b.function){assert.deepEqual(b.parameters[0].data.acceptance_round,a);const data={ticket,notification_id:r['Notification ID'],claim_id:mode==='wrong-claim'?'CLAIM|'+uuid():claim,claimed_row:{...r,Status:'SENDING','Attempt Count':1,'Last Attempt At':new Date(now).toISOString(),Notes:claim},text:r.Payload,...(mode==='no-echo'?{}:{acceptance_round:a})};return {ok:true,json:async()=>({done:true,response:{result:V2.signContext('claim-result',ct,data,c.canonicalSecret)}})};}
  if(b.operation==='begin')result={context:ct,rows:[r],notification_id:r['Notification ID'],attempt_id:ticket,attempt_no:1};else if(b.operation==='enqueue')result={ticket,attempt_count:1,source_notification_id:r['Notification ID'],descriptor:b.parameters.descriptor,descriptor_sha256:'a'.repeat(64)};else throw Error('unexpected');
  return {ok:true,json:async()=>({ok:true,authenticated:true,version:'v2',project_ref:Legacy.PROJECT_REF,operation:b.operation,provider_sends:0,result})};};
 const body={stage:'canonical-admit',version:'v2',ticket},options={fetchImpl,getTokenImpl:async()=>'test-token'};assert.deepEqual((await V2.handle(body,c,options)).acceptance_round,a);
 for(mode of ['no-echo','wrong-claim']){calls.length=0;await assert.rejects(V2.handle(body,c,options));assert.deepEqual(calls,['begin','runCanonicalOwnerLedgerClaim']);}
});
test('exact sent receipt projection remains available with closed/disabled round after deadline',async t=>{
 t.mock.method(Date,'now',()=>now+300000);const m=manifest(),c=cfg(m),ct=context(m),r=row(),ticket=uuid(),p=V2.planCandidate([r],r['Notification ID'],ct,now),b=[...p.binding,R.claimId(m,r.Transport,R.immutableSourceHash(r))],d={version:Wire.VERSION,audience:Wire.AUDIENCE,...p.transport_identity,event_type:'OWNER_ALERT',content_version:Wire.hash(JSON.stringify(b)),text:r.Payload,created_at:new Date(now).toISOString(),expires_at:new Date(now+120000).toISOString()};c.realAcceptance.enabled=false;
 const record={ticket,attempt_count:1,descriptor:d,context:ct,source_notification_id:r['Notification ID'],status:'SENT'},calls=[];
 const fetchImpl=async(url,init)=>{const body=JSON.parse(init.body);calls.push(body.operation||body.function);if(body.function)return {ok:true,json:async()=>({done:true,response:{result:V2.signContext('project-result',ct,{notification_id:r['Notification ID'],status:'SENT'},c.canonicalSecret)}})};return {ok:true,json:async()=>({ok:true,authenticated:true,version:'v2',project_ref:Legacy.PROJECT_REF,operation:body.operation,provider_sends:0,result:record})};};
 const result=await V2.handle({stage:'canonical-project',envelope:{...d,signature:Wire.sign(d,c.secret)},attempt_id:ticket},c,{fetchImpl,getTokenImpl:async()=>'test-token'});assert.equal(result.projection_verified,true);assert.equal(result.send_allowed,false);assert.deepEqual(calls,['readback','readback','finalizeCanonicalOwnerLedgerAck']);
});
test('bounded poll requires controls before any I/O and signed matching GAS round echo',async t=>{
 t.mock.method(Date,'now',()=>now);const m=manifest(),c=cfg(m),ct=context(m),a=R.attestation(m),calls=[];
 const fetchImpl=async(url,init)=>{const b=JSON.parse(init.body);calls.push(b.operation||b.function);let result;
  if(b.function){assert.deepEqual(b.parameters[0].data,{acceptance_round:a});return {ok:true,json:async()=>({done:true,response:{result:V2.signContext('poll-result',ct,{rows:[],candidates:[],held:[],acceptance_round:a},c.canonicalSecret)}})};}
  if(b.operation==='poll')result=ct;else if(b.operation==='tickets')result=[];else if(b.operation==='poll-readback')result={issued:true,context:ct,held:[]};else throw Error('unexpected');
  return {ok:true,json:async()=>({ok:true,authenticated:true,version:'v2',project_ref:Legacy.PROJECT_REF,operation:b.operation,provider_sends:0,result})};};
 await assert.rejects(V2.handle({stage:'canonical-poll',version:'v2'},c,{fetchImpl}),e=>e.code==='REAL_ACCEPTANCE_FIELDS_INVALID');assert.equal(calls.length,0);
 const result=await V2.handle({stage:'canonical-poll',version:'v2',acceptance_round:{round_id:m.round_id,manifest_sha256:R.digest(m)}},c,{fetchImpl,getTokenImpl:async()=>'test-token'});assert.deepEqual(result.acceptance_round,a);
});
test('dispatch rechecks round deadline after native grant and rejects changed native round binding',async t=>{
 let clock=now;t.mock.method(Date,'now',()=>clock);const m=manifest(),c=cfg(m),ct=context(m),r=row(),ticket=uuid(),receipt=uuid(),dispatchId=uuid(),p=V2.planCandidate([r],r['Notification ID'],ct,now),b=[...p.binding,R.claimId(m,r.Transport,R.immutableSourceHash(r))];
 const d={version:Wire.VERSION,audience:Wire.AUDIENCE,...p.transport_identity,event_type:'OWNER_ALERT',content_version:Wire.hash(JSON.stringify(b)),text:r.Payload,created_at:new Date(now).toISOString(),expires_at:new Date(now+120000).toISOString()},envelope={...d,signature:Wire.sign(d,c.secret)};
 const record={ticket,receipt_id:receipt,descriptor:d,context:ct,source_row:r,source_notification_id:r['Notification ID'],binding_text:JSON.stringify(b),attempt_count:1,status:'RESERVED',provider_binding:provider};
 const calls=[];let delayed=false;const fetchImpl=async(url,init)=>{const b=JSON.parse(init.body);calls.push(b.operation);const result=b.operation==='readback'?record:{...record,provider_dispatch:{dispatch_id:dispatchId,attempt_id:ticket,receipt_id:receipt}};if(b.operation==='dispatch-start'&&delayed)clock=Date.parse(m.expires_at);return {ok:true,json:async()=>({ok:true,authenticated:true,version:'v2',project_ref:Legacy.PROJECT_REF,operation:b.operation,provider_sends:0,result})};};
 const body={stage:'canonical-dispatch-start',envelope_json:JSON.stringify(envelope),attempt_id:ticket,receipt_id:receipt,bot_id:provider.bot_id,provider_binding_sha256:Adapter.bindingDigest(provider)};
 assert.equal((await V2.handle(body,c,{fetchImpl,getTokenImpl:async()=>'test-token'})).send_allowed,true);
 delayed=true;await assert.rejects(V2.handle(body,c,{fetchImpl,getTokenImpl:async()=>'test-token'}),e=>e.code==='REAL_ACCEPTANCE_WINDOW_CLOSED');
 clock=now;record.binding_text=JSON.stringify([...p.binding,'CLAIM|'+uuid()]);calls.length=0;await assert.rejects(V2.handle(body,c,{fetchImpl,getTokenImpl:async()=>'test-token'}));assert.deepEqual(calls,['readback']);
});
module.exports={manifest,context,row,cfg,now,provider};
