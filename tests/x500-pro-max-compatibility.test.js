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
  assert.match(formula, /\+700/);
  assert.match(formula, /\+400/);
  assert.match(formula, /TPL-VIVO-X300-PRO-BUNDLE/, 'price must inherit the actual X300 bundle template override');
  assert.doesNotMatch(formula, /09_Web_Packages/, 'generated public H column must never self-reference');
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

test('legacy booking without a template ID must not guess between X300 and X500', () => {
  const ctx = loadFunctions(['kkGetPackageSpecByType_']);
  ctx.KK = { packages: '03_Packages' };
  ctx.kkIsTrue_ = value => value === true;
  ctx.kkGetValues_ = () => [
    ['TPL-X300-BUNDLE', 'VIVO_X300_PRO', 'phone_lens_bundle', 'ZEISS_2_35X', 690, '', '', true],
    ['TPL-X500-200', 'VIVO_X500_PRO_MAX', 'phone_lens_bundle', 'ZEISS_2_35X', 1090, '', '', true],
    ['TPL-X500-400', 'VIVO_X500_PRO_MAX', 'phone_lens_bundle', 'ZEISS_400MM', 1390, '', '', true]
  ];
  assert.throws(() => ctx.kkGetPackageSpecByType_('phone_lens_bundle'), /Ambiguous package_type/);
});

test('X500 bundle visibility inherits only the same event X300 bundle hidden lock', () => {
  const ctx = loadFunctions(['kkFormulaWebPackageStatus_']);
  const x300 = ctx.kkFormulaWebPackageStatus_(7,5);
  const x500200 = ctx.kkFormulaWebPackageStatus_(8,5);
  const x500400 = ctx.kkFormulaWebPackageStatus_(9,5);
  assert.doesNotMatch(x300, /J7="hidden"/, 'the base row must not self-reference its J cell');
  assert.match(x500200, /J7="hidden"/);
  assert.match(x500400, /J7="hidden"/);
  assert.match(ctx.kkFormulaWebPackageStatus_(13,5), /J12="hidden"/);
  assert.doesNotMatch(ctx.kkFormulaWebPackageStatus_(8,3), /J7="hidden"/, 'old 3-template layout remains unaffected');
});

test('backend package repair covers complete generated sheet, booking price looks beyond row 1000', () => {
  const bookingPrice = extractFunction('kkFormulaBookingPrice_');
  const repair = extractFunction('kkRepairLensCompatibilityFormulas_');
  const lockRepair = extractFunction('kkRepairOwnerVisibilityLockFormulas_');
  assert.match(bookingPrice, /\$3000/);
  assert.match(repair, /web\.getLastRow\(\)/);
  assert.match(repair, /bookingEnd = Math\.min\(1000, booking\.getMaxRows\(\)\)/);
  assert.match(repair, /kkFormulaWebPackageStatus_\(row, templateCount\)/);
  assert.match(lockRepair, /packageSheet\.getLastRow\(\)/);
});
