'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const Intel=require('../server/kk-code-intelligence');
test('finite round context retrieves actual GAS/gateway/15-module compiler and meaningful tests within budget',()=>{
 const pack=Intel.contextPack('bounded real acceptance finite round GAS gateway Make 6176241',{root:path.join(__dirname,'..')});
 assert.ok(pack.matched_routes.some(r=>r.id==='owner_finite_acceptance'));
 for(const p of ['apps-script/kk-agent/OwnerRealAcceptance.gs','server/make-owner-real-acceptance.js','server/make-owner-canonical-real-acceptance-stage.js'])assert.ok(pack.selected_files.some(f=>f.path===p),p);
 for(const p of ['tests/kk-agent-real-acceptance.test.js','tests/make-owner-real-acceptance.test.js','tests/make-owner-real-acceptance-parity.test.js','tests/make-owner-canonical-real-acceptance-stage.test.js'])assert.ok(pack.targeted_tests.includes(p),p);
 assert.equal(pack.full_regression_required,true);assert.ok(pack.selected_files.length<=10);assert.ok(pack.estimated_context_tokens<=12000);
});
