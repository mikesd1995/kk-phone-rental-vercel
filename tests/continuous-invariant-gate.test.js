'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Gate=require('../scripts/kk-continuous-invariant-gate');

test('continuous invariant gate passes the accepted repository baseline',()=>{
  const report=Gate.audit();
  assert.equal(report.schema,'kk-continuous-invariant-gate/v1');
  assert.equal(report.status,'PASS');
  assert.deepEqual(report.failed_checks,[]);
  assert.equal(report.production_writes,0);
  assert.equal(report.business_data_mutations,0);

  const ids=new Set(report.checks.map(x=>x.id));
  for(const id of [
    'ADMIN_MUTATION_FRESH_READBACK',
    'CANONICAL_POSTER_SOT_PRECEDENCE',
    'PUBLIC_DATA_NO_STORE_HANDLER',
    'PUBLIC_DATA_NO_STORE_EDGE',
    'PUBLIC_FEED_ALLOWLIST_ONLY',
    'PUBLIC_INTERNAL_TEXT_REDACTION',
    'OWNER_HIDDEN_TOMBSTONE_END_TO_END',
    'PRIVATE_READER_FAIL_CLOSED',
    'CANONICAL_IDENTITY_AND_PROJECTION_EVIDENCE',
    'GENERATED_PRICE_FORMULA_PRESERVED',
    'REVENUE_POLICY_FAIL_CLOSED',
    'CI_CONTINUOUS_GATE_WIRED'
  ]) assert.ok(ids.has(id),id+' missing');
});
