'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'..','apps-script','Code.gs'),'utf8');
const webhook=fs.readFileSync(path.join(__dirname,'..','server','line-booking-webhook.js'),'utf8');
const intake=require('../server/line-booking-intake');

function writerBody(){
  const start=source.indexOf('function kkApiCreateLineBookingPending_');
  const end=source.indexOf('\nfunction kkApiCreateBooking_',start);
  assert.ok(start>=0&&end>start,'current-schema LINE pending writer must exist before legacy createBooking');
  return source.slice(start,end);
}

test('LINE intake targets dedicated pending writer, never legacy createBooking',()=>{
  const r=intake.bookingIntent(
    {webhookEventId:'evt-v4',source:{userId:'U1'}},
    {nickname:'Mint',phone:'0812345678',pickup_time:'16:00'},
    {event_id:'EVT-1',template_id:'TPL-1'}
  );
  assert.equal(r.ok,true);
  assert.equal(r.payload.action,'createLineBookingPending');
  assert.notEqual(r.payload.action,'createBooking');
  assert.equal(r.payload.booking_status,'pending');
  assert.equal(r.payload.payment_status,'unpaid');
  assert.equal(r.payload.amount_received,0);
});

test('pending LINE writer treats verified LINE contact as customer identity; phone is optional',()=>{
 const writer=writerBody();
 assert.match(writer,/const customerContact = String\(payload\.customer_contact \|\| ''\)\.trim\(\)/);
 assert.match(writer,/!eventId \|\| !templateId \|\| !customerName \|\| !customerContact/);
 assert.doesNotMatch(writer,/!customerPhone\)/);
 assert.match(writer,/customerContact, customerPhone, 'LINE'/);
 assert.match(writer,/payment_status: 'unpaid'|pkgType,\s*'',\s*'',\s*pickupTime,\s*'',\s*'unpaid',\s*0/);
});

test('Apps Script exposes a separate pending route while legacy createBooking remains separate',()=>{
  assert.match(source,/case 'createLineBookingPending': result = kkApiCreateLineBookingPending_\(payload\); break;/);
  assert.match(source,/case 'createBooking': result = kkApiCreateBooking_\(payload\); break;/);
});

test('writer serializes idempotency claim, row allocation, canonical A:T write and readback under document lock',()=>{
  const s=writerBody();
  assert.match(s,/kkAcquireDocumentLock_\('LINE pending booking intake', 12000\)/);
  assert.match(source,/\^line:\[a-f0-9\]\{48\}\$/);
  assert.match(s,/status\s*:\s*'PENDING'/);
  assert.match(s,/const row = kkFirstEmptyRow_\(KK\.bookings, 4, 5, 2, 19\)/);
  assert.match(s,/const bookingId = kkGenerateUniqueBookingId_\(event\.event_date\)/);
  assert.match(s,/row_number: row,[\s\S]*booking_id: bookingId/);
  assert.match(s,/getRange\(row, 1, 1, 20\)\.setValues/);
  assert.match(s,/SpreadsheetApp\.flush\(\)/);
  assert.match(s,/kkLineBookingClaimReadback_/);
  assert.match(s,/finally \{[\s\S]*lock\.releaseLock\(\)/);
});

test('pending LINE writer never allocates phone or lens assets',()=>{
  const s=writerBody();
  assert.match(s,/Pending LINE intake must not assign physical assets/);
  assert.doesNotMatch(s,/kkFindAvailableAsset_/);
  assert.match(s,/pkgType,\s*'',\s*'',\s*pickupTime,\s*'',\s*'unpaid',\s*0/);
  assert.match(s,/phone_asset_id\s*:\s*'',[\s\S]*lens_asset_id\s*:\s*''/);
});

test('canonical ID uses current 9.5.13 direct column-A ownership and exact readback',()=>{
  const s=writerBody();
  assert.match(s,/kkGenerateUniqueBookingId_\(event\.event_date\)/);
  assert.match(s,/bookingId, new Date\(\), 'pending'/);
  assert.match(source,/function kkLineBookingClaimReadback_/);
  assert.match(source,/String\(readback\[0\] \|\| ''\)\.trim\(\) !== bookingId/);
  assert.doesNotMatch(s,/getRange\(row, 2, 1, 19\)\.setValues/);
});

test('PENDING replay self-reconciles only an exact claimed row and never allocates a replacement',()=>{
  const s=writerBody();
  const pending=s.indexOf("existing.status === 'PENDING'");
  const reconcile=s.indexOf('kkLineBookingClaimReadback_(existing)',pending);
  const throwAt=s.indexOf('exact readback did not reconcile safely',pending);
  assert.ok(pending>=0&&reconcile>pending&&throwAt>reconcile);
  const helperStart=source.indexOf('function kkLineBookingClaimReadback_');
  const helperEnd=source.indexOf('\nfunction kkApiCreateLineBookingPending_',helperStart);
  const helper=source.slice(helperStart,helperEnd);
  assert.doesNotMatch(helper,/setValues\(/);
  assert.doesNotMatch(helper,/kkFirstEmptyRow_/);
  assert.match(helper,/readback\[2\][\s\S]*'pending'/);
  assert.match(helper,/LINE/);
  assert.match(helper,/unpaid/);
  assert.match(helper,/kkBookingRequestIdFromNote_/);
});

test('public LINE webhook activates only the governed owner-approval runtime',()=>{
  assert.match(webhook,/line-booking-owner-approval/);
  assert.match(webhook,/automationReadiness/);
  assert.doesNotMatch(webhook,/action:\s*['"]createBooking['"]/);
  assert.doesNotMatch(webhook,/action:\s*['"]updateBooking['"]/);
});
