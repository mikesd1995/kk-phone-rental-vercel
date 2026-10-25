'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const V2=require('../server/make-owner-canonical');
const Legacy=require('../server/make-owner-ledger-bridge');
const now=Date.parse('2026-10-25T05:15:01.000Z');
const uuid=()=>crypto.randomUUID();
function context(){return {version:'kk-owner-canonical-context-v2',cutover_id:uuid(),activated_at:'2026-10-25T05:00:00.000Z',policy_version:'v4.9.44',consumer_id:'6176241',max_attempts:'4',script_project_id:Legacy.SCRIPT_PROJECT_ID,spreadsheet_id:Legacy.SPREADSHEET_ID,tab:Legacy.TAB,transport:Legacy.TRANSPORT,environment:'preview',poll_id:uuid(),slot_id:'1',due_at:'2026-10-25T05:15:00.000Z',observed_at:new Date(now).toISOString(),nonce:uuid()};}
function row(){return Object.assign(Object.fromEntries(Legacy.HEADERS.map(k=>[k,''])),{'Notification ID':'normal-event-123','Created At':'2026-10-25T05:00:01.000Z','Event Family ID':'family','Show ID':'show','Change Type':'MATERIAL_EVENT_UPDATE',Priority:'P1','Quiet Hours Policy':'DEFAULT',Payload:'รายละเอียดงานที่ยืนยันแล้ว','Audit Event ID':'audit123',Transport:Legacy.TRANSPORT,Status:'QUEUED','Attempt Count':0,'Dedup Key':'normal-dedup-123'});}
test('canonical preserves old post-cutover source identity and rejects pre-cutover, stale observation and UAT',()=>{
 const c=context(),r=row(),p=V2.planCandidate([r],r['Notification ID'],c,now);
 assert.equal(p.binding[0],'kk-owner-ledger-binding-v2');assert.equal(p.binding[5],r['Created At']);
 assert.equal(p.source_row['Created At'],r['Created At']);
 const offset={...r,'Created At':'2026-10-25T12:00:01.000+07:00'};assert.equal(V2.planCandidate([offset],offset['Notification ID'],c,now).binding[5],offset['Created At']);
 for(const bad of [{...r,'Created At':'2026-10-25T04:59:59.999Z'},{...r,Priority:'TEST'},{...r,Status:'RETRY_WAIT'},{...r,'Delivery Evidence':'unknown'}])assert.throws(()=>V2.planCandidate([bad],r['Notification ID'],c,now));
 assert.throws(()=>V2.planCandidate([r],r['Notification ID'],{...c,observed_at:new Date(now-120001).toISOString()},now));
 assert.throws(()=>V2.planCandidate([r,{...r}],r['Notification ID'],c,now));
 assert.throws(()=>V2.planCandidate([r,{...r,'Notification ID':'other123'}],r['Notification ID'],c,now));
});
test('quiet-held original CreatedAt qualifies under fresh later poll; normal P0 material update cannot bypass quiet hours',()=>{
 const c=context(),r={...row(),Priority:'P0'};assert.equal(V2.quietHeld(r,Date.parse('2026-10-25T17:00:00.000Z')),true);
 assert.equal(V2.quietHeld({...r,'Change Type':'CANCELLATION'},Date.parse('2026-10-25T17:00:00.000Z')),false);
 const later=now+900000,cc={...c,slot_id:'2',due_at:new Date(now+899000).toISOString(),observed_at:new Date(later).toISOString()};
 assert.equal(V2.planCandidate([r],r['Notification ID'],cc,later).binding[5],r['Created At']);
});
test('signed GAS context domain separation binds fixed consumer, action and full response',()=>{
 const cfg={canonicalEnabled:true,canonicalSecret:'v2-secret-'.repeat(8)},c=context();
 const signed=V2.signContext('poll',c,{},cfg.canonicalSecret);
 assert.equal(V2.verifySigned(signed,'poll',cfg,now).context.poll_id,c.poll_id);
 assert.throws(()=>V2.verifySigned({...signed,action:'claim'},'claim',cfg,now));
 assert.throws(()=>V2.verifySigned({...signed,context:{...c,consumer_id:'other'}},'poll',cfg,now));
 assert.throws(()=>V2.verifySigned(signed,'poll',{...cfg,canonicalEnabled:false},now));
});
test('fixed GAS adapter refuses disabled/unbound before I/O, allowlists function and devMode false',async()=>{
 let calls=[];const cfg={canonicalEnabled:true,canonicalSecret:'v2-secret-'.repeat(8),gasDeploymentId:'AKfycb_testdeployment',gasProjectId:Legacy.SCRIPT_PROJECT_ID,gasAccessToken:'test-token'};
 const fetchImpl=async(u,i)=>{calls.push({u,i});return {ok:true,json:async()=>({done:true,response:{result:{ok:true}}})};};
 await assert.rejects(V2.executeGas('poll',{}, {...cfg,canonicalEnabled:false},{fetchImpl}));assert.equal(calls.length,0);
 await assert.rejects(V2.executeGas('other',{},cfg,{fetchImpl}));assert.equal(calls.length,0);
 await V2.executeGas('poll',{},cfg,{fetchImpl});assert.equal(calls[0].u,'https://script.googleapis.com/v1/scripts/AKfycb_testdeployment:run');
 assert.deepEqual(JSON.parse(calls[0].i.body),{function:'runCanonicalOwnerLedgerPoll',parameters:[{}],devMode:false});
});
module.exports={context,row,now};
test('GAS adapter refreshes OAuth using fixed provider endpoint without exposing credentials in results',async()=>{
 const calls=[],cfg={canonicalEnabled:true,gasDeploymentId:'AKfycb_testdeployment',gasProjectId:Legacy.SCRIPT_PROJECT_ID,gasClientId:'client.apps.googleusercontent.com',gasClientSecret:'test-client-secret',gasRefreshToken:'test-refresh-token'};
 const result=await V2.executeGas('poll',{},cfg,{fetchImpl:async(u,i)=>{calls.push({u,i});return {ok:true,json:async()=>u.endsWith('/token')?{access_token:'fresh-private-access',token_type:'Bearer',expires_in:3600}:{done:true,response:{result:{ok:true}}}};}});
 assert.equal(calls[0].u,'https://oauth2.googleapis.com/token');assert.equal(calls[1].i.headers.Authorization,'Bearer fresh-private-access');assert.deepEqual(result,{ok:true});
 assert.equal(new URLSearchParams(calls[0].i.body).get('grant_type'),'refresh_token');
});
test('same-route canonical handler is default OFF before OAuth, GAS or durable I/O',async()=>{
 const API=require('../server/kk-make-owner-notify')._test;let count=0,body;const res={setHeader(){},end(s){body=JSON.parse(s);}};
 const env={KK_MAKE_OWNER_TRANSPORT_ENABLED:'TRUE',KK_MAKE_OWNER_TRANSPORT_STORE_MODE:'vercel-oidc',KK_MAKE_OWNER_TRANSPORT_PROJECT_REF:Legacy.PROJECT_REF,KK_MAKE_OWNER_TRANSPORT_SIGNING_SECRET:'transport-secret-'.repeat(4),KK_OWNER_TELEGRAM_CHAT_ID:'-123456789'};
 await API.processRequest({method:'POST',body:{stage:'canonical-poll',version:'v2'}},res,env,async()=>{count++;throw Error('network');});
 assert.equal(res.statusCode,503);assert.equal(body.error_code,'CANONICAL_DISABLED_OR_UNBOUND');assert.equal(count,0);
});
test('canonical enabled route requires same-consumer secret authentication before any network',async()=>{
 const API=require('../server/kk-make-owner-notify')._test;let count=0,body;const res={setHeader(){},end(s){body=JSON.parse(s);}};
 const env={KK_MAKE_OWNER_TRANSPORT_ENABLED:'TRUE',KK_MAKE_OWNER_TRANSPORT_STORE_MODE:'vercel-oidc',KK_MAKE_OWNER_TRANSPORT_PROJECT_REF:Legacy.PROJECT_REF,KK_MAKE_OWNER_TRANSPORT_SIGNING_SECRET:'transport-secret-'.repeat(4),KK_OWNER_TELEGRAM_CHAT_ID:'-123456789',KK_OWNER_CANONICAL_ENABLED:'TRUE',KK_OWNER_LEDGER_PRODUCER_ENABLED:'TRUE',KK_OWNER_CANONICAL_SECRET:'canonical-secret-'.repeat(4),KK_OWNER_CANONICAL_CONSUMER_SECRET:'same617-consumer-secret-'.repeat(3),KK_OWNER_CANONICAL_GAS_PROJECT_ID:Legacy.SCRIPT_PROJECT_ID,KK_OWNER_CANONICAL_GAS_DEPLOYMENT_ID:'AKfycb_testdeployment',KK_OWNER_CANONICAL_OAUTH_CLIENT_ID:'test-client',KK_OWNER_CANONICAL_OAUTH_CLIENT_SECRET:'client-secret',KK_OWNER_CANONICAL_OAUTH_REFRESH_TOKEN:'refresh-secret'};
 await API.processRequest({method:'POST',body:{stage:'canonical-poll',version:'v2'},headers:{}},res,env,async()=>{count++;throw Error('network');});
 assert.equal(res.statusCode,401);assert.equal(body.error_code,'CANONICAL_CONSUMER_UNAUTHENTICATED');assert.equal(count,0);
});
test('complete canonical OIDC carrier is bounded before network without truncating the source snapshot',async()=>{
 let calls=0;await assert.rejects(V2.store('tickets',{context:context(),rows:[{Payload:'x'.repeat(262144)}],candidates:['normal-event-123']},{canonicalEnabled:true,storeMode:'vercel-oidc',expectedRef:Legacy.PROJECT_REF},{fetchImpl:async()=>{calls++;throw Error('unexpected');},getTokenImpl:async()=>'test-token'}),e=>e.code==='CANONICAL_REQUEST_BOUNDS');assert.equal(calls,0);
});
test('a projected retry keeps source identity while a fresh poll checks due, count and quiet hours',()=>{
 const c=context(),r=row();r.Status='RETRY_WAIT';r['Attempt Count']=1;r['Last Attempt At']='2026-10-25T05:01:00.000Z';r['HTTP Status']='429';r['Next Retry At']='2026-10-25T05:10:00.000Z';r['Last Error']='TELEGRAM_API_REJECTED_HTTP_429';r.Notes='CLAIM|'+uuid()+' | REJECTED_RETRY_SAFE';
 const p=V2.planCandidate([r],r['Notification ID'],c,now);
 assert.equal(p.binding[5],r['Created At']);assert.equal(p.binding[7],r['Dedup Key']);assert.equal(p.attempt_count,2);
 assert.throws(()=>V2.planCandidate([{...r,'Next Retry At':'2026-10-25T05:20:00.000Z'}],r['Notification ID'],c,now));
 assert.throws(()=>V2.planCandidate([{...r,'Attempt Count':4}],r['Notification ID'],c,now));
});
test('only fixed bound original Telegram 429 response is retryable',()=>{
 const profile={id:'native-telegram-617-module8-v1',schema_sha256:'a'.repeat(64),scenario_id:'6176241',module_id:8,connection_id:10356915,profile_digest:'b'.repeat(64)};
 const current={source_notification_id:'normal-event-123',attempt_id:uuid(),attempt_no:1,receipt_id:uuid(),descriptor_sha256:'c'.repeat(64)};
 const capture={profile_id:profile.id,scenario_id:profile.scenario_id,module_id:8,connection_id:profile.connection_id,attempt_id:current.attempt_id,attempt_no:1,receipt_id:current.receipt_id,source_notification_id:current.source_notification_id,descriptor_sha256:current.descriptor_sha256,http_status:429,telegram_response:{ok:false,error_code:429,description:'Too Many Requests',parameters:{retry_after:600}}};
 const classify=(x,p=profile)=>V2.classifyProviderRejection(x,current,p);
 assert.deepEqual(classify(capture),{disposition:'retry',http_status:429,retry_after_seconds:600});
 for(const bad of [{...capture,http_status:'429'},{...capture,module_id:6},{...capture,receipt_id:uuid()},{...capture,telegram_response:{ok:false,error_code:429,result:{message_id:123}}},{...capture,telegram_response:{ok:false,error_code:500}},{...capture,telegram_response:{ok:true,error_code:429}},{...capture,error:'RateLimitError 429'}])assert.equal(classify(bad).disposition,'unknown');
 assert.equal(classify(capture,null).disposition,'unknown');
 assert.equal(classify({...capture,http_status:403,telegram_response:{ok:false,error_code:403}}).disposition,'failed');
 assert.equal(classify({...capture,http_status:408,telegram_response:{ok:false,error_code:408}}).disposition,'unknown');
});
