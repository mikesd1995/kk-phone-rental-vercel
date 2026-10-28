'use strict';
const crypto=require('crypto');
const Inbox=require('./kk-unified-inbox-contract.js');
const VERSION='KK_LINE_WEBHOOK_V1';
// Bound signed webhook processing before parsing or persisting untrusted events.
const MAX_WEBHOOK_BYTES=1024*1024;
const MAX_WEBHOOK_EVENTS=100;

function asBuffer(raw){
  if(Buffer.isBuffer(raw)) return raw;
  if(typeof raw==='string') return Buffer.from(raw,'utf8');
  throw Object.assign(new Error('raw LINE webhook body required'),{code:'LINE_RAW_BODY_REQUIRED'});
}
function verifySignature(rawBody, signature, channelSecret){
  const raw=asBuffer(rawBody);
  const sig=String(signature||'').trim();
  const secret=String(channelSecret||'');
  if(!sig || !secret) return false;
  const expected=crypto.createHmac('sha256',secret).update(raw).digest('base64');
  const a=Buffer.from(expected), b=Buffer.from(sig);
  return a.length===b.length && crypto.timingSafeEqual(a,b);
}
function sourceIdentity(source={}){
  if(!source||typeof source!=='object'||Array.isArray(source)) return '';
  return String(source.userId||source.groupId||source.roomId||'').trim();
}
function normalizeEvent(event={}){
  if(!event||typeof event!=='object'||Array.isArray(event)) return null;
  const externalUserId=sourceIdentity(event.source);
  if(!externalUserId) return null;
  const type=String(event.type||'').trim();
  if(type!=='message') return null;
  if(!event.message||typeof event.message!=='object'||Array.isArray(event.message)) return null;
  const msg=event.message;
  const externalMessageId=String(event.webhookEventId||msg.id||'').trim();
  if(!externalMessageId) return null;
  // A malformed provider timestamp must not crash the entire signed batch.
  const timestamp=Number(event.timestamp);
  const timestampValid=event.timestamp!==undefined&&event.timestamp!==null&&
    Number.isFinite(timestamp)&&Number.isFinite(new Date(timestamp).getTime());
  return Inbox.normalizeInbound({
    channel:'line',
    external_message_id:externalMessageId,
    external_user_id:externalUserId,
    message_type:String(msg.type||'event'),
    text:msg.type==='text'?String(msg.text||''):'',
    received_at:timestampValid?new Date(timestamp).toISOString():'',
    redelivery:Boolean(event.deliveryContext&&event.deliveryContext.isRedelivery),
    raw_ref:String(event.webhookEventId||'').trim(),
    line_message_id:String(msg.id||'').trim()
  });
}
async function ingest(input={}, options={}){
  const raw=asBuffer(input.rawBody);
  if(raw.length>MAX_WEBHOOK_BYTES){
    return {schema_version:VERSION,status:'REJECTED_PAYLOAD_TOO_LARGE',http_status:413,writes:0,messages:[]};
  }
  if(!verifySignature(raw,input.signature,input.channelSecret)){
    return {schema_version:VERSION,status:'REJECTED_INVALID_SIGNATURE',http_status:401,writes:0,messages:[]};
  }
  let payload;
  try{ payload=JSON.parse(raw.toString('utf8')); }
  catch(_){ return {schema_version:VERSION,status:'REJECTED_INVALID_JSON',http_status:400,writes:0,messages:[]}; }
  const events=payload&&Array.isArray(payload.events)?payload.events:[];
  if(events.length>MAX_WEBHOOK_EVENTS){
    return {schema_version:VERSION,status:'REJECTED_TOO_MANY_EVENTS',http_status:413,writes:0,messages:[]};
  }
  const messages=events.map(normalizeEvent).filter(Boolean);
  if(typeof options.persistFn!=='function'){
    return {schema_version:VERSION,status:messages.length?'BLOCKED_PERSISTENCE_UNAVAILABLE':'ACCEPTED_NO_EVENTS',http_status:messages.length?503:200,writes:0,messages};
  }
  let writes=0, duplicates=0;
  for(const message of messages){
    const receipt=await options.persistFn(message);
    if(receipt&&receipt.duplicate===true) duplicates++;
    else writes++;
  }
  return {schema_version:VERSION,status:'ACCEPTED',http_status:200,writes,duplicates,messages};
}
module.exports={VERSION,MAX_WEBHOOK_BYTES,MAX_WEBHOOK_EVENTS,verifySignature,normalizeEvent,ingest};
