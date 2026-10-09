'use strict';
const test=require('node:test'); const assert=require('node:assert/strict');
const Memory=require('../server/kk-project-memory.js');
const row=(o={})=>({memory_id:'kk:test:memory:0001',occurred_at:'2026-10-02T12:00:00+07:00',kind:'DECISION',domain:'content',summary:'Use governed agent invocation evidence for every social content request.',evidence_refs:['docs/example.md'],...o});
test('builds deterministic bootstrap context',()=>{const r=Memory.buildBootstrap([row()]);assert.equal(r.status,'READY');assert.equal(r.context.length,1);assert.equal(r.rules.business_truth_authority,false);});
test('superseded memory is omitted',()=>{const a=row();const b=row({memory_id:'kk:test:memory:0002',occurred_at:'2026-10-02T13:00:00+07:00',summary:'New governed decision replaces the prior project rule safely.',supersedes:[a.memory_id]});const r=Memory.buildBootstrap([a,b]);assert.deepEqual(r.context.map(x=>x.memory_id),[b.memory_id]);});
test('rejects sensitive summaries',()=>{const r=Memory.buildBootstrap([row({summary:'customer phone 0812345678 must be remembered forever'})]);assert.equal(r.status,'BLOCKED_INVALID_MEMORY');assert.match(r.blockers[0].errors.join(','),/SENSITIVE_CONTENT_REJECTED/);});
test('filters context by domain',()=>{const r=Memory.buildBootstrap([row(),row({memory_id:'kk:test:memory:0003',domain:'pricing',summary:'Pricing decisions require current canonical evidence before writes.'})],{domains:['pricing']});assert.deepEqual(r.context.map(x=>x.domain),['pricing']);});

test('agent gateway bootstraps project memory for critical routes and fail-closes invalid corpus',async()=>{
 const Gateway=require('../server/kk-agent-gateway.js');
 const ledgerFn=async row=>({ok:true,inserted:true,invocation_id:row.invocation_id});
 const good=await Gateway.executeAgentRequest({task_type:'reliability_audit',input:{observations:[]}},{ledgerFn});
 assert.equal(good.status,'RECORDED');
 assert.equal(good.project_memory.status,'READY');
 assert.ok(good.project_memory.context_count>0);
 const bad=await Gateway.executeAgentRequest({task_type:'reliability_audit',input:{observations:[]}},{ledgerFn,projectMemoryCorpus:{items:[row({summary:'customer phone 0812345678 must persist'})]}});
 assert.equal(bad.status,'BLOCKED_PROJECT_MEMORY_UNAVAILABLE');
 assert.equal(bad.blocker,'PROJECT_MEMORY_BOOTSTRAP_BLOCKED');
});

test('gateway merges durable ledger memory and fail-closes when enabled ledger is unavailable',async()=>{
 const Gateway=require('../server/kk-agent-gateway.js');
 const ledgerFn=async row=>({ok:true,inserted:true,invocation_id:row.invocation_id});
 const durable=row({memory_id:'kk:test:memory:durable1',domain:'reliability_debug',summary:'Durable runtime lesson is loaded before the reliability agent executes.'});
 const good=await Gateway.executeAgentRequest({task_type:'reliability_audit',input:{observations:[]}},{ledgerFn,projectMemoryListFn:async()=>({ok:true,enabled:true,rows:[durable]})});
 assert.equal(good.status,'RECORDED'); assert.ok(good.project_memory.context_count>0);
 const bad=await Gateway.executeAgentRequest({task_type:'reliability_audit',input:{observations:[]}},{ledgerFn,projectMemoryListFn:async()=>{throw Object.assign(new Error('down'),{code:'PROJECT_MEMORY_LEDGER_READ_FAILED'});}});
 assert.equal(bad.status,'BLOCKED_PROJECT_MEMORY_UNAVAILABLE'); assert.equal(bad.blocker,'PROJECT_MEMORY_LEDGER_READ_FAILED');
});

test('checked-in project memory corpus is valid across every domain',()=>{
 const corpus=require('../config/kk-project-memory.json');
 const result=Memory.buildBootstrap(corpus.items);
 assert.equal(result.status,'READY',JSON.stringify(result.blockers));
 assert.equal(result.generated_from,corpus.items.length);
});

test('unsupported run-result kind still fails closed',()=>{
 const result=Memory.buildBootstrap([row({kind:'RUN_RESULT'})]);
 assert.equal(result.status,'BLOCKED_INVALID_MEMORY');
 assert.deepEqual(result.blockers[0].errors,['KIND_INVALID']);
});
