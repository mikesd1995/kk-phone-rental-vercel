'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const workflow=fs.readFileSync(
  path.join(__dirname,'..','.github','workflows','ultra-deep-v2-acceptance.yml'),'utf8'
);

test('CI authenticates the exact pull request HEAD, not the synthetic merge ref',()=>{
  assert.match(workflow,/^permissions:\s*\n\s+contents: read/m);
  assert.match(workflow,/APPROVED_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
  assert.match(workflow,/ref: \$\{\{ env\.APPROVED_SHA \}\}/);
  assert.match(workflow,/persist-credentials: false/);
  assert.match(workflow,/test "\$\(git rev-parse HEAD\)" = "\$APPROVED_SHA"/);
});

test('obsolete PR runs are cancelled without disabling required checks',()=>{
  assert.match(workflow,/^concurrency:\s*\n\s+group: kk-ultra-deep-v2-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref \}\}\s*\n\s+cancel-in-progress: true/m);
  assert.match(workflow,/^\s+workflow_dispatch:\s*$/m);
  assert.match(workflow,/^\s+pull_request:\s*$/m);
  assert.match(workflow,/'\.github\/workflows\/ultra-deep-v2-acceptance\.yml'/);
  assert.match(workflow,/'tests\/ultra-deep-v2-workflow-contract\.test\.js'/);
  assert.doesNotMatch(workflow,/^\s+continue-on-error:\s*true\s*$/m);
});

test('source-only no-lockfile dependency gate remains fail-closed',()=>{
  assert.match(workflow,/test ! -f package-lock\.json && test ! -f npm-shrinkwrap\.json/);
  assert.match(workflow,/node --test tests\/kk-ci-offline-dependency-gate\.test\.js/);
  assert.match(workflow,/node scripts\/kk-ci-offline-dependency-gate\.js ultradeep/);
  assert.doesNotMatch(workflow,/^\s+(?:-\s+)?run:\s*npm (?:ci|install)(?:\s|$)/m);
});

test('October recall, owner lineage and V2 suites remain mandatory',()=>{
  assert.match(workflow,/run: npm run check/);
  assert.match(workflow,/run: npm run test:ultradeep:recall/);
  assert.match(workflow,/run: node --test tests\/kk-ultra-deep-full-loop-v2\.test\.js/);
  assert.match(workflow,/run: node --test tests\/ultra-deep-v2-workflow-contract\.test\.js/);
  assert.match(workflow,/^\s+timeout-minutes: 10\s*$/m);
});

test('Backscan and shard script edits re-trigger exact-head checks without paid dependency installs',()=>{
  assert.match(workflow,/'scripts\/kk-ultra-deep-\*\.js'/);
  assert.match(workflow,/'tests\/kk-ultra-deep-\*\.test\.js'/);
  assert.match(workflow,/'tests\/ultra-deep-v2-workflow-contract\.test\.js'/);
  assert.doesNotMatch(workflow,/^\s+(?:-\s+)?run:\s*npm (?:ci|install|i)\b/m);
  assert.doesNotMatch(workflow,/^\s+continue-on-error:\s*true\s*$/m);
});

test('trusted local exact-head helper safety tests are part of the free offline CI gate',()=>{
  assert.match(workflow,/'tests\/kk-ci-exact-head-local\.test\.js'/);
  assert.match(workflow,/'scripts\/kk-ci-exact-head-local\.sh'/);
  assert.match(workflow,/node --test tests\/kk-ci-offline-dependency-gate\.test\.js tests\/kk-ci-exact-head-local\.test\.js/);
  assert.doesNotMatch(workflow,/^\s*(?:-\s*)?run:\s*npm (?:ci|install|i)\b/m);
  assert.doesNotMatch(workflow,/^\s*vercel --prod(?:\s|$)/m);
});
