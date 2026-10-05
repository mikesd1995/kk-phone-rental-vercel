'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const A=require('../server/kk-ultra-deep-phase3-artifact.js');

function accepted(){
 return A.freezePhase3({
  status:'PHASE3_ACCEPTED',ready_for_phase4:true,production_writes:0,phase4_started:false,
  month:'2026-10',accepted_at:'2026-10-05T15:00:00Z',phase2_fingerprint:'p2',
  results:[
   {candidate_id:'c1',status:'PRICE_READY',price_source:'EXACT_EVENT_COMPETITOR_MEDIAN',price_confidence:'HIGH',target_prices:{phone:790,bundle:990,lens:200},evidence:[{competitor_id:'shop',package_type:'PHONE_ONLY',price:790,source_url:'https://x.com/shop/status/1',source_published_at:'2026-10-04'}]},
   {candidate_id:'c2',status:'SKIP_OWNER_HIDDEN',reason:'OWNER_HIDDEN_TOMBSTONE_DO_NOT_READD'}
  ]
 });
}
test('Phase3 artifact freezes exact accepted price decisions',()=>{
 const a=accepted();
 assert.equal(a.frozen,true);assert.deepEqual(a.actionable_candidate_ids,['c1']);assert.match(a.fingerprint,/^[a-f0-9]{64}$/);
 assert.equal(A.validateForPhase4(a).pass,true);
});
test('Phase3 artifact refuses accepted handoff with HOLD decision',()=>{
 const a=A.freezePhase3({
  status:'PHASE3_ACCEPTED',ready_for_phase4:true,production_writes:0,phase4_started:false,phase2_fingerprint:'p2',
  results:[{candidate_id:'c1',status:'HOLD',reason:'BOOKED_PRICE_SOT_REQUIRED'}]
 });
 assert.equal(a.frozen,false);assert.ok(a.blockers.includes('PHASE3_HOLD_PRESENT'));
});
test('tampering with accepted price decision breaks fingerprint',()=>{
 const a=accepted();const bad={...a,results:a.results.map((x,i)=>i?x:{...x,target_prices:{...x.target_prices,phone:1290}})};
 const v=A.validateForPhase4(bad);assert.equal(v.pass,false);assert.ok(v.blockers.includes('PHASE3_ARTIFACT_FINGERPRINT_MISMATCH'));
});
