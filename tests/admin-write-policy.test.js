'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Policy=require('../admin/write-policy.js');

function snap(extra={}){
  return Object.assign({
    degraded_read_only:true,
    legacy_write_attempt_allowed:false,
    write_path_health:{checked:true,skipped:false,ok:false,error_code:''},
    bookings:[],
    packages:[]
  },extra);
}

test('transient timeout permits one legacy mutation attempt while deterministic failures remain blocked',()=>{
  const timeout=snap({
    legacy_write_attempt_allowed:true,
    write_admission_mode:'transient-attempt',
    write_path_health:{checked:true,skipped:false,ok:false,error_code:'WRITE_HEALTH_TIMEOUT'}
  });
  assert.deepEqual(Policy.admission(timeout,false),{allowed:true,mode:'transient-attempt'});
  assert.equal(Policy.transientWriteHealth(timeout),true);

  const mismatch=snap({
    write_path_health:{checked:true,skipped:false,ok:false,error_code:'WRITE_HEALTH_IDENTITY_MISMATCH'}
  });
  assert.deepEqual(Policy.admission(mismatch,false),{allowed:false,mode:'blocked'});
  assert.equal(Policy.transientWriteHealth(mismatch),false);

  const skipped=snap({
    write_path_health:{checked:false,skipped:true,ok:false,error_code:'WRITE_HEALTH_UPSTREAM_UNAVAILABLE'}
  });
  assert.deepEqual(Policy.admission(skipped,false),{allowed:false,mode:'blocked'});
});

test('verified and accepted direct transports remain writable independently of transient legacy health',()=>{
  assert.deepEqual(Policy.admission({degraded_read_only:false},false),{allowed:true,mode:'verified'});
  assert.deepEqual(Policy.admission(snap(),true),{allowed:true,mode:'direct'});
});

test('updateBooking readback requires the persisted row to match every supplied mutable field',()=>{
  const after={bookings:[{
    row_number:25,booking_id:'BK-25',event_id:'EVT-1',booking_status:'prepared',
    customer_name:'Mint',customer_contact:'@mint',customer_phone:'0812345678',contact_channel:'LINE',
    payment_status:'partial',amount_received:690,pickup_time:'17:30',
    phone_asset_id:'PHONE-1',lens_asset_id:'LENS-1',note:'VIP'
  }]};
  const good=Policy.verifyBookingMutation('updateBooking',{
    row_number:25,booking_status:'prepared',payment_status:'partial',amount_received:'690',
    customer_name:'Mint',customer_contact:'@mint',customer_phone:'0812345678',contact_channel:'LINE',
    pickup_time:'17:30',phone_asset_id:'PHONE-1',lens_asset_id:'LENS-1',booking_note:'VIP'
  },{},null,after);
  assert.equal(good.status,'committed');
  assert.equal(good.row_number,25);

  const bad=Policy.verifyBookingMutation('updateBooking',{
    row_number:25,payment_status:'paid'
  },{},null,after);
  assert.equal(bad.status,'not-committed');
  assert.equal(bad.reason,'booking-row-mismatch');
});

test('createBooking timeout reconciliation only accepts one new matching row',()=>{
  const before={
    packages:[{template_id:'TPL-PHONE',package_type:'phone_only'}],
    bookings:[{row_number:20,booking_id:'BK-20',event_id:'EVT-X'}]
  };
  const payload={
    event_id:'EVT-1',template_id:'TPL-PHONE',booking_status:'confirmed',
    customer_name:'Mint',customer_contact:'@mint',customer_phone:'0812345678',
    contact_channel:'LINE',payment_status:'unpaid',amount_received:'690',pickup_time:'17:30',
    phone_asset_id:'PHONE-1',lens_asset_id:'',booking_note:''
  };
  const row={
    row_number:26,booking_id:'BK-26',event_id:'EVT-1',package_type:'phone_only',
    booking_status:'confirmed',customer_name:'Mint',customer_contact:'@mint',
    customer_phone:'0812345678',contact_channel:'LINE',payment_status:'unpaid',
    amount_received:690,pickup_time:'17:30',phone_asset_id:'PHONE-1',lens_asset_id:'',note:''
  };
  const one=Policy.verifyBookingMutation('createBooking',payload,{},before,{bookings:[before.bookings[0],row]});
  assert.equal(one.status,'committed');
  assert.equal(one.row_number,26);

  const many=Policy.verifyBookingMutation('createBooking',payload,{},before,{bookings:[before.bookings[0],row,Object.assign({},row,{row_number:27,booking_id:'BK-27'})]});
  assert.equal(many.status,'ambiguous');

  const none=Policy.verifyBookingMutation('createBooking',payload,{},before,{bookings:[before.bookings[0]]});
  assert.equal(none.status,'not-committed');
});
