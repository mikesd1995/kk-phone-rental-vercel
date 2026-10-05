'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const R=require('../server/kk-ultra-deep-phase3-runtime.js');
const A=require('../server/kk-ultra-deep-phase2-artifact.js');

function artifact(){
 return A.freezePhase2({
  status:'PHASE2_ACCEPTED',ready_for_phase3:true,production_writes:0,phase3_started:false,
  month:'2026-10',phase1_fingerprint:'p1',accepted_at:'2026-10-05T14:00:00Z',
  results:[{candidate_id:'c1',title:'LYKN REFLEXION CONCERT',event_date:'2026-10-23',venue:'IMPACT',disposition:'VERIFIED',evidence:['https://official.example/c1']}]
 });
}
test('Phase3 runtime remains zero-write and can accept governed base fallback after bounded recovery',async()=>{
 const out=await R.run({
  phase2_artifact:artifact(),
  candidates:[{candidate_id:'c1',title:'LYKN REFLEXION CONCERT',event_date:'2026-10-23',venue:'IMPACT',phase2_disposition:'VERIFIED'}],
  max_rounds:2
 },{
  ddgs_runner:async()=>[],
  now:'2026-10-05T12:00:00Z'
 });
 assert.equal(out.status,'PHASE3_ACCEPTED');assert.equal(out.ready_for_phase4,true);assert.equal(out.production_writes,0);assert.equal(out.phase4_started,false);
 assert.equal(out.results[0].price_source,'BASE_690_890');assert.ok(out.rounds.length>=1);
});
test('Phase3 runtime refuses a candidate set not matching Phase2 artifact',async()=>{
 const out=await R.run({
  phase2_artifact:artifact(),
  candidates:[{candidate_id:'c2',title:'Other',event_date:'2026-10-23',venue:'IMPACT'}]
 },{skip_scan:true});
 assert.equal(out.status,'PHASE3_BLOCKED');assert.ok(out.blockers.includes('PHASE2_PHASE3_CANDIDATE_SET_MISMATCH'));
});
