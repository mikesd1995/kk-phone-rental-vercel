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


test('create uses reservation-window-aware manual validation and auto allocation',()=>{
  const create=fn('kkApiCreateBooking_');
  assert.match(create,/kkValidateManualAssetForWindow_\(phoneAssetId/);
  assert.match(create,/kkValidateManualAssetForWindow_\(lensAssetId/);
  assert.match(create,/kkFindAvailableAssetForWindow_\('phone'/);
  assert.match(create,/kkFindAvailableAssetForWindow_\('lens'/);
  assert.doesNotMatch(create,/kkFindAvailableAsset_\('phone'/);
  assert.doesNotMatch(create,/kkFindAvailableAsset_\('lens'/);
});

test('window-aware asset helpers allow same-day non-overlap and reject only overlapping holds',()=>{
  const validate=fn('kkValidateManualAssetForWindow_');
  const allocate=fn('kkFindAvailableAssetForWindow_');
  const conflict=fn('kkAssetConflictsInWindow_');
  assert.match(validate,/kkBookingReservationWindow_/);
  assert.match(validate,/kkAssetConflictsInWindow_/);
  assert.doesNotMatch(validate,/kkBookedAssetIdsForDate_/);
  assert.match(allocate,/kkBookingReservationWindow_/);
  assert.match(allocate,/kkAssetConflictsInWindow_/);
  assert.doesNotMatch(allocate,/kkBookedAssetIdsForDate_/);
  assert.match(conflict,/kkBookingWindowsOverlap_/);
});

test('update validates assigned assets against the edited reservation window',()=>{
  const update=fn('kkApiUpdateBooking_');
  assert.match(update,/kkValidateManualAssetForWindow_\(next\[9\]/);
  assert.match(update,/kkValidateManualAssetForWindow_\(next\[10\]/);
});


test('prepared and picked_up transitions assign missing assets from the edited reservation window',()=>{
  const assign=fn('kkAssignMissingAssetsForPreparedBooking_');
  const update=fn('kkApiUpdateBooking_');
  assert.match(assign,/kkFindAvailableAssetForWindow_\('phone'/);
  assert.match(assign,/kkFindAvailableAssetForWindow_\('lens'/);
  assert.doesNotMatch(assign,/kkFindAvailableAsset_\('phone'/);
  assert.doesNotMatch(assign,/kkFindAvailableAsset_\('lens'/);
  assert.match(assign,/next\[11\], next\[12\], status, excludeRow/);
  assert.match(update,/kkAssignMissingAssetsForPreparedBooking_\(next, nextStatus, event\.event_date, row\)/);
});
