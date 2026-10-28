'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const file=path.join(__dirname,'../.github/workflows/core-sheet-privacy-exact-head.yml');
const source=()=>fs.readFileSync(file,'utf8');
test('Core P0 CI runs on PR or exact gated Draft push and checks out reviewed SHA without credentials',()=>{
 const s=source();
 assert.match(s,/on:\s*\n\s*pull_request:/);
 assert.ok(s.includes('  push:'));
 assert.ok(s.includes('      - fix/core-sheets-privacy-private-read-gates-20261014'));
 assert.ok(!s.includes('      - main'));
 assert.ok(s.includes("'.github/workflows/core-sheet-privacy-exact-head.yml'"));
 assert.ok(s.includes("'tests/core-sheet-privacy-workflow-contract.test.js'"));
 assert.match(s,/permissions:\s*\n\s+contents:\s*read/);
 assert.match(s,/ref:\s*\$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
 assert.match(s,/persist-credentials:\s*false/);
 assert.match(s,/git rev-parse HEAD/);
});
test('Core P0 CI avoids paid/remote dependencies, caches and artifacts',()=>{
 const s=source();
 assert.match(s,/runs-on:\s*ubuntu-latest/);
 assert.match(s,/timeout-minutes:\s*8/);
 assert.match(s,/cancel-in-progress:\s*true/);
 for(const line of s.split(/\r?\n/)){
   assert.doesNotMatch(line,/^\s*(?:-\s+)?(?:run:\s*)?(?:sudo\s+)?(?:npm\s+(?:ci|install|i)\b|npx\s+|pnpm\s+install|yarn\s+install|corepack)/i);
 }
 assert.doesNotMatch(s,/upload-artifact|actions\/cache|secrets\.|\$\{\{\s*secrets|deploy --prod/);
});
test('Core P0 CI checks source, owner-only key separation and public-PII regressions',()=>{
 const s=source();
 for(const f of [
 'tests/core-sheet-privacy-cutover.test.js','tests/core-private-cutover-preflight.test.js',
 'tests/core-apps-script-private-reader.test.js','tests/core-apps-script-public-get-privacy.test.js',
 'tests/core-read-only-key-isolation.test.js','tests/core-read-key-owner-setup.test.js',
 'tests/admin-sheet-fallback-private-reader.test.js','tests/public-data-proxy.test.js',
 'tests/public-data-browser-privacy.test.js','tests/core-sheet-privacy-workflow-contract.test.js'
 ])assert.ok(s.includes(f),'missing '+f);
 assert.match(s,/node --check < apps-script\/Code\.gs/);
});
test('Core P0 CI responds to changes to its own workflow and gate',()=>{
 const s=source();
 assert.match(s,/'\.github\/workflows\/core-sheet-privacy-exact-head\.yml'/);
 assert.match(s,/'tests\/core-sheet-privacy-workflow-contract\.test\.js'/);
 assert.match(s,/node-version:\s*'20'/);
});
