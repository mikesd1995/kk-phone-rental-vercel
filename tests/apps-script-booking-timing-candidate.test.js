'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'apps-script','candidates','Code_9_5_12_ATOMIC_BOOKING_TIMING_CANDIDATE_2026-10-01.gs'),'utf8');
function fn(name){const s=source.indexOf('function '+name+'(');assert.notEqual(s,-1,'missing '+name);const e=source.indexOf('\nfunction ',s+10);return source.slice(s,e<0?source.length:e);}

test('9_5_12 persists and exposes optional return_time',()=>{
  assert.match(fn('kkApiCreateBooking_'),/const returnTime = String\(payload\.return_time \|\| ''\)\.trim\(\)/);
  assert.match(fn('kkApiCreateBooking_'),/pickupTime, returnTime, paymentStatus/);
  assert.match(fn('kkApiUpdateBooking_'),/payload\.return_time !== undefined/);
  assert.match(fn('kkApiUpdateBooking_'),/getRange\(row, 12, 1, 2\)\.setValues\(\[\[next\[11\], next\[12\]\]\]\)/);
  assert.match(fn('kkApiSnapshot_'),/return_time: r\[12\] \|\| ''/);
});

test('reservation window handles cross-midnight, fallback and picked-up open end',()=>{
  const w=fn('kkBookingReservationWindow_');
  assert.match(w,/endMin <= startMin/);
  assert.match(w,/86400000 \+ 6 \* 3600000/);
  assert.match(w,/2099-12-31T23:59:00\+07:00/);
  assert.match(w,/Invalid pickup_time/);
  assert.match(w,/Invalid return_time/);
});

test('create and update enforce overlapping-window capacity inside their document lock',()=>{
  const create=fn('kkApiCreateBooking_');
  const update=fn('kkApiUpdateBooking_');
  for(const body of [create,update]){
    assert.match(body,/kkAcquireDocumentLock_\('write operation', 12000\)/);
    assert.match(body,/kkAssertBookingWindowCapacity_/);
    assert.ok(body.indexOf('kkAssertBookingWindowCapacity_') < body.indexOf('setValues('),'capacity gate must precede first write');
  }
});

test('window capacity checks both aggregate demand and explicit asset collision',()=>{
  const body=fn('kkAssertBookingWindowCapacity_');
  assert.match(body,/kkBookingWindowsOverlap_/);
  assert.match(body,/Phone capacity exceeded in reservation window/);
  assert.match(body,/Lens capacity exceeded in reservation window/);
  assert.match(body,/already booked in an overlapping reservation window/);
});
