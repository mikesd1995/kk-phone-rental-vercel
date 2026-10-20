'use strict';
const crypto=require('crypto');
const Inbox=require('./kk-unified-inbox-contract.js');
const VERSION='KK_LINE_WEBHOOK_V1';

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
  return String(source.userId||source.groupId||source.roomId||'').trim();
}
function normalizeEvent(event={}){
  const externalUserId=sourceIdentity(event.source);
  if(!externalUserId) return null;
  const type=String(event.type||'').trim();
  if(type!=='message') return null;
  const msg=event.message||{};
  return Inbox.normalizeInbound({
    channel:'line',
    external_message_id:String(event.webhookEventId||msg.id||'').trim(),
    external_user_id:externalUserId,
    message_type:String(msg.type||'event'),
    text:msg.type==='text'?String(msg.text||''):'',
    received_at:Number.isFinite(Number(event.timestamp))?new Date(Number(event.timestamp)).toISOString():'',
    redelivery:Boolean(event.deliveryContext&&event.deliveryContext.isRedelivery),
    raw_ref:String(event.webhookEventId||'').trim(),
    line_message_id:String(msg.id||'').trim()
  });
}
async function ingest(input={}, options={}){
  const raw=asBuffer(input.rawBody);
  if(!verifySignature(raw,input.signature,input.channelSecret)){
    return {schema_version:VERSION,status:'REJECTED_INVALID_SIGNATURE',http_status:401,writes:0,messages:[]};
  }
  let payload;
  try{ payload=JSON.parse(raw.toString('utf8')); }
  catch(_){ return {schema_version:VERSION,status:'REJECTED_INVALID_JSON',http_status:400,writes:0,messages:[]}; }
  const events=Array.isArray(payload.events)?payload.events:[];
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
module.exports={VERSION,verifySignature,normalizeEvent,ingest};
