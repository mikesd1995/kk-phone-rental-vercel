'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Gate=require('../server/kk-booking-handover-safety');
const booking=(date,asset,extras={})=>({booking_status:'confirmed',event_date:date,phone_asset_id:asset,pickup_time:'14:00',return_time:'21:00',...extras});

test('canonical Excel, Thai and ISO dates resolve deterministically',()=>{
  assert.equal(Gate.isoDate(46312),'2026-10-17');
  assert.equal(Gate.isoDate('17/10/2569'),'2026-10-17');
  assert.equal(Gate.isoDate('2026-10-18'),'2026-10-18');
  for(const d of ['2026-02-30','', 'foo','18/15/2026'])assert.equal(Gate.isoDate(d),'');
});
test('unrelated fully specified dates do not signal handover blockers',()=>{
  const r=Gate.audit([booking('2026-10-17','P1'),booking('2026-10-18','P2')]);
  assert.equal(r.status,'NO_OBSERVED_BLOCKER');
  assert.equal(r.counts.adjacent_day_asset_reuse,0);
  assert.equal(r.production_writes,0);
});
test('current consecutive-day two-phone handover blocks without verified times',()=>{
  const rows=[booking('2026-10-17','P1',{pickup_time:'',return_time:''}),booking('2026-10-17','P2',{pickup_time:'',return_time:''}),booking('2026-10-18','P1',{pickup_time:'',return_time:''}),booking('2026-10-18','P2',{pickup_time:'',return_time:''})];
  const r=Gate.audit(rows);
  assert.equal(r.status,'BLOCKED');
  assert.equal(r.counts.active_checked,4);
  assert.equal(r.counts.missing_pickup,4);
  assert.equal(r.counts.missing_return,4);
  assert.equal(r.counts.adjacent_day_asset_reuse,2);
  assert.equal(r.counts.unverified_interday_handover,2);
  assert.equal(r.authorizes_asset_allocation,false);
});
test('times alone never declare adjacent-day physical handover safe',()=>{
  const r=Gate.audit([booking('2026-10-17','P1'),booking('2026-10-18','P1')]);
  assert.equal(r.status,'OWNER_REVIEW_REQUIRED');
  assert.equal(r.owner_review_required,true);
  assert.equal(r.counts.unverified_interday_handover,0);
});
test('duplicate same-day asset assignment blocks; no raw asset identifiers in report',()=>{
  const r=Gate.audit([booking('2026-10-17','PRIVATE_ASSET_1'),booking('2026-10-17','PRIVATE_ASSET_1')]);
  assert.equal(r.status,'BLOCKED');
  assert.equal(r.counts.same_day_asset_duplicates,1);
  assert.doesNotMatch(JSON.stringify(r),/PRIVATE_ASSET_1/);
});
test('missing asset and malformed date fail closed without leaking customer data',()=>{
  const r=Gate.audit([booking('invalid','',{customer_name:'PRIVATE_CUSTOMER_NAME'})]);
  assert.equal(r.status,'BLOCKED');
  assert.equal(r.counts.missing_event_date,1);
  assert.equal(r.counts.missing_asset,1);
  assert.doesNotMatch(JSON.stringify(r),/PRIVATE_CUSTOMER_NAME/);
});
test('cancelled/completed and pending unallocated rows do not claim confirmed handovers',()=>{
  const r=Gate.audit([booking('2026-10-17','P1',{booking_status:'cancelled'}),booking('2026-10-17','P1',{booking_status:'completed'}),booking('2026-10-17','',{booking_status:'pending'})]);
  assert.equal(r.counts.active_checked,0);
});
test('focus dates limit reporting to requested window and never supply an allocation permit',()=>{
  const r=Gate.audit([booking('2026-10-17','P1',{return_time:''}),booking('2026-11-01','P2',{return_time:''})],{focusDates:['17/10/2026']});
  assert.equal(r.counts.active_checked,1);
  assert.equal(r.counts.missing_return,1);
  assert.equal(r.authorizes_booking_write,false);
});
test('adjacent day comparison is strict, not same day or month-number approximation',()=>{
  assert.equal(Gate.adjacent('2026-10-31','2026-11-01'),true);
  assert.equal(Gate.adjacent('2026-10-17','2026-10-19'),false);
});

test('pending booking with an assigned asset is a safety hold, unallocated pending is ignored',()=>{
  const r=Gate.audit([booking('2026-10-17','P1'),booking('2026-10-17','P1',{booking_status:'pending'}),booking('2026-10-17','',{booking_status:'pending'})]);
  assert.equal(r.counts.active_checked,2);
  assert.equal(r.counts.same_day_asset_duplicates,1);
  assert.equal(r.status,'BLOCKED');
});
test('invalid or empty focus filters must fail closed rather than returning green',()=>{
  for(const focusDates of [[],['garbage'],['2026-10-17','garbage'],'2026-10-17']){
    const r=Gate.audit([booking('2026-10-17','P1')],{focusDates});
    assert.equal(r.status,'BLOCKED');
    assert.equal(r.counts.invalid_focus_dates,1);
  }
});


test('focus on prior day preserves next-day asset reuse and blocks missing return',()=>{
  const rows=[booking('2026-10-17','P1',{return_time:''}),booking('2026-10-18','P1'),booking('2026-11-01','P2',{return_time:''})];
  const r=Gate.audit(rows,{focusDates:['2026-10-17']});
  assert.equal(r.counts.active_checked,1);
  assert.equal(r.counts.missing_return,1);
  assert.equal(r.counts.adjacent_day_asset_reuse,1);
  assert.equal(r.counts.unverified_interday_handover,1);
  assert.equal(r.status,'BLOCKED');
  assert.equal(r.authorizes_booking_write,false);
});
test('focus on next day checks prior-day return and cannot become a false green',()=>{
  const rows=[booking('2026-10-17','P1',{return_time:''}),booking('2026-10-18','P1')];
  const r=Gate.audit(rows,{focusDates:['2026-10-18']});
  assert.equal(r.counts.active_checked,1);
  assert.equal(r.counts.missing_return,0);
  assert.equal(r.counts.adjacent_day_asset_reuse,1);
  assert.equal(r.counts.unverified_interday_handover,1);
  assert.equal(r.status,'BLOCKED');
});
test('focused clean next-day reuse still requires manual owner review',()=>{
  const r=Gate.audit([booking('2026-10-17','P1'),booking('2026-10-18','P1')],{focusDates:['2026-10-18']});
  assert.equal(r.status,'OWNER_REVIEW_REQUIRED');
  assert.equal(r.counts.adjacent_day_asset_reuse,1);
  assert.equal(r.counts.unverified_interday_handover,0);
});
test('unrelated outside-window handover evidence is not counted under focused report',()=>{
  const r=Gate.audit([
    booking('2026-10-17','P1'),
    booking('2026-11-01','P2',{return_time:''}),
    booking('2026-11-02','P2',{pickup_time:''})
  ],{focusDates:['2026-10-17']});
  assert.equal(r.status,'NO_OBSERVED_BLOCKER');
  assert.equal(r.counts.active_checked,1);
  assert.equal(r.counts.adjacent_day_asset_reuse,0);
  assert.equal(r.counts.unverified_interday_handover,0);
});

test('three-day focused review includes both boundary transfers but not customer identities',()=>{
  const rows=[
    booking('2026-10-16','P1',{pickup_time:'',return_time:''}),
    booking('2026-10-17','P1',{pickup_time:'',return_time:''}),
    booking('2026-10-17','P2',{pickup_time:'',return_time:''}),
    booking('2026-10-18','P1',{pickup_time:'',return_time:''}),
    booking('2026-10-18','P2',{pickup_time:'',return_time:''})
  ];
  const focus=Gate.audit(rows,{focusDates:['2026-10-17']});
  assert.equal(focus.counts.active_checked,2);
  assert.equal(focus.counts.adjacent_day_asset_reuse,3);
  assert.equal(focus.counts.unverified_interday_handover,3);
  assert.equal(focus.status,'BLOCKED');
  assert.equal(focus.authorizes_asset_allocation,false);
  const following=Gate.audit(rows,{focusDates:['2026-10-18']});
  assert.equal(following.counts.adjacent_day_asset_reuse,2);
  assert.equal(following.status,'BLOCKED');
});
