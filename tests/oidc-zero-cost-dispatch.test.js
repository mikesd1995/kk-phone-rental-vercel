'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const workflowPath=path.join(__dirname,'..','.github','workflows','bounded-oidc-production-acceptance.yml');
const routerPath=path.join(__dirname,'..','.github','workflows','kk-owner-comment-command-router.yml');
const source=fs.readFileSync(workflowPath,'utf8');
const routerSource=fs.readFileSync(routerPath,'utf8');

test('zero-cost OIDC dispatcher is owner-only, issue-scoped, and exact-command scoped via router + workflow_call',()=>{
  assert.match(routerSource,/issue_comment:/);
  assert.match(routerSource,/uses: \.\/\.github\/workflows\/bounded-oidc-production-acceptance\.yml/);
  assert.match(source,/workflow_call:/);
  assert.doesNotMatch(source,/^\s*issue_comment:/m);
  assert.match(source,/github\.event\.issue\.number == 47/);
  assert.match(source,/github\.event\.comment\.user\.login == github\.repository_owner/);
  assert.match(source,/github\.event\.comment\.author_association == 'OWNER'/);
  assert.match(source,/github\.event\.comment\.body == '\/run-bounded-oidc'/);
  assert.doesNotMatch(source,/\bschedule:/);
  assert.doesNotMatch(source,/\bpush:/);
});

test('dispatcher auto-resolves exact current-main Production instead of requiring a hard-coded deployment',()=>{
  assert.match(source,/resolve-current-production\.js/);
  assert.match(source,/--expected-sha "\$EXPECTED_SHA"/);
  assert.match(source,/MANUAL_SOURCE/);
  assert.match(source,/test "\$MANUAL_SOURCE" = "\$SOURCE_ID"/);
});

test('dispatcher preserves dry-run, immediate main recheck, independent rollback and terminal marker',()=>{
  assert.match(source,/--dry-run/);
  assert.match(source,/Recheck main immediately before mutation/);
  assert.match(source,/--rollback-only/);
  assert.match(source,/PASS_AND_ROLLED_BACK/);
  assert.match(source,/business_writes/);
  assert.match(source,/oidc_probe_enabled/);
  assert.match(source,/cancel-in-progress: false/);
});

test('dispatcher does not add Scanner, Verifier, HF, or business execution authority',()=>{
  assert.doesNotMatch(source,/HF_EVENT_ASSIST_ENABLED:\s*['"]?true/i);
  assert.doesNotMatch(source,/EXTERNAL_SCANNER_ENABLED:\s*['"]?true/i);
  assert.doesNotMatch(source,/scanner_execution_capable:\s*true/i);
  assert.doesNotMatch(source,/business_writes_capable:\s*true/i);
});
