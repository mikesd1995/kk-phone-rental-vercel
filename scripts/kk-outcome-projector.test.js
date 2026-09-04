'use strict';
const assert=require('assert');
const {projectOutcome,toBusinessOutcomeRow}=require('../lib/kk-outcome-projector');

function fixture(overrides={}){
  return {
    crosswalk:{
      identity_verified:true,
      event_family_id:'FAM|example|20260815',
      show_id:'SHOW|example|20260815|S1',
      crm_event_id:'EVT-20260815-EXAMPLE',
      event_date:'2026-08-15',
      identity_evidence:['event_name exact','event_date exact','venue exact']
    },
    event_rows:[{event_id:'EVT-20260815-EXAMPLE',event_name:'Example Event',event_date:'15/08/2026',venue:'Example Hall'}],
    booking_rows:[
      {event_id:'EVT-20260815-EXAMPLE',booking_status:'completed',package_price:'1190',phone_asset_id:'PHONE-001',lens_asset_id:'LENS-001',customer_name:'MUST_NOT_LEAK',customer_phone:'0999999999'},
      {event_id:'EVT-20260815-EXAMPLE',booking_status:'completed',package_price:'990',phone_asset_id:'PHONE-002',lens_asset_id:'',customer_name:'ALSO_PRIVATE'},
      {event_id:'EVT-20260815-EXAMPLE',booking_status:'cancelled',package_price:'1290',phone_asset_id:'',lens_asset_id:''},
      {event_id:'OTHER',booking_status:'completed',package_price:'9999',phone_asset_id:'PHONE-X'}
    ],
    observed_at:'2026-09-04T16:20:00+07:00',
    observation_stage:'POST_EVENT_FINAL',
    policy_version:'v4.9.2',
    ...overrides
  };
}

(function completedAggregate(){
  const o=projectOutcome(fixture());
  assert.equal(o.bookings,2);
  assert.equal(o.units_rented,3);
  assert.equal(o.actual_price,1090);
  assert.equal(o.booked,true);
  assert.equal(o.cancellation_count,1);
  assert.equal(o.posted_x,null);
  assert.equal(o.eligible_for_business_outcome,true);
  assert.equal(o.gross_revenue,null);
  assert.equal(o.net_revenue,null);
  assert.equal(o.amount_received_not_used_as_revenue,true);
  const row=toBusinessOutcomeRow(o);
  assert.equal(row['Bookings'],2);
  assert.equal(row['Posted X'],null);
  assert.equal(row['Gross Revenue'],null);
  const s=JSON.stringify(row);
  assert(!s.includes('MUST_NOT_LEAK'));
  assert(!s.includes('0999999999'));
})();
(function exactEventSnapshotRequired(){ const x=fixture({event_rows:[]}); assert.throws(()=>projectOutcome(x),/exact CRM event snapshot: expected exactly one row, got 0/); })();
(function verifiedCrosswalk(){ const x=fixture(); x.crosswalk={...x.crosswalk,identity_verified:false}; assert.throws(()=>projectOutcome(x),/identity_verified=true required/); })();
(function evidenceMinimum(){ const x=fixture(); x.crosswalk={...x.crosswalk,identity_evidence:['one']}; assert.throws(()=>projectOutcome(x),/>=2 identity evidence/); })();
(function invalidClock(){ const x=fixture({observed_at:'not-a-time'}); assert.throws(()=>projectOutcome(x),/observed_at invalid/); })();
(function policyRequired(){ const x=fixture({policy_version:''}); assert.throws(()=>projectOutcome(x),/policy_version required/); })();
(function activeBookingStage(){ const x=fixture(); x.booking_rows=[{event_id:'EVT-20260815-EXAMPLE',booking_status:'confirmed',package_price:'1290'}]; const o=projectOutcome(x); assert.equal(o.bookings,1); assert.equal(o.units_rented,0); assert.equal(o.outcome_confidence,'CRM_BOOKING_STAGE_AGGREGATE'); })();
(function cancelledOnlyFinal(){ const x=fixture(); x.booking_rows=[{event_id:'EVT-20260815-EXAMPLE',booking_status:'cancelled',package_price:'1290'}]; const o=projectOutcome(x); assert.equal(o.bookings,0); assert.equal(o.booked,false); assert.equal(o.cancellation_count,1); assert.equal(o.outcome_confidence,'CRM_ZERO_BOOKING_FINAL'); })();
(function zeroBookingFinal(){ const o=projectOutcome(fixture({booking_rows:[]})); assert.equal(o.bookings,0); assert.equal(o.booked,false); assert.equal(o.eligible_for_business_outcome,true); assert.equal(toBusinessOutcomeRow(o)['Bookings'],0); })();
(function preEventNotFinal(){ const o=projectOutcome(fixture({booking_rows:[],observation_stage:'PRE_EVENT_SNAPSHOT'})); assert.equal(o.eligible_for_business_outcome,false); assert.equal(o.outcome_confidence,'CRM_ZERO_BOOKING_PRE_EVENT_SNAPSHOT'); assert.throws(()=>toBusinessOutcomeRow(o),/not eligible/); })();
(function publishedXNeedsProviderEvidence(){ const o=projectOutcome(fixture({x_post_evidence:{posted:true,provider_evidence_ref:'XPROVIDER|123',post_id:'123',post_url:'https://x.com/kk/status/123',post_at:'2026-08-15T20:00:00+07:00'}})); assert.equal(o.posted_x,true); assert.equal(o.x_post_id,'123'); assert.equal(toBusinessOutcomeRow(o)['Posted X'],true); })();
(function publishedXMissingReceiptFails(){ const x=fixture({x_post_evidence:{posted:true,provider_evidence_ref:'XPROVIDER|123',post_id:'',post_url:'',post_at:'2026-08-15T20:00:00+07:00'}}); assert.throws(()=>projectOutcome(x),/requires post_id and post_url/); })();
(function explicitNotPostedEvidence(){ const o=projectOutcome(fixture({x_post_evidence:{posted:false,provider_evidence_ref:'GATE|NOT_AUTHORIZED'}})); assert.equal(o.posted_x,false); })();
(function badStageFails(){ assert.throws(()=>projectOutcome(fixture({observation_stage:'MAYBE'})),/observation_stage/); })();

console.log('kk-outcome-projector: 14/14 PASS');
