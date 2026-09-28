'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const workflowPath=path.join(root,'.github','workflows','kk-external-witness-clock.yml');
const reconciliationPath=path.join(root,'docs','GITHUB_OIDC_WITNESS_V425_AUTHORITY_RECONCILIATION_2026-09-28.md');
const retirementPath=path.join(root,'docs','GITHUB_OIDC_WITNESS_RETIREMENT_2026-09-28.md');

test('retired witness cannot emit scheduled GitHub failures because active workflow is absent',()=>{
  assert.equal(fs.existsSync(workflowPath),false);
});

test('v4.9.25 reconciliation remains fail-closed historical evidence',()=>{
  const source=fs.readFileSync(reconciliationPath,'utf8');
  assert.match(source,/WITNESS MUST REMAIN DISABLED/);
  assert.match(source,/keep `github_oidc_witness_v1=false`/);
  assert.match(source,/do not backfill historical expectation rows/);
});

test('retirement delegates runtime scheduling only to the existing Machine-SOT-bound tasks',()=>{
  const source=fs.readFileSync(retirementPath,'utf8');
  assert.match(source,/SCANNER.*6ab272b36b1881919577ff3367fa8245/);
  assert.match(source,/VERIFIER.*6ab7e060fa788191b5f17a7028494c3a/);
  assert.match(source,/ACTIVE_TASKS_EXACT2/);
  assert.match(source,/do not create a new Make scenario/i);
  assert.match(source,/do not create a new GitHub Actions scheduler/i);
});

test('retirement preserves natural-runtime acceptance semantics',()=>{
  const source=fs.readFileSync(retirementPath,'utf8');
  assert.match(source,/natural future slot/i);
  assert.match(source,/timer metadata.*zero acceptance credit/i);
  assert.match(source,/MISSING_RUNTIME/);
});
