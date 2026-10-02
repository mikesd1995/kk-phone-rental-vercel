'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const sources=[
  fs.readFileSync('apps-script/Code.gs','utf8'),
  fs.readFileSync('apps-script/candidates/Code_9_5_13_FULL_BACKEND_AUDIT_2026-10-02.gs','utf8')
];

function functionBlock(src,name,nextName){
  const start=src.indexOf('function '+name);
  assert.notEqual(start,-1,name+' missing');
  const end=nextName?src.indexOf('function '+nextName,start+10):src.indexOf('\nfunction ',start+10);
  return src.slice(start,end===-1?src.length:end);
}

test('booking update persists one canonical A:T row then readbacks identity/status/payment/assets',()=>{
  for(const src of sources){
    const block=functionBlock(src,'kkApiUpdateBooking_','kkEnsureSheetWithHeaders_');
    assert.match(block,/getRange\(row, 1, 1, 20\)\.setValues\(\[next\]\)/);
    assert.match(block,/SpreadsheetApp\.flush\(\)/);
    assert.match(block,/Booking identity readback failed/);
    assert.match(block,/Booking status readback failed/);
    assert.match(block,/Booking payment readback failed/);
    assert.match(block,/Booking asset readback failed/);
    assert.doesNotMatch(block,/getRange\(row, 3\)\.setValue/);
  }
});

test('retired G2 cannot be used to create new lens assets or packages even if legacy Model_Master says active',()=>{
  for(const src of sources){
    const block=functionBlock(src,'kkAssertModelGroupType_','kkNormalizeAssetModelDisplay_');
    assert.match(block,/kkIsRetiredG2LensGroup_\(group\)/);
    assert.match(block,/Retired model_group cannot be used for new asset\/package/);
  }
});
