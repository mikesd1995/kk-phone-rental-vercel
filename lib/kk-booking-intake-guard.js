'use strict';

/**
 * Governed AI/customer-intake -> CRM booking boundary.
 *
 * This module never writes CRM. It only authorizes a call to the existing
 * canonical CRM/Admin createBooking API after exact identity, current
 * availability, exact package, idempotency and evidence-bound KYC gates pass.
 * Raw customer/KYC/payment PII is forbidden anywhere in this Machine-SOT input.
 */

const crypto=require('crypto');
const {evidenceCount,evidenceTimestamp}=require('./kk-evidence-validation');

const RAW_PII_KEYS = new Set([
  'customername','customerphone','customercontact','phone','contact','email','customeremail',
  'address','customeraddress','fullname','firstname','lastname','idcard','nationalid','passport',
  'dateofbirth','birthdate','idcardimage','passportimage','kycdocument','paymentslip','bankaccount'
]);

function text(v){ return String(v == null ? '' : v).trim(); }
function lower(v){ return text(v).toLowerCase(); }
function normalizedKey(v){ return lower(v).replace(/[^a-z0-9]/g,''); }
function nonNegativeInt(v, field){
  const n=evidenceCount(v);
  if(n===null) throw new Error(`${field}: expected non-negative integer`);
  return n;
}
function positiveMs(v, field){
  const n=evidenceCount(v);
  if(n===null || n<=0) throw new Error(`${field}: positive finite milliseconds required`);
  return n;
}
function parseTime(v, field){
  if(!evidenceTimestamp(v)) throw new Error(`${field} invalid`);
  const ms=Date.parse(text(v));
  if(!Number.isFinite(ms)) throw new Error(`${field} invalid`);
  return ms;
}
function hasMaterialValue(v){
  if(v==null || v==='') return false;
  if(Array.isArray(v)) return v.length>0;
  if(typeof v==='object') return Object.keys(v).length>0;
  return text(v)!=='';
}
function assertNoRawPii(value, path='input', seen=new Set(), depth=0){
  if(depth>16) throw new Error('machine intake nesting too deep');
  if(value==null || typeof value!=='object') return;
  if(seen.has(value)) throw new Error('machine intake cyclic object forbidden');
  seen.add(value);
  if(Array.isArray(value)){
    value.forEach((item,i)=>assertNoRawPii(item,`${path}[${i}]`,seen,depth+1));
    seen.delete(value);
    return;
  }
  for(const [k,v] of Object.entries(value)){
    if(RAW_PII_KEYS.has(normalizedKey(k)) && hasMaterialValue(v)) throw new Error(`raw PII forbidden in machine intake: ${path}.${k}`);
    assertNoRawPii(v,`${path}.${k}`,seen,depth+1);
  }
  seen.delete(value);
}
function exactOne(rows,predicate,label){
  const hits=(rows||[]).filter(predicate);
  if(hits.length!==1) throw new Error(`${label}: expected exactly one row, got ${hits.length}`);
  return hits[0];
}
function sha256(value){ return crypto.createHash('sha256').update(value).digest('hex'); }
function bookingIntent(input){
  const requestId=text(input.request_id);
  const customerRef=text(input.customer_ref);
  const eventId=text(input.crm_event_id);
  const templateId=text(input.crm_template_id || input.template_id);
  const packageType=text(input.package_type);
  if(!requestId) throw new Error('request_id required');
  if(!customerRef) throw new Error('customer_ref required');
  if(!eventId) throw new Error('crm_event_id required');
  if(!templateId) throw new Error('crm_template_id required');
  if(!packageType) throw new Error('package_type required');
  if(!['phone_only','lens_only','phone_lens_bundle'].includes(packageType)) throw new Error('package_type unsupported');
  return {schema_version:1,request_id:requestId,customer_ref:customerRef,crm_event_id:eventId,crm_template_id:templateId,package_type:packageType};
}
function bookingIntentFingerprint(input){ return sha256(JSON.stringify(bookingIntent(input))); }
function requireKycAttestation(input, customerRef, nowMs){
  const a=input && input.kyc_attestation;
  if(!a || typeof a!=='object' || a.verified!==true) throw new Error('KYC attestation verified=true required');
  const subject=text(a.subject_ref);
  const evidence=text(a.evidence_ref);
  const authority=text(a.authority);
  const verifiedAt=text(a.verified_at);
  if(!subject || subject!==customerRef) throw new Error('KYC attestation subject_ref mismatch');
  if(!evidence) throw new Error('KYC attestation evidence_ref required');
  if(!authority) throw new Error('KYC attestation authority required');
  const allowlist=Array.isArray(input.kyc_authority_allowlist)?input.kyc_authority_allowlist.map(text).filter(Boolean):[];
  if(!allowlist.length) throw new Error('KYC authority allowlist required');
  if(!allowlist.includes(authority)) throw new Error('KYC attestation authority not allowed');
  const verifiedMs=parseTime(verifiedAt,'KYC attestation verified_at');
  const maxAgeMs=positiveMs(input.kyc_max_age_ms,'kyc_max_age_ms');
  const futureToleranceMs=5*60*1000;
  if(verifiedMs>nowMs+futureToleranceMs) throw new Error('KYC attestation verified_at is in the future');
  const ageMs=Math.max(0,nowMs-verifiedMs);
  if(ageMs>maxAgeMs) throw new Error('KYC attestation is stale');
  return {subject_ref:subject,evidence_ref:evidence,authority,verified_at:verifiedAt,age_ms:ageMs,max_age_ms:maxAgeMs};
}
function requireCurrentAvailability(input,eventId,nowMs){
  const projection=input.availability_projection || {};
  if(text(projection.crm_event_id)!==eventId) throw new Error('availability event identity mismatch');
  if(text(projection.freshness)!=='CURRENT') throw new Error('availability is not CURRENT');
  if(text(projection.write_boundary)!=='READ_ONLY_CRM_PROJECTION') throw new Error('untrusted availability projection');
  const checkedAt=text(projection.source_checked_at);
  const checkedMs=parseTime(checkedAt,'availability source_checked_at');
  const maxAgeMs=positiveMs(input.availability_max_age_ms,'availability_max_age_ms');
  const futureToleranceMs=5*60*1000;
  if(checkedMs>nowMs+futureToleranceMs) throw new Error('availability source_checked_at is in the future');
  const ageMs=Math.max(0,nowMs-checkedMs);
  if(ageMs>maxAgeMs) throw new Error('availability projection is stale by clock');
  return {projection,checked_at:checkedAt,age_ms:ageMs,max_age_ms:maxAgeMs};
}

function authorizeBooking(input){
  if(!input || typeof input!=='object') throw new Error('input required');
  assertNoRawPii(input);
  if(input.identity_verified!==true) throw new Error('exact event identity not verified');

  const nowMs=input.now_ms==null?Date.now():evidenceCount(input.now_ms);
  if(nowMs===null) throw new Error('now_ms invalid');

  const intent=bookingIntent(input);
  const requestFingerprint=bookingIntentFingerprint(input);
  const kyc=requireKycAttestation(input,intent.customer_ref,nowMs);

  if(!Array.isArray(input.prior_requests)) throw new Error('prior_requests: explicit ledger read required');
  const prior=input.prior_requests.filter(r=>text(r.request_id)===intent.request_id);
  if(prior.length>1) throw new Error('idempotency ledger conflict');
  if(prior.length===1){
    const p=prior[0];
    const priorFp=text(p.request_fingerprint);
    if(!priorFp) throw new Error('idempotency record missing request_fingerprint; reconcile before retry');
    if(priorFp!==requestFingerprint) throw new Error('idempotency request fingerprint mismatch');
    const bookingId=text(p.booking_id);
    if(!bookingId) throw new Error('prior request unresolved; reconcile canonical CRM before retry');
    return {
      decision:'DUPLICATE_NO_WRITE',
      request_id:intent.request_id,
      request_fingerprint:requestFingerprint,
      existing_booking_id:bookingId,
      write_boundary:'EXISTING_CRM_API_ONLY'
    };
  }

  const availability=requireCurrentAvailability(input,intent.crm_event_id,nowMs);
  const packageRows=input.package_rows || [];
  const pkg=exactOne(packageRows,r=>
    text(r.event_id)===intent.crm_event_id &&
    text(r.template_id || r.crm_template_id)===intent.crm_template_id &&
    text(r.package_type)===intent.package_type,
    'exact bookable package'
  );
  const status=lower(pkg.status || pkg.availability_status);
  const qty=nonNegativeInt(pkg.available_qty ?? pkg.available_quantity ?? pkg.qty,'package.available_qty');
  if(status!=='available') throw new Error(`package not bookable: ${status || '<blank>'}`);
  if(qty<1) throw new Error('package has zero availability');

  const needPhone=intent.package_type==='phone_only' || intent.package_type==='phone_lens_bundle';
  const needLens=intent.package_type==='lens_only' || intent.package_type==='phone_lens_bundle';
  const phone=nonNegativeInt(availability.projection.phone_available,'phone_available');
  const lens=nonNegativeInt(availability.projection.lens_available,'lens_available');
  if(needPhone && phone<1) throw new Error('no phone availability');
  if(needLens && lens<1) throw new Error('no lens availability');

  return {
    decision:'CREATE_BOOKING_AUTHORIZED',
    request_id:intent.request_id,
    request_fingerprint:requestFingerprint,
    customer_ref:intent.customer_ref,
    crm_event_id:intent.crm_event_id,
    crm_template_id:intent.crm_template_id,
    package_type:intent.package_type,
    kyc_verified:true,
    kyc_evidence_ref:kyc.evidence_ref,
    kyc_authority:kyc.authority,
    kyc_verified_at:kyc.verified_at,
    kyc_age_ms:kyc.age_ms,
    exact_identity_verified:true,
    inventory_freshness:'CURRENT',
    availability_checked_at:availability.checked_at,
    availability_age_ms:availability.age_ms,
    write_boundary:'EXISTING_CRM_API_ONLY',
    canonical_writer_requires_request_idempotency:true,
    prohibited_direct_sheet_append:true
  };
}

module.exports={authorizeBooking,bookingIntentFingerprint,assertNoRawPii};
