'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const path='apps-script/candidates/Code_9_5_12_IMMUTABLE_BOOKING_ID_FULL_AUDIT_2026-10-02.gs';
const src=fs.readFileSync(path,'utf8');

test('9.5.12 candidate writes immutable booking_id in A:T instead of relying on column-A formula',()=>{
  assert.match(src,/function kkGenerateUniqueBookingId_\(eventDate\)/);
  assert.match(src,/const bookingId = kkGenerateUniqueBookingId_\(event\.event_date\)/);
  assert.match(src,/bookingSheet\.getRange\(row, 1, 1, 20\)\.setValues/);
  assert.match(src,/\[\[\s*bookingId, new Date\(\), bookingStatus, eventId/);
  assert.doesNotMatch(
    src.slice(src.indexOf('function kkApiCreateBooking_'),src.indexOf('function kkApiUpdateBooking_')),
    /bookingSheet\.getRange\(row, 2, 1, 19\)\.setValues/
  );
});

test('booking ID allocator checks both current bookings and archive IDs',()=>{
  const start=src.indexOf('function kkBookingIdValues_');
  const end=src.indexOf('function kkBookingArchiveIdentity_',start);
  const block=src.slice(start,end);
  assert.match(block,/kkGetValues_\(KK\.bookings, 5, 1, 1\)/);
  assert.match(block,/getRange\(2, 7, archive\.getLastRow\(\) - 1, 1\)/);
  assert.match(block,/prefix = 'BK-' \+ day \+ '-'/);
  assert.match(block,/maxSeq = Math\.max\(maxSeq, Number\(suffix\)\)/);
});

test('booking lookup resolves immutable ID before row fallback',()=>{
  const start=src.indexOf('function kkFindBookingRow_');
  const end=src.indexOf('function kkAssertBookingAssetsNotDoubleBooked_',start);
  const block=src.slice(start,end);
  assert.ok(block.indexOf('if (id)') < block.indexOf('const n = Number(rowNumber'));
  assert.match(block,/Duplicate booking_id/);
});

test('cleanup never archives an orphan booking by created_at fallback',()=>{
  const start=src.indexOf('function kkCleanupOldData30Days_');
  const end=src.indexOf('function kkCleanupOldData30Days()',start);
  const block=src.slice(start,end);
  assert.match(block,/if \(!event \|\| !event\.event_date\) \{ skippedOrphanBookings\+\+; return; \}/);
  assert.doesNotMatch(block,/event && event\.event_date \? kkDateObj_\(event\.event_date\) : \(r\[1\]/);
  assert.match(block,/bookingClearA1s\.push\(\`A\$\{sourceRow\}:T\$\{sourceRow\}\`\)/);
});

test('Customer Stats are rebuilt deterministically from archive with composite identity',()=>{
  assert.match(src,/function kkRebuildCustomerStatsFromArchive_\(\)/);
  assert.match(src,/const identity = kkBookingArchiveIdentity_\(booking, eventDate\)/);
  assert.match(src,/if \(seen\[identity\]\) return/);
  assert.match(src,/customerStatsUpdated = kkRebuildCustomerStatsFromArchive_\(\)/);
});

test('asset update response preserves existing rentable value when field is omitted',()=>{
  const start=src.indexOf('function kkApiUpdateAsset_');
  const end=src.indexOf('function kkAssetUsageSummary_',start);
  const block=src.slice(start,end);
  assert.match(block,/const currentRentable = sh\.getRange\(row, 7\)\.getValue\(\)/);
  assert.match(block,/hasRentable \? kkIsTrue_\(payload\.rentable\) : kkIsTrue_\(currentRentable\)/);
});
