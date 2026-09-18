'use strict';

const crypto=require('crypto');

const VERSION='kk-scanner-trigger-v1';
const ROLE='SCANNER';
const SOURCE='CLOUDFLARE_CRON';
const DEFAULT_ISSUED_SKEW_MS=10*60*1000;
const DEFAULT_SCHEDULE_SKEW_MS=20*60*1000;
const TOP_HOUR_BANGKOK=/^\d{4}-\d{2}-\d{2}T\d{2}:00:00\+07:00$/;

function text(value){
  return String(value==null?'':value).trim();
}

function canonicalizeEnvelope(input={}){
  return [
    text(input.version),
    text(input.role),
    text(input.occurrence_id),
    text(input.scheduled_at),
    text(input.issued_at),
    text(input.nonce),
    text(input.source)
  ].join('\n');
}

function occurrenceIdFor(scheduledAt){
  const value=text(scheduledAt);
  if(!TOP_HOUR_BANGKOK.test(value) || Number.isNaN(Date.parse(value))){
    throw new Error('scheduled_at must be a valid Asia/Bangkok top-of-hour timestamp');
  }
  return `SCANNER|${value}`;
}

function sha256(value){
  return crypto.createHash('sha256').update(String(value),'utf8').digest('hex');
}

function signEnvelope(secret,envelope){
  const key=text(secret);
  if(!key) throw new Error('scanner shared secret is required');
  return crypto.createHmac('sha256',key).update(canonicalizeEnvelope(envelope),'utf8').digest('hex');
}

function safeEqualHex(a,b){
  const left=text(a).toLowerCase();
  const right=text(b).toLowerCase();
  if(!/^[0-9a-f]{64}$/.test(left) || !/^[0-9a-f]{64}$/.test(right)) return false;
  return crypto.timingSafeEqual(Buffer.from(left,'hex'),Buffer.from(right,'hex'));
}

function validateEnvelope(input={},options={}){
  const nowMs=Number.isFinite(options.nowMs)?options.nowMs:Date.now();
  const issuedSkewMs=Number.isFinite(options.issuedSkewMs)?options.issuedSkewMs:DEFAULT_ISSUED_SKEW_MS;
  const scheduleSkewMs=Number.isFinite(options.scheduleSkewMs)?options.scheduleSkewMs:DEFAULT_SCHEDULE_SKEW_MS;

  const envelope={
    version:text(input.version),
    role:text(input.role),
    occurrence_id:text(input.occurrence_id),
    scheduled_at:text(input.scheduled_at),
    issued_at:text(input.issued_at),
    nonce:text(input.nonce),
    source:text(input.source)
  };

  if(envelope.version!==VERSION) throw Object.assign(new Error('unsupported trigger version'),{code:'TRIGGER_VERSION_INVALID'});
  if(envelope.role!==ROLE) throw Object.assign(new Error('role must be SCANNER'),{code:'TRIGGER_ROLE_INVALID'});
  if(envelope.source!==SOURCE) throw Object.assign(new Error('source must be CLOUDFLARE_CRON'),{code:'TRIGGER_SOURCE_INVALID'});
  if(!TOP_HOUR_BANGKOK.test(envelope.scheduled_at) || Number.isNaN(Date.parse(envelope.scheduled_at))){
    throw Object.assign(new Error('scheduled_at must be Asia/Bangkok top-of-hour'),{code:'TRIGGER_SCHEDULE_INVALID'});
  }
  const expectedId=occurrenceIdFor(envelope.scheduled_at);
  if(envelope.occurrence_id!==expectedId){
    throw Object.assign(new Error('occurrence_id does not match scheduled_at'),{code:'TRIGGER_OCCURRENCE_ID_INVALID'});
  }
  if(!/^[-A-Za-z0-9_:.]{16,128}$/.test(envelope.nonce)){
    throw Object.assign(new Error('nonce format invalid'),{code:'TRIGGER_NONCE_INVALID'});
  }

  const issuedMs=Date.parse(envelope.issued_at);
  if(Number.isNaN(issuedMs)){
    throw Object.assign(new Error('issued_at is invalid'),{code:'TRIGGER_ISSUED_AT_INVALID'});
  }
  if(Math.abs(nowMs-issuedMs)>issuedSkewMs){
    throw Object.assign(new Error('issued_at is outside allowed skew'),{code:'TRIGGER_ISSUED_AT_STALE'});
  }

  const scheduledMs=Date.parse(envelope.scheduled_at);
  if(Math.abs(nowMs-scheduledMs)>scheduleSkewMs){
    throw Object.assign(new Error('scheduled_at is outside allowed execution window'),{code:'TRIGGER_SCHEDULE_STALE'});
  }

  return {
    envelope,
    canonical:canonicalizeEnvelope(envelope),
    payload_hash:sha256(canonicalizeEnvelope(envelope))
  };
}

function verifyEnvelope({secret,signature,envelope,options}){
  const validated=validateEnvelope(envelope,options);
  const expected=signEnvelope(secret,validated.envelope);
  if(!safeEqualHex(expected,signature)){
    throw Object.assign(new Error('signature verification failed'),{code:'TRIGGER_SIGNATURE_INVALID'});
  }
  return validated;
}

module.exports={
  VERSION,
  ROLE,
  SOURCE,
  canonicalizeEnvelope,
  occurrenceIdFor,
  sha256,
  signEnvelope,
  validateEnvelope,
  verifyEnvelope
};
