'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const workflowPath=path.join(__dirname,'..','.github','workflows','audit-witness-scheduler.yml');
const source=fs.readFileSync(workflowPath,'utf8');

test('witness scheduler diagnostic is owner-only and issue-scoped',()=>{
  assert.match(source,/issue_comment:/);
  assert.match(source,/github\.event\.issue\.number == 47/);
  assert.match(source,/github\.event\.comment\.user\.login == github\.repository_owner/);
  assert.match(source,/github\.event\.comment\.author_association == 'OWNER'/);
  assert.match(source,/github\.event\.comment\.body == '\/audit-witness-scheduler'/);
});

test('diagnostic has read-only permissions and no runtime authority',()=>{
  assert.match(source,/contents:\s*read/);
  assert.match(source,/actions:\s*read/);
  assert.doesNotMatch(source,/id-token:\s*write/);
  assert.doesNotMatch(source,/schedule:/);
  assert.doesNotMatch(source,/workflow_dispatch:/);
  assert.doesNotMatch(source,/SUPABASE/i);
  assert.doesNotMatch(source,/VERCEL_TOKEN/);
  assert.doesNotMatch(source,/KK_EXTERNAL_SCANNER_ENABLED/);
  assert.doesNotMatch(source,/HF_EVENT_ASSIST_ENABLED/);
});

test('diagnostic calls only the read-only audit script',()=>{
  assert.match(source,/node scripts\/audit-github-witness-scheduler\.js/);
  assert.match(source,/REPORT_PATH: witness-scheduler-audit\.json/);
});
