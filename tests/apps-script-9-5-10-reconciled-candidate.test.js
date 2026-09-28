'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const canonical = fs.readFileSync(path.join(root, 'apps-script', 'Code.gs'), 'utf8');
const recovered = fs.readFileSync(path.join(root, 'apps-script', 'recovered', 'Code_9_5_9_DEPLOYED_RECOVERY_2026-09-20.gs'), 'utf8');
const candidate = fs.readFileSync(path.join(root, 'apps-script', 'candidates', 'Code_9_5_10_RECONCILED_PRICE_INTEGRITY_OWNER_GUARD_2026-09-29.gs'), 'utf8');

function extractFunction(source, name) {
  const marker = new RegExp('function\\s+' + name + '\\s*\\([^)]*\\)\\s*\\{', 'g');
  const match = marker.exec(source);
  assert.ok(match, 'missing function ' + name);
  let i = marker.lastIndex - 1;
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (; i < source.length; i += 1) {
    const c = source[i];
    const n = source[i + 1];
    if (lineComment) { if (c === '\\n') lineComment = false; continue; }
    if (blockComment) { if (c === '*' && n === '/') { blockComment = false; i += 1; } continue; }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (c === '\\\\') { escaped = true; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '/' && n === '/') { lineComment = true; i += 1; continue; }
    if (c === '/' && n === '*') { blockComment = true; i += 1; continue; }
    if (c === "'" || c === '"' || c.charCodeAt(0) === 96) { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(match.index, i + 1);
    }
  }
  assert.fail('unterminated function ' + name);
}

test('9_5_10 candidate carries deployed 9_5_9 price-integrity functions exactly', () => {
  for (const name of [
    'kkDirectApplyOverridePriceToWebPackages_',
    'kkSnapshotWebPackagePricesForEvent_',
    'kkRestoreWebPackagePricesForEvent_',
    'kkRepairPriceIntegritySafe'
  ]) {
    assert.equal(extractFunction(candidate, name), extractFunction(recovered, name), name + ' must match recovered deployed lineage exactly');
  }
});

test('9_5_10 candidate preserves canonical owner-hidden event update guard exactly', () => {
  assert.equal(extractFunction(candidate, 'kkApiUpdateEvent_'), extractFunction(canonical, 'kkApiUpdateEvent_'));
  assert.match(candidate, /ownerReopenIntent/);
  assert.match(candidate, /EVENT_VISIBILITY_OWNER_LOCKED/);
  assert.match(candidate, /explicit_owner_reopen/);
});

test('9_5_10 candidate is a new reconciled candidate, not either source artifact', () => {
  assert.notEqual(candidate, canonical);
  assert.notEqual(candidate, recovered);
  assert.match(candidate, /v16\\.7\\.0_CRM_PRO_PHASE3_9_5_10_RECONCILED_PRICE_INTEGRITY_OWNER_GUARD/);
  assert.match(candidate, /Repair Price Integrity \\(Safe\\)/);
  assert.match(candidate, /ambiguous legacy package mapping/);
  assert.match(candidate, /Never copy a formula from an old physical row to a new row/);
  assert.match(candidate, /Invalid override price/);
});
