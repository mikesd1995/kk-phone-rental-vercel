'use strict';

// Contract for a future OWNER-ONLY Make notification transport.
// No provider call, database mutation, or owner decision is made in this module.
const crypto = require('node:crypto');

const VERSION = 'kk-make-owner-transport-v1';
const AUDIENCE = 'KK_OWNER_TELEGRAM_ONLY';
const ALLOWED_TYPES = new Set(['OWNER_ALERT','OWNER_APPROVAL_PREVIEW']);
const MAX_AGE_MS = 120000;
const MAX_FUTURE_SKEW_MS = 15000;
const MAX_MESSAGE_LENGTH = 2048;

function t(value){ return String(value===undefined||value===null?'':value).trim(); }
function hash(value){ return crypto.createHash('sha256').update(t(value),'utf8').digest('hex'); }
function canonical(e={}){
  return [
    VERSION,AUDIENCE,
    t(e.notification_id),t(e.request_id),t(e.event_type),
    t(e.entity_id),t(e.content_version),
    t(e.created_at),t(e.expires_at),hash(e.text)
  ].join('\n');
}
function signingKey(secret){ return t(secret); }
function sign(input,secret){
  if(!signingKey(secret)) throw Object.assign(new Error('Make transport signing key unavailable'),{code:'SIGNING_KEY_MISSING'});
  return crypto.createHmac('sha256',signingKey(secret)).update(canonical(input),'utf8').digest('hex');
}
function safeEqHex(left,right){
  if(!/^[a-f0-9]{64}$/i.test(t(left))||!/^[a-f0-9]{64}$/i.test(t(right))) return false;
  return crypto.timingSafeEqual(Buffer.from(t(left),'hex'),Buffer.from(t(right),'hex'));
}
const ENVELOPE_FIELDS=new Set([
  'version','audience','notification_id','request_id','event_type','entity_id',
  'content_version','text','created_at','expires_at','signature'
]);
function checkBody(e={},now=Date.now()){
  if(!e||typeof e!=='object'||Array.isArray(e)) return 'TRANSPORT_ENVELOPE_INVALID';
  if(Object.keys(e).some(key=>!ENVELOPE_FIELDS.has(key))) return 'FORBIDDEN_TRANSPORT_FIELD';
  if(e.version!==VERSION||e.audience!==AUDIENCE) return 'TRANSPORT_VERSION_OR_AUDIENCE_INVALID';
  if(!/^[a-zA-Z0-9:_-]{12,128}$/.test(t(e.notification_id))) return 'NOTIFICATION_ID_INVALID';
  if(!/^[a-zA-Z0-9:_-]{12,128}$/.test(t(e.request_id))) return 'REQUEST_ID_INVALID';
  if(!ALLOWED_TYPES.has(t(e.event_type))) return 'TRANSPORT_EVENT_TYPE_FORBIDDEN';
  if(!/^[a-zA-Z0-9:_-]{1,128}$/.test(t(e.entity_id))) return 'ENTITY_ID_INVALID';
  if(!/^[a-f0-9]{64}$/i.test(t(e.content_version))) return 'CONTENT_VERSION_REQUIRED';
  if(!t(e.text)||t(e.text).length>MAX_MESSAGE_LENGTH) return 'TRANSPORT_TEXT_INVALID';
  if(Object.prototype.hasOwnProperty.call(e,'chat_id')||
     Object.prototype.hasOwnProperty.call(e,'recipient')||
     Object.prototype.hasOwnProperty.call(e,'booking_status')||
     Object.prototype.hasOwnProperty.call(e,'price_write')||
     Object.prototype.hasOwnProperty.call(e,'publish_x')) return 'FORBIDDEN_TRANSPORT_FIELD';
  const created=Date.parse(t(e.created_at)),expires=Date.parse(t(e.expires_at));
  if(!Number.isFinite(created)||!Number.isFinite(expires)||expires<=created||
     expires-created>MAX_AGE_MS) return 'TRANSPORT_TTL_INVALID';
  if(created>now+MAX_FUTURE_SKEW_MS||now-created>MAX_AGE_MS||now>=expires) return 'TRANSPORT_EXPIRED';
  return '';
}
function buildEnvelope(fields={},secret,now=new Date()){
  const created=now instanceof Date?now:new Date(now);
  const input={
    version:VERSION,audience:AUDIENCE,
    notification_id:t(fields.notification_id),
    request_id:t(fields.request_id),
    event_type:t(fields.event_type),
    entity_id:t(fields.entity_id),
    content_version:t(fields.content_version),
    text:t(fields.text),
    created_at:created.toISOString(),
    expires_at:new Date(created.getTime()+MAX_AGE_MS).toISOString()
  };
  const code=checkBody(input,created.getTime());
  if(code) throw Object.assign(new Error(code),{code});
  input.signature=sign(input,secret);
  return input;
}
function verifyEnvelope(input={},secret,now=Date.now()){
  const code=checkBody(input,now instanceof Date?now.getTime():now);
  if(code) return {ok:false,error_code:code};
  if(!signingKey(secret)) return {ok:false,error_code:'SIGNING_KEY_MISSING'};
  const signature=sign(input,secret);
  if(!safeEqHex(signature,input.signature)) return {ok:false,error_code:'SIGNATURE_INVALID'};
  return {ok:true,notification_id:t(input.notification_id),event_type:t(input.event_type)};
}

// A REQUIRED persistent atomic claim precedes any Telegram send. The claim
// implementation must return RESERVED only for the first exact immutable event.
// No in-memory Set or read-then-write check is an acceptable production claim.
async function prepareDispatch(envelope,options={}){
  const result=verifyEnvelope(envelope,options.secret,options.now===undefined?Date.now():options.now);
  if(!result.ok) return Object.assign({send_allowed:false,provider_sends:0},result);
  if(!t(options.ownerChatId)){
    return {ok:false,send_allowed:false,provider_sends:0,error_code:'OWNER_CHAT_NOT_CONFIGURED'};
  }
  if(typeof options.claimFn!=='function'){
    return {ok:false,send_allowed:false,provider_sends:0,error_code:'DURABLE_CLAIM_UNAVAILABLE'};
  }
  let claim;
  try{
    claim=await options.claimFn({
      notification_id:t(envelope.notification_id),
      request_id:t(envelope.request_id),
      event_type:t(envelope.event_type),
      entity_id:t(envelope.entity_id),
      content_version:t(envelope.content_version),
      text_sha256:hash(envelope.text),
      expires_at:t(envelope.expires_at)
    });
  }catch(_){
    return {ok:false,send_allowed:false,provider_sends:0,error_code:'DURABLE_CLAIM_FAILED'};
  }
  if(!claim||claim.status!=='RESERVED'||
     !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(t(claim.receipt_id))){
    return {ok:false,send_allowed:false,provider_sends:0,error_code:'DISPATCH_NOT_RESERVED'};
  }
  return {
    ok:true,send_allowed:true,provider_sends:0,protocol:VERSION,
    notification_id:t(envelope.notification_id),
    receipt_id:t(claim.receipt_id),
    target_chat_id:t(options.ownerChatId),
    text:t(envelope.text),
    event_type:t(envelope.event_type)
  };
}
module.exports={VERSION,AUDIENCE,ALLOWED_TYPES,MAX_AGE_MS,MAX_MESSAGE_LENGTH,canonical,hash,sign,buildEnvelope,verifyEnvelope,prepareDispatch};
