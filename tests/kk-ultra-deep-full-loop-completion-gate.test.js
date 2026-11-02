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


const launchLead={event_id:'EVT-20261103-GMMTVNEXT-GENERATION-HAPPY',
 event_date:'2026-11-03',title:'GMMTVNEXT: GENERATION HAPPY'};
const launchQueue={...launchLead,status:'READY_FOR_VERIFIER'};
test('cross-surface GMMTVNEXT audit blocks COMPLETE even when event was discovered in a separate report',()=>{
 const out=Gate.evaluate({discovery:{...discovery,audit_required:true},candidates:[completeCandidate],
  audit_discovery_leads:[launchLead],candidate_queue_readback_verified:true,
  candidate_queue_readback:[],final_report_ready:true});
 assert.equal(out.complete,false);
 assert.ok(out.blockers.includes('AUDIT_LEAD_TO_CANDIDATE_RECONCILIATION_INCOMPLETE'));
 assert.equal(out.audit_reconciliation.missing_count,1);
 assert.equal(out.audit_reconciliation.unresolved[0].reason,'AUDIT_LEAD_NOT_IN_CANDIDATE_QUEUE');
 assert.equal(out.production_completion_claim_allowed,false);
});
test('exact dated Candidate Queue readback closes GMMTVNEXT handoff debt, not unrelated same-day events',()=>{
 const input={discovery:{...discovery,audit_required:true},candidates:[completeCandidate],
  audit_discovery_leads:[launchLead],candidate_queue_readback_verified:true,final_report_ready:true};
 const unrelated={event_id:'EVT-20261103-THE-FALL-OF-TROY-BANGKOK',event_date:'2026-11-03',
  title:'The Fall of Troy Live in Bangkok',status:'READY_FOR_VERIFIER'};
 assert.equal(Gate.evaluate({...input,candidate_queue_readback:[unrelated]}).complete,false);
 const good=Gate.evaluate({...input,candidate_queue_readback:[unrelated,launchQueue]});
 assert.equal(good.complete,true);
 assert.equal(good.audit_reconciliation.accounted_count,1);
});
test('iQIYI parent event requires both fan zone 400 and green carpet 1600 eligibility evidence',()=>{
 const lead={event_id:'EVT-20261105-IQIYI-IJOY-TH-2027',event_date:'2026-11-05',
  title:'iQIYI iJOY TH 2027',required_access_variants:['FAN_ZONE_400','GREEN_CARPET_1600']};
 const base={discovery:{...discovery,audit_required:true},candidates:[completeCandidate],
  audit_discovery_leads:[lead],candidate_queue_readback_verified:true,final_report_ready:true};
 const partial={...lead,access_variants:['FAN_ZONE_400']};
 const failed=Gate.evaluate({...base,candidate_queue_readback:[partial]});
 assert.equal(failed.complete,false);
 assert.deepEqual(failed.audit_reconciliation.unresolved[0].missing_access_variants,['GREEN_CARPET_1600']);
 assert.equal(Gate.evaluate({...base,candidate_queue_readback:[{...partial,access_variants:['FAN_ZONE_400','GREEN_CARPET_1600']}]}).complete,true);
});
test('audited discovery does not accept unverified readback, incomplete identity, or another date',()=>{
 const base={discovery:{...discovery,audit_required:true},candidates:[completeCandidate],
  audit_discovery_leads:[launchLead],final_report_ready:true};
 assert.equal(Gate.evaluate({...base,candidate_queue_readback:[launchQueue]}).complete,false);
 assert.equal(Gate.evaluate({...base,candidate_queue_readback_verified:true,
  candidate_queue_readback:[{...launchQueue,event_date:'2026-11-05'}]}).complete,false);
 assert.equal(Gate.evaluate({...base,audit_discovery_leads:[{title:'',event_date:''}],
  candidate_queue_readback_verified:true,candidate_queue_readback:[]}).complete,false);
});
test('safe terminal with exact identity is permitted but an unresolved HOLD is not',()=>{
 const input={discovery:{...discovery,audit_required:true},candidates:[],
  verified_candidate_count:1,audit_discovery_leads:[launchLead],
  final_report_ready:true};
 const ok=Gate.evaluate({...input,terminal_dispositions:[
  {event_id:launchLead.event_id,event_date:launchLead.event_date,status:'SKIPPED_FULL_BOOKING_DATE'}]});
 assert.equal(ok.complete,true);
 const no=Gate.evaluate({...input,terminal_dispositions:[
  {event_id:launchLead.event_id,event_date:launchLead.event_date,status:'HOLD_AMBIGUOUS_EXISTING'}]});
 assert.equal(no.complete,false);
 assert.ok(no.blockers.includes('AUDIT_LEAD_TO_CANDIDATE_RECONCILIATION_INCOMPLETE'));
});
