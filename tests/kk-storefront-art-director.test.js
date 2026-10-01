'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Art=require('../server/kk-storefront-art-director.js');
const Registry=require('../server/kk-agent-registry.js');
const Router=require('../server/kk-agent-task-router.js');

test('art director emits implementation-ready design system without business writes',()=>{
 const r=Art.buildDirection({references:['competitor benchmark']});
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
 const r=await Router.executeTask('storefront_art_direction',{goals:['premium']});
 assert.deepEqual(r.invoked_agents,['kk-storefront-art-director']);
 assert.equal(r.result.status,'READY_FOR_IMPLEMENTATION');
});
