const test=require('node:test');
const assert=require('node:assert/strict');
const R=require('../admin/reservation-guard.js');
const Guard=require('../api/kk-admin-guard.js');

const phone={asset_id:'PHONE-001',asset_type:'phone',status:'available',rentable_setting:true};
const lens={asset_id:'LENS-001',asset_type:'lens',status:'available',rentable_setting:true};
const booking=(id,date,pickup,status='confirmed',extra={})=>Object.assign({
  booking_id:id,row_number:10,event_id:'E-'+date,event_date:date,
  booking_status:status,package_type:'phone_only',phone_asset_id:'PHONE-001',
  lens_asset_id:'',pickup_time:pickup,return_time:''
},extra);

test('explicit cross-midnight window ends on the next Bangkok day',()=>{
  const w=R.reservationWindow(booking('B1','2026-09-19','22:00','confirmed',{return_time:'01:00'}));
  assert.equal(w.mode,'explicit');
  assert.equal(w.end_ms-w.start_ms,3*60*60*1000);
  assert.equal(w.start_at,'2026-09-19T15:00:00.000Z');
  assert.equal(w.end_at,'2026-09-19T18:00:00.000Z');
});

test('adjacent explicit windows do not overlap at the return boundary',()=>{
  const a=R.reservationWindow(booking('B1','2026-09-19','18:00','confirmed',{return_time:'20:00'}));
  const b=R.reservationWindow(booking('B2','2026-09-19','20:00','confirmed',{return_time:'22:00'}));
  assert.equal(R.overlaps(a,b),false);
});

test('same asset collision is rejected inside an explicit reservation window',()=>{
  const existing=booking('B1','2026-09-19','18:00','confirmed',{return_time:'22:00'});
  const proposed=booking('NEW','2026-09-19','20:00','confirmed',{row_number:0,return_time:'23:00'});
  const r=R.preflight({assets:[phone],bookings:[existing]},proposed);
  assert.equal(r.ok,false);
  assert.ok(r.errors.some(x=>x.code==='PHONE_CAPACITY_EXCEEDED'));
  assert.ok(r.errors.some(x=>x.code==='ASSET_WINDOW_COLLISION'));
});

test('capacity overlap is rejected even when the proposed asset is left for auto-assign',()=>{
  const existing=booking('B1','2026-09-19','18:00','confirmed',{return_time:'22:00'});
  const proposed=booking('NEW','2026-09-19','20:00','confirmed',{
    row_number:0,phone_asset_id:'',return_time:'23:00'
  });
  const r=R.preflight({assets:[phone],bookings:[existing]},proposed);
  assert.equal(r.ok,false);
  assert.ok(r.errors.some(x=>x.code==='PHONE_CAPACITY_EXCEEDED'));
  assert.ok(r.warnings.some(x=>x.code==='PHONE_AUTO_ASSIGN'));
});

test('update self-exclusion does not collide with the booking being updated',()=>{
  const current=booking('B1','2026-09-19','18:00','confirmed',{row_number:42,return_time:'22:00'});
  const proposed=booking('B1','2026-09-19','19:00','confirmed',{row_number:42,return_time:'21:00'});
  const r=R.preflight({assets:[phone],bookings:[current]},proposed);
  assert.equal(r.ok,true);
  assert.deepEqual(r.overlapping_booking_ids,[]);
});

test('picked_up booking without return evidence remains open-ended',()=>{
  const existing=booking('B1','2026-09-19','18:00','picked_up',{return_time:''});
  const proposed=booking('NEW','2026-09-25','12:00','confirmed',{row_number:0,return_time:'14:00'});
  const r=R.preflight({assets:[phone],bookings:[existing]},proposed);
  assert.equal(r.ok,false);
  assert.ok(r.errors.some(x=>x.code==='ASSET_WINDOW_COLLISION'));
});

test('Vercel create proposal now trusts return_time because staged backend persists it end-to-end',()=>{
  const snapshot={
    events:[{event_id:'E1',event_date:'2026-09-19'}],
    packages:[{template_id:'TPL-PHONE',package_type:'phone_only'}],
    web_packages:[]
  };
  const proposal=Guard._test.createProposal(snapshot,{
    action:'createBooking',event_id:'E1',template_id:'TPL-PHONE',
    pickup_time:'18:00',return_time:'20:00',phone_asset_id:'PHONE-001'
  });
  assert.equal(proposal.return_time,'20:00');
});

test('Vercel update proposal applies submitted return_time and preserves it when omitted',()=>{
  const snapshot={bookings:[booking('B1','2026-09-19','18:00','confirmed',{row_number:42,return_time:'22:00'})]};
  const changed=Guard._test.updateProposal(snapshot,{
    action:'updateBooking',booking_id:'B1',row_number:42,pickup_time:'19:00',return_time:'23:00'
  });
  assert.equal(changed.pickup_time,'19:00');
  assert.equal(changed.return_time,'23:00');

  const preserved=Guard._test.updateProposal(snapshot,{
    action:'updateBooking',booking_id:'B1',row_number:42,pickup_time:'19:30'
  });
  assert.equal(preserved.return_time,'22:00');
});

test('previous-day fallback reservation blocks the same asset before 06:00 next day',()=>{
  const existing=booking('B1','2026-09-19','18:00','confirmed',{return_time:''});
  const early=booking('B2','2026-09-20','05:30','confirmed',{row_number:20,return_time:'07:00'});
  const later=booking('B3','2026-09-20','06:00','confirmed',{row_number:30,return_time:'07:00'});
  const blocked=R.preflight({assets:[phone],bookings:[existing]},early);
  const allowed=R.preflight({assets:[phone],bookings:[existing]},later);
  assert.equal(blocked.ok,false);
  assert.ok(blocked.errors.some(x=>x.code==='ASSET_WINDOW_COLLISION'));
  assert.equal(allowed.ok,true);
});

test('invalid explicit return time is rejected before upstream write',()=>{
  const result=Guard._test.validateBookingTiming({
    action:'createBooking',pickup_time:'18:00',return_time:'25:99'
  });
  assert.equal(result.ok,false);
  assert.equal(result.error_code,'BOOKING_RETURN_TIME_INVALID');
});
