'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const direct=require('../server/admin-direct-writer-phase1.js');

const apps=fs.readFileSync('apps-script/Code.gs','utf8');
const candidate=fs.readFileSync('apps-script/candidates/Code_9_5_13_FULL_BACKEND_AUDIT_2026-10-02.gs','utf8');

test('web package price formula avoids live LOOKUP array failure and preserves latest override semantics',()=>{
  const formula=direct.webPackagePriceFormula(185,'TPL-VIVO-X300-PRO-PHONE');
  assert.match(formula,/INDEX\(FILTER\(/);
  assert.match(formula,/COUNTIFS\(/);
  assert.doesNotMatch(formula,/LOOKUP\(2,1\//);
  assert.match(formula,/04_Event_Overrides/);
  assert.match(formula,/03_Packages/);
});

test('Apps Script source and accepted candidate use the same FILTER + COUNTIFS price strategy',()=>{
  for(const src of [apps,candidate]){
    const start=src.indexOf('function kkWebPackagePriceFormula_');
    assert.notEqual(start,-1);
    const end=src.indexOf('\nfunction ',start+10);
    const block=src.slice(start,end===-1?src.length:end);
    assert.match(block,/INDEX\(FILTER\(/);
    assert.match(block,/COUNTIFS\(/);
    assert.doesNotMatch(block,/IFERROR\(LOOKUP\(2,1\//);
  }
});

test('direct writer and canonical GAS use uncapped override ranges for independent X500 lens packages',()=>{
  const p200=direct.webPackagePriceFormula(3103,'TPL-VIVO-X500-PRO-MAX-BUNDLE-200MM');
  const p400=direct.webPackagePriceFormula(3104,'TPL-VIVO-X500-PRO-MAX-BUNDLE-400MM');
  for(const [formula,row,own,other] of [[p200,3103,'200MM','400MM'],[p400,3104,'400MM','200MM']]){
    assert.ok(formula.includes('B'+row));
    for(const col of ['A','B','C'])assert.ok(formula.includes("'04_Event_Overrides'!$"+col+"$5:$"+col),col);
    assert.doesNotMatch(formula,/\$1000\b/);
    assert.ok(formula.includes('TPL-VIVO-X500-PRO-MAX-BUNDLE-'+own));
    assert.ok(!formula.includes('TPL-VIVO-X500-PRO-MAX-BUNDLE-'+other));
    assert.match(formula,/INDEX\(FILTER\(/);
    assert.match(formula,/VLOOKUP\(/);
  }
  const vm=require('node:vm');
  const start=apps.indexOf('function kkWebPackagePriceFormula_');
  const end=apps.indexOf('\nfunction ',start+10);
  const gas=vm.runInNewContext(apps.slice(start,end)+'\nkkWebPackagePriceFormula_');
  assert.equal(gas(3103,'TPL-VIVO-X500-PRO-MAX-BUNDLE-200MM'),p200);
  assert.equal(gas(3104,'TPL-VIVO-X500-PRO-MAX-BUNDLE-400MM'),p400);
});
