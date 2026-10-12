'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('Apps Script owner decision is a separate atomic pending-only action',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','apps-script','Code.gs'),'utf8');
  assert.match(source,/case 'decideLineBookingPending': result = kkApiDecideLineBookingPending_\(payload\); break;/);
  const start=source.indexOf('function kkApiDecideLineBookingPending_');
  const end=source.indexOf('\nfunction kkApiCreateBooking_',start);
  assert.ok(start>=0&&end>start);
  const body=source.slice(start,end);
  assert.match(body,/kkAcquireDocumentLock_\('LINE owner booking decision', 12000\)/);
  assert.match(body,/currentStatus !== 'pending'/);
  assert.match(body,/targetStatus = decision === 'approve' \? 'confirmed' : 'cancelled'/);
  assert.match(body,/idempotent_replay: true/);
  assert.match(body,/SpreadsheetApp\.flush\(\)/);
  assert.match(body,/Owner decision readback failed/);
  assert.match(body,/LINE customer contact readback failed/);
  assert.match(body,/customer_contact: customerContact/);
  assert.match(body,/customerContact = String\(current\[5\]/);
  assert.match(body,/String\(persisted\[5\]/);
});

test('v2 approval snapshot binds A:T booking state and rejects changed version under document lock',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','apps-script','Code.gs'),'utf8');
  assert.match(source,/case 'decideLineBookingPendingV2': result = kkApiDecideLineBookingPending_\(payload, true\); break;/);
  assert.match(source,/function kkLineBookingApprovalVersion_\(row\)/);
  assert.match(source,/Utilities\.computeDigest\(Utilities\.DigestAlgorithm\.SHA_256/);
  assert.match(source,/const indices = \[0,1,2,3,4,5,6,7,8,9,10,11,13,14,19\]/);
  assert.match(source,/approval_version:kkLineBookingApprovalVersionAtRow_/);
  const start=source.indexOf('function kkApiDecideLineBookingPending_');
  const end=source.indexOf('\nfunction kkApiCreateBooking_',start);
  const body=source.slice(start,end);
  assert.match(body,/kkAcquireDocumentLock_\('LINE owner booking decision', 12000\)/);
  assert.match(body,/approvedVersion = kkLineBookingApprovalVersion_\(current\)/);
  assert.match(body,/approvedVersion !== expectedVersion/);
  assert.match(body,/currentStatus !== 'pending'/);
  assert.match(body,/Number\(current\[14\]\|\|0\) !== 0/);
  assert.match(body,/kkIsPastEventDate_\(liveEvent\.event_date\)/);
  assert.match(body,/approved_version:approvedVersion/);
});

test('v2 commercial version binds current event and exact public package price',()=>{
  const code=fs.readFileSync(path.join(__dirname,'..','apps-script','Code.gs'),'utf8');
  assert.match(code,/function kkLineBookingCommercialSnapshot_\(row\)/);
  const start=code.indexOf('function kkLineBookingCommercialSnapshot_');
  const end=code.indexOf('function kkLineBookingApprovalVersionAtRow_',start);
  assert.ok(end>start,'version helper section must be contiguous');
  const body=code.slice(start,end);
  assert.match(body,/kkBookingRequestIdFromNote_\(row\[19\]\)/);
  assert.match(body,/claim\.status !== 'OK'/);
  assert.match(body,/String\(claim\.booking_id\|\|''\)\.trim\(\) !== bookingId/);
  assert.match(body,/String\(claim\.event_id\|\|''\)\.trim\(\) !== eventId/);
  assert.match(body,/kkGetEventById_\(eventId\)/);
  assert.match(body,/kkApiWebPackageRows_\(\)\.filter/);
  assert.match(body,/matching\.length !== 1 \|\| !\(Number\(matching\[0\]\.price\|\|0\)>0\)/);
  assert.match(body,/kkApiDate_\(event\.event_date\)/);
  assert.match(body,/Number\(pkg\.price\)/);
  assert.match(body,/JSON\.stringify\(\['KK_LINE_BOOKING_OWNER_APPROVAL_V2', normalized, commercial\]\)/);
  assert.match(code,/decision === 'approve' &&\s*\(String\(liveEvent\.status/);
  assert.match(code,/approvedVersion !== expectedVersion/);
});
