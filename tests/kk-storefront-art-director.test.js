'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Art=require('../server/kk-storefront-art-director.js');
const Registry=require('../server/kk-agent-registry.js');
const Router=require('../server/kk-agent-task-router.js');

test('art director emits implementation-ready design system without business writes',()=>{
 const r=Art.buildDirection({kind:'bugfix',references:['competitor benchmark']});
 assert.equal(r.status,'READY_FOR_IMPLEMENTATION');
 assert.equal(r.authority.production_writes,0);
 assert.equal(r.acceptance.business_truth_unchanged,true);
 assert.ok(r.anti_patterns.length>=5);
});
test('art director acceptance fails closed without visual evidence',()=>{
 const r=Art.evaluateImplementation({evidence:{multi_viewport:true}});
 assert.equal(r.status,'BLOCKED');
 assert.ok(r.blockers.includes('INDEPENDENT_VISUAL_QA_NOT_PASSING'));
});
test('agent registry and task router make art director callable',async()=>{
 const route=Registry.routeForIntent('storefront_art_direction');
 assert.ok(route);
 assert.deepEqual(route.required_agents,['kk-storefront-art-director']);
 const r=await Router.executeTask('storefront_art_direction',{kind:'bugfix',goals:['premium']});
 assert.deepEqual(r.invoked_agents,['kk-storefront-art-director']);
 assert.equal(r.result.status,'READY_FOR_IMPLEMENTATION');
});

test('art director blocks major redesign until Inspo research evidence is present',()=>{
 const r=Art.buildDirection({kind:'redesign',goals:['premium mobile-first']});
 assert.equal(r.status,'BLOCKED_REFERENCE_RESEARCH');
 assert.ok(r.reference_gate.blockers.includes('INSPO_PROVIDER_EVIDENCE_MISSING'));
});
test('art director accepts major redesign with bounded Inspo evidence',()=>{
 const r=Art.buildDirection({kind:'redesign',inspo_evidence:{
  provider:'Nutlope/inspo',brief:'mobile-first poster-led concert rental storefront',
  references:['inspo:a','inspo:b','inspo:c'],
  patterns_adopt:['poster-first hierarchy'],patterns_reject:['generic SaaS hero']
 }});
 assert.equal(r.status,'READY_FOR_IMPLEMENTATION');
 assert.equal(r.reference_gate.status,'PASS');
});
