'use strict';

const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'BookingIdempotency.gs'), 'utf8');
let passed = 0;
let total = 0;

function test(name, fn) {
  total += 1;
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}: ${err.message}`);
    process.exitCode = 1;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

test('overrides canonical createBooking writer inside Apps Script boundary', () => {
  assert(source.includes('kkApiCreateBooking_ = function(payload)'), 'canonical writer override missing');
  assert(source.includes("kkAcquireDocumentLock_('create booking idempotent'"), 'DocumentLock boundary missing');
});

test('uses a dedicated durable non-PII receipt surface', () => {
  assert(source.includes("17_Booking_Request_Receipts"), 'receipt sheet missing');
  const headersBlock = source.match(/const KK_BOOKING_RECEIPT_HEADERS = \[([\s\S]*?)\];/);
  assert(headersBlock, 'receipt headers missing');
  const h = headersBlock[1];
  ['customer_name','customer_contact','customer_phone'].forEach(k => assert(!h.includes(k), `raw PII header leaked: ${k}`));
  ['request_id','request_fingerprint','status','target_row','write_fingerprint','result_json'].forEach(k => assert(h.includes(k), `missing receipt field ${k}`));
});

test('implements PREPARED to COMMITTED transaction states', () => {
  assert(source.includes("'PREPARED'"), 'PREPARED state missing');
  assert(source.includes("'COMMITTED'"), 'COMMITTED state missing');
  assert(source.indexOf("'PREPARED'") < source.lastIndexOf("'COMMITTED'"), 'state order not represented');
});

test('binds request_id to canonical request fingerprint', () => {
  assert(source.includes('kkBookingRequestFingerprint_'), 'request fingerprint helper missing');
  assert(source.includes('IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_BOOKING_INTENT'), 'request-id reuse fail-closed gate missing');
  assert(source.includes('request_fingerprint does not match canonical booking intent'), 'supplied fingerprint validation missing');
});

test('provides deterministic fallback idempotency key for legacy admin callers', () => {
  assert(source.includes("'AUTO-' + requestFingerprint.slice(0, 40)"), 'deterministic fallback request id missing');
});

test('records assigned assets and exact reserved booking target row before write', () => {
  assert(source.includes('targetRow'), 'target row binding missing');
  assert(source.includes('phoneAssetId'), 'phone binding missing');
  assert(source.includes('lensAssetId'), 'lens binding missing');
  const preparedPos = source.indexOf("'PREPARED'");
  const bookingWritePos = source.indexOf('getRange(targetRow, 2, 1, 19).setValues');
  assert(preparedPos >= 0 && bookingWritePos > preparedPos, 'booking write can occur before PREPARED receipt');
});

test('reconciles PREPARED receipt against exact booking-row fingerprint before retry mutation', () => {
  assert(source.includes('kkFinalizePreparedBookingReceipt_'), 'prepared reconciliation helper missing');
  assert(source.includes('actualWriteFingerprint !== receipt.write_fingerprint'), 'prepared target fingerprint check missing');
  assert(source.includes('PREPARED target row is occupied by non-matching booking data'), 'nonmatching target fail-closed error missing');
});

test('exact-readbacks the booking row before COMMIT', () => {
  const writePos = source.indexOf('getRange(targetRow, 2, 1, 19).setValues');
  const readPos = source.indexOf('const stored = kkBookingTargetRowState_(targetRow)', writePos);
  const commitPos = source.lastIndexOf("'COMMITTED'");
  assert(writePos >= 0 && readPos > writePos, 'booking exact readback missing after write');
  assert(commitPos > readPos, 'COMMITTED can occur before booking readback');
  assert(source.includes('Booking write exact readback fingerprint mismatch'), 'readback mismatch gate missing');
});

test('exact-readbacks receipt state', () => {
  assert(source.includes('kkAssertBookingReceipt_'), 'receipt assertion helper missing');
  assert(source.includes("kkAssertBookingReceipt_(activeReceipt, 'PREPARED'"), 'PREPARED readback assertion missing');
  assert(source.includes("kkAssertBookingReceipt_(committed, 'COMMITTED'"), 'COMMITTED readback assertion missing');
});

test('preserves receipt lineage on error instead of clearing history', () => {
  assert(source.includes('kkBookingMarkReceiptError_'), 'receipt error preservation missing');
  assert(!source.includes('clearContent()'), 'idempotency overlay must not clear receipt history');
  assert(!source.includes('deleteSheet'), 'idempotency overlay must not delete receipt history');
});

test('releases DocumentLock in finally', () => {
  assert(source.includes('finally {\n    lock.releaseLock();\n  }'), 'lock release missing');
});

test('does not store raw booking payload in receipt result JSON', () => {
  assert(!source.includes('JSON.stringify(payload)'), 'raw payload must not be persisted');
  assert(!source.includes('JSON.stringify(p)'), 'raw payload must not be persisted');
});

console.log(`\n${passed}/${total} booking writer idempotency assertions PASS`);
if (passed !== total) process.exitCode = 1;
