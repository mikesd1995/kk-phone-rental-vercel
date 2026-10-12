'use strict';

// Internal-only, disabled-by-default bridge from *canonical verified readback*
// to durable owner-notification outbox. This module is not a public route,
// does not call Telegram, confirm bookings, publish X, or alter business truth.
const crypto=require('node:crypto');
const Transport=require('./make-owner-transport-contract.js');
const Runtime=require('./runtime-ledger.js');

const VERSION='kk-make-owner-producer-v1';
const VERIFIED_SOURCE='KK_CANONICAL_VERIFIER_READBACK_V1';
const ENTITY=/^[A-Za-z0-9:_-]{1,128}$/;
const REVISION=/^[a-f0-9]{64}$/i;
// Approval previews stay out of the live producer until actor/version-bound
// approval decision handling and PII-redaction acceptance are proven.
const OWNER_TYPES=new Set(['OWNER_ALERT']);

function t(v){return String(v===undefined||v===null?'':v).trim();}
function sha(v){return crypto.createHash('sha256').update(String(v),'utf8').digest('hex');}
function on(v){return /^(1|true|yes|on)$/i.test(t(v));}
function config(env=process.env){
  const projectRef=Runtime.projectRefFromUrl(env.SUPABASE_URL);
  const boundRef=t(env.KK_MAKE_OWNER_TRANSPORT_PROJECT_REF);
  const secret=t(env.KK_MAKE_OWNER_TRANSPORT_SIGNING_SECRET);
  const key=Runtime.resolveServerKey(env).value;
  const webhook=t(env.KK_MAKE_OWNER_WEBHOOK_URL);
  let webhookValid=false;
  try{
    const u=new URL(webhook);
    webhookValid=u.protocol==='https:' && /^hook\.[a-z0-9-]+\.make\.com$/i.test(u.hostname) &&
      /^\/[A-Za-z0-9]+$/.test(u.pathname) && !u.username && !u.password &&
      !u.port && !u.search && !u.hash;
  }catch(_){}
  const enabled=on(env.KK_MAKE_OWNER_PRODUCER_ENABLED);
  return {
    ready:enabled&&on(env.KK_MAKE_OWNER_TRANSPORT_ENABLED)&&!!projectRef&&
      projectRef===boundRef&&!!key&&secret.length>=32&&webhookValid,
    enabled,project_bound:!!projectRef&&projectRef===boundRef,
    webhook_valid:webhookValid,key,secret,url:t(env.SUPABASE_URL).replace(/\/+$/,''),
    webhook
  };
}

// The caller supplies only a lookup key. All content, type and revision are
// resolved independently through the canonical reader (not arbitrary input).
function makeIdentity(readback){
  const type=t(readback.event_type),entity=t(readback.entity_id);
  const revision=t(readback.content_version),message=t(readback.text);
  if(readback.source!==VERIFIED_SOURCE||readback.status!=='VERIFIED'||
     !OWNER_TYPES.has(type)||!ENTITY.test(entity)||!REVISION.test(revision)||
     !message||message.length>Transport.MAX_MESSAGE_LENGTH){
    return {ok:false,error_code:'CANONICAL_READBACK_NOT_VERIFIED'};
  }
  // The immutable id is stable across retries and does not contain PII.
  const digest=sha([VERSION,type,entity,revision,Transport.hash(message)].join('\n'));
  return {ok:true,event_type:type,entity_id:entity,
    content_version:revision,text:message,
    notification_id:'kn_'+digest.slice(0,48),
    request_id:'kr_'+digest.slice(0,48)};
}
async function insertOutbox(row,cfg,fetchImpl=global.fetch){
  if(typeof fetchImpl!=='function') throw new Error('outbox network unavailable');
  const key=cfg.key;
  const headers={apikey:key,'Content-Type':'application/json',
    Prefer:'resolution=ignore-duplicates,return=representation'};
  if(!/^sb_secret_/.test(key)) headers.Authorization='Bearer '+key;
  const r=await fetchImpl(cfg.url+'/rest/v1/kk_make_owner_notification_outbox?on_conflict=notification_id',{
    method:'POST',headers,body:JSON.stringify([row])
  });
  if(!r.ok) throw new Error('outbox insert not acknowledged');
  const data=await r.json();
  if(!Array.isArray(data)) throw new Error('outbox receipt malformed');
  if(data.length>1) throw new Error('outbox insert unexpected batch');
  if(!data.length) return {ok:true,inserted:false};
  const got=data[0];
  if(got.notification_id!==row.notification_id||got.request_id!==row.request_id||
     got.content_version!==row.content_version||got.text_sha256!==row.text_sha256||
     got.status!=='QUEUED') throw new Error('outbox readback mismatch');
  return {ok:true,inserted:true};
}
async function notifyVerifiedOwner(lookup={},options={}){
  const cfg=config(options.env||process.env);
  if(!cfg.ready) return {ok:false,queued:false,provider_sends:0,reason:'OWNER_PRODUCER_DISABLED_OR_UNBOUND'};
  if(!ENTITY.test(t(lookup.entity_id))||typeof options.canonicalReadbackFn!=='function'){
    return {ok:false,queued:false,provider_sends:0,reason:'CANONICAL_READER_REQUIRED'};
  }
  let verified;
  try{verified=await options.canonicalReadbackFn(t(lookup.entity_id));}
  catch(_){return {ok:false,queued:false,provider_sends:0,reason:'CANONICAL_READBACK_UNAVAILABLE'};}
  if(!verified||t(verified.entity_id)!==t(lookup.entity_id)){
    return {ok:false,queued:false,provider_sends:0,reason:'CANONICAL_IDENTITY_MISMATCH'};
  }
  const identity=makeIdentity(verified);
  if(!identity.ok) return {ok:false,queued:false,provider_sends:0,reason:identity.error_code};
  if(typeof options.insertFn!=='function'||typeof options.sendFn!=='function'){
    return {ok:false,queued:false,provider_sends:0,reason:'DURABLE_OUTBOX_OR_DISPATCH_UNAVAILABLE'};
  }
  const envelope=Transport.buildEnvelope(identity,cfg.secret,options.now||new Date());
  let saved;
  try{
    saved=await options.insertFn({
      notification_id:identity.notification_id,request_id:identity.request_id,
      event_type:identity.event_type,entity_id:identity.entity_id,
      content_version:identity.content_version,text_sha256:Transport.hash(identity.text),
      status:'QUEUED',created_at:envelope.created_at,expires_at:envelope.expires_at
    },cfg);
  }catch(_){return {ok:false,queued:false,provider_sends:0,reason:'DURABLE_OUTBOX_WRITE_FAILED'};}
  if(!saved||saved.ok!==true||saved.inserted!==true){
    return {ok:false,queued:false,duplicate:!!(saved&&saved.inserted===false),
      provider_sends:0,reason:'ALREADY_QUEUED_OR_OUTBOX_UNVERIFIED'};
  }
  try{
    const response=await options.sendFn({stage:'prepare',envelope},cfg);
    if(!response||response.ok!==true){
      return {ok:false,queued:true,provider_sends:0,reason:'MAKE_TRANSPORT_UNCONFIRMED_REQUIRES_REVIEW'};
    }
  }catch(_){return {ok:false,queued:true,provider_sends:0,reason:'MAKE_TRANSPORT_UNCONFIRMED_REQUIRES_REVIEW'};}
  return {ok:true,queued:true,provider_sends:0,
    notification_id:identity.notification_id,request_id:identity.request_id,
    status:'PENDING_PROVIDER_ACK'};
}
// Server-only Make handoff. Successful HTTP does not imply Telegram delivery.
// A signed receipt must be independently read from the outbox before declaring SENT.
async function postToMake(payload,cfg,fetchImpl=global.fetch){
  if(!cfg.ready||typeof fetchImpl!=='function'||!payload||payload.stage!=='prepare'||
     !Transport.verifyEnvelope(payload.envelope,cfg.secret).ok) return {ok:false,reason:'MAKE_HANDOFF_DISABLED_OR_INVALID'};
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10000);
  try{
    const response=await fetchImpl(cfg.webhook,{
      method:'POST',headers:{'Content-Type':'application/json','User-Agent':'KK-Owner-Transport/1'},
      body:JSON.stringify(payload),signal:controller.signal,redirect:'error'
    });
    if(!response.ok) return {ok:false,reason:'MAKE_HANDOFF_NON_2XX'};
    const receipt=await response.json().catch(()=>null);
    if(!receipt||receipt.ok!==true||receipt.notification_id!==payload.envelope.notification_id||
       receipt.status!=='SENT') return {ok:false,reason:'MAKE_DELIVERY_NOT_ACKNOWLEDGED'};
    return {ok:true,status:'SENT',notification_id:receipt.notification_id};
  }catch(_){return {ok:false,reason:'MAKE_TRANSPORT_UNCONFIRMED'};}
  finally{clearTimeout(timer);}
}
module.exports={VERSION,VERIFIED_SOURCE,config,makeIdentity,insertOutbox,postToMake,notifyVerifiedOwner};
