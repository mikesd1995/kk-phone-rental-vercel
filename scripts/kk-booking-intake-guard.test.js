'use strict';
const assert=require('assert');
const {authorizeBooking}=require('../lib/kk-booking-intake-guard');

function fixture(overrides={}){
  return {
    request_id:'REQ-001',
    customer_ref:'CUS-TEST-REF',
    crm_event_id:'EVT-20261016-OH-MY-FOURTH-CONCERT',
    package_type:'phone_lens_bundle',
    identity_verified:true,
    kyc_attestation:{
      verified:true,
      subject_ref:'CUS-TEST-REF',
      evidence_ref:'KYCREF|TEST|001',
      authority:'CRM_MANUAL_VERIFIER',
      verified_at:'2026-09-04T16:30:00+07:00'
    },
    prior_requests:[],
    availability_projection:{
      crm_event_id:'EVT-20261016-OH-MY-FOURTH-CONCERT',
      freshness:'CURRENT',
      phone_available:2,
      lens_available:2,
      write_boundary:'READ_ONLY_CRM_PROJECTION'
    },
    package_rows:[{event_id:'EVT-20261016-OH-MY-FOURTH-CONCERT',package_type:'phone_lens_bundle',available_qty:2,status:'available'}],
    ...overrides
  };
}

(function pass(){
  const out=authorizeBooking(fixture());
  assert.equal(out.decision,'CREATE_BOOKING_AUTHORIZED');
  assert.equal(out.write_boundary,'EXISTING_CRM_API_ONLY');
  assert.equal(out.prohibited_direct_sheet_append,true);
  assert.equal(out.kyc_evidence_ref,'KYCREF|TEST|001');
  assert.equal(out.kyc_authority,'CRM_MANUAL_VERIFIER');
})();
(function noKycAttestation(){ const x=fixture(); delete x.kyc_attestation; assert.throws(()=>authorizeBooking(x),/KYC attestation verified=true required/); })();
(function kycNotVerified(){ const x=fixture(); x.kyc_attestation={...x.kyc_attestation,verified:false}; assert.throws(()=>authorizeBooking(x),/verified=true required/); })();
(function kycSubjectMismatch(){ const x=fixture(); x.kyc_attestation={...x.kyc_attestation,subject_ref:'CUS-OTHER'}; assert.throws(()=>authorizeBooking(x),/subject_ref mismatch/); })();
(function kycEvidenceRequired(){ const x=fixture(); x.kyc_attestation={...x.kyc_attestation,evidence_ref:''}; assert.throws(()=>authorizeBooking(x),/evidence_ref required/); })();
(function kycAuthorityRequired(){ const x=fixture(); x.kyc_attestation={...x.kyc_attestation,authority:''}; assert.throws(()=>authorizeBooking(x),/authority required/); })();
(function kycClockRequired(){ const x=fixture(); x.kyc_attestation={...x.kyc_attestation,verified_at:'bad-time'}; assert.throws(()=>authorizeBooking(x),/verified_at invalid/); })();
(function stale(){ const x=fixture(); x.availability_projection={...x.availability_projection,freshness:'STALE'}; assert.throws(()=>authorizeBooking(x),/not CURRENT/); })();
(function wrongIdentity(){ const x=fixture(); x.availability_projection={...x.availability_projection,crm_event_id:'EVT-WRONG'}; assert.throws(()=>authorizeBooking(x),/identity mismatch/); })();
(function fullPackage(){ const x=fixture(); x.package_rows[0]={...x.package_rows[0],status:'full',available_qty:0}; assert.throws(()=>authorizeBooking(x),/package not bookable/); })();
(function noInventory(){ const x=fixture(); x.availability_projection={...x.availability_projection,phone_available:0}; assert.throws(()=>authorizeBooking(x),/no phone availability/); })();
(function duplicate(){ const x=fixture({prior_requests:[{request_id:'REQ-001',booking_id:'BK-EXISTING'}]}); const out=authorizeBooking(x); assert.equal(out.decision,'DUPLICATE_NO_WRITE'); assert.equal(out.existing_booking_id,'BK-EXISTING'); })();
(function rawPiiBlocked(){ const x=fixture({customer_phone:'0999999999'}); assert.throws(()=>authorizeBooking(x),/raw PII forbidden/); })();
(function directSheetProjectionBlocked(){ const x=fixture(); x.availability_projection={...x.availability_projection,write_boundary:'DIRECT_SHEET'}; assert.throws(()=>authorizeBooking(x),/untrusted availability projection/); })();

console.log('kk-booking-intake-guard: 14/14 PASS');
