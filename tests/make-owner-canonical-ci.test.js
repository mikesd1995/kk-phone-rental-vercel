'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const workflowPath='.github/workflows/canonical-owner-v2.yml';
function load(){return JSON.parse(fs.readFileSync(path.join(__dirname,'..',workflowPath),'utf8'));}
function matches(glob,file){let pattern='^';for(let i=0;i<glob.length;i++){if(glob[i]==='*'){if(glob[i+1]==='*'){pattern+='.*';i++;}else pattern+='[^/]*';}else pattern+=glob[i].replace(/[\\^$+?.()|{}\[\]]/g,'\\$&');}return new RegExp(pattern+'$').test(file);}
test('F3 automatic canonical PR CI covers every implementation boundary and its own native harness without duplicate push runs',()=>{
 const w=load(),required=['server/make-owner-canonical.js','server/make-owner-canonical-builder.js','server/kk-make-owner-notify.js','server/make-owner-transport-contract.js','server/make-owner-ledger-bridge.js','server/runtime-ledger-oidc-bridge.js','api/kk-scanner-dispatch.js','apps-script/kk-agent/Code.gs','apps-script/kk-agent/OwnerLedgerBridge.gs','apps-script/kk-agent/CanonicalOwnerLedger.gs','supabase/functions/kk-runtime-ledger-oidc-probe/index.ts','supabase/staging/kk-owner-ledger-canonical-v2.sql','supabase/staging/kk-owner-ledger-bridge-v1.sql','tests/make-owner-canonical.test.js','tests/kk-agent-owner-canonical.test.js','tests/make-owner-canonical-builder.test.js','tests/make-owner-edge-oidc.test.js','scripts/test-owner-canonical-native.mjs','package.json','package-lock.json',workflowPath,'tests/make-owner-canonical-ci.test.js'];
 assert.ok(w.on.pull_request);for(const file of required)assert.ok(w.on.pull_request.paths.some(g=>matches(g,file)),'pull_request must cover '+file);assert.equal(w.on.push,undefined);
 assert.ok(w.on.pull_request.branches.includes('main'));
});
test('F3 canonical CI executes full source checks and pinned temporary native SQL with read-only permissions',()=>{
 const w=load();assert.deepEqual(w.permissions,{contents:'read'});const jobs=Object.values(w.jobs);assert.equal(jobs.length,1);const steps=jobs[0].steps,runs=steps.map(s=>s.run||'').join('\n');
 assert.ok(steps.some(s=>s.uses?.startsWith('actions/setup-node@')&&s.with['node-version']==='24'));assert.match(runs,/npm ci --ignore-scripts/);assert.match(runs,/npm test/);assert.match(runs,/npm run check/);assert.match(runs,/node --check server\/make-owner-canonical\.js/);assert.match(runs,/vm\.Script/);assert.match(runs,/\.gs/);
 assert.match(runs,/@electric-sql\/pglite@0\.5\.11/);assert.match(runs,/npm install --prefix "\$\{RUNNER_TEMP\}\/kk-canonical-native" --no-save --ignore-scripts --no-package-lock/);assert.match(runs,/node scripts\/test-owner-canonical-native\.mjs/);
 const native=steps.find(s=>s.run?.includes('node scripts/test-owner-canonical-native.mjs'));assert.match(native.env.PGLITE_MODULE,/runner\.temp/);assert.equal(w.env.KK_OWNER_CANONICAL_ENABLED,'FALSE');assert.equal(w.env.KK_MAKE_OWNER_TRANSPORT_ENABLED,'FALSE');
 assert.ok(steps.some(s=>s.uses?.startsWith('actions/checkout@')&&s.with['persist-credentials']===false&&s.with.ref.includes('pull_request.head.sha')));assert.doesNotMatch(JSON.stringify(w),/secrets\.|id-token|vercel deploy|supabase db push|scenario_activate|script\.googleapis\.com/);
});
