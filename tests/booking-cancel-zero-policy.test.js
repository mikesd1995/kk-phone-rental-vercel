'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');
// Execute only the pure booking policy helper, not Apps Script/SpreadsheetApp code.
const policyDefinition = source.match(/function kkPrepareCancelledZeroPolicy_\([\s\S]*?\n}\n(?=\nfunction kkAppendCancelledZeroReconciliation_)/);
assert.ok(policyDefinition, 'The cancellation policy helper must be present');
const policy = vm.runInNewContext('(' + policyDefinition[0].trim() + ')', {Date}, {timeout: 1000});

function booking(status, paymentStatus, amount, quote = 690) {
  const row = Array(20).fill('');
  row[0] = 'BK-TEST-001';
  row[2] = status;
  row[3] = 'EVT-TEST';
  row[4] = 'Client';
  row[13] = paymentStatus;
  row[14] = amount;
  row[19] = '[KK_REQ:line:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa]';
  row[23] = quote; // intentionally outside canonical A:T, not used by the helper
  return row;
}

test('cancelling an unpaid confirmed booking zeroes operational fields and records snapshot', () => {
  const old = booking('confirmed', 'unpaid', 0);
  const next = old.slice();
  next[2] = 'cancelled';
  const result = policy(old, next, 'admin_update_booking', '2026-11-11T00:00:00Z');
  assert.equal(result.prior_status, 'confirmed');
  assert.equal(next[13], 'unpaid');
  assert.equal(next[14], 0);
  assert.match(next[19], /old_amount_received=0/);
  assert.match(next[19], /actual_refund_NOT_verified=true/);
  assert.match(next[19], /\[KK_REQ:line:/);
  assert.equal(next[23], 690);
});

test('an existing cash value is preserved in the cancellation snapshot, not treated as refund', () => {
  const old = booking('confirmed', 'paid', 1390, 1390);
  const next = old.slice();
  next[2] = 'cancelled';
  const result = policy(old, next, 'line_pending_reject', '2026-11-11T00:00:00Z');
  assert.equal(result.prior_amount_received, '1390');
  assert.equal(result.prior_payment, 'paid');
  assert.equal(next[13], 'unpaid');
  assert.equal(next[14], 0);
  assert.match(next[19], /old_payment=paid/);
});

test('repeat cancellation of a normalized cancelled row is idempotent', () => {
  const old = booking('cancelled', 'unpaid', 0);
  const next = old.slice();
  const result = policy(old, next, 'admin_update_booking', '2026-11-11T00:00:00Z');
  assert.equal(result, null);
  assert.equal(next[19], old[19]);
  assert.equal(next[14], 0);
});

test('a cancelled legacy row with nonzero amount is repaired and snapshotted once', () => {
  const old = booking('cancelled', 'paid', 590);
  const next = old.slice();
  const result = policy(old, next, 'admin_update_booking', '2026-11-11T00:00:00Z');
  assert.ok(result);
  assert.match(next[19], /old_amount_received=590/);
  assert.equal(next[14], 0);
});

test('completed, uploaded, returned and picked-up rows cannot be silently cancelled', () => {
  for (const status of ['picked_up', 'returned', 'uploaded', 'completed']) {
    const old = booking(status, 'paid', 690);
    const next = old.slice();
    next[2] = 'cancelled';
    assert.throws(() => policy(old, next, 'admin_update_booking'), /VERIFIED_REFUND_WORKFLOW/);
  }
});

test('noncancellation edits are not touched', () => {
  const old = booking('confirmed', 'partial', 100);
  const next = old.slice();
  next[2] = 'prepared';
  assert.equal(policy(old, next, 'admin_update_booking'), null);
  assert.equal(next[13], 'partial');
  assert.equal(next[14], 100);
});

test('both API cancel paths use same policy and write separate reconciliation audit', () => {
  assert.match(source, /kkPrepareCancelledZeroPolicy_\(current, next, 'line_pending_reject'\)/);
  assert.match(source, /kkPrepareCancelledZeroPolicy_\(current, next, 'admin_update_booking'\)/);
  assert.ok((source.match(/kkAppendCancelledZeroReconciliation_\(row, persisted, cancelAudit, cancelBefore\)/g)||[]).length >= 2);
  assert.match(source, /'19_Booking_Reconciliation'/);
});
