'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('apps-script/Code.gs','utf8');
function definition(name) {
  const start = source.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, 'missing ' + name);
  const end = source.indexOf('\nfunction ', start + 10);
  return source.slice(start, end < 0 ? source.length : end);
}

const context = vm.createContext({
  kkFormulaLensCriteria_(ref){ return ref; },
  kkFormulaLensAssetCount_(r){ return 'LENS_AVAILABLE_'+r; },
  kkFormulaLensBookedCount_(r){ return 'LENS_BOOKED_'+r; }
});
for (const name of [
  'kkFormulaPhoneRawCount_',
  'kkFormulaWebPackageAvailable_',
  'kkFormulaBookingPrice_'
]) vm.runInContext(definition(name),context);

test('X500 bare phone shares booking counts and gates PHONE-004 before 28 Nov 2026',()=>{
  const f = context.kkFormulaPhoneRawCount_(32);
  assert.match(f, /PHONE-004/);
  assert.match(f, /20261128/);
  assert.match(f, /VIVO_X500_PRO_MAX/);
  assert.match(f, /'00_Master_Booking'!\$AJ\$5:\$AJ\$1000,TRUE/);
  assert.match(f, /'00_Master_Booking'!\$AL\$5:\$AL\$1000,D32/);
});

test('phone_only capacity is independent of lens stock, bundle needs both',()=>{
  const f = context.kkFormulaWebPackageAvailable_(33,false);
  assert.match(f, /C33="lens_only"/);
  assert.match(f, /C33="phone_lens_bundle"/);
  assert.match(f, /LENS_AVAILABLE_33/);
  assert.match(f, /LENS_BOOKED_33/);
});

test('booking prices include packages after row 1000 and exact pending model',()=>{
  const f = context.kkFormulaBookingPrice_(47);
  assert.match(f, /'09_Web_Packages'!\$H\$5:\$H/);
  assert.doesNotMatch(f, /'09_Web_Packages'!\$H\$5:\$H\$1000/);
  assert.match(f, /KK_TEMPLATE/);
  assert.match(f, /TPL-\[A-Za-z0-9-\]/);
  assert.match(f, /'03_Packages'!\$A\$5:\$B/);
  assert.match(f, /D47/);
  assert.match(f, /AL47/);
});

test('repair does not destroy grandfathered or owner-approved public list prices',()=>{
  const repair = definition('kkRepairWebPackagePriceFormulas_');
  assert.match(repair, /const endRow = web\.getLastRow\(\)/);
  assert.match(repair, /values\[idx\]\[0\] !== ''/);
  assert.doesNotMatch(repair, /setFormulas\(formulas\)/);
});

test('price override lookup is not truncated at override row 1000',()=>{
  const sourceFn = definition('kkWebPackagePriceFormula_');
  assert.doesNotMatch(sourceFn, /\$1000/);
  assert.match(sourceFn, /'04_Event_Overrides'!\$C\$5:\$C/);
});
