'use strict';
const test=require('node:test'); const assert=require('node:assert/strict');
const Memory=require('../server/kk-project-memory.js');
const row=(o={})=>({memory_id:'kk:test:memory:0001',occurred_at:'2026-10-02T12:00:00+07:00',kind:'DECISION',domain:'content',summary:'Use governed agent invocation evidence for every social content request.',evidence_refs:['docs/example.md'],...o});
test('builds deterministic bootstrap context',()=>{const r=Memory.buildBootstrap([row()]);assert.equal(r.status,'READY');assert.equal(r.context.length,1);assert.equal(r.rules.business_truth_authority,false);});
test('superseded memory is omitted',()=>{const a=row();const b=row({memory_id:'kk:test:memory:0002',occurred_at:'2026-10-02T13:00:00+07:00',summary:'New governed decision replaces the prior project rule safely.',supersedes:[a.memory_id]});const r=Memory.buildBootstrap([a,b]);assert.deepEqual(r.context.map(x=>x.memory_id),[b.memory_id]);});
test('rejects sensitive summaries',()=>{const r=Memory.buildBootstrap([row({summary:'customer phone 0812345678 must be remembered forever'})]);assert.equal(r.status,'BLOCKED_INVALID_MEMORY');assert.match(r.blockers[0].errors.join(','),/SENSITIVE_CONTENT_REJECTED/);});
test('filters context by domain',()=>{const r=Memory.buildBootstrap([row(),row({memory_id:'kk:test:memory:0003',domain:'pricing',summary:'Pricing decisions require current canonical evidence before writes.'})],{domains:['pricing']});assert.deepEqual(r.context.map(x=>x.domain),['pricing']);});
