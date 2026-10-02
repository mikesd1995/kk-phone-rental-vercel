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
    assert.doesNotMatch(block,/LOOKUP\(2,1\//);
  }
});
