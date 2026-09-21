'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const file=path.join(__dirname,'..','.github','workflows','witness-config-zero-cost-acceptance.yml');
const source=fs.readFileSync(file,'utf8');

test('workflow is owner-only and Issue #47 exact-command scoped',()=>{
  assert.match(source,/issue_comment:/);
  assert.match(source,/github\.event\.issue\.number == 47/);
  assert.match(source,/github\.event\.comment\.user\.login == github\.repository_owner/);
  assert.match(source,/github\.event\.comment\.author_association == 'OWNER'/);
  assert.match(source,/github\.event\.comment\.body == '\/accept-witness-config-zero-cost'/);
  assert.doesNotMatch(source,/\bschedule:/);
  assert.doesNotMatch(source,/\bpush:/);
});

test('workflow requires exact-current-main Production and prior exact-SHA OIDC proof',()=>{
  assert.match(source,/resolve-current-production\.js/);
  assert.match(source,/Bounded OIDC Production Acceptance/);
  assert.match(source,/PASS_AND_ROLLED_BACK/);
  assert.match(source,/oidc-final-main-sha\.txt/);
});

test('workflow performs dry run, independent rollback and strict terminal gate',()=>{
  assert.match(source,/--dry-run/);
  assert.match(source,/--rollback-only/);
  assert.match(source,/WITNESS_CONFIG_APPLY_AND_ROLLED_BACK_PASS/);
  assert.match(source,/WITNESS_CONFIG_ROLLBACK_/);
  assert.match(source,/cancel-in-progress: false/);
});

test('workflow never authorizes external Scanner or HF production',()=>{
  assert.doesNotMatch(source,/KK_EXTERNAL_SCANNER_ENABLED:\s*['"]?true/i);
  assert.doesNotMatch(source,/HF_EVENT_ASSIST_ENABLED:\s*['"]?true/i);
});
