'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const canonical = fs.readFileSync(path.join(root, 'apps-script', 'Code.gs'), 'utf8');
const recovered = fs.readFileSync(path.join(root, 'apps-script', 'recovered', 'Code_9_5_9_DEPLOYED_RECOVERY_2026-09-20.gs'), 'utf8');
const candidate = fs.readFileSync(path.join(root, 'apps-script', 'candidates', 'Code_9_5_10_RECONCILED_PRICE_INTEGRITY_OWNER_GUARD_2026-09-29.gs'), 'utf8');

function extractTopLevelFunction(source, name) {
  const startMarker = 'function ' + name + '(';
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, 'missing function ' + name);
  const next = source.indexOf('\nfunction ', start + startMarker.length);
  const end = next === -1 ? source.length : next;
  return source.slice(start, end).trim();
}

test('9_5_10 candidate carries deployed 9_5_9 price-integrity functions exactly', () => {
  for (const name of [
    'kkDirectApplyOverridePriceToWebPackages_',
    'kkSnapshotWebPackagePricesForEvent_',
    'kkRestoreWebPackagePricesForEvent_',
    'kkRepairPriceIntegritySafe'
  ]) {
    assert.equal(extractTopLevelFunction(candidate, name), extractTopLevelFunction(recovered, name), name + ' must match recovered deployed lineage exactly');
  }
});

test('9_5_10 candidate preserves canonical owner-hidden event update guard exactly', () => {
  assert.equal(extractTopLevelFunction(candidate, 'kkApiUpdateEvent_'), extractTopLevelFunction(canonical, 'kkApiUpdateEvent_'));
  assert.ok(candidate.includes('ownerReopenIntent'));
  assert.ok(candidate.includes('EVENT_VISIBILITY_OWNER_LOCKED'));
  assert.ok(candidate.includes('explicit_owner_reopen'));
});

test('9_5_10 candidate is a new reconciled candidate, not either source artifact', () => {
  assert.notEqual(candidate, canonical);
  assert.notEqual(candidate, recovered);
  assert.ok(candidate.includes('v16.7.0_CRM_PRO_PHASE3_9_5_10_RECONCILED_PRICE_INTEGRITY_OWNER_GUARD'));
  assert.ok(candidate.includes('Repair Price Integrity (Safe)'));
  assert.ok(candidate.includes('ambiguous legacy package mapping'));
  assert.ok(candidate.includes('Never copy a formula from an old physical row to a new row'));
  assert.ok(candidate.includes('Invalid override price'));
});
