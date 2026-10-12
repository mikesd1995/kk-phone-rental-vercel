'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Admission=require('../server/kk-no-deposit-booking-create.js');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');

test('new confirmed and pending bookings with zero receipt are allowed',()=>{
  for(const status of ['pending','confirmed']){
    const out=Admission.checkCreateBooking({booking_status:status,payment_status:'unpaid',amount_received:0});
    assert.deepEqual(out,{ok:true,booking_status:status,payment_status:'unpaid',amount_received:0});
  }
});
test('missing payment amount defaults to zero, never package price',()=>{
  assert.equal(Admission.checkCreateBooking({}).amount_received,0);
  assert.equal(Admission.checkCreateBooking({amount_received:''}).amount_received,0);
});
test('paid, partial, refunded or historical nonzero receipts are rejected at creation',()=>{
  for(const payment of ['paid','partial','refunded']){
    const out=Admission.checkCreateBooking({payment_status:payment,amount_received:0});
    assert.equal(out.ok,false);
    assert.equal(out.error_code,'NO_DEPOSIT_PREPAYMENT_FORBIDDEN');
  }
  for(const amount of [490,'590','1,090',-10,'garbage']){
    const out=Admission.checkCreateBooking({payment_status:'unpaid',amount_received:amount});
    assert.equal(out.ok,false,'amount '+amount);
  }
});
test('future lifecycle states cannot be forged on create',()=>{
  for(const booking_status of ['prepared','picked_up','returned','uploaded','completed','cancelled','no_show']){
    const r=Admission.checkCreateBooking({booking_status});
    assert.equal(r.ok,false,booking_status);
    assert.equal(r.error_code,'NO_DEPOSIT_CREATE_STATUS_INVALID');
  }
});
test('Admin never transfers package price into amount_received',()=>{
  const s=fs.readFileSync(path.join(root,'admin/admin.js'),'utf8');
  const fn=s.split('function autofillBookingAmountFromPackage(){')[1]?.split('function populateBookingPackages(){')[0]||'';
  assert.ok(fn.includes('amount_received.value="0"'), 'new booking receipt must remain 0');
  assert.doesNotMatch(fn,/amount_received\.value\s*=\s*String\(info\.price\)/);
  assert.match(s,/payment_status="unpaid";/);
});
test('Admin displays no future-booking debt alert and server guards writes',()=>{
  const s=fs.readFileSync(path.join(root,'admin/admin.js'),'utf8');
  const guard=fs.readFileSync(path.join(root,'api/kk-admin-guard.js'),'utf8');
  assert.match(s,/\['picked_up','returned','uploaded'\]\.includes\(st\) && isUnpaidPayment\(b\.payment_status\)/);
  assert.match(guard,/NoDepositBooking\.checkCreateBooking\(payload\)/);
  assert.match(guard,/error_code:zeroDeposit\.error_code/);
});
