'use strict';

// LINE-native, customer-initiated Terms acceptance without a LINE Login channel.
// The signed Messaging webhook proves the LINE actor. A separate affirmative
// postback proves acceptance for a specific Pending Booking and legal version.
// Disabled by default: this never authorizes deployment or ordinary Reply-only mode.
const crypto=require('node:crypto');
const Terms=require('./kk-booking-terms-evidence');
const LineIdentity=require('./kk-line-identity');
const PREFIX='kkc1';
const MAX_AGE_MS=7*24*60*60*1000;
const CLOCK_SKEW_MS=2*60*1000;
const CONSENT_ACTION='acceptLineBookingTerms';
function str(x){return String(x===undefined||x===null?'':x).trim();}
function enabled(env={}){
  return str(env.KK_LINE_NATIVE_CONSENT_V1_ENABLED)==='true';
}
function dispatchKey(env={}){
  const secret=str(env.KK_LINE_NATIVE_CONSENT_DISPATCH_SECRET);
  if(!/^[A-Za-z0-9_-]{32,128}$/.test(secret) ||
    [env.KK_ADMIN_API_KEY,env.KK_LINE_INITIAL_OUTBOX_DISPATCH_SECRET,
      env.KK_LINE_OWNER_OUTBOX_DISPATCH_SECRET,env.LINE_CHANNEL_SECRET]
      .some(x=>secret===str(x)))return '';
  return secret;
}
function ready(env={}){
  return enabled(env) &&
    str(env.KK_LINE_BOOKING_AUTOMATION_ENABLED)==='true' &&
    str(env.KK_CUSTOMER_LOGIN_ENABLED)!=='true' &&
    str(env.KK_LINE_INITIAL_OUTBOX_V1_ENABLED)==='true' &&
    str(env.KK_LINE_OWNER_OUTBOX_V1_ENABLED)==='true' &&
    Boolean(str(env.KK_ADMIN_API_KEY)) &&
    Boolean(dispatchKey(env)) &&
    Boolean(str(env.LINE_CHANNEL_SECRET)) &&
    Boolean(str(env.KK_ADMIN_SCRIPT_URL)) &&
    Boolean(str(env.KK_OWNER_LINE_USER_ID));
}
function validBooking(bookingId,requestId,userId){
  return /^[A-Za-z0-9_-]{1,90}$/.test(str(bookingId)) &&
    /^line:[a-f0-9]{48}$/.test(str(requestId)) &&
    LineIdentity.isUserId(userId);
}
function mac(parts,secret,userId){
  return crypto.createHmac('sha256',secret)
    .update('KK_LINE_NATIVE_CONSENT_V1\\0'+parts.join('\\0')+'\\0'+userId,'utf8')
    .digest('base64url').slice(0,32);
}
function issue({bookingId,requestId,userId,timestamp},env={},now=Date.now()){
  const secret=str(env.LINE_CHANNEL_SECRET);
  if(!ready(env)||!validBooking(bookingId,requestId,userId)||secret.length<8)
    throw Object.assign(new Error('Native consent unavailable'),{code:'LINE_NATIVE_CONSENT_NOT_READY'});
  const issuedAt=Number(timestamp);
  if(!Number.isSafeInteger(issuedAt)||issuedAt<=0||issuedAt>now+CLOCK_SKEW_MS||
    now-issuedAt>MAX_AGE_MS)
    throw Object.assign(new Error('Invalid LINE event time'),{code:'LINE_NATIVE_CONSENT_TIME_INVALID'});
  const parts=[PREFIX,bookingId,requestId,String(issuedAt)];
  const token=parts.concat(mac(parts,secret,userId)).join('|');
  if(token.length>300)throw Object.assign(new Error('Consent token length'),{code:'LINE_NATIVE_CONSENT_TOKEN_TOO_LONG'});
  return token;
}
function parse(data,event,env={},now=Date.now()){
  if(!enabled(env)||!ready(env))return null;
  if(!event||event.type!=='postback'||!event.source||event.source.type!=='user')return null;
  const userId=str(event.source.userId);
  const parts=str(data).split('|');
  if(parts.length!==5||parts[0]!==PREFIX||
    !validBooking(parts[1],parts[2],userId)||
    !/^[0-9]{13}$/.test(parts[3])||
    !/^[A-Za-z0-9_-]{32}$/.test(parts[4]))return null;
  const issuedAt=Number(parts[3]);
  if(!Number.isSafeInteger(issuedAt)||issuedAt>now+CLOCK_SKEW_MS||
    now-issuedAt>MAX_AGE_MS)return null;
  const expected=mac(parts.slice(0,4),str(env.LINE_CHANNEL_SECRET),userId);
  if(expected.length!==parts[4].length||
    !crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(parts[4])))return null;
  return {booking_id:parts[1],request_id:parts[2],user_id:userId,
    terms_version:Terms.VERSION,issued_at:issuedAt};
}
async function preflightGas(env=process.env,fetchImpl=fetch,appsScriptCall){
  if(!ready(env)||typeof appsScriptCall!=='function')
    throw Object.assign(new Error('Native consent writer unavailable'),
      {code:'LINE_NATIVE_CONSENT_NOT_READY'});
  const result=await appsScriptCall({
    action:'lineNativeConsentReadiness',
    native_consent_dispatch_key:dispatchKey(env)
  },env,fetchImpl);
  const proof=result&&result.data||result||{};
  if(proof.native_consent_ready!==true ||
     str(proof.native_consent_version)!=='KK_LINE_NATIVE_CONSENT_V1' ||
     str(proof.terms_version)!==Terms.VERSION)
    throw Object.assign(new Error('Deployed native consent writer mismatch'),
      {code:'LINE_NATIVE_CONSENT_READBACK_FAILED'});
  return {ready:true};
}
function consentFooter(data){
  return {type:'box',layout:'vertical',spacing:'xs',contents:[
    {type:'text',text:'กรุณายืนยันการยอมรับเงื่อนไขก่อนร้านอนุมัติการจอง',size:'xs',
      wrap:true,color:'#666666'},
    {type:'button',style:'primary',action:{type:'postback',label:'ยอมรับเงื่อนไข',data}},
    {type:'button',style:'link',action:{type:'uri',label:'อ่านเงื่อนไข',uri:'https://kk-phone-rental.vercel.app/terms/'}}
  ]};
}
async function processPostback(event,env=process.env,fetchImpl=fetch,
                               {signatureVerified=false,appsScriptCall,reply}={}){
  const data=str(event&&event.postback&&event.postback.data);
  if(!data.startsWith(PREFIX+'|'))return {handled:false};
  // Never transform an untrusted or malformed postback into an owner decision.
  if(signatureVerified!==true)return {handled:true,status:'SIGNATURE_REQUIRED'};
  const accepted=parse(data,event,env);
  if(!accepted)return {handled:true,status:'INVALID_OR_EXPIRED_CONSENT'};
  if(typeof appsScriptCall!=='function')throw Object.assign(
    new Error('Canonical consent writer unavailable'),{code:'LINE_NATIVE_CONSENT_NOT_READY'});
  const result=await appsScriptCall({
    action:CONSENT_ACTION,
    booking_id:accepted.booking_id,request_id:accepted.request_id,
    source_user_id:accepted.user_id,terms_version:Terms.VERSION,
    native_consent_dispatch_key:dispatchKey(env)
  },env,fetchImpl);
  const proof=result&&result.data||result||{};
  if(str(proof.booking_id)!==accepted.booking_id||
    str(proof.request_id)!==accepted.request_id||
    str(proof.terms_version)!==Terms.VERSION||proof.terms_confirmed!==true||
    str(proof.booking_status)!=='pending'||typeof proof.idempotent_replay!=='boolean')
    throw Object.assign(new Error('Native consent readback mismatch'),
      {code:'LINE_NATIVE_CONSENT_READBACK_FAILED'});
  if(!proof.idempotent_replay&&event.replyToken&&typeof reply==='function'){
    await reply(event.replyToken,{
      type:'text',text:'✅ บันทึกการยอมรับเงื่อนไขของคำขอเช่าแล้ว กรุณารอร้านตรวจสอบคิวและกดยืนยันการจอง'
    },env,fetchImpl);
  }
  return {handled:true,status:proof.idempotent_replay?'ALREADY_ACCEPTED':'ACCEPTED',
    booking_id:accepted.booking_id};
}
module.exports={PREFIX,CONSENT_ACTION,enabled,dispatchKey,ready,issue,parse,preflightGas,consentFooter,processPostback};
