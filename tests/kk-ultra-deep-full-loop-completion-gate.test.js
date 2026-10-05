'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Gate=require('../server/kk-ultra-deep-full-loop-completion-gate.js');

const discovery={full:true,status:'READY_FOR_VERIFIER'};
const completeCandidate={
 candidate_id:'E1',verified:true,deduplicated:true,
 pricing:{competitor_evidence:[{source_url:'https://competitor.example/post'}],final_price:690},
 poster:{verified:true,image_url:'https://official.example/poster.jpg'},
 storefront_compared:true,publish_required:true,governed_publish:true,production_readback:true
};

test('blocks the exact 2026-10-02 failure mode: discovery alone is never Ultra Deep COMPLETE',()=>{
 const r=Gate.evaluate({discovery,candidates:[{candidate_id:'E1'}],final_report_ready:true});
 assert.equal(r.complete,false);
 assert.equal(r.status,'BLOCKED_INCOMPLETE_FULL_LOOP');
 assert.ok(r.candidates[0].blockers.includes('PRICING_EVIDENCE_OR_FALLBACK_MISSING'));
 assert.ok(r.candidates[0].blockers.includes('VERIFIED_POSTER_MISSING'));
 assert.ok(r.candidates[0].blockers.includes('STOREFRONT_COMPARISON_MISSING'));
});

test('zero competitor is allowed only with explicit fallback and final KK price',()=>{
 const c={...completeCandidate,pricing:{competitor_evidence:[],fallback_applied:true,proposal_source:'COMPARABLE_FALLBACK',final_price:590}};
 const r=Gate.evaluate({discovery,candidates:[c],final_report_ready:true});
 assert.equal(r.complete,true);
});

test('publish-required candidate cannot complete without governed publish and production readback',()=>{
 const c={...completeCandidate,governed_publish:false,production_readback:false};
 const r=Gate.evaluate({discovery,candidates:[c],final_report_ready:true});
 assert.equal(r.complete,false);
 assert.ok(r.candidates[0].blockers.includes('GOVERNED_PUBLISH_NOT_PROVEN'));
 assert.ok(r.candidates[0].blockers.includes('PRODUCTION_READBACK_NOT_PROVEN'));
});

test('complete means every stage has evidence',()=>{
 const r=Gate.evaluate({discovery,candidates:[completeCandidate],final_report_ready:true});
 assert.equal(r.complete,true);
 assert.equal(r.production_completion_claim_allowed,true);
});

test('all verified candidates may complete as a zero-write no-op only when every one has an allowed terminal disposition',()=>{
 const r=Gate.evaluate({
  discovery,
  candidates:[],
  verified_candidate_count:3,
  terminal_dispositions:[
   {event_key:'A',status:'SKIPPED_BOOKING_DATE'},
   {event_key:'B',status:'SKIPPED_EVENT_HISTORY'},
   {event_key:'C',status:'SKIPPED_OWNER_HIDDEN'}
  ],
  final_report_ready:true
 });
 assert.equal(r.complete,true);
 assert.equal(r.status,'COMPLETE');
 assert.equal(r.completion_mode,'SAFE_NOOP_TERMINAL_DISPOSITIONS');
 assert.equal(r.terminal_disposition_count,3);
 assert.equal(r.production_completion_claim_allowed,true);
});

test('safe no-op cannot pass when terminal disposition coverage is incomplete',()=>{
 const r=Gate.evaluate({
  discovery,
  candidates:[],
  verified_candidate_count:2,
  terminal_dispositions:[{event_key:'A',status:'SKIPPED_BOOKING_DATE'}],
  final_report_ready:true
 });
 assert.equal(r.complete,false);
 assert.ok(r.blockers.includes('TERMINAL_DISPOSITION_COVERAGE_MISMATCH'));
});

test('safe no-op cannot hide ambiguous or unresolved reconciliation',()=>{
 const r=Gate.evaluate({
  discovery,
  candidates:[],
  verified_candidate_count:1,
  terminal_dispositions:[{event_key:'A',status:'HOLD_AMBIGUOUS_EXISTING'}],
  final_report_ready:true
 });
 assert.equal(r.complete,false);
 assert.ok(r.blockers.includes('UNSAFE_TERMINAL_DISPOSITION'));
});

test('zero candidates with no verified-input accounting remains blocked',()=>{
 const r=Gate.evaluate({discovery,candidates:[],verified_candidate_count:0,terminal_dispositions:[],final_report_ready:true});
 assert.equal(r.complete,false);
 assert.ok(r.blockers.includes('NO_VERIFIED_CANDIDATES'));
});


test('full-capacity booking skip is terminal but unknown booking outcomes remain blocked',()=>{
 const input={discovery,candidates:[],verified_candidate_count:1,final_report_ready:true};
 const complete=Gate.evaluate({...input,terminal_dispositions:[{event_key:'A',status:'SKIPPED_FULL_BOOKING_DATE'}]});
 assert.equal(complete.complete,true);
 assert.equal(complete.completion_mode,'SAFE_NOOP_TERMINAL_DISPOSITIONS');
 for(const status of ['HOLD_BOOKING_CHECK','SAFE_NEW','SKIPPED_UNKNOWN']){
  const blocked=Gate.evaluate({...input,terminal_dispositions:[{event_key:'A',status}]});
  assert.equal(blocked.complete,false);
  assert.ok(blocked.blockers.includes('UNSAFE_TERMINAL_DISPOSITION'));
 }
});
