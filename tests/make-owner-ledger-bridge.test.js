'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const Bridge=require('../server/make-owner-ledger-bridge');
const API=require('../server/kk-make-owner-notify');
const Contract=require('../server/make-owner-transport-contract');
const Ledger=require('../server/make-owner-ledger-plan');
const SECRET='producer-test-secret-'.repeat(3),TRANSPORT_SECRET='transport-test-secret-'.repeat(3);
const HEADERS=['Notification ID','Created At','Event Family ID','Show ID','Change Type','Priority','Quiet Hours Policy','Payload','Audit Event ID','Transport','Status','Attempt Count','Last Attempt At','Delivery Evidence','Next Retry At','Dedup Key','Notes','HTTP Status','Provider Message ID','API Accepted At','Delivery Confirmed At','Last Error','Feedback Source'];
function fixture(){
  const now=new Date().toISOString(),id='uat|'+crypto.randomUUID(),claim='CLAIM|'+crypto.randomUUID();
  const row=Object.fromEntries(HEADERS.map(h=>[h,'']));Object.assign(row,{'Notification ID':id,'Created At':now,'Change Type':'TRANSPORT_UAT',Priority:'TEST','Quiet Hours Policy':'OWNER_CONTROLLED_UAT',Payload:'ทดสอบระบบแจ้งเตือน เจ้าของเท่านั้น','Audit Event ID':'CONTROLLED_UAT|'+id,Transport:'TELEGRAM_OWNER_ALERTS',Status:'QUEUED','Attempt Count':0,'Dedup Key':'test|'+id,Notes:'OWNER_AUTHORIZED_TRANSPORT_UAT|'+id});
  const claimed={...row,Status:'SENDING','Attempt Count':1,'Last Attempt At':now,Notes:row.Notes+' | '+claim};
  const a={version:'kk-owner-ledger-producer-v1',action:'admit',script_project_id:Bridge.SCRIPT_PROJECT_ID,spreadsheet_id:Bridge.SPREADSHEET_ID,tab:'_Notification_Ledger',transport:'TELEGRAM_OWNER_ALERTS',consumer_id:'6176241',scope:'OWNER_TRANSPORT_UAT',policy_version:'v4.9.44',observed_at:now,nonce:crypto.randomUUID(),notification_id:id,claim_id:claim,before_rows:[row],claimed_row:claimed};
  return sign(a);
}
function sign(a){a.signature=crypto.createHmac('sha256',SECRET).update(Bridge.canonicalAttestation(a)).digest('hex');return a;}
const cfg={storeMode:'vercel-oidc',expectedRef:'zehlsagzrpromtfqqflt',producerSecret:SECRET,producerEnabled:true,secret:TRANSPORT_SECRET};
function fakeStore(options={}){let saved,calls=[];return {calls,get saved(){return saved;},fetch:async(url,init)=>{
  const b=JSON.parse(init.body);calls.push(b);assert.match(url,/zehlsagzrpromtfqqflt\.supabase\.co\/functions\/v1\/kk-runtime-ledger-oidc-probe$/);assert.equal(init.headers.Authorization,'Bearer test-oidc');
  if(b.operation==='enqueue'){
    const p=b.parameters,binding=JSON.parse(p.p_immutable_binding),ids=Ledger.encodeLedgerIdentity({spreadsheet_id:Bridge.SPREADSHEET_ID,tab:Bridge.TAB,transport:Bridge.TRANSPORT,notification_id:binding[4]});
    saved={replayed:false,mapping_record:{...ids,immutable_binding:binding},immutable_binding_text:p.p_immutable_binding,source_audit_event_id:p.p_source_audit_event_id,descriptor:p.p_descriptor,text_sha256:Contract.hash(p.p_descriptor.text),outbox:{...Object.fromEntries(['notification_id','request_id','event_type','entity_id','content_version','created_at','expires_at'].map(k=>[k,p.p_descriptor[k]])),text_sha256:Contract.hash(p.p_descriptor.text),status:'QUEUED',receipt_id:null,reserved_at:null,provider_message_id:null,delivered_at:null}};
    if(options.mismatch)saved.outbox.content_version='0'.repeat(64);
  }
  let result=b.operation==='enqueue'?saved:(options.readback||saved);
  if(b.operation==='claim'){
    if(saved.outbox.status!=='QUEUED')result=[];
    else{Object.assign(saved.outbox,{status:'RESERVED',receipt_id:crypto.randomUUID(),reserved_at:new Date().toISOString()});result=[{status:'RESERVED',receipt_id:saved.outbox.receipt_id}];}
  }
  if(b.operation==='ack'){
    if(saved.outbox.status==='RESERVED'&&saved.outbox.receipt_id===b.parameters.p_receipt_id){
      Object.assign(saved.outbox,{status:'SENT',provider_message_id:options.ackMismatch?'999999':b.parameters.p_provider_message_id,delivered_at:new Date().toISOString()});result=[{...saved.outbox}];
    }else result=[];
  }
  return {ok:true,status:200,json:async()=>({ok:true,authenticated:true,project_ref:'zehlsagzrpromtfqqflt',owner_transport_version:Contract.VERSION,operation:b.operation,provider_sends:0,read_only:b.operation==='readback',result})};
}};}
const opts=s=>({fetchImpl:s.fetch,getTokenImpl:async()=>'test-oidc'});
test('producer signature binds all source and exact post-claim evidence before I/O',async()=>{
  const s=fakeStore(),a=fixture();a.claimed_row.Payload+='tampered';
  await assert.rejects(Bridge.admit(a,cfg,opts(s)),e=>e.code==='PRODUCER_SIGNATURE_INVALID');assert.equal(s.calls.length,0);
});
test('authenticated source attestation executes installed enqueue/readback then signs persisted descriptor',async()=>{
  const s=fakeStore(),a=fixture(),r=await Bridge.admit(a,cfg,opts(s));
  assert.equal(r.send_allowed,false);assert.equal(r.status,'ADMITTED');assert.equal(Contract.verifyEnvelope(r.envelope,TRANSPORT_SECRET).ok,true);
  assert.deepEqual(s.calls.map(x=>x.operation),['enqueue','readback']);assert.equal(s.calls[0].parameters.p_source_audit_event_id,a.before_rows[0]['Audit Event ID']);
  const derivedFresh=Date.parse(s.calls[0].parameters.p_fresh_since);
  assert.ok(derivedFresh>=Date.parse(a.observed_at)-120000&&derivedFresh<=Date.now()-120000);
});
test('signed wrong project, consumer, stale row, historical status and fake source fence cannot enqueue',async()=>{
  for(const mutate of [a=>a.script_project_id='other',a=>a.consumer_id='6600107',a=>a.observed_at='2000-01-01T00:00:00.000Z',a=>{a.before_rows[0].Status='HOLD_TRANSPORT_QUARANTINE';},a=>{a.claimed_row['Attempt Count']=2;},a=>{a.before_rows[0]['Created At']='2000-01-01T00:00:00.000Z';},a=>{a.before_rows[0]['Delivery Evidence']='old';},a=>{a.before_rows[0].Notes='unattributed';a.claimed_row.Notes='unattributed | '+a.claim_id;}]){
    const a=fixture();mutate(a);sign(a);const s=fakeStore();await assert.rejects(Bridge.admit(a,cfg,opts(s)));assert.equal(s.calls.length,0);
  }
});
test('caller cannot supply admission booleans, target overrides or incomplete claimed rows',async()=>{
  for(const extra of [{owner_approved:true},{recipient:'customer'},{fresh_since:'2000-01-01'}]){const a=fixture();Object.assign(a,extra);sign(a);const s=fakeStore();await assert.rejects(Bridge.admit(a,cfg,opts(s)));assert.equal(s.calls.length,0);}
});
test('DB exact readback mismatch never returns a usable signed envelope',async()=>{
  const s=fakeStore({mismatch:true});await assert.rejects(Bridge.admit(fixture(),cfg,opts(s)));assert.equal(s.calls.length,1);
});
test('missing official OIDC context or producer gate cannot call durable database',async()=>{
  const a=fixture(),s=fakeStore();await assert.rejects(Bridge.admit(a,{...cfg,producerEnabled:false},opts(s)));assert.equal(s.calls.length,0);
  await assert.rejects(Bridge.admit(a,cfg,{fetchImpl:s.fetch,getTokenImpl:async()=>''}));assert.equal(s.calls.length,0);
});
test('OIDC store config requires exact pinned project and remains explicit/default disabled',()=>{
  const env={KK_MAKE_OWNER_TRANSPORT_ENABLED:'true',KK_MAKE_OWNER_TRANSPORT_PROJECT_REF:Bridge.PROJECT_REF,KK_MAKE_OWNER_TRANSPORT_STORE_MODE:'vercel-oidc',KK_MAKE_OWNER_TRANSPORT_SIGNING_SECRET:TRANSPORT_SECRET,KK_OWNER_TELEGRAM_CHAT_ID:'-123456789'};
  assert.equal(API._test.config(env).ready,true);assert.equal(API._test.config({...env,KK_MAKE_OWNER_TRANSPORT_PROJECT_REF:'other'}).ready,false);assert.equal(API._test.config({...env,KK_MAKE_OWNER_TRANSPORT_ENABLED:'false'}).ready,false);
});
const apiEnv={KK_MAKE_OWNER_TRANSPORT_ENABLED:'true',KK_MAKE_OWNER_TRANSPORT_PROJECT_REF:Bridge.PROJECT_REF,KK_MAKE_OWNER_TRANSPORT_STORE_MODE:'vercel-oidc',KK_MAKE_OWNER_TRANSPORT_SIGNING_SECRET:TRANSPORT_SECRET,KK_OWNER_TELEGRAM_CHAT_ID:'-123456789',KK_OWNER_LEDGER_PRODUCER_ENABLED:'true',KK_OWNER_LEDGER_PRODUCER_SECRET:SECRET};
async function callApi(body,s){let parsed;const res={setHeader(){},end(raw){parsed=JSON.parse(raw);}};await API._test.processRequest({method:'POST',body},res,apiEnv,s.fetch,{getTokenImpl:async()=>'test-oidc'});return {status:res.statusCode,body:parsed};}
test('OIDC admit -> atomic Prepare -> exact durable ACK -> authenticated readback joins same source and receipt',async()=>{
  const a=fixture(),s=fakeStore(),admitted=await callApi({stage:'admit',attestation:a},s);assert.equal(admitted.status,200);
  const envelope=admitted.body.envelope,prepared=await callApi({stage:'prepare',envelope},s);assert.equal(prepared.status,200);assert.equal(prepared.body.send_allowed,true);assert.equal(prepared.body.target_chat_id,apiEnv.KK_OWNER_TELEGRAM_CHAT_ID);
  const duplicate=await callApi({stage:'prepare',envelope},s);assert.equal(duplicate.status,409);assert.equal(duplicate.body.send_allowed,false);
  const ack={stage:'ack',envelope,receipt_id:prepared.body.receipt_id,provider_message_id:'123456789'},accepted=await callApi(ack,s);assert.equal(accepted.status,200);assert.equal(accepted.body.status,'SENT');assert.equal(accepted.body.delivery_confirmed,false);
  assert.equal(accepted.body.receipt_id,prepared.body.receipt_id);assert.equal(accepted.body.api_accepted_at,s.saved.outbox.delivered_at);
  const replay=await callApi(ack,s);assert.equal(replay.status,200);assert.equal(replay.body.idempotent,true);
  const {before_rows,claimed_row,signature,...read}=a;read.action='readback';read.nonce=crypto.randomUUID();sign(read);
  const readback=await callApi({stage:'readback',attestation:read},s);assert.equal(readback.status,200);assert.equal(readback.body.record.outbox.provider_message_id,'123456789');assert.equal(readback.body.record.outbox.receipt_id,prepared.body.receipt_id);
  assert.ok(s.calls.every(c=>c.probe==='owner-notification'));assert.equal(readback.body.send_allowed,false);
});
test('ACK response alone cannot report SENT when durable exact provider readback differs',async()=>{
  const a=fixture(),s=fakeStore({ackMismatch:true}),{envelope}=await Bridge.admit(a,cfg,opts(s)),prepared=await callApi({stage:'prepare',envelope},s);
  const r=await callApi({stage:'ack',envelope,receipt_id:prepared.body.receipt_id,provider_message_id:'1234567'},s);assert.equal(r.status,409);assert.equal(r.body.error_code,'DELIVERY_ACK_NOT_RESERVED');
});
test('durable SENT can be read after envelope expiry for projection recovery without another claim or send',async context=>{
  const a=fixture(),s=fakeStore(),{envelope}=await Bridge.admit(a,cfg,opts(s)),prepared=await callApi({stage:'prepare',envelope},s);
  assert.equal((await callApi({stage:'ack',envelope,receipt_id:prepared.body.receipt_id,provider_message_id:'123456'},s)).status,200);
  const later=Date.now()+180000;context.mock.method(Date,'now',()=>later);
  const {before_rows,claimed_row,signature,...read}=a;read.action='readback';read.observed_at=new Date(later).toISOString();read.nonce=crypto.randomUUID();sign(read);
  const before=s.calls.length,r=await Bridge.readback(read,cfg,opts(s));assert.equal(r.status,'SENT');assert.equal(r.send_allowed,false);assert.deepEqual(s.calls.slice(before).map(x=>x.operation),['readback']);
});
test('producer stage accepts complete >10KB snapshot while legacy stage retains its 10KB budget',async()=>{
  const a=fixture();
  for(let i=0;i<30;i++){const row={...a.before_rows[0],'Notification ID':'historical|'+i,Status:'HOLD_TRANSPORT_QUARANTINE',Payload:'history'.repeat(100),'Dedup Key':'history|'+i};a.before_rows.push(row);}
  sign(a);assert.ok(Buffer.byteLength(JSON.stringify({stage:'admit',attestation:a}))>10000);
  const s=fakeStore();assert.equal((await callApi({stage:'admit',attestation:a},s)).status,200);
  const before=s.calls.length,r=await callApi({stage:'prepare',envelope:{text:'x'.repeat(10001)}},s);assert.equal(r.status,400);assert.equal(s.calls.length,before);
});
for(const boundary of ['token','fetch','body']){
  test('complete OIDC '+boundary+' operation deadline preserves uncertainty without retries',async context=>{
    const realSetTimeout=global.setTimeout;context.mock.method(global,'setTimeout',(fn,delay,...args)=>realSetTimeout(fn,Math.min(delay,5),...args));
    let calls=0,signal;
    const pending=Bridge.storeRpc('kk_make_owner_notification_readback',{p_source_notification_id:'uat|test'},cfg,{
      getTokenImpl:async()=>boundary==='token'?new Promise(()=>{}):'test-oidc',
      fetchImpl:async(_url,init)=>{calls++;signal=init.signal;if(boundary==='fetch')return new Promise(()=>{});return {ok:true,status:200,json:()=>new Promise(()=>{})};}
    }).then(()=>({code:'UNEXPECTED_SUCCESS'}),e=>e);
    const outcome=await Promise.race([pending,new Promise(resolve=>realSetTimeout(()=>resolve({code:'DEADLINE_MISSING'}),70))]);assert.equal(outcome.code,'DURABLE_STORE_TIMEOUT');assert.equal(calls,boundary==='token'?0:1);if(signal)assert.equal(signal.aborted,true);
  });
}
