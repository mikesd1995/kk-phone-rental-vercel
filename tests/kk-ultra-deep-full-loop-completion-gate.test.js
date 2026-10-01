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
