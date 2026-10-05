'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Router=require('../server/kk-agent-task-router.js');
const Artifact=require('../server/kk-ultra-deep-phase2-artifact.js');

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


test('Phase 3 agent route executes bounded runtime from immutable Phase2 artifact',async()=>{
 const phase2_artifact=Artifact.freezePhase2({
  status:'PHASE2_ACCEPTED',ready_for_phase3:true,production_writes:0,phase3_started:false,
  month:'2026-10',phase1_fingerprint:'p1',
  results:[{candidate_id:'c1',title:'Event',event_date:'2026-10-20',venue:'Hall',disposition:'VERIFIED',evidence:['https://official.example/c1']}]
 });
 const out=await Router.executeTask('phase3_commercial_pricing',{
  phase2_artifact,
  candidates:[{candidate_id:'c1',title:'Event',event_date:'2026-10-20',venue:'Hall'}],
  max_rounds:1
 },{
  ddgsRunner:async()=>[],
  now:'2026-10-05T12:00:00Z'
 });
 assert.deepEqual(out.invoked_agents,['kk-commercial-evidence','kk-reliability-learning']);
 assert.equal(out.result.status,'PHASE3_ACCEPTED');
 assert.equal(out.result.ready_for_phase4,true);
 assert.equal(out.result.phase3_artifact.frozen,true);
 assert.equal(out.result.production_writes,0);
 assert.equal(out.result.phase4_started,false);
});
