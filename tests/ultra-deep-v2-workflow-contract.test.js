'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const workflow=fs.readFileSync(path.join(__dirname,'..','.github','workflows','ultra-deep-v2-acceptance.yml'),'utf8');
const pkg=JSON.parse(fs.readFileSync(path.join(__dirname,'..','package.json'),'utf8'));

test('workflow checks pull_request and explicit workflow_dispatch without a paid runner or privileged token',()=>{
 assert.match(workflow,/^on:\s*\n\s+workflow_dispatch:\s*\n\s+pull_request:/m);
 assert.match(workflow,/^permissions:\s*\n\s+contents: read/m);
 assert.match(workflow,/runs-on: ubuntu-latest/);
 assert.match(workflow,/timeout-minutes: 10/);
 assert.doesNotMatch(workflow,/pull_request_target:/);
 assert.doesNotMatch(workflow,/secrets\./);
 assert.doesNotMatch(workflow,/continue-on-error:\s*true/);
});

test('checkout pins real PR head SHA with dispatch fallback and fail-closed readback',()=>{
 assert.match(workflow,/APPROVED_SHA:\s*\$\{\{\s*github\.event\.pull_request\.head\.sha\s*\|\|\s*github\.sha\s*\}\}/);
 assert.match(workflow,/ref:\s*\$\{\{\s*env\.APPROVED_SHA\s*\}\}/);
 assert.match(workflow,/fetch-depth:\s*1/);
 assert.match(workflow,/persist-credentials:\s*false/);
 assert.match(workflow,/test -n "\$APPROVED_SHA"/);
 assert.match(workflow,/test "\$\(git rev-parse HEAD\)" = "\$APPROVED_SHA"/);
 assert.ok(workflow.indexOf('Reject stale or synthetic-merge checkout') < workflow.indexOf('Syntax gate'));
});

test('per-PR cancellation only replaces obsolete queued/running attempts',()=>{
 assert.match(workflow,/group:\s*kk-ultra-deep-v2-\$\{\{\s*github\.event\.pull_request\.number\s*\|\|\s*github\.ref\s*\}\}/);
 assert.match(workflow,/cancel-in-progress:\s*true/);
});

test('no npm ci/install/network package install without a checked-in lockfile',()=>{
 assert.match(workflow,/test ! -f package-lock\.json/);
 assert.match(workflow,/test ! -f npm-shrinkwrap\.json/);
 assert.doesNotMatch(workflow,/^\s*(?:-\s*)?run:\s*npm (?:ci|install|i)\b/m);
 assert.doesNotMatch(workflow,/^\s*npm (?:ci|install|i)\b/m);
 assert.doesNotMatch(workflow,/actions\/setup-node@v4[\s\S]*?\n\s+cache:\s*npm/);
 assert.match(workflow,/node scripts\/kk-ci-offline-dependency-gate\.js ultradeep/);
});

test('workflow executes Node 20, offline gate, syntax, full Recall and focused V2 tests',()=>{
 assert.match(workflow,/node-version:\s*'20'/);
 assert.match(workflow,/node --test tests\/kk-ci-offline-dependency-gate\.test\.js tests\/ultra-deep-v2-workflow-contract\.test\.js/);
 assert.match(workflow,/run:\s*npm run check/);
 assert.match(workflow,/run:\s*npm run test:ultradeep:recall/);
 assert.match(workflow,/run:\s*node --test tests\/kk-ultra-deep-full-loop-v2\.test\.js/);
 assert.ok(pkg.scripts['test:ultradeep:recall'].includes('tests/kk-ultra-deep-owner-core-lineage.test.js'));
 assert.ok(pkg.scripts['test:ultradeep:recall'].includes('tests/kk-ultra-deep-backscan-miss-review.test.js'));
});

test('change paths include contract regression and business-independent source changes',()=>{
 for(const entry of [
  "'server/kk-ultra-deep-*.js'",
  "'tests/kk-ultra-deep-*.test.js'",
  "'tests/ultra-deep-v2-workflow-contract.test.js'",
  "'tests/kk-ci-offline-dependency-gate.test.js'",
  "'scripts/kk-ci-offline-dependency-gate.js'",
  "'.github/workflows/ultra-deep-v2-acceptance.yml'",
  "'package.json'"
 ])assert.ok(workflow.includes(entry),entry);
});

test('CI contract only describes checks; it does not publish events or mutate production',()=>{
 assert.doesNotMatch(workflow,/vercel --prod|npm run deploy|supabase db push|gh pr merge|curl\s+.*(?:POST|PATCH|DELETE)/i);
 assert.doesNotMatch(workflow,/^\s*environment:\s*production/m);
});
