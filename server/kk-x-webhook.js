'use strict';
const crypto=require('node:crypto');
const VERSION='KK_X_WEBHOOK_V1';
function secret(env=process.env){return String(env.KK_X_CONSUMER_SECRET||'').trim();}
function hmac(value,key){return crypto.createHmac('sha256',key).update(value).digest('base64');}
function crcResponse(crcToken,env=process.env){
 const key=secret(env), token=String(crcToken||'');
 if(!key) throw Object.assign(new Error('KK_X_CONSUMER_SECRET required'),{code:'X_WEBHOOK_CONFIG_REQUIRED'});
 if(!token) throw Object.assign(new Error('crc_token required'),{code:'X_CRC_TOKEN_REQUIRED'});
 return {response_token:'sha256='+hmac(token,key)};
}
function verifySignature(rawBody,signature,env=process.env){
 const key=secret(env); if(!key)return false;
 const actual=String(signature||''), expected='sha256='+hmac(Buffer.isBuffer(rawBody)?rawBody:Buffer.from(String(rawBody||'')),key);
 const a=Buffer.from(actual),b=Buffer.from(expected);
 return a.length===b.length&&crypto.timingSafeEqual(a,b);
}
function inboundEvents(payload={}){
 const out=[];
 // Account Activity webhook envelope documented by X uses direct_message_events with message_create events.
 for(const e of Array.isArray(payload.direct_message_events)?payload.direct_message_events:[]){
  if(!e||e.type!=='message_create'||!e.message_create)continue;
  const mc=e.message_create, sender=String(mc.sender_id||''), target=String(mc.target&&mc.target.recipient_id||'');
  if(!sender||!target)continue;
  out.push({id:String(e.id||''),created_timestamp:String(e.created_timestamp||''),sender_id:sender,recipient_id:target,text:String(mc.message_data&&mc.message_data.text||'')});
 }
 return out;
}
module.exports={VERSION,crcResponse,verifySignature,inboundEvents};
