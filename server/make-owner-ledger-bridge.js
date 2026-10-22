'use strict';
// Executable finite owner-UAT bridge. No provider credentials, public Sheet
// fallback, caller-supplied approval boolean, or implicit natural activation.
const crypto=require('node:crypto');
const Ledger=require('./make-owner-ledger-plan');
const Contract=require('./make-owner-transport-contract');
const Oidc=require('./runtime-ledger-oidc-bridge');
const PROJECT_REF='zehlsagzrpromtfqqflt';
const SCRIPT_PROJECT_ID='1NYvGpqhx8QJR6onHX07_8gWxSwIAvhblMDDpMWfYLEKK02sK352J0_WF';
const SPREADSHEET_ID='1O1PwrnR4DOa5PH8j8vdcgMnSi7pXVEFWk0Gh-_esWMo';
const TAB='_Notification_Ledger',TRANSPORT='TELEGRAM_OWNER_ALERTS';
const PRODUCER_VERSION='kk-owner-ledger-producer-v1';
const HEADERS=['Notification ID','Created At','Event Family ID','Show ID','Change Type','Priority','Quiet Hours Policy','Payload','Audit Event ID','Transport','Status','Attempt Count','Last Attempt At','Delivery Evidence','Next Retry At','Dedup Key','Notes','HTTP Status','Provider Message ID','API Accepted At','Delivery Confirmed At','Last Error','Feedback Source'];
const BASE_FIELDS=['version','action','script_project_id','spreadsheet_id','tab','transport','consumer_id','scope','policy_version','observed_at','nonce','notification_id','claim_id'];
const OPERATIONS={kk_make_owner_notification_enqueue:'enqueue',kk_make_owner_notification_readback:'readback',kk_make_owner_notification_claim:'claim',kk_make_owner_notification_ack:'ack'};
function fail(code){throw Object.assign(new Error(code),{code});}
function exact(value,fields,code='PRODUCER_ATTESTATION_INVALID'){
  if(!Contract.isPlainObject(value))fail(code);
  const d=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(value);
  if(keys.length!==fields.length||keys.some(k=>typeof k!=='string'||!fields.includes(k)||!Object.hasOwn(d[k],'value')))fail(code);
}
function canonicalAttestation(a){
  return JSON.stringify([...BASE_FIELDS.map(k=>a[k]),
    a.action==='admit'?a.before_rows.map(r=>HEADERS.map(k=>r[k])):null,
    a.action==='admit'?HEADERS.map(k=>a.claimed_row[k]):null]);
}
function stamp(v){
  if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v))fail('PRODUCER_CLOCK_INVALID');
  const n=Date.parse(v);if(!Number.isFinite(n)||new Date(n).toISOString()!==v)fail('PRODUCER_CLOCK_INVALID');return n;
}
function verifyAttestation(a,cfg,now=Date.now()){
  if(!cfg.producerEnabled||typeof cfg.producerSecret!=='string'||cfg.producerSecret.length<32||cfg.producerSecret===cfg.secret)fail('PRODUCER_DISABLED_OR_UNBOUND');
  const action=a&&a.action;
  if(!['admit','readback'].includes(action))fail('PRODUCER_ACTION_INVALID');
  exact(a,[...BASE_FIELDS,...(action==='admit'?['before_rows','claimed_row']:[]),'signature']);
  if(BASE_FIELDS.some(k=>typeof a[k]!=='string')||typeof a.signature!=='string')fail('PRODUCER_ATTESTATION_INVALID');
  if(action==='admit'){
    if(!Array.isArray(a.before_rows)||a.before_rows.length<1||a.before_rows.length>128)fail('PRODUCER_SNAPSHOT_BOUND_EXCEEDED');
    a.before_rows.forEach(r=>exact(r,HEADERS));exact(a.claimed_row,HEADERS);
    if(Buffer.byteLength(JSON.stringify(a.before_rows),'utf8')>262144)fail('PRODUCER_SNAPSHOT_BOUND_EXCEEDED');
  }
  if(!/^[a-f0-9]{64}$/.test(a.signature))fail('PRODUCER_SIGNATURE_INVALID');
  const expected=crypto.createHmac('sha256',cfg.producerSecret).update(canonicalAttestation(a),'utf8').digest('hex');
  if(!crypto.timingSafeEqual(Buffer.from(expected,'hex'),Buffer.from(a.signature,'hex')))fail('PRODUCER_SIGNATURE_INVALID');
  if(a.version!==PRODUCER_VERSION||a.script_project_id!==SCRIPT_PROJECT_ID||a.spreadsheet_id!==SPREADSHEET_ID||a.tab!==TAB||a.transport!==TRANSPORT||a.consumer_id!=='6176241'||a.scope!=='OWNER_TRANSPORT_UAT'||a.policy_version!=='v4.9.44')fail('PRODUCER_BINDING_INVALID');
  const observed=stamp(a.observed_at);
  if(observed>now+15000||observed<now-120000||!Contract.isReceiptId(a.nonce)||!/^CLAIM\|/.test(a.claim_id)||!Contract.isReceiptId(a.claim_id.slice(6)))fail('PRODUCER_FRESHNESS_OR_CLAIM_INVALID');
  Ledger.encodeLedgerIdentity({spreadsheet_id:SPREADSHEET_ID,tab:TAB,transport:TRANSPORT,notification_id:a.notification_id});
  return a;
}
function uatRow(row,raw){
  if(row['Notification ID']!==raw||row['Event Family ID']!==''||row['Show ID']!==''||row['Change Type']!=='TRANSPORT_UAT'||row.Priority!=='TEST'||row['Quiet Hours Policy']!=='OWNER_CONTROLLED_UAT'||row['Audit Event ID']!=='CONTROLLED_UAT|'+raw||typeof row.Payload!=='string'||!row.Payload.startsWith('ทดสอบระบบแจ้งเตือน'))fail('OWNER_UAT_SOURCE_REQUIRED');
}
function planAttested(a,now){
  const plan=Ledger.planOwnerLedgerNotification({spreadsheet_id:SPREADSHEET_ID,tab:TAB,rows:a.before_rows,exact_notification_id:a.notification_id,fresh_since:new Date(now-120000).toISOString(),supplied_now:new Date(now).toISOString(),existing_mapping_snapshot:[]});
  const row=a.before_rows.find(r=>r['Notification ID']===a.notification_id);uatRow(row,a.notification_id);
  if(row.Notes!=='OWNER_AUTHORIZED_TRANSPORT_UAT|'+a.notification_id)fail('OWNER_UAT_SOURCE_REQUIRED');
  const claimed=a.claimed_row;uatRow(claimed,a.notification_id);
  const expectedNotes=(row.Notes?row.Notes+' | ':'')+a.claim_id;
  const changes={Status:'SENDING','Attempt Count':1,'Last Attempt At':claimed['Last Attempt At'],Notes:expectedNotes};
  const at=stamp(claimed['Last Attempt At']);
  if(at<stamp(row['Created At'])||at>now+15000||at<now-120000||at>stamp(a.observed_at)+15000)fail('PRODUCER_CLAIM_TIME_INVALID');
  for(const h of HEADERS){const expected=Object.hasOwn(changes,h)?changes[h]:row[h];if(claimed[h]!==expected)fail('PRODUCER_CLAIM_READBACK_MISMATCH');}
  return {plan,row};
}
async function storeRpc(name,parameters,cfg,{fetchImpl=global.fetch,getTokenImpl}={}){
  const operation=OPERATIONS[name];if(!operation)fail('OWNER_STORE_OPERATION_FORBIDDEN');
  // A fetch signal alone does not bound a stalled body/token provider. Keep the
  // complete durable operation bounded and never retry an uncertain write.
  const controller=new AbortController();let timer;
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{reject(Object.assign(new Error('DURABLE_STORE_TIMEOUT'),{code:'DURABLE_STORE_TIMEOUT'}));controller.abort();},5000);});
  const boundedFetch=(url,init)=>fetchImpl(url,{...init,signal:controller.signal});
  const execute=async()=>{
  let result;
  if(cfg.storeMode==='vercel-oidc'){
    if(cfg.expectedRef!==PROJECT_REF)fail('OWNER_STORE_PROJECT_MISMATCH');
    const remote=await Oidc.request({probe:'owner-notification',version:'v1',operation,parameters},{fetchImpl:boundedFetch,...(getTokenImpl?{getTokenImpl}:{})});
    if(!remote.ok)fail(remote.error_code||'OWNER_OIDC_STORE_UNAVAILABLE');
    const b=remote.body;
    if(b.ok!==true||b.authenticated!==true||b.project_ref!==PROJECT_REF||b.owner_transport_version!==Contract.VERSION||b.operation!==operation||b.provider_sends!==0||b.read_only!==(operation==='readback'))fail('OWNER_OIDC_STORE_RESPONSE_INVALID');
    result=b.result;
  }else{
    if(!cfg.url||!cfg.key)fail('OWNER_STORE_UNBOUND');
    const headers={apikey:cfg.key,'Content-Type':'application/json',Accept:'application/json'};
    if(!cfg.key.startsWith('sb_secret_'))headers.Authorization='Bearer '+cfg.key;
    const reply=await boundedFetch(cfg.url+'/rest/v1/rpc/'+name,{method:'POST',headers,redirect:'error',body:JSON.stringify(parameters)});
    if(!reply.ok)fail('OWNER_STORE_REJECTED');result=await reply.json();
  }
  if(operation==='claim'||operation==='ack'){
    if(!Array.isArray(result)||result.length>1||result.some(r=>!Contract.isPlainObject(r)))fail('OWNER_STORE_RESPONSE_INVALID');
  }else if(result!==null&&!Contract.isPlainObject(result))fail('OWNER_STORE_RESPONSE_INVALID');
  if(operation==='enqueue'&&result===null)fail('OWNER_STORE_RESPONSE_INVALID');
  return result;
  };
  try{return await Promise.race([execute(),deadline]);}finally{clearTimeout(timer);}
}
function validatePersisted(r,raw){
  if(!Contract.isPlainObject(r)||!Contract.isPlainObject(r.mapping_record)||!Contract.isPlainObject(r.outbox))fail('OWNER_DURABLE_JOIN_INVALID');
  const ids=Ledger.encodeLedgerIdentity({spreadsheet_id:SPREADSHEET_ID,tab:TAB,transport:TRANSPORT,notification_id:raw}),m=r.mapping_record,b=m.immutable_binding,d=r.descriptor,o=r.outbox;
  if(JSON.stringify(m.source_tuple)!==JSON.stringify(ids.source_tuple)&&(!m.source_tuple||Object.keys(ids.source_tuple).some(k=>m.source_tuple[k]!==ids.source_tuple[k])))fail('OWNER_DURABLE_JOIN_INVALID');
  if(!Array.isArray(b)||b.length!==13||b.some(x=>typeof x!=='string')||JSON.stringify(b)!==r.immutable_binding_text||b[0]!=='kk-owner-ledger-binding-v1'||b[1]!==SPREADSHEET_ID||b[2]!==TAB||b[3]!==TRANSPORT||b[4]!==raw)fail('OWNER_DURABLE_JOIN_INVALID');
  uatRow({'Notification ID':raw,'Event Family ID':b[8],'Show ID':b[9],'Change Type':b[10],Priority:b[11],'Quiet Hours Policy':b[12],'Audit Event ID':r.source_audit_event_id,Payload:b[6]},raw);
  if(!Contract.isPlainObject(d)||Object.keys(d).length!==10||Object.values(d).some(v=>typeof v!=='string')||d.version!==Contract.VERSION||d.audience!==Contract.AUDIENCE||d.event_type!=='OWNER_ALERT'||d.text!==b[6])fail('OWNER_DURABLE_JOIN_INVALID');
  const bindingHash=crypto.createHash('sha256').update(r.immutable_binding_text,'utf8').digest('hex'),textHash=Contract.hash(d.text);
  for(const [k,v]of Object.entries(ids.transport_identity)){if(m.transport_identity?.[k]!==v||d[k]!==v||o[k]!==v)fail('OWNER_DURABLE_JOIN_INVALID');}
  if(d.content_version!==bindingHash||o.content_version!==bindingHash||r.text_sha256!==textHash||o.text_sha256!==textHash||o.event_type!=='OWNER_ALERT'||Date.parse(o.created_at)!==Date.parse(d.created_at)||Date.parse(o.expires_at)!==Date.parse(d.expires_at)||!(Date.parse(d.expires_at)>Date.parse(d.created_at))||Date.parse(d.expires_at)-Date.parse(d.created_at)>120000)fail('OWNER_DURABLE_JOIN_INVALID');
  if(!['QUEUED','RESERVED','SENT','FAILED_REQUIRES_REVIEW','EXPIRED'].includes(o.status))fail('OWNER_DURABLE_STATE_INVALID');
  if(o.status==='QUEUED'&&[o.receipt_id,o.reserved_at,o.provider_message_id,o.delivered_at].some(v=>v!==null))fail('OWNER_DURABLE_STATE_INVALID');
  if(o.status==='SENT'&&(!Contract.isReceiptId(o.receipt_id)||typeof o.provider_message_id!=='string'||!/^\d{1,20}$/.test(o.provider_message_id)||!Number.isFinite(Date.parse(o.delivered_at))||!Number.isFinite(Date.parse(o.reserved_at))||Date.parse(o.delivered_at)<Date.parse(o.reserved_at)||Date.parse(o.delivered_at)>=Date.parse(o.expires_at)))fail('OWNER_DURABLE_STATE_INVALID');
  return r;
}
async function admit(a,cfg,options={}){
  const now=Date.now();verifyAttestation(a,cfg,now);if(a.action!=='admit')fail('PRODUCER_ACTION_INVALID');
  const {plan,row}=planAttested(a,now);
  const initial=await storeRpc('kk_make_owner_notification_enqueue',{p_immutable_binding:JSON.stringify(plan.immutable_binding),p_source_audit_event_id:row['Audit Event ID'],p_descriptor:plan.descriptor,p_fresh_since:new Date(now-120000).toISOString()},cfg,options);
  validatePersisted(initial,a.notification_id);
  if(initial.immutable_binding_text!==JSON.stringify(plan.immutable_binding)||initial.source_audit_event_id!==row['Audit Event ID'])fail('OWNER_DURABLE_JOIN_INVALID');
  const r=validatePersisted(await storeRpc('kk_make_owner_notification_readback',{p_source_notification_id:a.notification_id},cfg,options),a.notification_id);
  if(JSON.stringify(r.descriptor)!==JSON.stringify(initial.descriptor)&&Object.keys(initial.descriptor).some(k=>r.descriptor[k]!==initial.descriptor[k]))fail('OWNER_DURABLE_JOIN_INVALID');
  if(r.outbox.status!=='QUEUED')fail('OWNER_DURABLE_ALREADY_ATTEMPTED');
  const envelope={...r.descriptor,signature:Contract.sign(r.descriptor,cfg.secret)};
  const verified=Contract.verifyEnvelope(envelope,cfg.secret);if(!verified.ok)fail(verified.error_code);
  return {ok:true,status:'ADMITTED',send_allowed:false,source_notification_id:a.notification_id,sheet_claim_id:a.claim_id,envelope};
}
async function readback(a,cfg,options={}){
  verifyAttestation(a,cfg);if(a.action!=='readback')fail('PRODUCER_ACTION_INVALID');
  const r=validatePersisted(await storeRpc('kk_make_owner_notification_readback',{p_source_notification_id:a.notification_id},cfg,options),a.notification_id);
  return {ok:true,send_allowed:false,source_notification_id:a.notification_id,sheet_claim_id:a.claim_id,status:r.outbox.status,record:r};
}
module.exports={PROJECT_REF,SCRIPT_PROJECT_ID,SPREADSHEET_ID,TAB,TRANSPORT,PRODUCER_VERSION,HEADERS,BASE_FIELDS,canonicalAttestation,verifyAttestation,planAttested,storeRpc,validatePersisted,admit,readback};
