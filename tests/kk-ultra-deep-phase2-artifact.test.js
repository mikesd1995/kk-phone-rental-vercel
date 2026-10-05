'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const A=require('../server/kk-ultra-deep-phase2-artifact.js');

function accepted(){
 return A.freezePhase2({
  status:'PHASE2_ACCEPTED',ready_for_phase3:true,production_writes:0,phase3_started:false,
  month:'2026-10',phase1_fingerprint:'p1',accepted_at:'2026-10-05T14:00:00Z',
  results:[
   {candidate_id:'c1',title:'A',event_date:'2026-10-10',venue:'Hall',disposition:'VERIFIED',evidence:['https://official.example/a']},
   {candidate_id:'c2',title:'B',event_date:'2026-10-11',venue:'Hall',disposition:'STATUS_CHANGED',reason:'POSTPONED',evidence:['https://official.example/b']}
  ]
 });
}
test('Phase2 artifact freezes exact pricing candidate set and fingerprint',()=>{
 const a=accepted();
 assert.equal(a.frozen,true);assert.deepEqual(a.candidate_ids,['c1','c2']);assert.deepEqual(a.pricing_candidate_ids,['c1']);
 assert.equal(a.pricing_candidate_count,1);assert.match(a.fingerprint,/^[a-f0-9]{64}$/);
 assert.equal(A.validateForPhase3(a).pass,true);
});
test('unresolved VERIFY_REQUIRED can never freeze as accepted Phase2 handoff',()=>{
 const a=A.freezePhase2({
  status:'PHASE2_ACCEPTED',ready_for_phase3:true,production_writes:0,phase3_started:false,phase1_fingerprint:'p1',
  results:[{candidate_id:'c1',disposition:'VERIFY_REQUIRED',reason:'official gap',evidence:['https://secondary.example']}]
 });
 assert.equal(a.frozen,false);assert.ok(a.blockers.includes('PHASE2_UNRESOLVED_VERIFY_REQUIRED'));
});
test('tampered pricing candidate set is rejected',()=>{
 const a=accepted();
 const bad={...a,pricing_candidate_ids:['c2']};
 const v=A.validateForPhase3(bad);
 assert.equal(v.pass,false);assert.ok(v.blockers.includes('PHASE2_PRICING_SET_MISMATCH')||v.blockers.includes('PHASE2_ARTIFACT_FINGERPRINT_MISMATCH'));
});
