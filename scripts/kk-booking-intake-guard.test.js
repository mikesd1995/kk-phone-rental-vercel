'use strict';
const assert=require('assert');
const {authorizeBooking,bookingIntentFingerprint}=require('../lib/kk-booking-intake-guard');

const NOW=Date.parse('2026-09-04T17:00:00+07:00');
function fixture(overrides={}){
  return {
    request_id:'REQ-001',
    customer_ref:'CUS-TEST-REF',
    crm_event_id:'EVT-20261016-OH-MY-FOURTH-CONCERT',
    crm_template_id:'TPL-VIVO-X300-PRO-BUNDLE',
    package_type:'phone_lens_bundle',
    identity_verified:true,
    now_ms:NOW,
    kyc_authority_allowlist:['CRM_MANUAL_VERIFIER'],
    kyc_max_age_ms:2*60*60*1000,
    availability_max_age_ms:15*60*1000,
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
      source_checked_at:'2026-09-04T16:55:00+07:00',
      freshness:'CURRENT',
      phone_available:2,
      lens_available:2,
      write_boundary:'READ_ONLY_CRM_PROJECTION'
    },
    package_rows:[{event_id:'EVT-20261016-OH-MY-FOURTH-CONCERT',template_id:'TPL-VIVO-X300-PRO-BUNDLE',package_type:'phone_lens_bundle',available_qty:2,status:'available'}],
    ...overrides
  };
}
let count=0; function test(name,fn){fn();count++;}

test('pass',()=>{const out=authorizeBooking(fixture());assert.equal(out.decision,'CREATE_BOOKING_AUTHORIZED');assert.equal(out.write_boundary,'EXISTING_CRM_API_ONLY');assert.equal(out.prohibited_direct_sheet_append,true);assert.equal(out.canonical_writer_requires_request_idempotency,true);assert.equal(out.kyc_evidence_ref,'KYCREF|TEST|001');assert.equal(out.crm_template_id,'TPL-VIVO-X300-PRO-BUNDLE');assert.match(out.request_fingerprint,/^[a-f0-9]{64}$/);});
test('no KYC',()=>{const x=fixture();delete x.kyc_attestation;assert.throws(()=>authorizeBooking(x),/verified=true required/);});
test('KYC false',()=>{const x=fixture();x.kyc_attestation={...x.kyc_attestation,verified:false};assert.throws(()=>authorizeBooking(x),/verified=true required/);});
test('KYC subject mismatch',()=>{const x=fixture();x.kyc_attestation={...x.kyc_attestation,subject_ref:'CUS-OTHER'};assert.throws(()=>authorizeBooking(x),/subject_ref mismatch/);});
test('KYC evidence required',()=>{const x=fixture();x.kyc_attestation={...x.kyc_attestation,evidence_ref:''};assert.throws(()=>authorizeBooking(x),/evidence_ref required/);});
test('KYC authority required',()=>{const x=fixture();x.kyc_attestation={...x.kyc_attestation,authority:''};assert.throws(()=>authorizeBooking(x),/authority required/);});
test('KYC clock required',()=>{const x=fixture();x.kyc_attestation={...x.kyc_attestation,verified_at:'bad-time'};assert.throws(()=>authorizeBooking(x),/verified_at invalid/);});
test('KYC allowlist required',()=>{const x=fixture({kyc_authority_allowlist:[]});assert.throws(()=>authorizeBooking(x),/allowlist required/);});
test('KYC authority allowlisted',()=>{const x=fixture({kyc_authority_allowlist:['OTHER']});assert.throws(()=>authorizeBooking(x),/authority not allowed/);});
test('KYC future blocked',()=>{const x=fixture();x.kyc_attestation={...x.kyc_attestation,verified_at:'2026-09-04T18:00:00+07:00'};assert.throws(()=>authorizeBooking(x),/in the future/);});
test('KYC stale blocked',()=>{const x=fixture({kyc_max_age_ms:10*60*1000});assert.throws(()=>authorizeBooking(x),/KYC attestation is stale/);});
test('availability flag stale',()=>{const x=fixture();x.availability_projection={...x.availability_projection,freshness:'STALE'};assert.throws(()=>authorizeBooking(x),/not CURRENT/);});
test('availability event mismatch',()=>{const x=fixture();x.availability_projection={...x.availability_projection,crm_event_id:'EVT-WRONG'};assert.throws(()=>authorizeBooking(x),/identity mismatch/);});
test('availability direct sheet blocked',()=>{const x=fixture();x.availability_projection={...x.availability_projection,write_boundary:'DIRECT_SHEET'};assert.throws(()=>authorizeBooking(x),/untrusted availability projection/);});
test('availability timestamp required',()=>{const x=fixture();x.availability_projection={...x.availability_projection,source_checked_at:''};assert.throws(()=>authorizeBooking(x),/source_checked_at invalid/);});
test('availability future blocked',()=>{const x=fixture();x.availability_projection={...x.availability_projection,source_checked_at:'2026-09-04T18:00:00+07:00'};assert.throws(()=>authorizeBooking(x),/in the future/);});
test('availability stale by clock',()=>{const x=fixture();x.availability_projection={...x.availability_projection,source_checked_at:'2026-09-04T16:00:00+07:00'};assert.throws(()=>authorizeBooking(x),/stale by clock/);});
test('full package blocked',()=>{const x=fixture();x.package_rows[0]={...x.package_rows[0],status:'full',available_qty:0};assert.throws(()=>authorizeBooking(x),/package not bookable/);});
test('zero package blocked',()=>{const x=fixture();x.package_rows[0]={...x.package_rows[0],available_qty:0};assert.throws(()=>authorizeBooking(x),/zero availability/);});
test('no phone',()=>{const x=fixture();x.availability_projection={...x.availability_projection,phone_available:0};assert.throws(()=>authorizeBooking(x),/no phone availability/);});
test('no lens',()=>{const x=fixture();x.availability_projection={...x.availability_projection,lens_available:0};assert.throws(()=>authorizeBooking(x),/no lens availability/);});
test('template required',()=>{const x=fixture({crm_template_id:''});assert.throws(()=>authorizeBooking(x),/crm_template_id required/);});
test('wrong template row',()=>{const x=fixture();x.package_rows[0]={...x.package_rows[0],template_id:'TPL-OTHER'};assert.throws(()=>authorizeBooking(x),/exact bookable package/);});
test('duplicate same intent no write',()=>{const x=fixture();const fp=bookingIntentFingerprint(x);x.prior_requests=[{request_id:'REQ-001',request_fingerprint:fp,booking_id:'BK-EXISTING'}];const out=authorizeBooking(x);assert.equal(out.decision,'DUPLICATE_NO_WRITE');assert.equal(out.existing_booking_id,'BK-EXISTING');});
test('duplicate missing fingerprint blocked',()=>{const x=fixture({prior_requests:[{request_id:'REQ-001',booking_id:'BK-EXISTING'}]});assert.throws(()=>authorizeBooking(x),/missing request_fingerprint/);});
test('duplicate fingerprint mismatch blocked',()=>{const x=fixture({prior_requests:[{request_id:'REQ-001',request_fingerprint:'f'.repeat(64),booking_id:'BK-EXISTING'}]});assert.throws(()=>authorizeBooking(x),/fingerprint mismatch/);});
test('duplicate unresolved blocked',()=>{const x=fixture();const fp=bookingIntentFingerprint(x);x.prior_requests=[{request_id:'REQ-001',request_fingerprint:fp,booking_id:''}];assert.throws(()=>authorizeBooking(x),/prior request unresolved/);});
test('duplicate ledger conflict',()=>{const x=fixture();const fp=bookingIntentFingerprint(x);x.prior_requests=[{request_id:'REQ-001',request_fingerprint:fp,booking_id:'A'},{request_id:'REQ-001',request_fingerprint:fp,booking_id:'A'}];assert.throws(()=>authorizeBooking(x),/ledger conflict/);});
test('top-level raw PII blocked',()=>{const x=fixture({customer_phone:'0999999999'});assert.throws(()=>authorizeBooking(x),/raw PII forbidden/);});
test('nested raw PII blocked',()=>{const x=fixture({metadata:{customer_name:'Alice'}});assert.throws(()=>authorizeBooking(x),/raw PII forbidden/);});
test('array nested raw PII blocked',()=>{const x=fixture({evidence:[{passport:'P123'}]});assert.throws(()=>authorizeBooking(x),/raw PII forbidden/);});
test('fingerprint stable',()=>{assert.equal(bookingIntentFingerprint(fixture()),bookingIntentFingerprint(fixture()));});
test('fingerprint changes exact intent',()=>{const a=bookingIntentFingerprint(fixture());const b=bookingIntentFingerprint(fixture({crm_event_id:'EVT-OTHER',availability_projection:{...fixture().availability_projection,crm_event_id:'EVT-OTHER'},package_rows:[{event_id:'EVT-OTHER',template_id:'TPL-VIVO-X300-PRO-BUNDLE',package_type:'phone_lens_bundle',available_qty:2,status:'available'}]}));assert.notEqual(a,b);});

console.log(`kk-booking-intake-guard: ${count}/${count} PASS`);
