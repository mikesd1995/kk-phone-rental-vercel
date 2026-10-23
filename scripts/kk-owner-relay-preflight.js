'use strict';

// Local operator guard only. No credential, signer, provider, network or runtime
// import. Matching independently read native data is not dispatch authority.
const crypto=require('node:crypto');
const ENVELOPE_FIELDS=['version','audience','notification_id','request_id','event_type','entity_id','content_version','text','created_at','expires_at','signature'];
const NATIVE_FIELDS=['consumer_id','source_notification_id','notification_id','request_id','entity_id','content_version','text','text_sha256','created_at','expires_at'];
const HEX64=/^[a-f0-9]{64}$/,SOURCE_ID=/^KKUAT_TG_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function fail(code){throw Object.assign(new Error(code),{code});}
function exactData(value,fields,code,strings=true){
  if(!value||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))fail(code);
  const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(value);
  if(keys.length!==fields.length||keys.some(k=>typeof k!=='string'||!fields.includes(k)||!Object.hasOwn(descriptors[k],'value')||
    descriptors[k].enumerable!==true||(strings&&typeof descriptors[k].value!=='string')))fail(code);
}
function instant(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value))fail('OWNER_RELAY_CLOCK_INVALID');
  const time=Date.parse(value);if(!Number.isFinite(time)||new Date(time).toISOString()!==value)fail('OWNER_RELAY_CLOCK_INVALID');return time;
}
function checkedText(value){
  if(!value.length||value.length>2048)fail('OWNER_RELAY_TEXT_INVALID');
  // Never let replacement-byte UTF8 encoding collapse malformed source text.
  for(let i=0;i<value.length;i++){
    const c=value.charCodeAt(i);
    if(c>=0xd800&&c<=0xdbff){const next=value.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff))fail('OWNER_RELAY_TEXT_INVALID');}
    else if(c>=0xdc00&&c<=0xdfff)fail('OWNER_RELAY_TEXT_INVALID');
  }
}
function assertExactOwnerRelay(envelope,native,options){
  exactData(envelope,ENVELOPE_FIELDS,'OWNER_RELAY_ENVELOPE_SHAPE_INVALID');
  exactData(native,NATIVE_FIELDS,'OWNER_RELAY_NATIVE_SHAPE_INVALID');
  if(options!==undefined)exactData(options,['now'],'OWNER_RELAY_CLOCK_OPTIONS_INVALID',false);
  const now=options===undefined?Date.now():options.now;
  if(typeof now!=='number'||!Number.isFinite(now))fail('OWNER_RELAY_CLOCK_INVALID');
  if(native.consumer_id!=='6176241'||!SOURCE_ID.test(native.source_notification_id))fail('OWNER_RELAY_SOURCE_BINDING_INVALID');
  const encoded=Buffer.from(native.source_notification_id,'utf8').toString('base64url');
  for(const [key,prefix] of [['notification_id','ks1_'],['request_id','kr1_'],['entity_id','ke1_']]){
    if(native[key]!==prefix+encoded||envelope[key]!==native[key])fail('OWNER_RELAY_IDENTITY_MISMATCH');
  }
  if(envelope.version!=='kk-make-owner-transport-v1'||envelope.audience!=='KK_OWNER_TELEGRAM_ONLY'||envelope.event_type!=='OWNER_ALERT')fail('OWNER_RELAY_PROTOCOL_INVALID');
  if(!HEX64.test(native.content_version)||envelope.content_version!==native.content_version)fail('OWNER_RELAY_CONTENT_MISMATCH');
  checkedText(envelope.text);checkedText(native.text);
  if(envelope.text!==native.text)fail('OWNER_RELAY_TEXT_MISMATCH');
  const textHash=crypto.createHash('sha256').update(envelope.text,'utf8').digest('hex');
  if(!HEX64.test(native.text_sha256)||textHash!==native.text_sha256)fail('OWNER_RELAY_TEXT_HASH_MISMATCH');
  if(!HEX64.test(envelope.signature))fail('OWNER_RELAY_SIGNATURE_SHAPE_INVALID');
  if(envelope.created_at!==native.created_at||envelope.expires_at!==native.expires_at)fail('OWNER_RELAY_DESCRIPTOR_MISMATCH');
  const created=instant(native.created_at),expires=instant(native.expires_at);
  if(expires<=created||expires-created>120000||created>now+15000||now-created>120000||expires-now<45000)fail('OWNER_RELAY_TTL_OR_MARGIN_INVALID');
  return Object.freeze({status:'LOCAL_RELAY_MATCH_ONLY',consumer_id:'6176241',source_notification_id:native.source_notification_id,
    content_version:native.content_version,text_sha256:textHash,remaining_ms:expires-now,signature_verified:false,provider_sends:0});
}
module.exports={assertExactOwnerRelay};
