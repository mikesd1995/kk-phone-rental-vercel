'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../server/kk-ultra-deep-phase1-controller.js');
const families=['TICKETING','ORGANIZER_PROMOTER','VENUE','ARTIST_SCHEDULE','BRAND_SOCIAL','FESTIVAL','BROAD_LIVE'];
const receipts=families.map(f=>({family:f,executed:true}));
const signals={fandom_strength:70,camera_value:80,social_demand:70,event_format:80,historical_similarity:60,venue_attendance:60,competitor_activity:0,operational_feasibility:80,independent_source_count:2,official_source:true,identity_match:true,date_match:true,source_url:'https://example.com/event'};

test('dedup is deterministic on date and normalized title',()=>{
 const out=C.dedup([{event_date:'2026-10-24',title:'TEEHENG GEN OF US'},{event_date:'2026-10-24',title:'TEEHENG   GEN OF US',organizers:['DeeHupHouse']}]);
 assert.equal(out.length,1);
 assert.deepEqual(out[0].organizers,['DeeHupHouse']);
});
test('miss forces learning recovery and never starts phase 2',()=>{
 const out=C.next({round:1,receipts,candidates:[{event_date:'2026-10-24',title:'TEEHENG',...signals}],discovery_pool_preserved:true,deterministic_dedup_passed:true,full_pool_confidence_scored:true,known_positive_backtest_executed:true,known_positive_misses:[{title:'Example',event_date:'2026-10-07',miss_class:'ORGANIZER_ACCOUNT_TIMELINE_GAP',organizers:['ExampleOrg']}]});
 assert.equal(out.status,'RECOVERY_REQUIRED');
 assert.equal(out.phase2_started,false);
 assert.ok(out.mandatory_expansion.includes('ORGANIZER_ACCOUNT_TIMELINE'));
});
test('cannot pass without backtest and confidence scoring',()=>{
 const out=C.next({receipts,candidates:[{event_date:'2026-10-24',title:'TEEHENG',...signals}],discovery_pool_preserved:true,deterministic_dedup_passed:true});
 assert.equal(out.status,'RECOVERY_REQUIRED');
 assert.ok(out.blockers.includes('KNOWN_POSITIVE_BACKTEST_NOT_EXECUTED'));
 assert.ok(out.blockers.includes('FULL_POOL_CONFIDENCE_INCOMPLETE'));
});
test('passes only with all families, preserved pool, scoring, confidence, backtest and zero misses',()=>{
 const out=C.next({receipts,candidates:[{event_date:'2026-10-24',title:'TEEHENG',...signals}],discovery_pool_preserved:true,deterministic_dedup_passed:true,full_pool_confidence_scored:true,known_positive_backtest_executed:true,known_positive_misses:[]});
 assert.equal(out.status,'PHASE1_ACCEPTED');
 assert.equal(out.next_action,'STOP_AND_REPORT_READY_FOR_OWNER_PHASE2_APPROVAL');
 assert.equal(out.phase2_started,false);
 assert.equal(out.phase1_artifact.frozen,true);
 assert.equal(out.phase1_artifact.candidate_count,1);
 assert.match(out.phase1_artifact.candidate_ids[0],/^P1-[a-f0-9]{18}$/);
 assert.match(out.phase1_artifact.fingerprint,/^[a-f0-9]{64}$/);
});
test('bounded learning stops fail-closed instead of looping forever',()=>{
 const out=C.next({round:3,max_rounds:3,receipts,candidates:[],discovery_pool_preserved:true,deterministic_dedup_passed:true,full_pool_confidence_scored:true,known_positive_backtest_executed:true,known_positive_misses:[{title:'Still missing',event_date:'2026-10-20'}]});
 assert.equal(out.status,'PHASE1_HOLD');
 assert.equal(out.next_action,'STOP_AND_REPORT_EXTERNAL_SOURCE_UNRESOLVED');
});

test('stale single-source status holds for cross-check',()=>{
 const out=C.next({receipts,candidates:[{event_date:'2026-10-24',title:'OMEGA X',...signals,status_evidence:[{status:'UPCOMING',stale:true,current:false}]}],discovery_pool_preserved:true,deterministic_dedup_passed:true,full_pool_confidence_scored:true,known_positive_backtest_executed:true,known_positive_misses:[]});
 assert.equal(out.status,'RECOVERY_REQUIRED');
 assert.ok(out.blockers.includes('STALE_STATUS_REQUIRES_CROSSCHECK'));
});
test('conflicting current status evidence fails closed',()=>{
 const out=C.next({receipts,candidates:[{event_date:'2026-10-30',title:'PiXXiE',...signals,status_evidence:[{status:'UPCOMING',current:true},{status:'CANCELLED',current:true}]}],discovery_pool_preserved:true,deterministic_dedup_passed:true,full_pool_confidence_scored:true,known_positive_backtest_executed:true,known_positive_misses:[]});
 assert.equal(out.status,'RECOVERY_REQUIRED');
 assert.ok(out.blockers.includes('CONFLICTING_CURRENT_STATUS_EVIDENCE'));
});
test('cross-checked stale history with one current status may proceed',()=>{
 const out=C.next({receipts,candidates:[{event_date:'2026-10-24',title:'Example',...signals,status_evidence:[{status:'UPCOMING',stale:true,current:false},{status:'CANCELLED',current:true}]}],discovery_pool_preserved:true,deterministic_dedup_passed:true,full_pool_confidence_scored:true,known_positive_backtest_executed:true,known_positive_misses:[]});
 assert.equal(out.status,'PHASE1_ACCEPTED');
});

test('stale status failure automatically teaches status recovery strategy',()=>{
 const out=C.next({receipts,candidates:[{event_date:'2026-10-24',title:'OMEGA X',...signals,status_evidence:[{status:'UPCOMING',stale:true,current:false}]}],discovery_pool_preserved:true,deterministic_dedup_passed:true,full_pool_confidence_scored:true,known_positive_backtest_executed:true,known_positive_misses:[]});
 assert.ok(out.status_learning_misses.some(x=>x.miss_class==='STALE_LISTING_GAP'));
 assert.ok(out.mandatory_expansion.includes('CURRENT_STATUS_OFFICIAL_CROSSCHECK'));
 assert.ok(out.mandatory_expansion.includes('CANCELLATION_POSTPONEMENT_SWEEP'));
});

test('soft Phase 1 completeness gaps do not block Phase 2 read-only verification',()=>{
 const gate=C.phase2ReadOnlyGate({blockers:['KNOWN_POSITIVE_RECALL_BELOW_100','FULL_POOL_CONFIDENCE_INCOMPLETE','LEARNING:KNOWN_MISS_REGRESSION_NOT_PASSED']});
 assert.equal(gate.allowed,true);
 assert.equal(gate.mode,'PHASE2_READ_ONLY_ALLOWED');
 assert.equal(gate.mutation_allowed,false);
});
test('candidate preservation or dedup safety failure still blocks Phase 2',()=>{
 const gate=C.phase2ReadOnlyGate({blockers:['DISCOVERY_POOL_NOT_PRESERVED','DETERMINISTIC_DEDUP_NOT_PASSED']});
 assert.equal(gate.allowed,false);
 assert.equal(gate.mode,'PHASE2_BLOCKED');
});


test('accepted Phase 1 refuses handoff artifact without source provenance',()=>{
 const noSource={...signals}; delete noSource.source_url;
 const out=C.next({receipts,candidates:[{event_date:'2026-10-24',title:'NO SOURCE',...noSource}],discovery_pool_preserved:true,deterministic_dedup_passed:true,full_pool_confidence_scored:true,known_positive_backtest_executed:true,known_positive_misses:[]});
 assert.equal(out.status,'RECOVERY_REQUIRED');
 assert.equal(out.phase1_artifact.frozen,false);
 assert.ok(out.blockers.includes('PHASE1_ARTIFACT:CANDIDATE_SOURCE_PROVENANCE_REQUIRED'));
 assert.equal(out.phase2_started,false);
});
