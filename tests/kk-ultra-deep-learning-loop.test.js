'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Learning=require('../server/kk-ultra-deep-learning-loop.js');
const Reliability=require('../server/kk-reliability-learning-agent.js');
const Router=require('../server/kk-agent-task-router.js');
const Registry=require('../server/kk-agent-registry.js');

test('premature Ultra Deep completion is durable reliability memory',()=>{
 const out=Reliability.analyzeReliability([{code:'ULTRA_DEEP_PREMATURE_COMPLETION'}]);
 assert.equal(out.known_incident_count,1);
 assert.equal(out.incidents[0].fingerprint_id,'ULTRA_DEEP_PREMATURE_COMPLETION');
 assert.ok(out.incidents[0].regression_guards.includes('discovery-only evidence cannot return COMPLETE'));
});

test('verified prior miss proposes a regression case without business writes',()=>{
 const out=Learning.learnKnownMiss({verified_event:true,was_missed:true,title:'Example Missed Fanmeet',event_date:'2026-12-01',source_url:'https://example.com/event',aliases:['example missed fanmeet'],search_queries:['Example Missed Fanmeet Bangkok']});
 assert.equal(out.status,'PROPOSED_REGRESSION_CASE');
 assert.equal(out.authority.production_writes,0);
 assert.equal(out.authority.auto_apply,false);
 assert.ok(out.next_actions.includes('RERUN_LIVE_DISCOVERY_ACCEPTANCE'));
});

test('unverified observation cannot teach durable known-miss regression',()=>{
 const out=Learning.learnKnownMiss({was_missed:true,title:'Rumor Event',event_date:'2026-12-01',source_url:'https://example.com/rumor',aliases:['rumor event']});
 assert.equal(out.status,'BLOCKED');
 assert.ok(out.blockers.includes('EVENT_NOT_VERIFIED'));
});

test('learning acceptance requires regression plus live rerun and non-regressing miss count',()=>{
 const blocked=Learning.evaluateClosedLoop({before_missed_count:2,after_missed_count:1,known_miss_regression_passed:true,live_discovery_acceptance_passed:false,original_failure_evidence_preserved:true});
 assert.equal(blocked.status,'BLOCKED');
 const pass=Learning.evaluateClosedLoop({before_missed_count:2,after_missed_count:0,known_miss_regression_passed:true,live_discovery_acceptance_passed:true,original_failure_evidence_preserved:true});
 assert.equal(pass.status,'LEARNING_ACCEPTED');
 assert.equal(pass.metrics.improvement,2);
});

test('learning routes are registry-backed and executable',async()=>{
 assert.equal(Registry.REGISTRY_VERSION,'KK_AGENT_REGISTRY_V30');
 const route=Registry.routeForIntent('learn_ultra_deep_miss');
 assert.equal(route.route_id,'ULTRA_DEEP_KNOWN_MISS_LEARNING');
 const out=await Router.executeTask('learn_ultra_deep_miss',{verified_event:true,was_missed:true,title:'Another Miss',event_date:'2026-12-02',source_url:'https://example.com/miss',aliases:['another miss']});
 assert.deepEqual(out.invoked_agents,['kk-discovery-scanner','kk-reliability-learning']);
 assert.equal(out.result.status,'PROPOSED_REGRESSION_CASE');
});
