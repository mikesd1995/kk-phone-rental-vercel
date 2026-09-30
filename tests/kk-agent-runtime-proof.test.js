'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Registry=require('../server/kk-agent-registry.js');
const Router=require('../server/kk-agent-task-router.js');

test('every registered agent has a callable required route with persistent invocation evidence',()=>{
  const audit=Registry.runtimeProofAudit();
  assert.equal(audit.pass,true,'Unproven/decorative agents: '+audit.unproven_agents.join(', '));
  assert.deepEqual(audit.unproven_agents,[]);
  for(const row of audit.agents){
    assert.equal(row.callable_route,true,row.agent_id+' has no callable required route');
    assert.equal(row.persistent_evidence_required,true,row.agent_id+' route can bypass invocation evidence');
  }
});

test('operational router returns executable evidence for representative safety agents',async()=>{
  const source=await Router.executeTask('source_watch_check',{url:'https://example.com/event',source_class:'official',observed_at:'2026-09-30T00:00:00Z'});
  assert.deepEqual(source.invoked_agents,['kk-discovery-source-watch']);
  const canary=await Router.executeTask('canary_audit',{});
  assert.deepEqual(canary.invoked_agents,['kk-canary-safety']);
  const reliability=await Router.executeTask('reliability_audit',{observations:[]});
  assert.deepEqual(reliability.invoked_agents,['kk-reliability-learning']);
});

test('declared agent names alone never count as runtime proof',()=>{
  const audit=Registry.runtimeProofAudit();
  for(const row of audit.agents){
    assert.notEqual(row.status,'DECLARED_ONLY');
    assert.ok(row.routes.length>0,row.agent_id+' is decorative: no required route');
  }
});
