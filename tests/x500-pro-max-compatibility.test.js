'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'apps-script', 'Code.gs'), 'utf8');

function extractFunction(name) {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' must be present in the Apps Script backend');
  const end = source.indexOf('\n}\n', start);
  assert.ok(end > start, name + ' must have a normal top-level closing brace');
  return source.slice(start, end + 2);
}

function loadFunctions(names) {
  const context = {};
  vm.createContext(context);
  vm.runInContext(names.map(extractFunction).join('\n'), context, { timeout: 2000 });
  return context;
}

test('compatibility matrix allows exactly three Vivo phone + lens pairings', () => {
  const ctx = loadFunctions(['kkPriceLensCanonical_', 'kkPhoneLensCompatible_', 'kkAssertPhoneLensCompatible_']);
  const cases = [
    ['VIVO_X300_PRO', 'ZEISS_2_35X', true],
    ['VIVO_X300_PRO', 'G1', true],
    ['VIVO_X300_PRO', 'ZEISS_400MM', false],
    ['VIVO_X500_PRO_MAX', 'ZEISS_2_35X', true],
    ['VIVO_X500_PRO_MAX', 'G1', true],
    ['VIVO_X500_PRO_MAX', 'ZEISS_400MM', true],
    ['VIVO_X500_PRO_MAX', 'G2', false]
  ];
  for (const [phone, lens, expected] of cases) {
    assert.equal(ctx.kkPhoneLensCompatible_(phone, lens), expected, phone + ' + ' + lens);
    if (!expected) assert.throws(() => ctx.kkAssertPhoneLensCompatible_(phone, lens), /Incompatible/);
  }
});

test('X500 price is based on same-event X300 bundle plus 400 or 700', () => {
  const ctx = loadFunctions(['kkWebPackageTemplateFormula_', 'kkWebPackageStandardPriceFormula_', 'kkWebPackagePriceFormula_']);
  const formula = ctx.kkWebPackagePriceFormula_(29);
  assert.match(formula, /VIVO_X500_PRO_MAX/);
  assert.match(formula, /ZEISS_400MM/);
  assert.match(formula, /700,400/);
  assert.match(formula, /VIVO_X300_PRO/);
  assert.match(formula, /09_Web_Packages/);
  assert.match(formula, /04_Event_Overrides/);
  assert.ok(!formula.includes('$H$5000'), 'no cap on price source when package grid grows');
});

test('stock holds are scoped by physical phone or lens model group', () => {
  const ctx = loadFunctions(['kkFormulaActiveBookingCount_', 'kkFormulaLensBookedCount_', 'kkFormulaPhoneRawCount_']);
  const phones = ctx.kkFormulaPhoneRawCount_(29);
  const lenses = ctx.kkFormulaLensBookedCount_(29);
  assert.match(phones, /AL\$5:AL\$1000/);
  assert.match(phones, /D29/);
  assert.match(lenses, /AM\$5:AM\$1000/);
  assert.match(lenses, /F29/);
  assert.match(lenses, /ZEISS_2_35X\|G1/);
});

test('create and update booking enforce a physical model-compatible pair', () => {
  const ctx = loadFunctions([
    'kkPriceLensCanonical_',
    'kkPhoneLensCompatible_',
    'kkAssertPhoneLensCompatible_',
    'kkAssertPhysicalPhoneLensPair_'
  ]);
  ctx.kkGetValues_ = () => [
    ['PHONE-001', 'phone', 'VIVO_X300_PRO'],
    ['PHONE-003', 'phone', 'VIVO_X500_PRO_MAX'],
    ['LENS-004', 'lens', 'ZEISS_2_35X'],
    ['LENS-005', 'lens', 'ZEISS_400MM']
  ];
  ctx.KK = { assets: '02_Assets' };
  assert.doesNotThrow(() => ctx.kkAssertPhysicalPhoneLensPair_('PHONE-001', 'LENS-004'));
  assert.doesNotThrow(() => ctx.kkAssertPhysicalPhoneLensPair_('PHONE-003', 'LENS-004'));
  assert.doesNotThrow(() => ctx.kkAssertPhysicalPhoneLensPair_('PHONE-003', 'LENS-005'));
  assert.throws(() => ctx.kkAssertPhysicalPhoneLensPair_('PHONE-001', 'LENS-005'), /Incompatible/);
});

test('public package mapper hides invalid X300 + 400mm tuples', () => {
  assert.match(extractFunction('kkApiWebPackageRows_'), /kkPhoneLensCompatible_/);
  assert.match(extractFunction('kkApiCreatePackage_'), /kkAssertPhoneLensCompatible_/);
  assert.match(extractFunction('kkApiCreateBooking_'), /kkAssertPhysicalPhoneLensPair_/);
  assert.match(extractFunction('kkApiUpdateBooking_'), /kkAssertPhysicalPhoneLensPair_/);
});
