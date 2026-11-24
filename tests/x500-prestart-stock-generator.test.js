'use strict';

// Regression: the canonical Apps Script generator must not count PHONE-004
// for event dates before its owner-approved public booking start (2026-11-22).
// This test extracts only pure formula builders; it never runs Apps Script,
// touches a Sheet, sends a booking, or invokes a deployment.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');

function extract(name) {
  const begin = source.indexOf('function ' + name + '(');
  assert.ok(begin !== -1, 'function missing: ' + name);
  const end = source.indexOf('\n}\n', begin);
  assert.ok(end !== -1, 'function body not closed: ' + name);
  return source.slice(begin, end + 2);
}

function makeBuilders() {
  const sandbox = {
    kkFormulaLensAssetCount_: row => 'LENS_STOCK_' + row,
    kkFormulaLensBookedCount_: row => 'LENS_HOLDS_' + row
  };
  vm.runInNewContext(
    [
      extract('kkPhone004StartDay_'),
      extract('kkFormulaActiveBookingCount_'),
      extract('kkFormulaPhoneRawCount_'),
      extract('kkFormulaWebPackageAvailable_')
    ].join('\n\n'),
    sandbox,
    { timeout: 1000 }
  );
  return sandbox;
}

test('X500 raw inventory formula subtracts PHONE-004 before 22 November 2026', () => {
  const { kkFormulaPhoneRawCount_ } = makeBuilders();
  const formula = kkFormulaPhoneRawCount_(3104);

  assert.match(formula, /D3104="VIVO_X500_PRO_MAX"/);
  assert.match(formula, /VALUE\(MID\(B3104,5,8\)\),0\)<20261122/);
  assert.match(formula, /COUNTIFS\('02_Assets'!\$A\$5:\$A,"PHONE-004"/);
  assert.match(formula, /'02_Assets'!\$E\$5:\$E,"available"/);
  assert.match(formula, /'02_Assets'!\$G\$5:\$G,TRUE/);
  assert.match(formula, /'00_Master_Booking'!\$AJ\$5:\$AJ,TRUE,'00_Master_Booking'!\$AL\$5:\$AL,D3104/, 'same-day model booking hold must remain');
  assert.match(formula, /'00_Master_Booking'!\$AL\$5:\$AL,""/, 'unknown-model holds still reserve conservatively');
  assert.ok(formula.indexOf('PHONE-004') < formula.indexOf("COUNTIFS('00_Master_Booking'"),
    'gate must be deducted before existing booking holds');
});

test('generated raw and clamped public counts share the pre-start gate', () => {
  const { kkFormulaWebPackageAvailable_ } = makeBuilders();
  for (const row of [3104, 3105, 3106, 3110, 3111, 3112]) {
    for (const raw of [true, false]) {
      const formula = kkFormulaWebPackageAvailable_(row, raw);
      assert.match(formula, new RegExp('D' + row + '="VIVO_X500_PRO_MAX"'));
      assert.match(formula, new RegExp('B' + row + ',5,8'));
      assert.match(formula, /PHONE-004/);
      assert.match(formula, /20261122/);
      assert.match(formula, /'00_Master_Booking'!\$AJ\$5:\$AJ,TRUE/);
      assert.match(formula, /LENS_STOCK_/, 'lens allocation must remain part of bundle logic');
      assert.match(formula, /LENS_HOLDS_/, 'lens booking holds must be preserved');
    }
  }
});

test('cutoff operator is strictly before 20261122 and cannot count another phone', () => {
  const { kkFormulaPhoneRawCount_ } = makeBuilders();
  const a = kkFormulaPhoneRawCount_(3104);
  const b = kkFormulaPhoneRawCount_(570);
  assert.match(a, /<20261122\)/);
  assert.match(b, /<20261122\)/);
  assert.ok(a.includes('D3104="VIVO_X500_PRO_MAX"'));
  assert.ok(b.includes('D570="VIVO_X500_PRO_MAX"'));
  assert.ok(!a.includes('"PHONE-001"'));
  assert.ok(!a.includes('"PHONE-003"'));
  assert.match(a, /"PHONE-004"/);
});

test('PHONE-004 start-day boundary matches live 02_Assets: 21-Nov excluded, 22-Nov eligible', () => {
  const { kkFormulaPhoneRawCount_ } = makeBuilders();
  const formula = kkFormulaPhoneRawCount_(3104);
  const match = formula.match(/VALUE\(MID\(B3104,5,8\)\),0\)<([0-9]{8})/);
  assert.ok(match, 'event-date eligibility gate missing');
  const startYmd = Number(match[1]);
  assert.equal(startYmd, 20261122);
  assert.equal(20261121 < startYmd, true);
  assert.equal(20261122 < startYmd, false);
  assert.equal(20261128 < startYmd, false);
  assert.equal((formula.match(/"PHONE-004"/g) || []).length, 1);
});
