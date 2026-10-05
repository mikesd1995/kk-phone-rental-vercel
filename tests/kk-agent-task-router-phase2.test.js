'use strict';
const test=require('node:test'); const assert=require('node:assert/strict');
const Router=require('../server/kk-agent-task-router.js');

test('Phase2 learning route is executable and invokes verifier plus learning',async()=>{
 const out=await Router.executeTask('phase2_verification_learning',{expected_candidate_count:1,candidate_master_pool_frozen:true,production_writes:0,results:[{title:'Example',disposition:'VERIFIED',evidence:['https://example.com']}]});
 assert.deepEqual(out.invoked_agents,['kk-event-verifier','kk-reliability-learning']);
 assert.equal(out.result.status,'PHASE2_ACCEPTED');
 assert.equal(out.result.phase3_started,false);
});
