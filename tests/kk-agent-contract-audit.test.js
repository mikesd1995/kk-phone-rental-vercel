'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {audit}=require('../scripts/kk-agent-contract-audit.js');

test('agent/design/skill contracts stay aligned with executable KK invariants',()=>{
  const report=audit();
  assert.equal(report.production_writes,0);
  assert.equal(report.business_data_mutations,0);
  assert.deepEqual(report.failed_checks,[]);
  assert.equal(report.status,'PASS');
  assert.equal(report.checks.length>=10,true);
});
