'use strict';
const crypto=require('node:crypto');
const InboxContract=require('./kk-unified-inbox-contract');
const VERSION='KK_INBOX_OUTBOUND_DURABLE_RESERVATION_V1';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const directLineUser=/^U[A-Za-z0-9_-]{20,}$/;
function errorResponse(code,status=502,providerSends=0){
 return {ok:false,http_status:status,error_code:code,provider_sends:providerSends,production_writes:0};
}
function text(v){return String(v===undefined||v===null?'':v).trim();}
function fingerprint(conversationId,body,secret){
 if(!text(secret))throw Object.assign(new Error('Missing private outbound dedupe secret'),{code:'INBOX_OUTBOUND_SECRET_MISSING'});
 return crypto.createHmac('sha256',secret).update(text(conversationId)+'\0'+text(body),'utf8').digest('hex');
}
async function markUncertain(store,requestId,delivery){
 // Failure to mark does not release the previously committed reservation.
 try{
  await store.finishOutbound(requestId,'UNCERTAIN',
    text(delivery?.external_message_id),text(delivery?.provider_request_id));
 }catch(_){}
}
async function sendOnce(input={},deps={}){
 const conversationId=text(input.conversationId),body=text(input.body),requestId=text(input.requestId);
 const repeatOf=text(input.repeatOf),repeatReason=text(input.repeatReason);
 const conversation=input.conversation||{};
 if(repeatOf){
  if(!UUID.test(repeatOf)||repeatOf===requestId||input.repeatApproved!==true||
     repeatReason.length<12||repeatReason.length>240)
   return errorResponse('INBOX_INTENTIONAL_REPEAT_APPROVAL_REQUIRED',409);
 }else if(repeatReason||input.repeatApproved===true){
  return errorResponse('INBOX_INTENTIONAL_REPEAT_CONTEXT_INVALID',409);
 }
 if(!UUID.test(requestId))return errorResponse('INBOX_SEND_REQUEST_ID_REQUIRED',400);
 if(!conversationId||text(conversation.conversation_id)!==conversationId||
    String(conversation.channel||'').toLowerCase()!=='line'||
    !directLineUser.test(text(conversation.external_user_id)))
   return errorResponse('INBOX_SEND_RECIPIENT_UNVERIFIED',409);
 if(!body||body.length>5000)return errorResponse('INBOX_SEND_TEXT_INVALID',400);
 if(!deps.store||typeof deps.store.reserveOutbound!=='function'||
    typeof deps.store.finishOutbound!=='function'||
    typeof deps.store.recordOutbound!=='function')
   return errorResponse('INBOX_OUTBOUND_LEDGER_UNAVAILABLE',503);
 if(typeof deps.store.hasLegacyOutbound!=='function')
   return errorResponse('INBOX_LEGACY_OUTBOUND_UNAVAILABLE',503);
 if(!deps.lineMessaging||typeof deps.lineMessaging.pushText!=='function')
   return errorResponse('INBOX_LINE_PROVIDER_UNAVAILABLE',503);
 // Legacy sends predate the reservation ledger. Read complete history before
 // creating a claim; missing/malformed evidence never authorizes a new send.
 let legacy;
 try{legacy=await deps.store.hasLegacyOutbound(conversationId,body);}
 catch(_){return errorResponse('INBOX_LEGACY_OUTBOUND_UNAVAILABLE',503)}
 if(legacy===true)return errorResponse('INBOX_LEGACY_OUTBOUND_REVIEW_REQUIRED',409);
 if(legacy!==false)return errorResponse('INBOX_LEGACY_OUTBOUND_UNAVAILABLE',503);
 let digest;
 try{digest=fingerprint(conversationId,body,deps.serviceKey);}
 catch(_){return errorResponse('INBOX_OUTBOUND_LEDGER_UNAVAILABLE',503)}
 // Must commit a single durable reservation BEFORE any provider traffic.
 let reservation;
 try{reservation=await deps.store.reserveOutbound(requestId,conversationId,digest,{
  repeatOf:repeatOf||null,repeatReason
 });}
 catch(_){return errorResponse('INBOX_OUTBOUND_LEDGER_UNAVAILABLE',503)}
 if(!reservation||reservation.allowed!==true)
   return errorResponse(reservation?.status==='REQUEST_CONFLICT'?'INBOX_OUTBOUND_REQUEST_CONFLICT':
     'INBOX_OUTBOUND_ALREADY_RESERVED',409);
 if(!UUID.test(text(reservation.retry_key)))
   return errorResponse('INBOX_OUTBOUND_RETRY_KEY_MISSING',503);
 const draft=InboxContract.authorizeSend(InboxContract.outboundDraft({
  channel:'line',conversation_id:conversationId,text:body
 }),'owner');
 let delivery;
 try{
  delivery=await deps.lineMessaging.pushText(
   {to:conversation.external_user_id,text:draft.text},
   {token:deps.lineToken,retryKey:reservation.retry_key,fetchImpl:deps.fetchImpl}
  );
  // Do not invent a provider message ID from the key if the provider receipt is absent.
  if(!text(delivery?.external_message_id)||!delivery?.provider_confirmed)
    throw Object.assign(new Error('Provider acceptance receipt missing'),{code:'LINE_PUSH_RECEIPT_MISSING'});
 }catch(_){
  await markUncertain(deps.store,requestId);
  // A network failure is not proof that LINE did not send the message.
  return errorResponse('INBOX_LINE_SEND_UNCERTAIN',502,null);
 }
 const message={
  schema_version:InboxContract.VERSION,
  message_id:'msg_'+crypto.createHash('sha256').update('line:'+delivery.external_message_id).digest('hex').slice(0,24),
  conversation_id:conversationId,channel:'line',direction:'outbound',
  external_message_id:delivery.external_message_id,
  external_user_id:text(conversation.external_user_id),message_type:'text',
  text:draft.text,sent_at:delivery.sent_at,
  send_authorized:true,authorized_by:'owner',
  provider_request_id:text(delivery.provider_request_id),
  retry_key:reservation.retry_key,
  outbound_request_id:requestId
 };
 let receipt;
 try{
  receipt=await deps.store.recordOutbound(message);
  // RPC HTTP 200 with a null/empty body is NOT proof of persistence.
  // Nor is a conflict/duplicate proof that the accepted LINE delivery was
  // correctly associated with this exact new outbound reservation.
  if(receipt?.ok!==true||receipt.duplicate===true||receipt.writes!==1)
   throw Object.assign(new Error('Missing verified Inbox persistence receipt'),{code:'INBOX_OUTBOUND_READBACK_REQUIRED'});
 }catch(_){
  await markUncertain(deps.store,requestId,delivery);
  return errorResponse('INBOX_OUTBOUND_PERSIST_UNCERTAIN',502,1);
 }
 try{
  const final=await deps.store.finishOutbound(
   requestId,'SENT',delivery.external_message_id,delivery.provider_request_id);
  if(final?.status!=='SENT')throw new Error('Outbound reservation confirmation missing');
 }catch(_){
  // Provider and Inbox may both have accepted it: still never authorize a replay.
  return errorResponse('INBOX_OUTBOUND_FINALIZE_UNCERTAIN',502,1);
 }
 return {
  ok:true,http_status:200,message:{
   message_id:message.message_id,conversation_id:conversationId,
   direction:'outbound',message_type:'text',body_text:draft.text,sent_at:delivery.sent_at
  },
  provider_request_id:delivery.provider_request_id||null,
  production_writes:Number(receipt?.writes||0),provider_sends:1,outbound_enabled:true
 };
}
module.exports={VERSION,fingerprint,sendOnce,errorResponse};
