'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Direct=require('../server/kk-ultra-deep-direct-zero-cost.js');
const Artifact=require('../server/kk-ultra-deep-phase-artifact.js');

function artifact(){
 return Artifact.freezePhase1({
  phase:'PHASE1',status:'PHASE1_ACCEPTED',month:'2026-10',production_writes:0,
  candidates:[{title:'Artist Concert',event_date:'2026-10-10',source_url:'https://official.example/event'}]
 });
}

test('runnerless Phase 2 direct path consumes frozen artifact and stops before Phase 3',async()=>{
 let called=0;
 const out=await Direct.run({
  month:'2026-10',phase:'PHASE2',phase1_artifact:artifact()
 },{
  executeWrites:false,
  phase2RunFn:async input=>{
   called++;
   assert.equal(input.phase1_artifact.frozen,true);
   return {status:'PHASE2_ACCEPTED',ready_for_phase3:true,production_writes:0,phase3_started:false};
  }
 });
 assert.equal(called,1);
 assert.equal(out.status,'PHASE2_ACCEPTED');
 assert.equal(out.mode,'PHASE2_READ_ONLY');
 assert.equal(out.ready_for_phase3,true);
 assert.equal(out.production_writes,0);
 assert.equal(out.phase3_started,false);
 assert.equal(out.discovery,null);
});

test('Phase 2 direct path permanently rejects production writes',async()=>{
 await assert.rejects(
  ()=>Direct.run({month:'2026-10',phase:'PHASE2',phase1_artifact:artifact()},{executeWrites:true}),
  error=>error&&error.code==='PHASE2_PRODUCTION_WRITES_PROHIBITED'
 );
});

test('runnerless Phase 2 can reconstruct and freeze accepted discovery when artifact is absent',async()=>{
 const out=await Direct.run({month:'2026-10',phase:'PHASE2'},{
  executeWrites:false,
  discoveryFn:async()=>({
   full:true,status:'READY_FOR_VERIFIER',candidate_count:1,
   candidates:[{title:'Artist Concert',event_date:'2026-10-10',source_url:'https://official.example/event'}],
   production_writes:0
  }),
  phase2RunFn:async input=>({
   status:'PHASE2_ACCEPTED',ready_for_phase3:true,
   candidate_count:input.phase1_artifact.candidate_count,
   production_writes:0,phase3_started:false
  })
 });
 assert.equal(out.status,'PHASE2_ACCEPTED');
 assert.equal(out.phase1_artifact.frozen,true);
 assert.equal(out.phase1_artifact.candidate_count,1);
 assert.match(out.phase1_artifact.fingerprint,/^[a-f0-9]{64}$/);
 assert.equal(out.production_writes,0);
});

test('authenticated admin Phase 2 action is read-only and after auth gate',()=>{
 const src=fs.readFileSync(require.resolve('../api/kk-admin-guard.js'),'utf8');
 const auth=src.indexOf("if(!signedSession&&!legacyPinOk) return reply(res,401");
 const action=src.indexOf("if(action==='ultraDeepPhase2ReadOnly')");
 assert.ok(auth>0&&action>auth,'Phase 2 direct action must remain behind Admin authentication');
 const block=src.slice(action,action+3000);
 assert.match(block,/phase:'PHASE2'/);
 assert.match(block,/executeWrites:false/);
 assert.match(block,/PHASE2_READ_ONLY_INVARIANT_BROKEN/);
 assert.match(block,/phase3_started:false/);
 assert.doesNotMatch(block,/executeWrites:commit/);
});
