'use strict';
// Canonical v2 is isolated from finite UAT v1. No provider API is called here.
const crypto=require('node:crypto');
const Legacy=require('./make-owner-ledger-bridge');
const Ledger=require('./make-owner-ledger-plan');
const Wire=require('./make-owner-transport-contract');
const Oidc=require('./runtime-ledger-oidc-bridge');
const FUNCTIONS={poll:'runCanonicalOwnerLedgerPoll',claim:'runCanonicalOwnerLedgerClaim',project:'finalizeCanonicalOwnerLedgerAck'};
const CONTEXT_FIELDS=['version','cutover_id','activated_at','policy_version','consumer_id','script_project_id','spreadsheet_id','tab','transport','environment','poll_id','slot_id','due_at','observed_at','nonce'];
const EVIDENCE=['Last Attempt At','Delivery Evidence','Next Retry At','HTTP Status','Provider Message ID','API Accepted At','Delivery Confirmed At','Last Error','Feedback Source'];
const HELD_CODES=new Set(['CANONICAL_SOURCE_TYPE_INVALID','CANONICAL_ID_INVALID','CANONICAL_ID_AMBIGUOUS','CANONICAL_DEDUP_AMBIGUOUS','CANONICAL_SOURCE_ALREADY_ATTEMPTED','CANONICAL_NORMAL_SOURCE_REQUIRED','CANONICAL_SOURCE_CUTOVER_INVALID','CANONICAL_SOURCE_HELD','QUIET_HOURS_HOLD','CANONICAL_CORE_SELECTION_HELD','CANONICAL_RENDER_INVALID','SOURCE_URL_REQUIRED','OWNER_ACTION_REQUIRED','NOTIFICATION_TOO_LONG','MACHINE_GARBAGE_PAYLOAD_BLOCKED','GATEWAY_CANDIDATE_REJECTED']);
function fail(code){throw Object.assign(new Error(code),{code});}
function exact(v,keys){if(!Wire.isPlainObject(v)||Reflect.ownKeys(v).length!==keys.length||Reflect.ownKeys(v).some(k=>typeof k!=='string'||!keys.includes(k)||!Object.hasOwn(Object.getOwnPropertyDescriptor(v,k),'value')))fail('CANONICAL_FIELDS_INVALID');return v;}
function stamp(v){if(typeof v!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString()!==v)fail('CANONICAL_CLOCK_INVALID');return Date.parse(v);}
function sourceStamp(v){
 if(typeof v!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?(?:Z|[+-]\d\d:\d\d)$/.test(v)||!Number.isFinite(Date.parse(v)))fail('CANONICAL_SOURCE_CLOCK_INVALID');
 const local=v.slice(0,19)+'Z';if(new Date(local).toISOString().slice(0,19)!==v.slice(0,19))fail('CANONICAL_SOURCE_CLOCK_INVALID');return Date.parse(v);
}
function validateContext(c,now=Date.now(),fresh=true){
 exact(c,CONTEXT_FIELDS);if(Object.values(c).some(v=>typeof v!=='string')||c.version!=='kk-owner-canonical-context-v2'||c.policy_version!=='v4.9.44'||c.consumer_id!=='6176241'||c.script_project_id!==Legacy.SCRIPT_PROJECT_ID||c.spreadsheet_id!==Legacy.SPREADSHEET_ID||c.tab!==Legacy.TAB||c.transport!==Legacy.TRANSPORT||!['production','preview'].includes(c.environment)||!['cutover_id','poll_id','nonce'].every(k=>Wire.isReceiptId(c[k]))||! /^[1-9][0-9]*$/.test(c.slot_id))fail('CANONICAL_BINDING_INVALID');
 const epoch=stamp(c.activated_at),due=stamp(c.due_at),observed=stamp(c.observed_at);
 if(due!==epoch+Number(c.slot_id)*900000||observed<due||observed>due+120000||(fresh&&(observed<now-120000||observed>now+15000||now>due+120000)))fail('CANONICAL_CONTEXT_EXPIRED');return c;
}
function quietHeld(r,now){const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Bangkok',hour:'2-digit',hourCycle:'h23'}).format(now));return (hour>=23||hour<7)&&!(r.Priority==='P0'&&['CANCELLATION','POSTPONEMENT','DATE_CHANGE','VENUE_CHANGE'].includes(r['Change Type']));}
function planCandidate(rows,id,c,now=Date.now()){
 validateContext(c,now);if(!Array.isArray(rows)||rows.length<1||rows.length>128||Buffer.byteLength(JSON.stringify(rows))>262144)fail('CANONICAL_SNAPSHOT_BOUNDS');
 rows.forEach(r=>exact(r,Legacy.HEADERS));const found=rows.filter(r=>r['Notification ID']===id);if(found.length!==1)fail('CANONICAL_ID_AMBIGUOUS');const r=found[0];
 const ids=Ledger.encodeLedgerIdentity({spreadsheet_id:Legacy.SPREADSHEET_ID,tab:Legacy.TAB,transport:Legacy.TRANSPORT,notification_id:id});
 if(r.Transport!==Legacy.TRANSPORT||r.Status!=='QUEUED'||![0,'0'].includes(r['Attempt Count'])||EVIDENCE.some(k=>r[k]!==''))fail('CANONICAL_SOURCE_ALREADY_ATTEMPTED');
 if(['Event Family ID','Change Type','Priority','Quiet Hours Policy','Audit Event ID','Dedup Key'].some(k=>typeof r[k]!=='string'||!r[k])||r['Change Type']==='TRANSPORT_UAT'||r.Priority==='TEST'||r['Quiet Hours Policy']==='OWNER_CONTROLLED_UAT'||/^(KKUAT_|CONTROLLED_UAT\|)/.test(id)||r['Audit Event ID'].startsWith('CONTROLLED_UAT|')||/OWNER_AUTHORIZED_TRANSPORT_UAT|CLAIM\|/.test(r.Notes))fail('CANONICAL_NORMAL_SOURCE_REQUIRED');
 if(rows.filter(x=>x.Transport===r.Transport&&x['Dedup Key']===r['Dedup Key']).length!==1)fail('CANONICAL_DEDUP_AMBIGUOUS');
 if(Legacy.HEADERS.some(k=>k!=='Attempt Count'&&typeof r[k]!=='string'))fail('CANONICAL_SOURCE_TYPE_INVALID');
 const created=sourceStamp(r['Created At']);if(created<stamp(c.activated_at)||created>stamp(c.observed_at)||created>now)fail('CANONICAL_SOURCE_CUTOVER_INVALID');
 if(typeof r.Payload!=='string'||!r.Payload.trim()||r.Payload!==r.Payload.trim()||r.Payload.length>2048||quietHeld(r,now))fail('CANONICAL_SOURCE_HELD');
 const binding=['kk-owner-ledger-binding-v2',Legacy.SPREADSHEET_ID,Legacy.TAB,Legacy.TRANSPORT,id,r['Created At'],r.Payload,r['Dedup Key'],r['Event Family ID'],r['Show ID'],r['Change Type'],r.Priority,r['Quiet Hours Policy'],JSON.stringify(c)];
 return {binding,source_row:r,transport_identity:ids.transport_identity};
}
function canonicalSigned(a){return JSON.stringify(['KK_OWNER_CANONICAL_V2',a.action,CONTEXT_FIELDS.map(k=>a.context[k]),a.data]);}
function signContext(action,context,data,secret){const a={version:'kk-owner-ledger-producer-v2',action,context,data};a.signature=crypto.createHmac('sha256',secret).update(canonicalSigned(a)).digest('hex');return a;}
function verifySigned(a,action,cfg,now=Date.now(),fresh=true){
 if(!cfg.canonicalEnabled||typeof cfg.canonicalSecret!=='string'||cfg.canonicalSecret.length<32||cfg.canonicalSecret===cfg.secret)fail('CANONICAL_DISABLED_OR_UNBOUND');
 exact(a,['version','action','context','data','signature']);validateContext(a.context,now,fresh);
 if(a.version!=='kk-owner-ledger-producer-v2'||a.action!==action||! /^[a-f0-9]{64}$/.test(a.signature||''))fail('CANONICAL_ATTESTATION_INVALID');
 const expected=signContext(action,a.context,a.data,cfg.canonicalSecret).signature;if(!crypto.timingSafeEqual(Buffer.from(a.signature,'hex'),Buffer.from(expected,'hex')))fail('CANONICAL_SIGNATURE_INVALID');return a;
}
async function bounded(run,ms=5000){const controller=new AbortController();let timer;try{return await Promise.race([run(controller.signal),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Object.assign(new Error('CANONICAL_OUTCOME_UNKNOWN'),{code:'CANONICAL_OUTCOME_UNKNOWN'}));},ms);})]);}finally{clearTimeout(timer);}}
async function executeGas(action,signed,cfg,{fetchImpl=global.fetch,signal:outerSignal}={}){
 if(!cfg.canonicalEnabled||cfg.gasProjectId!==Legacy.SCRIPT_PROJECT_ID||!/^[-_A-Za-z0-9]{16,200}$/.test(cfg.gasDeploymentId||'')||(!cfg.gasAccessToken&&!(cfg.gasClientId&&cfg.gasClientSecret&&cfg.gasRefreshToken))||!Object.hasOwn(FUNCTIONS,action))fail('CANONICAL_GAS_DISABLED_OR_UNBOUND');
 return bounded(async signal=>{
  if(outerSignal)signal=AbortSignal.any([signal,outerSignal]);
  let token=cfg.gasAccessToken;
  if(!token){
   const reply=await fetchImpl('https://oauth2.googleapis.com/token',{method:'POST',redirect:'error',signal,headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:cfg.gasClientId,client_secret:cfg.gasClientSecret,refresh_token:cfg.gasRefreshToken}).toString()});
   if(!reply.ok)fail('CANONICAL_OAUTH_REJECTED');const oauth=await reply.json();
   if(typeof oauth.access_token!=='string'||!oauth.access_token||oauth.token_type!=='Bearer'||!Number.isFinite(oauth.expires_in)||oauth.expires_in<30)fail('CANONICAL_OAUTH_INVALID');token=oauth.access_token;
  }
  const response=await fetchImpl('https://script.googleapis.com/v1/scripts/'+cfg.gasDeploymentId+':run',{method:'POST',redirect:'error',signal,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({function:FUNCTIONS[action],parameters:[signed],devMode:false})});if(!response.ok)fail('CANONICAL_GAS_REJECTED');const b=await response.json();if(b.done!==true||b.error||!b.response||!Wire.isPlainObject(b.response.result))fail('CANONICAL_GAS_OUTCOME_UNKNOWN');return b.response.result;
 });
}
async function store(operation,parameters,cfg,options={}){
 if(!cfg.canonicalEnabled||cfg.storeMode!=='vercel-oidc'||cfg.expectedRef!==Legacy.PROJECT_REF)fail('CANONICAL_STORE_DISABLED_OR_UNBOUND');
 const request={probe:'owner-canonical',version:'v2',operation,parameters};if(Buffer.byteLength(JSON.stringify(request),'utf8')>262144)fail('CANONICAL_REQUEST_BOUNDS');
 return bounded(async signal=>{if(options.signal)signal=AbortSignal.any([signal,options.signal]);const r=await Oidc.request(request,{...options,fetchImpl:(u,i)=>(options.fetchImpl||global.fetch)(u,{...i,signal})});
 if(!r.ok)fail(r.error_code||'CANONICAL_STORE_UNAVAILABLE');const b=r.body;if(b.ok!==true||b.authenticated!==true||b.project_ref!==Legacy.PROJECT_REF||b.version!=='v2'||b.operation!==operation||b.provider_sends!==0)fail('CANONICAL_STORE_RESPONSE_INVALID');return b.result;});
}
function descriptorMatch(record,envelope){if(!Wire.isPlainObject(record)||!Wire.isPlainObject(record.descriptor)||!Object.keys(record.descriptor).every(k=>record.descriptor[k]===envelope[k]))fail('CANONICAL_DURABLE_DESCRIPTOR_MISMATCH');}
function heldEntry(rows,index,reason_code){return {row_index:index+1,notification_id_sha256:crypto.createHash('sha256').update(JSON.stringify(rows[index]['Notification ID']),'utf8').digest('hex'),reason_code};}
function validateHeld(held,rows){
 if(!Array.isArray(held)||held.length>128||Buffer.byteLength(JSON.stringify(held))>32768)fail('CANONICAL_HELD_METADATA_INVALID');const indices=new Set();
 for(const h of held){exact(h,['row_index','notification_id_sha256','reason_code']);if(!Number.isInteger(h.row_index)||h.row_index<1||h.row_index>rows.length||indices.has(h.row_index)||!HELD_CODES.has(h.reason_code)||h.notification_id_sha256!==heldEntry(rows,h.row_index-1,h.reason_code).notification_id_sha256)fail('CANONICAL_HELD_METADATA_INVALID');indices.add(h.row_index);}return held;
}
async function runHandle(body,cfg,options={}){
 if(!cfg.canonicalEnabled||!cfg.producerEnabled||typeof cfg.canonicalSecret!=='string'||cfg.canonicalSecret.length<32||cfg.canonicalSecret===cfg.secret||(!cfg.gasAccessToken&&!(cfg.gasClientId&&cfg.gasClientSecret&&cfg.gasRefreshToken))||!cfg.gasDeploymentId||cfg.gasProjectId!==Legacy.SCRIPT_PROJECT_ID)fail('CANONICAL_DISABLED_OR_UNBOUND');
 if(cfg.consumerAuthenticated!==true)fail('CANONICAL_CONSUMER_UNAUTHENTICATED');
 const op=body.stage;
 if(op==='canonical-poll-readback'){
  exact(body,['stage','version','poll_id']);if(body.version!=='v2'||!Wire.isReceiptId(body.poll_id))fail('CANONICAL_FIELDS_INVALID');
  const read=await store('poll-readback',{poll_id:body.poll_id},cfg,options);if(!Wire.isPlainObject(read)||read.context?.poll_id!==body.poll_id||!Array.isArray(read.held)||read.held.length>128)fail('CANONICAL_POLL_READBACK_INVALID');
  return {ok:true,mode:'CANONICAL_V2',send_allowed:false,poll_id:body.poll_id,issued:read.issued,held:read.held};
 }
 if(op==='canonical-poll'){
  exact(body,['stage','version']);if(body.version!=='v2')fail('CANONICAL_FIELDS_INVALID');const context=validateContext(await store('poll',{},cfg,options));
  const result=verifySigned(await executeGas('poll',signContext('poll',context,{},cfg.canonicalSecret),cfg,options),'poll-result',cfg);
  if(JSON.stringify(result.context)!==JSON.stringify(context))fail('CANONICAL_CONTEXT_MISMATCH');
  exact(result.data,['rows','candidates','held']);if(!Array.isArray(result.data.rows)||result.data.rows.length>128||Buffer.byteLength(JSON.stringify(result.data.rows))>262144||!Array.isArray(result.data.candidates)||result.data.candidates.length>128)fail('CANONICAL_SNAPSHOT_BOUNDS');
  const held=validateHeld(result.data.held,result.data.rows).slice(),candidates=[];
  for(const id of result.data.candidates){try{planCandidate(result.data.rows,id,context);candidates.push(id);}catch(_){const index=result.data.rows.findIndex(r=>r['Notification ID']===id);if(index<0)fail('CANONICAL_CANDIDATE_INVALID');if(!held.some(h=>h.row_index===index+1))held.push(heldEntry(result.data.rows,index,'GATEWAY_CANDIDATE_REJECTED'));}}
  validateHeld(held,result.data.rows);
  if(candidates.some(id=>held.some(h=>result.data.rows[h.row_index-1]['Notification ID']===id)))fail('CANONICAL_HELD_CANDIDATE_CONFLICT');
  const tickets=await store('tickets',{context,rows:result.data.rows,candidates,held},cfg,options);
  if(!Array.isArray(tickets)||tickets.some(ticket=>!Wire.isReceiptId(ticket)))fail('CANONICAL_TICKET_RESPONSE_INVALID');
  return {ok:true,mode:'CANONICAL_V2',send_allowed:false,poll_id:context.poll_id,tickets:tickets.map(ticket=>({ticket})),held};
 }
 if(op==='canonical-admit'){
  exact(body,['stage','version','ticket']);if(body.version!=='v2'||!Wire.isReceiptId(body.ticket))fail('CANONICAL_FIELDS_INVALID');
  // Durable consumption precedes GAS. Any timeout leaves CLAIMING/SENDING fenced.
  const t=await store('begin',{ticket:body.ticket},cfg,options);validateContext(t.context);planCandidate(t.rows,t.notification_id,t.context);
  const signed=verifySigned(await executeGas('claim',signContext('claim',t.context,{ticket:body.ticket,notification_id:t.notification_id,rows:t.rows},cfg.canonicalSecret),cfg,options),'claim-result',cfg);
  if(JSON.stringify(signed.context)!==JSON.stringify(t.context))fail('CANONICAL_CONTEXT_MISMATCH');
  exact(signed.data,['ticket','notification_id','claim_id','claimed_row','text']);if(signed.data.ticket!==body.ticket||signed.data.notification_id!==t.notification_id)fail('CANONICAL_CLAIM_MISMATCH');
  const p=planCandidate(t.rows,t.notification_id,t.context),r=p.source_row,claimed=signed.data.claimed_row;exact(claimed,Legacy.HEADERS);
  if(!/^CLAIM\|/.test(signed.data.claim_id)||!Wire.isReceiptId(signed.data.claim_id.slice(6)))fail('CANONICAL_CLAIM_MISMATCH');
  const at=stamp(claimed['Last Attempt At']),now=Date.now();if(at<stamp(t.context.observed_at)||at<now-120000||at>now+15000)fail('CANONICAL_CLAIM_EXPIRED');
  const changes={Status:'SENDING','Attempt Count':1,'Last Attempt At':claimed['Last Attempt At'],Notes:(r.Notes?r.Notes+' | ':'')+signed.data.claim_id};
  if(Legacy.HEADERS.some(k=>claimed[k]!== (Object.hasOwn(changes,k)?changes[k]:r[k])))fail('CANONICAL_CLAIM_MISMATCH');
  if(typeof signed.data.text!=='string'||!signed.data.text.trim()||signed.data.text.length>2048)fail('CANONICAL_RENDER_INVALID');
  const binding=[...p.binding,signed.data.claim_id],d={version:Wire.VERSION,audience:Wire.AUDIENCE,...p.transport_identity,event_type:'OWNER_ALERT',content_version:Wire.hash(JSON.stringify(binding)),text:signed.data.text,created_at:new Date(now).toISOString(),expires_at:new Date(now+120000).toISOString()};
  const record=await store('enqueue',{ticket:body.ticket,binding:JSON.stringify(binding),descriptor:d,claimed_row:claimed},cfg,options);descriptorMatch(record,d);
  const envelope={...record.descriptor,signature:Wire.sign(record.descriptor,cfg.secret)};
  return {ok:true,mode:'CANONICAL_V2',status:'ADMITTED',send_allowed:false,envelope,envelope_json:JSON.stringify(envelope)};
 }
 if(['canonical-prepare','canonical-ack','canonical-project'].includes(op)){
  const keys=op==='canonical-ack'?['stage','envelope','receipt_id','provider_message_id']:['stage','envelope'];exact(body,keys);
  const e=body.envelope;
  exact(e,['version','audience','notification_id','request_id','entity_id','event_type','content_version','text','created_at','expires_at','signature']);
  if(Object.values(e).some(v=>typeof v!=='string'))fail('CANONICAL_FIELDS_INVALID');
  if(op!=='canonical-project'){const v=Wire.verifyEnvelope(e,cfg.secret);if(!v.ok)fail(v.error_code);}
  const record=await store('readback',{notification_id:e.notification_id},cfg,options);descriptorMatch(record,e);
  if(!/^[a-f0-9]{64}$/.test(e.signature||'')||!crypto.timingSafeEqual(Buffer.from(Wire.sign(record.descriptor,cfg.secret),'hex'),Buffer.from(e.signature,'hex')))fail('SIGNATURE_INVALID');
  if(op==='canonical-prepare'){
   if(Date.parse(e.expires_at)<=Date.now()+15000)fail('CANONICAL_PROVIDER_MARGIN_EXPIRED');
   const prepared=await Wire.prepareDispatch(e,{secret:cfg.secret,ownerChatId:cfg.ownerChatId,claimFn:async()=>store('reserve',{notification_id:e.notification_id},cfg,options)});
   if(!prepared.send_allowed||Date.parse(e.expires_at)<=Date.now()+15000)fail(prepared.error_code||'CANONICAL_PROVIDER_MARGIN_EXPIRED');return prepared;
  }
  if(op==='canonical-ack'){
   if(!Wire.isReceiptId(body.receipt_id)||typeof body.provider_message_id!=='string'||! /^[1-9][0-9]{0,19}$/.test(body.provider_message_id))fail('CANONICAL_ACK_INVALID');
   await store('ack',{notification_id:e.notification_id,receipt_id:body.receipt_id,provider_message_id:body.provider_message_id},cfg,options);
  }
  const durable=await store('readback',{notification_id:e.notification_id},cfg,options);descriptorMatch(durable,e);
  if(durable.status!=='SENT'||(op==='canonical-ack'&&(durable.receipt_id!==body.receipt_id||durable.provider_message_id!==body.provider_message_id)))fail('CANONICAL_DURABLE_ACK_REQUIRED');
  if(op==='canonical-ack')return {ok:true,send_allowed:false,mode:'CANONICAL_V2',status:'SENT',receipt_id:durable.receipt_id,provider_message_id:durable.provider_message_id,projection_verified:false,delivery_confirmed:false};
  const context=durable.context;validateContext(context,Date.now(),false);
  const projected=verifySigned(await executeGas('project',signContext('project',context,{record:durable},cfg.canonicalSecret),cfg,options),'project-result',cfg,Date.now(),false);
  if(JSON.stringify(projected.context)!==JSON.stringify(context)||projected.data.notification_id!==durable.source_notification_id||projected.data.status!=='SENT')fail('CANONICAL_PROJECTION_UNCONFIRMED');
  return {ok:true,send_allowed:false,mode:'CANONICAL_V2',status:'SENT',projection_verified:true,delivery_confirmed:false};
 }
 fail('CANONICAL_STAGE_FORBIDDEN');
}
async function handle(body,cfg,options={}){return bounded(signal=>runHandle(body,cfg,{...options,signal}),20000);}
module.exports={FUNCTIONS,CONTEXT_FIELDS,validateContext,quietHeld,planCandidate,signContext,verifySigned,executeGas,store,handle};
