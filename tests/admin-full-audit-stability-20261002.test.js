'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const apps=fs.readFileSync('apps-script/Code.gs','utf8');
const fallback=fs.readFileSync('server/admin-sheet-fallback.js','utf8');

test('createBooking is request-idempotent before allocating stock or writing a row',()=>{
  const start=apps.indexOf('function kkApiCreateBooking_');
  const end=apps.indexOf('function kkApiUpdateBooking_',start);
  assert.ok(start>0&&end>start);
  const block=apps.slice(start,end);
  assert.match(block,/const requestId = kkBookingRequestId_\(payload\)/);
  assert.match(block,/const prior = requestId \? kkFindBookingByRequestId_\(requestId\) : null/);
  assert.match(block,/if \(prior\) return kkBookingCreateResult_\(prior\.row_number, prior\.row, true\)/);
  assert.ok(block.indexOf('if (prior)') < block.indexOf('kkFindAvailableAsset_'));
});

test('new bookings get immutable explicit booking_id values and Sheet Quick Booking uses the canonical creator',()=>{
  assert.match(apps,/function kkGenerateUniqueBookingId_\(eventDate\)/);
  assert.match(apps,/archive\.getRange\(2, 7, archive\.getLastRow\(\) - 1, 1\)/);
  assert.match(apps,/const bookingId = kkGenerateUniqueBookingId_\(event\.event_date\)/);
  assert.match(apps,/bookingSheet\.getRange\(row, 1, 1, 20\)\.setValues/);
  const start=apps.indexOf('function kkAddQuickBookingFromDashboard');
  const end=apps.indexOf('\nfunction ',start+10);
  const quick=apps.slice(start,end);
  assert.match(quick,/kkApiCreateBooking_\(/);
  assert.doesNotMatch(quick,/getRange\(row, 2, 1, 19\)\.setValues/);
});

test('technical idempotency marker is hidden from Admin snapshots and preserved across note edits',()=>{
  assert.match(apps,/function kkBookingNoteForDisplay_\(note\)/);
  assert.match(apps,/const existingRequestId = kkBookingRequestIdFromNote_\(current\[19\]\)/);
  assert.match(apps,/note: kkBookingNoteForDisplay_\(r\[19\]\)/);
  assert.match(fallback,/function cleanBookingNote\(v\)/);
  assert.match(fallback,/note:cleanBookingNote\(r\.staff_note\)/);
});

test('asset status cannot remain rentable while repair or inactive',()=>{
  assert.match(apps,/if \(!\['available', 'repair', 'inactive'\]\.includes\(status\)\) throw new Error\('status must be available, repair, or inactive'\)/);
  assert.match(apps,/if \(status !== 'available'\) rentable = false/);
  assert.match(apps,/sh\.getRange\(row, 7\)\.setValue\(rentable\)/);
});

test('event update rejects unknown status instead of persisting arbitrary text',()=>{
  assert.match(apps,/const nextEventStatus = String\(payload\.status\)\.toLowerCase\(\)\.trim\(\)/);
  assert.match(apps,/if \(!\['open', 'closed'\]\.includes\(nextEventStatus\)\) throw new Error\('status must be open or closed'\)/);
});
