'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','apps-script','Code.gs'),'utf8');

function body(){
 const start=source.indexOf('function kkApiCreateLineBookingPending_');
 const end=source.indexOf('\nfunction kkApiCreateBooking_',start);
 assert.ok(start>=0&&end>start,'LINE pending writer must exist before legacy createBooking');
 return source.slice(start,end);
}

test('LINE pending action is separate from legacy createBooking',()=>{
 assert.match(source,/case 'createLineBookingPending': result = kkApiCreateLineBookingPending_\(payload\); break;/);
 assert.match(source,/case 'createBooking': result = kkApiCreateBooking_\(payload\); break;/);
});
test('writer serializes claim, row allocation, write and readback under document lock',()=>{
 const s=body();
 assert.match(s,/kkAcquireDocumentLock_\('LINE pending booking intake', 12000\)/);
 assert.match(s,/props\.setProperty\(requestKey,[\s\S]*status: 'PENDING'/);
 assert.match(s,/kkFirstEmptyRow_\(KK\.bookings, 4, 5, 2, 19\)/);
 assert.match(s,/getRange\(row, 2, 1, 19\)\.setValues/);
 assert.match(s,/SpreadsheetApp\.flush\(\)/);
 assert.match(s,/getRange\(row, 1, 1, 20\)\.getValues\(\)\[0\]/);
 assert.match(s,/finally \{[\s\S]*lock\.releaseLock\(\)/);
});
test('writer is deterministic-idempotent and uncertain PENDING requests fail closed',()=>{
 const s=body();
 assert.match(source,/\^line:\[a-f0-9\]\{48\}\$/);
 assert.match(s,/existing\.status === 'OK' && existing\.booking_id/);
 assert.match(s,/idempotent_replay: true/);
 assert.match(s,/pending or uncertain; manual reconciliation required before retry/);
});
test('pending LINE booking never assigns phone or lens assets',()=>{
 const s=body();
 assert.match(s,/Pending LINE intake must not assign physical assets/);
 assert.doesNotMatch(s,/kkFindAvailableAsset_/);
 assert.match(s,/pkgType, '', '', pickupTime/);
 assert.match(s,/Pending LINE booking unexpectedly has assigned assets/);
});
test('canonical booking id is read from formula column A and persisted before success',()=>{
 const s=body();
 assert.match(s,/const bookingId = String\(readback\[0\]/);
 assert.match(s,/Canonical booking_id readback missing/);
 const ok=s.indexOf("status: 'OK'");
 const ret=s.lastIndexOf('return {');
 assert.ok(ok>=0&&ret>ok,'OK idempotency record must be persisted before success return');
});
test('LINE pending writer hard-codes pending unpaid LINE semantics',()=>{
 const s=body();
 assert.match(s,/new Date\(\), 'pending', eventId, customerName, customerContact, customerPhone, 'LINE'/);
 assert.match(s,/pickupTime, '', 'unpaid', 0/);
});
