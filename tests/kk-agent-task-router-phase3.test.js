'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Router=require('../server/kk-agent-task-router.js');

test('Phase 3 diagnostic route exercises pricing without crossing phase boundary',async()=>{
 const out=await Router.executeTask('phase3_commercial_pricing',{
  diagnostic_only:true,
  candidates:[{candidate_id:'c1',phase2_disposition:'VERIFIED'}]
 });
 assert.deepEqual(out.invoked_agents,['kk-commercial-evidence','kk-reliability-learning']);
 assert.equal(out.result.status,'PHASE3_ACCEPTED');
 assert.equal(out.result.diagnostic_only,true);
 assert.equal(out.result.ready_for_phase4,false);
 assert.equal(out.result.production_writes,0);
});

test('Phase 3 official route remains locked until Phase 2 accepted',async()=>{
 const out=await Router.executeTask('phase3_commercial_pricing',{
  phase2:{status:'PHASE2_HOLD',ready_for_phase3:false,production_writes:0,phase3_started:false},
  candidates:[{candidate_id:'c1',phase2_disposition:'VERIFIED'}]
 });
 assert.equal(out.result.status,'PHASE3_BLOCKED');
 assert.ok(out.result.blockers.includes('PHASE2_ACCEPTED_REQUIRED'));
 assert.equal(out.result.production_writes,0);
});
