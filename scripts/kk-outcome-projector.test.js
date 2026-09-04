'use strict';
const assert=require('assert');
const {projectOutcome}=require('../lib/kk-outcome-projector');

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
    booking_rows:[
      {event_id:'EVT-20260815-EXAMPLE',booking_status:'completed',package_price:'1190',phone_asset_id:'PHONE-001',lens_asset_id:'LENS-001',customer_name:'MUST_NOT_LEAK',customer_phone:'0999999999'},
      {event_id:'EVT-20260815-EXAMPLE',booking_status:'completed',package_price:'990',phone_asset_id:'PHONE-002',lens_asset_id:'',customer_name:'ALSO_PRIVATE'},
      {event_id:'EVT-20260815-EXAMPLE',booking_status:'cancelled',package_price:'1290',phone_asset_id:'',lens_asset_id:''},
      {event_id:'OTHER',booking_status:'completed',package_price:'9999',phone_asset_id:'PHONE-X'}
    ],
    observed_at:'2026-09-04T16:20:00+07:00',
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
  assert.equal(o.gross_revenue,null);
  assert.equal(o.net_revenue,null);
  assert.equal(o.amount_received_not_used_as_revenue,true);
  const s=JSON.stringify(o);
  assert(!s.includes('MUST_NOT_LEAK'));
  assert(!s.includes('0999999999'));
})();
(function exactOnly(){ const x=fixture(); x.crosswalk={...x.crosswalk,crm_event_id:'EVT-NONE'}; assert.throws(()=>projectOutcome(x),/no exact CRM booking rows/); })();
(function verifiedCrosswalk(){ const x=fixture(); x.crosswalk={...x.crosswalk,identity_verified:false}; assert.throws(()=>projectOutcome(x),/identity_verified=true required/); })();
(function evidenceMinimum(){ const x=fixture(); x.crosswalk={...x.crosswalk,identity_evidence:['one']}; assert.throws(()=>projectOutcome(x),/>=2 identity evidence/); })();
(function invalidClock(){ const x=fixture({observed_at:'not-a-time'}); assert.throws(()=>projectOutcome(x),/observed_at invalid/); })();
(function activeBookingStage(){ const x=fixture(); x.booking_rows=[{event_id:'EVT-20260815-EXAMPLE',booking_status:'confirmed',package_price:'1290'}]; const o=projectOutcome(x); assert.equal(o.bookings,1); assert.equal(o.units_rented,0); assert.equal(o.outcome_confidence,'CRM_BOOKING_STAGE_AGGREGATE'); })();
(function cancelledOnly(){ const x=fixture(); x.booking_rows=[{event_id:'EVT-20260815-EXAMPLE',booking_status:'cancelled',package_price:'1290'}]; const o=projectOutcome(x); assert.equal(o.bookings,0); assert.equal(o.booked,false); assert.equal(o.cancellation_count,1); })();

console.log('kk-outcome-projector: 7/7 PASS');
