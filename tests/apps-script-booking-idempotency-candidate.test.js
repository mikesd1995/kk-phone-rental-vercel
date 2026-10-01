'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const candidate=fs.readFileSync(path.join(root,'apps-script','candidates','Code_9_5_10_RECONCILED_PRICE_INTEGRITY_OWNER_GUARD_2026-09-29.gs'),'utf8');
const canonical=fs.readFileSync(path.join(root,'apps-script','Code.gs'),'utf8');

function fn(name){
  const start=candidate.indexOf('function '+name+'(');
  assert.notEqual(start,-1,'missing '+name);
  const next=candidate.indexOf('\nfunction ',start+10);
  return candidate.slice(start,next===-1?candidate.length:next);
}

test('atomic Booking create idempotency is implemented only in reconciled candidate',()=>{
  assert.match(fn('kkApiCreateBooking_'),/kkAcquireDocumentLock_\('write operation', 12000\)/);
  assert.match(fn('kkApiCreateBooking_'),/kkFindBookingByRequestId_\(requestId\)/);
  assert.match(fn('kkApiCreateBooking_'),/if \(prior\) return kkBookingCreateResult_\(prior\.row_number, prior\.row, true\)/);
  assert.match(fn('kkApiCreateBooking_'),/SpreadsheetApp\.flush\(\)/);
  assert.match(fn('kkApiCreateBooking_'),/getRange\(row, 1, 1, 20\)\.getValues\(\)\[0\]/);
  assert.doesNotMatch(canonical,/function kkBookingRequestMarker_\(/);
});

test('request id is bounded and persisted in Booking note inside the locked transaction',()=>{
  assert.match(fn('kkBookingRequestId_'),/\^\[A-Za-z0-9\._:-\]\{8,128\}\$/);
  assert.match(fn('kkBookingRequestMarker_'),/\[KK_REQ:/);
  assert.match(fn('kkApiCreateBooking_'),/kkBookingNoteWithRequest_\(payload\.booking_note \|\| '', requestId\)/);
});

test('canonical booking id is mandatory for both first commit and replay',()=>{
  assert.match(fn('kkBookingCreateResult_'),/if \(!current\[0\]\) throw new Error\('Booking canonical booking_id readback failed'\)/);
  assert.match(fn('kkApiCreateBooking_'),/return kkBookingCreateResult_\(row, persisted, false\)/);
});
