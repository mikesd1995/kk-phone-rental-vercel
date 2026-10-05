'use strict';
const test=require('node:test'); const assert=require('node:assert/strict');
const Router=require('../server/kk-agent-task-router.js');
const Artifact=require('../server/kk-ultra-deep-phase-artifact.js');

test('Phase2 learning route is executable and invokes verifier plus learning',async()=>{
 const out=await Router.executeTask('phase2_verification_learning',{expected_candidate_count:1,expected_candidate_ids:['c1'],candidate_master_pool_frozen:true,production_writes:0,results:[{candidate_id:'c1',title:'Example',disposition:'VERIFIED',evidence:['https://example.com']}]});
 assert.deepEqual(out.invoked_agents,['kk-event-verifier','kk-reliability-learning']);
 assert.equal(out.result.status,'PHASE2_ACCEPTED');
 assert.equal(out.result.phase3_started,false);
});


test('Phase2 agent route can execute live verifier-learning runtime from frozen artifact',async()=>{
 const artifact=Artifact.freezePhase1({
  phase:'PHASE1',status:'PHASE1_ACCEPTED',month:'2026-10',production_writes:0,
  candidates:[{title:'Artist Concert',event_date:'2026-10-10',source_url:'https://official.example/event'}]
 });
 const body=`<html><head><script type="application/ld+json">
 {"@type":"MusicEvent","name":"Artist Concert","startDate":"2026-10-10","location":{"@type":"Place","name":"Union Hall"}}
 </script></head><body>Artist Concert</body></html>`;
 const out=await Router.executeTask('phase2_verification_learning',{phase1_artifact:artifact,location:'Bangkok Thailand'},{
  fetchImpl:async()=>({ok:true,headers:{get:()=>null},text:async()=>body}),
  ultraDeepProviders:{}
 });
 assert.deepEqual(out.invoked_agents,['kk-event-verifier','kk-reliability-learning']);
 assert.equal(out.result.status,'PHASE2_ACCEPTED');
 assert.equal(out.result.pool_source,'PHASE1_ARTIFACT');
 assert.equal(out.result.production_writes,0);
 assert.equal(out.result.phase3_started,false);
});
