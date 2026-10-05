'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../server/kk-ultra-deep-phase1-controller.js');
const families=['TICKETING','ORGANIZER_PROMOTER','VENUE','ARTIST_SCHEDULE','BRAND_SOCIAL','FESTIVAL','BROAD_LIVE'];
const receipts=families.map(f=>({family:f,executed:true}));
const signals={fandom_strength:70,camera_value:80,social_demand:70,event_format:80,historical_similarity:60,venue_attendance:60,competitor_activity:0,operational_feasibility:80,independent_source_count:2,official_source:true,identity_match:true,date_match:true};

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
});
test('bounded learning stops fail-closed instead of looping forever',()=>{
 const out=C.next({round:3,max_rounds:3,receipts,candidates:[],discovery_pool_preserved:true,deterministic_dedup_passed:true,full_pool_confidence_scored:true,known_positive_backtest_executed:true,known_positive_misses:[{title:'Still missing',event_date:'2026-10-20'}]});
 assert.equal(out.status,'PHASE1_HOLD');
 assert.equal(out.next_action,'STOP_AND_REPORT_EXTERNAL_SOURCE_UNRESOLVED');
});
