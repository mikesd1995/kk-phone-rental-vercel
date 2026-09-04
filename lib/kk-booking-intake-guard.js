'use strict';

/**
 * Governed AI/customer-intake -> CRM booking boundary.
 *
 * This module never writes CRM. It only authorizes a call to the existing
 * canonical CRM/Admin createBooking API after exact identity, current
 * availability, package, idempotency and evidence-bound KYC gates pass.
 * Raw customer/KYC/payment PII is forbidden at this Machine-SOT boundary.
 */

const RAW_PII_KEYS = new Set([
  'customer_name','customer_phone','customer_contact','phone','contact',
  'id_card','passport','id_card_image','passport_image','kyc_document','payment_slip'
]);

function text(v){ return String(v == null ? '' : v).trim(); }
function lower(v){ return text(v).toLowerCase(); }
function nonNegativeInt(v, field){
  const s=text(v).replace(/,/g,'');
  if(!/^\d+$/.test(s)) throw new Error(`${field}: expected non-negative integer`);
  const n=Number(s);
  if(!Number.isSafeInteger(n)) throw new Error(`${field}: invalid integer`);
  return n;
}
function assertNoRawPii(obj){
  for(const k of Object.keys(obj || {})){
    if(RAW_PII_KEYS.has(lower(k)) && text(obj[k])) throw new Error(`raw PII forbidden in machine intake: ${k}`);
  }
}
function exactOne(rows,predicate,label){
  const hits=(rows||[]).filter(predicate);
  if(hits.length!==1) throw new Error(`${label}: expected exactly one row, got ${hits.length}`);
  return hits[0];
}
function requireKycAttestation(input, customerRef){
  const a=input && input.kyc_attestation;
  if(!a || typeof a!=='object' || a.verified!==true) throw new Error('KYC attestation verified=true required');
  const subject=text(a.subject_ref);
  const evidence=text(a.evidence_ref);
  const authority=text(a.authority);
  const verifiedAt=text(a.verified_at);
  if(!subject || subject!==customerRef) throw new Error('KYC attestation subject_ref mismatch');
  if(!evidence) throw new Error('KYC attestation evidence_ref required');
  if(!authority) throw new Error('KYC attestation authority required');
  if(!Number.isFinite(Date.parse(verifiedAt))) throw new Error('KYC attestation verified_at invalid');
  return {subject_ref:subject,evidence_ref:evidence,authority,verified_at:verifiedAt};
}

function authorizeBooking(input){
  if(!input || typeof input!=='object') throw new Error('input required');
  assertNoRawPii(input);

  const requestId=text(input.request_id);
  const customerRef=text(input.customer_ref);
  const eventId=text(input.crm_event_id);
  const packageType=text(input.package_type);
  if(!requestId) throw new Error('request_id required');
  if(!customerRef) throw new Error('customer_ref required');
  if(!eventId) throw new Error('crm_event_id required');
  if(!packageType) throw new Error('package_type required');
  if(input.identity_verified!==true) throw new Error('exact event identity not verified');
  const kyc=requireKycAttestation(input,customerRef);

  const prior=(input.prior_requests||[]).filter(r=>text(r.request_id)===requestId);
  if(prior.length>1) throw new Error('idempotency ledger conflict');
  if(prior.length===1){
    const p=prior[0];
    return {
      decision:'DUPLICATE_NO_WRITE',
      request_id:requestId,
      existing_booking_id:text(p.booking_id),
      write_boundary:'EXISTING_CRM_API_ONLY'
    };
  }

  const projection=input.availability_projection || {};
  if(text(projection.crm_event_id)!==eventId) throw new Error('availability event identity mismatch');
  if(text(projection.freshness)!=='CURRENT') throw new Error('availability is not CURRENT');
  if(text(projection.write_boundary)!=='READ_ONLY_CRM_PROJECTION') throw new Error('untrusted availability projection');

  const packageRows=input.package_rows || [];
  const pkg=exactOne(packageRows,r=>text(r.event_id)===eventId && text(r.package_type)===packageType,'exact bookable package');
  const status=lower(pkg.status || pkg.availability_status);
  const qty=nonNegativeInt(pkg.available_qty ?? pkg.available_quantity ?? pkg.qty,'package.available_qty');
  if(status!=='available') throw new Error(`package not bookable: ${status || '<blank>'}`);
  if(qty<1) throw new Error('package has zero availability');

  const needPhone=packageType==='phone_only' || packageType==='phone_lens_bundle';
  const needLens=packageType==='lens_only' || packageType==='phone_lens_bundle';
  const phone=nonNegativeInt(projection.phone_available,'phone_available');
  const lens=nonNegativeInt(projection.lens_available,'lens_available');
  if(needPhone && phone<1) throw new Error('no phone availability');
  if(needLens && lens<1) throw new Error('no lens availability');

  return {
    decision:'CREATE_BOOKING_AUTHORIZED',
    request_id:requestId,
    customer_ref:customerRef,
    crm_event_id:eventId,
    package_type:packageType,
    kyc_verified:true,
    kyc_evidence_ref:kyc.evidence_ref,
    kyc_authority:kyc.authority,
    kyc_verified_at:kyc.verified_at,
    exact_identity_verified:true,
    inventory_freshness:'CURRENT',
    write_boundary:'EXISTING_CRM_API_ONLY',
    prohibited_direct_sheet_append:true
  };
}

module.exports={authorizeBooking};
