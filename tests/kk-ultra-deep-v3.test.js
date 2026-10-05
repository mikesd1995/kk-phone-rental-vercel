'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Ultra=require('../server/kk-ultra-deep-v3.js');
const Eng=require('../server/kk-engineering-execution-gate.js');
const Router=require('../server/kk-agent-task-router.js');
const Registry=require('../server/kk-agent-registry.js');

test('Ultra Deep V3 fails closed until every source tier is covered',()=>{
  const p=Ultra.planGapSearch([{source_tier:'OFFICIAL',source_url:'https://official.example/event'}]);
  assert.equal(p.status,'SEARCH_GAPS_REQUIRED');
  assert.ok(p.coverage.missing_tiers.includes('SOCIAL'));
  assert.equal(p.provider_order[0],'OFFICIAL_DIRECT');
  assert.equal(p.hf_policy.production_writes,0);
});

test('Ultra Deep V3 accepts full evidence only after downstream gates',()=>{
  const observations=Ultra.REQUIRED_TIERS.map(t=>({source_tier:t,source_url:`https://example.com/${t.toLowerCase()}`}));
  assert.equal(Ultra.acceptance({observations,deterministic_dedup_passed:true,hf_required:true,hf_assist_passed:true,verifier_ready:true,commercial_evidence_ready:true}).status,'READY_FOR_FINAL_VERIFIER');
  assert.equal(Ultra.acceptance({observations,deterministic_dedup_passed:true,hf_required:true,hf_assist_passed:false,verifier_ready:true,commercial_evidence_ready:true}).status,'HOLD_FOR_ULTRA_DEEP_ACCEPTANCE');
});

test('engineering gate requires independent review and release readback',()=>{
  const base=Object.fromEntries(Eng.REQUIRED_PHASES.map(k=>[k,true]));
  assert.equal(Eng.evaluate(base).status,'ENGINEERING_ACCEPTED');
  base.INDEPENDENT_REVIEWER=false;
  assert.equal(Eng.evaluate(base).status,'BLOCKED');
  assert.ok(Eng.evaluate(base).missing.includes('INDEPENDENT_REVIEWER'));
});


test('Ultra Deep V3 is callable through governed agent routes',async()=>{
  const route=Registry.routeForIntent('plan_ultra_deep_scan');
  assert.equal(route.runtime_available,true);
  const out=await Router.executeTask('plan_ultra_deep_scan',{observations:[]});
  assert.deepEqual(out.invoked_agents,['kk-discovery-source-watch','kk-discovery-scanner']);
  assert.equal(out.result.status,'SEARCH_GAPS_REQUIRED');
  assert.equal(Registry.REGISTRY_VERSION,'KK_AGENT_REGISTRY_V34');
});


test('Ultra Deep full-loop completion route is registered and requires learning plus commercial verification',()=>{
 const route=Registry.routeForIntent('accept_ultra_deep_full_loop');
 assert.equal(route.route_id,'ULTRA_DEEP_FULL_LOOP_COMPLETION_ACCEPTANCE');
 assert.equal(route.runtime_available,true);
 assert.ok(route.required_agents.includes('kk-discovery-scanner'));
 assert.ok(route.required_agents.includes('kk-commercial-evidence'));
 assert.ok(route.required_agents.includes('kk-event-verifier'));
 assert.ok(route.required_agents.includes('kk-reliability-learning'));
});
