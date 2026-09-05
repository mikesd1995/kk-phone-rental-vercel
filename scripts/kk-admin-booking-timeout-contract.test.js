'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const source = fs.readFileSync(path.join(__dirname, '..', 'api', 'kk-admin.js'), 'utf8');

const checks = [
  ["createBooking timeout is identified as ambiguous", /isAmbiguousCreateBooking\s*=\s*isTimeout\s*&&\s*action\s*===\s*["']createBooking["']/.test(source)],
  ["blind retry is explicitly prohibited", /DO NOT retry this booking blindly/.test(source)],
  ["ambiguous booking timeout has dedicated error code", /BOOKING_WRITE_AMBIGUOUS_RECONCILE_REQUIRED/.test(source)],
  ["ambiguous booking timeout marks retry unsafe", /retry_safe:\s*isAmbiguousCreateBooking\s*\?\s*false/.test(source)],
  ["ambiguous booking timeout requires reconciliation", /reconciliation_required:\s*isAmbiguousCreateBooking\s*\?\s*true/.test(source)],
];

let passed = 0;
for (const [name, ok] of checks) {
  assert.ok(ok, name);
  passed += 1;
  console.log('PASS', name);
}

console.log(`kk-admin booking timeout contract: ${passed}/${checks.length} PASS`);
