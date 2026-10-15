'use strict';
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const assert=require('node:assert/strict');
const file=path.resolve(__dirname,'../.github/workflows/ultra-deep-v2-acceptance.yml');
const contents=()=>fs.readFileSync(file,'utf8');

test('CI keeps SHA-pinned checkout and read-only GitHub token',()=>{
 const s=contents();
 assert.match(s,/APPROVED_SHA:\s*\$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
 assert.match(s,/ref:\s*\$\{\{ env\.APPROVED_SHA \}\}/);
 assert.match(s,/persist-credentials:\s*false/);
 assert.match(s,/test "\$\(git rev-parse HEAD\)" = "\$APPROVED_SHA"/);
 assert.match(s,/permissions:\s*\n\s+contents:\s*read/);
});
test('no executable npm ci/npm install or network package install in source-only CI',()=>{
 const s=contents();
 for(const line of s.split(/\r?\n/)){
  assert.doesNotMatch(line,/^\s*(?:-\s+)?(?:run:\s*)?(?:sudo\s+)?(?:npm\s+(?:ci|install|i)\b|npx\s+(?:--yes\s+)?\S+|yarn\s+install\b|pnpm\s+install\b|corepack\s+)/i);
 }
 assert.match(s,/test ! -f package-lock\.json/);
 assert.match(s,/test ! -f npm-shrinkwrap\.json/);
});
test('source-only exact V2 regression and existing syntax check remain mandatory',()=>{
 const s=contents();
 assert.match(s,/run:\s*npm run check/);
 assert.match(s,/run:\s*node --test tests\/kk-ultra-deep-full-loop-v2\.test\.js/);
 assert.match(s,/runs-on:\s*ubuntu-latest/);
 assert.match(s,/node-version:\s*'20'/);
});
test('cancel superseded PR head jobs to save included free runner minutes',()=>{
 const s=contents();
 assert.match(s,/concurrency:\s*\n\s*group:/);
 assert.match(s,/cancel-in-progress:\s*true/);
 assert.match(s,/timeout-minutes:\s*10/);
});
test('workflow source and contract test itself trigger checks on future PR changes',()=>{
 const s=contents();
 assert.match(s,/'\.github\/workflows\/ultra-deep-v2-acceptance\.yml'/);
 assert.match(s,/'tests\/ci-ultra-deep-v2-workflow-safety\.test\.js'/);
 assert.match(s,/on:\s*\n\s*workflow_dispatch:/);
 assert.match(s,/pull_request:\s*\n\s*paths:/);
});
test('contract test is wired into CI and cannot be skipped by only running V2 test',()=>{
 const s=contents();
 assert.match(s,/node --test tests\/ci-ultra-deep-v2-workflow-safety\.test\.js/);
});

test('detail-only and regression-only changes trigger and execute the added safety guards',()=>{
 const s=contents();
 for(const file of ['server/kk-public-event-detail-followup.js','server/kk-onebangkok-event-detail.js','tests/kk-ultra-deep-*.test.js','tests/kk-public-event-detail-followup.test.js','tests/kk-onebangkok-event-detail.test.js','tests/kk-knownmiss-identity-boundary.test.js','tests/kk-public-search-availability.test.js']){
  assert.ok(s.includes("'"+file+"'"),'missing PR path trigger: '+file);
 }
 const commands=s.split(/\r?\n/).filter(line=>/^\s*run:\s*node --test /.test(line)).join('\n');
 for(const file of ['tests/kk-ultra-deep-*.test.js','tests/kk-public-event-detail-followup.test.js','tests/kk-onebangkok-event-detail.test.js','tests/kk-knownmiss-identity-boundary.test.js','tests/kk-public-search-availability.test.js']){
  assert.ok(commands.includes(file),'missing executed safety suite: '+file);
 }
});
