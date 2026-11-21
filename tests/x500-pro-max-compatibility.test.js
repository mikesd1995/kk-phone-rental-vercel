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

test('second X500 PHONE-004 starts on 22 Nov without removing first X500 from earlier event stock', () => {
  const ctx = loadFunctions(['kkFormulaActiveBookingCount_', 'kkFormulaPhoneRawCount_', 'kkFormulaWebPackageStatus_']);
  const formula = ctx.kkFormulaPhoneRawCount_(29);
  assert.match(formula, /PHONE-004/, 'only the newly added X500 is subject to the start gate');
  assert.match(formula, /D29="VIVO_X500_PRO_MAX"/, 'X300 inventory must remain unchanged');
  assert.match(formula, /MID\(B29,5,8\)/, 'eligibility must follow the EVENT date');
  assert.match(formula, /<20261122/, 'second device must not count before 22 November');
  assert.match(formula, /AL\$5:AL\$1000/, 'same-day X500 bookings still subtract from shared model stock');
  const earlierPackage = ctx.kkFormulaWebPackageStatus_(8, 5);
  assert.doesNotMatch(earlierPackage, /20261122/, 'first X500 must not be suppressed by a package-wide date gate');
  assert.match(earlierPackage, /J7="hidden"/, 'owner-hidden parent bundle still closes X500 variants');
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

test('public event stock formula sums unique X300 and X500 capacity, not 200/400mm variants', () => {
  const ctx = loadFunctions(['kkFormulaWebReadyPhoneCount_']);
  const formula = ctx.kkFormulaWebReadyPhoneCount_(523);
  assert.match(formula, /A523/);
  assert.match(formula, /"VIVO_X300_PRO"/);
  assert.match(formula, /"VIVO_X500_PRO_MAX"/);
  assert.match(formula, /"<>hidden"/);
  assert.equal((formula.match(/MAXIFS\(/g) || []).length, 2, 'one MAXIFS for each unique phone model');
  assert.match(formula, /\+MAXIFS\(/, 'combine the two separate model counts');
  assert.doesNotMatch(formula, /"<>lens_only"/, 'global MAXIFS ignores the second physical phone');
  assert.throws(() => ctx.kkFormulaWebReadyPhoneCount_(4), /INVALID_WEB_READY_ROW/);
});

test('stock formula repair writes only 08_Web_Ready column G using row-adjusted formulas', () => {
  const ctx = loadFunctions(['kkFormulaWebReadyPhoneCount_', 'kkRepairWebReadyPhoneStock_']);
  const writes = [];
  ctx.KK = {webReady:'08_Web_Ready'};
  ctx.kkSheet_ = name => {
    assert.equal(name, '08_Web_Ready');
    return {
      getMaxRows: () => 1000,
      getRange: (r,c,rows,cols) => {
        assert.deepEqual([r,c,rows,cols], [5,7,3,1]);
        return {setFormulas: formulas => writes.push(formulas)};
      }
    };
  };
  assert.equal(ctx.kkRepairWebReadyPhoneStock_(7), 3);
  assert.equal(writes.length, 1);
  assert.deepEqual(Array.from(writes[0], x=>x[0].match(/A\d+/)?.[0]), ['A5','A6','A7']);
});

function mockNewEventPackageCoverage({partial=false, existing=false}={}) {
  const formulas = Array.from({length:5},()=>Array(14).fill(''));
  const seeded = Array.from({length:5},()=>Array(14).fill('=FORMULA'));
  const data = Array.from({length:5},()=>Array(14).fill(''));
  if (partial) formulas[0][0] = '=HALF_GENERATED';
  if (existing) formulas.forEach(row => row.fill('=COMPLETE'));
  let rows = 2594, insertCount = 0, copies = 0;
  const target = {
    getFormulas: () => formulas,
    getValues: () => data,
  };
  const seed = {getFormulas:()=>seeded,copyTo:(dest,type,transpose)=>{
    assert.equal(dest, target);
    assert.equal(type, 'PASTE_NORMAL');
    assert.equal(transpose, false);
    copies++;
    formulas.forEach(row=>row.fill('=COPIED'));
  }};
  const web = {
    getMaxRows: () => rows,
    insertRowsAfter: (after,n) => {assert.equal(after, 2594); rows+=n; insertCount+=n;},
    getRange: (start,col,count,width) => {
      assert.equal(col,1);
      assert.deepEqual([count,width],[5,14]);
      if (start===2595) return target;
      if (start===5) return seed;
      throw new Error('Unexpected start '+start);
    }
  };
  const ctx = loadFunctions(['kkEnsureWebPackageCoverageForEventRow_']);
  ctx.KK = {webPackages:'09_Web_Packages',packages:'03_Packages'};
  ctx.SpreadsheetApp = {CopyPasteType:{PASTE_NORMAL:'PASTE_NORMAL'},flush:()=>{}};
  ctx.kkSheet_ = name => {assert.equal(name, '09_Web_Packages');return web;};
  ctx.kkGetValues_ = (name,start,col,width) => {
    assert.deepEqual([name,start,col,width],['03_Packages',5,1,1]);
    return Array.from({length:5},(_,i)=>['TPL_'+i]);
  };
  return {ctx,state:()=>({rows,insertCount,copies})};
}

test('new Core event row 523 extends generated five-package public rows exactly once', () => {
  const m = mockNewEventPackageCoverage();
  const result = m.ctx.kkEnsureWebPackageCoverageForEventRow_(523);
  assert.deepEqual({first:result.first_row,last:result.last_row,populated:result.populated},
                   {first:2595,last:2599,populated:true});
  assert.deepEqual(m.state(),{rows:2599,insertCount:5,copies:1});
});

test('new event package migration is idempotent and never overwrites prices', () => {
  const m = mockNewEventPackageCoverage({existing:true});
  const result = m.ctx.kkEnsureWebPackageCoverageForEventRow_(523);
  assert.equal(result.populated,false);
  assert.deepEqual(m.state(),{rows:2599,insertCount:5,copies:0});
});

test('partially generated package block fails closed, rather than overwriting user values', () => {
  const m = mockNewEventPackageCoverage({partial:true});
  assert.throws(()=>m.ctx.kkEnsureWebPackageCoverageForEventRow_(523),/PARTIAL_WEB_PACKAGE_BLOCK_FAIL_CLOSED/);
  assert.equal(m.state().copies,0);
});

test('event create preflights generated package coverage before Core and override writes', () => {
  const create = extractFunction('kkApiCreateEvent_');
  const a = create.indexOf('kkEnsureWebPackageCoverageForEventRow_(row)');
  const b = create.indexOf('sh.getRange(row, 1, 1, 8).setValues');
  const c = create.indexOf('kkWriteEventOverrides_');
  assert.ok(a>=0 && b>a && c>b, 'publishability check must precede Core/history/price writes');
  const repair = extractFunction('kkRepairLensCompatibilityFormulas_');
  assert.match(repair,/WEB_PACKAGE_TAIL_MISSING_FORMULAS/);
  assert.match(repair,/kkRepairWebReadyPhoneStock_/);
  assert.doesNotMatch(repair,/getRange\(startRow, 8, rowCount, 1\)\.setFormulas/, 'do not rewrite price column H');
});
