// Actual gateway + actual GAS/Core source + exact staged SQL, isolated only.
// The database and clock are disposable. Provider responses are synthetic.
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const pgliteModule=process.env.PGLITE_MODULE;
assert.ok(pgliteModule,'PGLITE_MODULE must point to a disposable PGlite ESM entrypoint');
const {PGlite}=await import(pgliteModule);
const repo=fileURLToPath(new URL('../',import.meta.url));
const require=createRequire(path.join(repo,'package.json'));
const V2=require(path.join(repo,'server/make-owner-canonical.js'));
const Legacy=require(path.join(repo,'server/make-owner-ledger-bridge.js'));
const Adapter=require(path.join(repo,'server/make-owner-telegram-adapter.js'));
const testFile=path.join(repo,'tests/kk-agent-owner-canonical.test.js');
const testSource=await fs.readFile(testFile,'utf8');
const prefixMarker='const plain=x=>JSON.parse(JSON.stringify(x));';
const markerIndex=testSource.indexOf(prefixMarker);
assert.ok(markerIndex>0&&testSource.indexOf(prefixMarker,markerIndex+1)<0,'actual GAS harness delimiter is unique');
const prefix=testSource.slice(0,markerIndex);
assert.ok(prefix.includes('function setup()')&&prefix.includes("secret='canonical-gas-secret-'.repeat(4)"),'actual GAS harness prefix found');
const harnessContext=vm.createContext({require:createRequire(testFile),__dirname:path.dirname(testFile),console,Buffer});
vm.runInContext(prefix+'\nglobalThis.harnessFactory=setup;globalThis.harnessSecret=secret;',harnessContext);
const fixtureProfile=JSON.parse(await fs.readFile(new URL('../tests/fixtures/owner-canonical-capture.synthetic.json',import.meta.url),'utf8'));
assert.equal(fixtureProfile.live_connector_profile_verified,false);
assert.equal(fixtureProfile.scope,'SYNTHETIC_CAPTURE_PROFILE_FOR_DISPOSABLE_TESTS_ONLY');
const profile=fixtureProfile.profile||fixtureProfile;
assert.equal(V2.captureProfileDigest(profile),profile.profile_digest,'synthetic profile digest is independently recomputed');
assert.equal(crypto.createHash('sha256').update(JSON.stringify(fixtureProfile.synthetic_route)).digest('hex'),profile.provider_route_sha256,'exact synthetic callback route is bound');
const plain=x=>JSON.parse(JSON.stringify(x));
const findings=[];
async function run(name,scenario){
 const db=new PGlite();const h=harnessContext.harnessFactory();let now=Date.parse('2026-10-25T05:15:01.000Z');let nativeCalls=[],network=[];
 if(scenario.rawSource){h.row['Notification ID']='งาน "A" \\ identity';h.rows[1]=Legacy.HEADERS.map(k=>h.row[k]);}
 const oldNow=Date.now;Date.now=()=>now;
 const max=scenario.max||4;h.stored.CORE_V1_MAX_ATTEMPTS=String(scenario.gasMax||max);
 const adapterBinding=scenario.adapter?{kind:Adapter.KIND,app_name:'kk-telegram-response-adapter-disposable',module_id:18,connection_id:456,bot_id:'123456',manifest_sha256:Adapter.MANIFEST_SHA256}:null;
 const advance=async ms=>{now+=ms;h.setNow(now);await db.query('update public.retry_test_clock set now_at=$1',[new Date(now).toISOString()]);};
 const rpc=async(operation,parameters)=>{
  nativeCalls.push(operation);
  return (await db.query('select public.kk_owner_canonical_operation($1,$2::jsonb,$3) as result',[operation,JSON.stringify(parameters),'preview'])).rows[0].result;
 };
 const cfg={canonicalEnabled:true,producerEnabled:true,canonicalSecret:harnessContext.harnessSecret,secret:'independent-wire-test-secret-'.repeat(3),consumerAuthenticated:true,gasProjectId:Legacy.SCRIPT_PROJECT_ID,gasDeploymentId:'AKfycb_independent_test_only',gasAccessToken:'synthetic-no-provider-token',storeMode:'vercel-oidc',expectedRef:Legacy.PROJECT_REF,ownerChatId:'-123456789',captureProfile:scenario.adapter?null:profile,captureProfileReviewSha256:scenario.adapter?null:profile.profile_digest,adapterBinding};
 const fetchImpl=async(url,init)=>{
  network.push(url);const body=JSON.parse(init.body);
  if(url.includes('.supabase.co/functions/v1/kk-runtime-ledger-oidc-probe'))return {ok:true,status:200,json:async()=>({ok:true,authenticated:true,project_ref:Legacy.PROJECT_REF,version:'v2',operation:body.operation,provider_sends:0,result:await rpc(body.operation,body.parameters)})};
  if(url.startsWith('https://script.googleapis.com/v1/scripts/')){
   assert.equal(body.devMode,false);assert.equal(typeof h.ctx[body.function],'function');
   return {ok:true,status:200,json:async()=>({done:true,response:{result:plain(h.ctx[body.function](body.parameters[0]))}})};
  }
  throw Error('UNEXPECTED_NETWORK_DESTINATION');
 };
 const call=body=>V2.handle(body,cfg,{fetchImpl,getTokenImpl:async()=>'synthetic-oidc'});
 const setCap=async()=>{await db.exec('create role anon;create role authenticated;create role service_role;');
  await db.exec("create table public.retry_test_clock(now_at timestamptz not null); insert into public.retry_test_clock values('2026-10-25T05:15:01.000Z'); alter function pg_catalog.clock_timestamp() rename to retry_real_clock_timestamp; create function pg_catalog.clock_timestamp() returns timestamptz language sql volatile set search_path='' as 'select now_at from public.retry_test_clock';");
  await db.exec(await fs.readFile(path.join(repo,'supabase/staging/kk-owner-ledger-canonical-v2.sql'),'utf8'));
  await db.query('insert into public.kk_owner_canonical_cutover(cutover_id,activated_at,policy_version,consumer_id,environment,enabled,max_attempts,capture_profile_sha256,provider_binding) values($1,$2,$3,$4,$5,true,$6,$7,$8)',[h.stored.KK_OWNER_CANONICAL_CUTOVER_ID,h.stored.KK_OWNER_CANONICAL_ACTIVATED_AT,'v4.9.44','6176241','preview',max,scenario.adapter?null:profile.profile_digest,adapterBinding?JSON.stringify(adapterBinding):null]);
 };
 const templateBody=(body,values)=>Object.fromEntries(Object.entries(body).map(([k,v])=>{if(typeof v==='string'&&v.startsWith('{{')){assert.equal(typeof values[v],'string','known adapter template field '+v);return [k,values[v]];}return [k,v];}));
 const adapterValues=f=>({'{{parameters.envelope_json}}':f.admitted.envelope_json,'{{parameters.attempt_id}}':f.admitted.attempt_id,'{{parameters.receipt_id}}':f.prepared.receipt_id,'{{toString(connection.botId)}}':adapterBinding.bot_id,'{{parameters.provider_binding_sha256}}':Adapter.bindingDigest(adapterBinding)});
 const adapterReport=async(f,status,response)=>{
  const frame=Adapter.MANIFEST.module.communication[1].response.error.message.replace('{{temp.grant.dispatch_id}}',f.dispatch.dispatch_id).replace('{{statusCode}}',String(status)).replace('{{createJSON(body)}}',JSON.stringify(response));
  return call(templateBody(Adapter.MANIFEST.reporter.communication.body,{...adapterValues(f),'{{parameters.outcome_frame}}':frame}));
 };
 const admit=async()=>{const polled=await call({stage:'canonical-poll',version:'v2'});assert.equal(polled.tickets.length,1);const admitted=await call({stage:'canonical-admit',version:'v2',ticket:polled.tickets[0].ticket});
  if(scenario.adapter){
   const selector={notification_id:admitted.envelope.notification_id,attempt_id:admitted.attempt_id};
   for(const wrongBinding of [null,{...adapterBinding,bot_id:'999999'}]){
    cfg.adapterBinding=wrongBinding;
    await assert.rejects(call({stage:'canonical-prepare',envelope:admitted.envelope,attempt_id:admitted.attempt_id}));
    assert.equal((await rpc('readback',selector)).status,'QUEUED','unbound or mismatched adapter cannot reserve a receipt');
   }
   cfg.adapterBinding=adapterBinding;
  }
  const prepared=await call({stage:'canonical-prepare',envelope:admitted.envelope,attempt_id:admitted.attempt_id});assert.equal(prepared.send_allowed,!scenario.adapter);if(scenario.adapter)assert.equal(prepared.adapter_ready,true);assert.equal(prepared.descriptor_sha256,admitted.descriptor_sha256);const result={polled,admitted,prepared};
  if(scenario.adapter){const start=templateBody(Adapter.MANIFEST.module.communication[0].body,adapterValues(result));await assert.rejects(call({...start,bot_id:'999999'}));result.dispatch=await call(start);assert.equal(result.dispatch.send_allowed,true);assert.equal(result.dispatch.text,admitted.envelope.text);assert.equal(result.dispatch.target_chat_id,cfg.ownerChatId);await assert.rejects(call(start));}
  return result;};
 const refuse=async f=>{
  if(scenario.adapter){const rejected=await adapterReport(f,429,{ok:false,error_code:429,description:'Original provider refusal, synthetic transport only',parameters:{retry_after:600}});assert.equal(rejected.status,'REJECTION_PENDING');assert.equal(h.rows[1][Legacy.HEADERS.indexOf('Status')],'SENDING');return call({stage:'canonical-project-rejection',envelope:f.admitted.envelope,attempt_id:f.admitted.attempt_id});}
  // Substitute only this explicitly synthetic Make binding. This does not
  // assert that the live Telegram connector exposes these original fields.
  const values={'{{13.data.envelope_json}}':f.admitted.envelope_json,'{{13.data.source_notification_id_json}}':f.admitted.source_notification_id_json,'{{13.data.attempt_id}}':f.admitted.attempt_id,'{{13.data.attempt_no}}':String(f.admitted.attempt_no),'{{6.data.receipt_id}}':f.prepared.receipt_id,'{{6.data.descriptor_sha256}}':f.prepared.descriptor_sha256,'{{8.error.status}}':'429','{{toString(8.error.original_response)}}':JSON.stringify({ok:false,error_code:429,description:'Wait "please" \\ retry',parameters:{retry_after:600}})};
  const bodyFor=module=>JSON.parse(module.config.mapper.jsonStringBodyContent.replace(/\{\{[^}]+\}\}/g,key=>{assert.equal(typeof values[key],'string','known synthetic field '+key);return values[key];}));
  const rejectedBody=bodyFor(fixtureProfile.synthetic_route[0]);
  assert.equal(rejectedBody.capture.source_notification_id,h.row['Notification ID']);assert.notEqual(rejectedBody.capture.source_notification_id,f.admitted.envelope.notification_id);
  assert.equal(typeof rejectedBody.capture.attempt_no,'number');assert.equal(typeof rejectedBody.capture.http_status,'number');assert.equal(typeof rejectedBody.capture.telegram_response,'object');
  const rejected=await call(rejectedBody);assert.equal(rejected.status,'REJECTION_PENDING');
  assert.equal(h.rows[1][Legacy.HEADERS.indexOf('Status')],'SENDING','native refusal precedes Sheet write');
  return call(bodyFor(fixtureProfile.synthetic_route[1]));
 };
 try{
  await setCap();
  if(scenario.mismatch){await assert.rejects(call({stage:'canonical-poll',version:'v2'}));assert.equal(h.writes,0);return {name,passed:true};}
  const fake={...h.row,'Notification ID':'untrusted-retry-123','Dedup Key':'untrusted-dedup',Status:'RETRY_WAIT','Attempt Count':1,'Last Attempt At':'2026-10-25T05:01:00.000Z','Next Retry At':'2026-10-25T05:10:00.000Z','HTTP Status':'429','Last Error':'TELEGRAM_API_REJECTED_HTTP_429',Notes:'CLAIM|'+crypto.randomUUID()+' | REJECTED_RETRY_SAFE'};
  h.rows.push(Legacy.HEADERS.map(k=>fake[k]));const badSnapshot=JSON.stringify(h.rows[2]);
  const first=await admit();assert.ok(first.polled.held.some(x=>x.reason_code==='CANONICAL_RETRY_HISTORY_UNVERIFIED'));
  const originalDescriptor=JSON.stringify(first.admitted.envelope);
  if(scenario.adapterLate||scenario.lostGrant){
   if(scenario.adapterLate){await advance(121000);await assert.rejects(adapterReport(first,429,{ok:false,error_code:429}));await advance(779000);}else await advance(900000);
   assert.equal((await call({stage:'canonical-poll',version:'v2'})).tickets.length,0);assert.equal(h.rows[1][Legacy.HEADERS.indexOf('Status')],'SENDING');assert.equal((await db.query('select count(*)::integer n from public.kk_owner_canonical_dispatch')).rows[0].n,1);return {name,passed:true,native_calls:nativeCalls.length,actual_provider_calls:0};
  }
  if(scenario.unknown){
   if(scenario.adapter){await assert.rejects(adapterReport(first,429,{ok:false,error_code:429,result:{message_id:42}}));await advance(900000);assert.equal((await call({stage:'canonical-poll',version:'v2'})).tickets.length,0);assert.equal(h.rows[1][Legacy.HEADERS.indexOf('Status')],'SENDING');return {name,passed:true,native_calls:nativeCalls.length};}
   const contradictory={profile_id:profile.id,scenario_id:'6176241',module_id:8,connection_id:10356915,attempt_id:first.admitted.attempt_id,attempt_no:1,receipt_id:first.prepared.receipt_id,source_notification_id:h.row['Notification ID'],descriptor_sha256:first.prepared.descriptor_sha256,http_status:429,telegram_response:{ok:false,error_code:429,result:{message_id:42}}};
   await assert.rejects(call({stage:'canonical-reject',envelope:first.admitted.envelope,attempt_id:first.admitted.attempt_id,receipt_id:first.prepared.receipt_id,capture:contradictory}));
   await advance(900000);assert.equal((await call({stage:'canonical-poll',version:'v2'})).tickets.length,0);assert.equal(h.rows[1][Legacy.HEADERS.indexOf('Status')],'SENDING');return {name,passed:true,native_calls:nativeCalls.length};
  }
  assert.equal((await refuse(first)).status,'RETRY_WAIT');assert.equal(h.rows[1][Legacy.HEADERS.indexOf('Attempt Count')],1);assert.equal(h.rows[1][Legacy.HEADERS.indexOf('Created At')],h.row['Created At']);
  assert.equal(Date.parse(h.rows[1][Legacy.HEADERS.indexOf('Next Retry At')])-now,600000,'provider wait lower bound honored');
  const writes=h.writes;assert.equal((await call({stage:'canonical-project-rejection',envelope:first.admitted.envelope,attempt_id:first.admitted.attempt_id})).status,'RETRY_WAIT');assert.equal(h.writes,writes,'rejection repair is readback only');
  await advance(900000);const second=await admit();assert.equal(second.admitted.attempt_no,2);assert.equal(second.admitted.envelope.notification_id,first.admitted.envelope.notification_id);assert.notEqual(second.admitted.attempt_id,first.admitted.attempt_id);assert.notEqual(second.prepared.receipt_id,first.prepared.receipt_id);assert.notEqual(second.admitted.envelope.content_version,first.admitted.envelope.content_version);assert.notEqual(second.admitted.envelope.created_at,first.admitted.envelope.created_at);
  await assert.rejects(rpc('ack',{notification_id:first.admitted.envelope.notification_id,attempt_id:first.admitted.attempt_id,receipt_id:first.prepared.receipt_id,provider_message_id:'123456'}));
  if(scenario.adapter){await assert.rejects(adapterReport(first,429,{ok:false,error_code:429}));const oldDispatch=(await db.query('select dispatch_id from public.kk_owner_canonical_dispatch where attempt_id=$1',[first.admitted.attempt_id])).rows[0];assert.equal(oldDispatch.dispatch_id,first.dispatch.dispatch_id);assert.notEqual(second.dispatch.dispatch_id,first.dispatch.dispatch_id);}
  if(scenario.terminal){assert.equal((await refuse(second)).status,'FAILED');assert.equal(h.rows[1][Legacy.HEADERS.indexOf('Next Retry At')],'');await advance(900000);assert.equal((await call({stage:'canonical-poll',version:'v2'})).tickets.length,0);}
  else{
   if(scenario.adapter){const valid={ok:true,result:{message_id:123456789,from:{id:123456,is_bot:true},chat:{id:-123456789}}};for(const bad of [{...valid,error_code:429},{...valid,result:{...valid.result,from:{id:'123456',is_bot:true}}},{...valid,result:{...valid.result,from:{id:999999,is_bot:true}}},{...valid,result:{...valid.result,chat:{id:'-123456789'}}}])await assert.rejects(adapterReport(second,200,bad));}
   const accepted=scenario.adapter?await adapterReport(second,200,{ok:true,result:{message_id:123456789,from:{id:123456,is_bot:true},chat:{id:-123456789}}}):await call({stage:'canonical-ack',envelope:second.admitted.envelope,attempt_id:second.admitted.attempt_id,receipt_id:second.prepared.receipt_id,provider_message_id:'123456789'});assert.equal(accepted.status,'SENT');assert.equal(h.rows[1][Legacy.HEADERS.indexOf('Status')],'SENDING');
   assert.equal((await call({stage:'canonical-project',envelope:second.admitted.envelope,attempt_id:second.admitted.attempt_id})).status,'SENT');assert.equal(h.rows[1][Legacy.HEADERS.indexOf('Status')],'SENT');
   const count=h.writes;await advance(121000);assert.equal((await call({stage:'canonical-project',envelope:second.admitted.envelope,attempt_id:second.admitted.attempt_id})).status,'SENT');assert.equal(h.writes,count,'expired positive projection is readback only');
  }
  await assert.rejects(rpc('readback',{notification_id:first.admitted.envelope.notification_id,attempt_id:first.admitted.attempt_id}));
  const previous=(await db.query('select descriptor,receipt_id,provider_message_id,status from public.kk_owner_canonical_attempt where ticket=$1',[first.admitted.attempt_id])).rows[0];assert.equal(previous.descriptor.created_at,first.admitted.envelope.created_at);assert.equal(previous.descriptor.expires_at,first.admitted.envelope.expires_at);assert.equal(previous.receipt_id,first.prepared.receipt_id);assert.equal(previous.provider_message_id,null);assert.equal(previous.status,'RETRY_WAIT');assert.equal(JSON.stringify(first.admitted.envelope),originalDescriptor);assert.equal(JSON.stringify(h.rows[2]),badSnapshot);assert.equal(h.rows[1][Legacy.HEADERS.indexOf('Created At')],h.row['Created At']);assert.equal(h.rows[1][Legacy.HEADERS.indexOf('Dedup Key')],h.row['Dedup Key']);
  assert.ok(network.every(url=>!url.includes('api.telegram.org')));return {name,passed:true,native_calls:nativeCalls.length,sheet_writes:h.writes,actual_provider_calls:0};
 }catch(error){return {name,passed:false,code:error.code||null,error:error.message,native_calls_tail:nativeCalls.slice(-12),sheet_status:h.rows[1][Legacy.HEADERS.indexOf('Status')],stack:error.stack?.split('\n').slice(0,3)};}
 finally{Date.now=oldNow;await db.close();}
}
findings.push(await run('actual gateway-GAS-native rejection and same-source attempt2 success',{}));
findings.push(await run('stricter cap2 terminalizes exact attempt2 refusal',{max:2,terminal:true}));
findings.push(await run('GAS/native cap mismatch denies before Sheet claim',{max:2,gasMax:4,mismatch:true}));
findings.push(await run('contradictory acceptance/refusal never releases retry',{unknown:true}));
findings.push(await run('synthetic Make callbacks preserve quoted raw identity through actual retry loop',{rawSource:true}));
findings.push(await run('owned Make adapter frame and one-use dispatch complete same-source retry',{adapter:true,rawSource:true}));
findings.push(await run('owned adapter stricter cap terminalizes same-source second refusal',{adapter:true,max:2,terminal:true}));
findings.push(await run('owned adapter preserves contradictory original full body as unknown',{adapter:true,unknown:true}));
findings.push(await run('owned adapter expired outcome cannot retry or renew original descriptor',{adapter:true,adapterLate:true}));
findings.push(await run('lost owned adapter dispatch grant stays consumed without provider or resend',{adapter:true,lostGrant:true}));
const result={scope:'ACTUAL_SOURCE_AND_EXACT_SQL_WITH_DISPOSABLE_SYNTHETIC_CLOCK_AND_PROVIDER_FIXTURES_ONLY',provider_calls:0,production_connections:0,passed:findings.filter(x=>x.passed).length,failed:findings.filter(x=>!x.passed).length,cases:findings};
console.log(JSON.stringify(result,null,2));
const outputIndex=process.argv.indexOf('--output');
if(outputIndex>=0){assert.ok(process.argv[outputIndex+1]&&!process.argv[outputIndex+1].startsWith('--'),'--output requires a file path');await fs.writeFile(process.argv[outputIndex+1],JSON.stringify(result,null,2)+'\n');}
if(result.failed)process.exitCode=1;
