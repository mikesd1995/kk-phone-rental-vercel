'use strict';

// Initial notifications have their own canonical ledger. Booking replay alone
// never authorizes sending, and a claimed attempt never receives a second send.
const crypto=require('node:crypto');
const Identity=require('./kk-line-identity');
const Deadline=require('./line-booking-deadline');
const VERSION='KK_LINE_INITIAL_OUTBOX_V1';
const KINDS=Object.freeze(['OWNER_APPROVAL_PUSH','CUSTOMER_PENDING_REPLY']);
const FIELDS=Object.freeze(['version','event_name','event_date','venue','poster_image_url',
 'package_name','price_display','nickname','phone','pickup_time','terms_status','terms_version']);
const HASH=/^[a-f0-9]{64}$/;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const REQUEST=/^line:[a-f0-9]{48}$/;
const text=v=>String(v==null?'':v).trim();
const hash=value=>crypto.createHash('sha256').update(value,'utf8').digest('hex');
const enabled=env=>env.KK_LINE_INITIAL_OUTBOX_V1_ENABLED==='true';
function fail(code){throw Object.assign(new Error('Canonical initial notification evidence unavailable'),{code});}
function contextJson(booking={},canonical={},termsStatus=''){
 const context={version:VERSION,event_name:text(booking.event_name),event_date:text(booking.event_date),
  venue:text(booking.venue),poster_image_url:text(booking.poster_image_url),
  package_name:text(canonical.package_name),price_display:text(canonical.price_display),
  nickname:text(booking.nickname),phone:text(booking.phone),pickup_time:text(booking.pickup_time),
  terms_status:text(termsStatus),terms_version:text(booking.terms_version)};
 const raw=JSON.stringify(context);parseContext(raw,hash(raw));return raw;
}
function parseContext(raw,digest){
 if(typeof raw!=='string'||raw.length>8192||Buffer.byteLength(raw,'utf8')>6000
  ||!HASH.test(digest)||hash(raw)!==digest)
  fail('LINE_INITIAL_OUTBOX_CONTEXT_INVALID');
 let context;try{context=JSON.parse(raw);}catch(_){fail('LINE_INITIAL_OUTBOX_CONTEXT_INVALID');}
 if(!context||Array.isArray(context)||typeof context!=='object'
  ||Object.keys(context).length!==FIELDS.length||FIELDS.some(k=>typeof context[k]!=='string'||context[k].length>512)
  ||context.version!==VERSION||!context.event_name||!context.event_date||!context.package_name
  ||!context.price_display||!context.nickname)fail('LINE_INITIAL_OUTBOX_CONTEXT_INVALID');
 return context;
}
function configuration(env){
 const secret=text(env.KK_LINE_INITIAL_OUTBOX_DISPATCH_SECRET);
 if(!/^[A-Za-z0-9_-]{32,128}$/.test(secret)||secret===text(env.KK_ADMIN_API_KEY)
  ||secret===text(env.KK_LINE_OWNER_OUTBOX_DISPATCH_SECRET))fail('LINE_INITIAL_OUTBOX_DISPATCH_NOT_READY');
 return secret;
}
function idFor(bookingId,kind){return 'LINE_INITIAL_V1_'+hash(kind+':'+bookingId).slice(0,48);}
function validReceipt(value){return typeof value==='string'&&/^[A-Za-z0-9._:-]{1,200}$/.test(value);}
function sentProof(row){return row.state==='SENT'&&UUID.test(row.claim_key)
 &&HASH.test(row.message_hash)&&validReceipt(row.provider_message_id);}
function validateEnvelope(value,expected){
 if(!Identity.isUserId(expected.customer)||typeof expected.bookingId!=='string'
  ||!expected.bookingId||expected.bookingId.length>128||/[|\r\n]/.test(expected.bookingId)
  ||!value||value.mode!==VERSION||value.booking_id!==expected.bookingId
  ||value.request_id!==expected.requestId||!REQUEST.test(value.request_id)
  ||value.owner_target!==expected.ownerTarget||!Identity.isPushTarget(value.owner_target)
  ||value.context_hash!==expected.contextHash||!Array.isArray(value.deliveries)||value.deliveries.length!==2)
  fail('LINE_INITIAL_OUTBOX_READBACK_REQUIRED');
 const context=parseContext(value.context_json,value.context_hash);
 for(const kind of KINDS){
  const rows=value.deliveries.filter(r=>r&&r.kind===kind);
  if(rows.length!==1)fail('LINE_INITIAL_OUTBOX_READBACK_REQUIRED');
  const row=rows[0],recipient=kind===KINDS[0]?expected.ownerTarget:expected.customer;
  if(row.outbox_id!==idFor(expected.bookingId,kind)||row.booking_id!==expected.bookingId
   ||row.request_id!==expected.requestId||row.recipient!==recipient
   ||!['INTENT','READY','CLAIMED','SENT','UNCERTAIN','MISSING'].includes(row.state)
   ||(row.state==='SENT'&&!sentProof(row)))fail('LINE_INITIAL_OUTBOX_READBACK_REQUIRED');
 }
 return {envelope:value,context};
}
const review=()=>({handled:true,automation_status:'PENDING_DELIVERY_REVIEW_REQUIRED',
 requires_manual_delivery_review:true,owner_notifications:0,customer_notifications:0});
function matches(value,row,envelope,key,messageHash){
 return !!value&&value.mode===VERSION&&value.booking_id===envelope.booking_id
  &&value.request_id===envelope.request_id&&value.outbox_id===row.outbox_id
  &&value.kind===row.kind&&value.recipient===row.recipient&&value.context_hash===envelope.context_hash
  &&value.claim_key===key&&value.message_hash===messageHash;
}
const extract=value=>value&&value.data||value||{};
async function providerSend(row,message,key,replyToken,deps){
 const push=row.kind===KINDS[0];
 if(!message||message.type!=='flex'||(!push&&!text(replyToken)))throw Error('Missing initial message');
 const headers={Authorization:'Bearer '+deps.lineToken,'Content-Type':'application/json'};
 if(push)headers['X-Line-Retry-Key']=key;
 return Deadline.fetchWithDeadline(deps.fetchImpl,
  'https://api.line.me/v2/bot/message/'+(push?'push':'reply'),
  {method:'POST',headers,body:JSON.stringify(push?{to:row.recipient,messages:[message]}:
   {replyToken,messages:[message]})},async response=>{
   if(response?.ok!==true||!Number.isInteger(response.status)||response.status<200||response.status>=300)
    throw Error('Initial provider response unavailable');
   const data=JSON.parse(await response.text());
   const id=data?.sentMessages?.length===1&&data.sentMessages[0]?.id;
   if(!validReceipt(id))throw Error('Initial provider receipt unavailable');
   const requestId=text(response.headers?.get?.('x-line-request-id'));
   if(requestId&&!validReceipt(requestId))throw Error('Initial provider receipt unavailable');
   return {messageId:id,requestId};
  });
}
async function deliver(context={},deps={}){
 const result=review(),expected=context.expected||{};
 const {envelope}=validateEnvelope(context.envelope,expected);
 result.booking_id=envelope.booking_id;
 if(typeof deps.appsScriptCall!=='function'||typeof deps.fetchImpl!=='function'
  ||!text(deps.lineToken)||!/^[A-Za-z0-9_-]{32,128}$/.test(text(deps.dispatchSecret)))
  fail('LINE_INITIAL_OUTBOX_DEPENDENCIES_MISSING');
 // A saved owner receipt must match today's rendering before it can unlock
 // another leg. A changed signing key/template requires review, not a resend.
 for(const row of envelope.deliveries){
  const message=context.messages?.[row.kind];
  if(!message||message.type!=='flex'||(row.state==='SENT'
   &&row.message_hash!==hash(JSON.stringify(message))))return result;
 }
 for(const kind of KINDS){
  const row=envelope.deliveries.find(r=>r.kind===kind);
  if(sentProof(row))continue;
  if(row.state!=='READY'||(kind===KINDS[1]&&!text(context.replyToken)))return result;
  const message=context.messages?.[kind];
  if(!message||message.type!=='flex')return result;
  const messageHash=hash(JSON.stringify(message)),key=crypto.randomUUID();
  const common={booking_id:envelope.booking_id,request_id:envelope.request_id,kind,
   outbox_id:row.outbox_id,context_hash:envelope.context_hash,message_hash:messageHash,
   claim_key:key,initial_dispatch_key:deps.dispatchSecret};
  let claim;
  try{claim=extract(await deps.appsScriptCall({action:'claimLineBookingInitialDelivery',...common}));}
  catch(_){return result;}
  if(claim.claimed!==true||claim.state!=='CLAIMED'||!matches(claim,row,envelope,key,messageHash))return result;
  const settle=async(state,receipt={})=>{
   const ack=extract(await deps.appsScriptCall({action:'settleLineBookingInitialDelivery',...common,
    delivery_state:state,provider_message_id:receipt.messageId||'',provider_request_id:receipt.requestId||''}));
   if(!matches(ack,row,envelope,key,messageHash)||ack.state!==state
    ||(state==='SENT'&&(ack.provider_message_id!==receipt.messageId
     ||text(ack.provider_request_id)!==receipt.requestId)))throw Error('Initial settlement unverified');
  };
  let receipt;
  try{receipt=await providerSend(row,message,key,context.replyToken,deps);}
  catch(_){try{await settle('UNCERTAIN');}catch(_){}return result;}
  try{await settle('SENT',receipt);}catch(_){return result;}
  if(kind===KINDS[0])result.owner_notifications++;
  else result.customer_notifications++;
 }
 return {...result,automation_status:'PENDING_OWNER_APPROVAL',requires_manual_delivery_review:false,
  initial_delivery_status:'SENT'};
}
module.exports={VERSION,KINDS,enabled,hash,contextJson,parseContext,configuration,idFor,validateEnvelope,deliver};
