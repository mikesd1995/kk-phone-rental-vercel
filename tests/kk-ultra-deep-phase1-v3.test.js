'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const R=require('../server/kk-ultra-deep-rentability-score.js');
const V3=require('../server/kk-ultra-deep-v3.js');

test('rentability never owns candidate deletion',()=>{
 const out=R.qualify({title:'generic community event',fandom_strength:1,camera_value:1,social_demand:1,event_format:1,historical_similarity:1,venue_attendance:1,competitor_activity:0,operational_feasibility:50});
 assert.equal(out.decision,'HOLD_VISIBLE');
 assert.equal(out.discovery_preserved,true);
 assert.equal(out.may_drop_candidate,false);
});
test('direct rental-intent language boosts a brand event',()=>{
 const base={fandom_strength:60,camera_value:80,social_demand:60,event_format:70,historical_similarity:50,venue_attendance:40,competitor_activity:0,operational_feasibility:80};
 assert.ok(R.score({...base,title:'Lucky Fan selected fans with artist'}).total>R.score({...base,title:'generic event'}).total);
});
test('known booking always proceeds to Phase 2 regardless of score',()=>{
 const out=R.qualify({known_booking:true});
 assert.equal(out.decision,'PHASE2_MANDATORY');
 assert.equal(out.phase2_recommended,true);
});
test('confidence is independent from rentability',()=>{
 const out=R.priority({fandom_strength:90,camera_value:90,official_source:false,independent_source_count:0});
 assert.ok(out.rentability.total>out.discovery_confidence.total);
});
test('Phase 1 holds if a source family was not executed',()=>{
 const families=['TICKETING','ORGANIZER_PROMOTER','VENUE','ARTIST_SCHEDULE','BRAND_SOCIAL','FESTIVAL'];
 const receipts=families.map(f=>({family:f,executed:true}));
 const out=V3.phase1Acceptance({receipts,discovery_pool_preserved:true,deterministic_dedup_passed:true});
 assert.equal(out.status,'PHASE1_HOLD');
 assert.ok(out.blockers.includes('MISSING_DISCOVERY_FAMILY:BROAD_LIVE'));
});
test('Phase 1 passes only after all families ran and discovery was preserved',()=>{
 const families=['TICKETING','ORGANIZER_PROMOTER','VENUE','ARTIST_SCHEDULE','BRAND_SOCIAL','FESTIVAL','BROAD_LIVE'];
 const out=V3.phase1Acceptance({receipts:families.map(f=>({family:f,executed:true})),discovery_pool_preserved:true,deterministic_dedup_passed:true,scoring_used_as_discovery_filter:false});
 assert.equal(out.status,'PHASE1_DISCOVERY_COMPLETE');
});
test('recursive expansion is bounded to three hops',()=>{
 const out=V3.recursiveExpansion({artists:['TeeTeePor'],brands:['RYO']},{max_depth:99});
 assert.equal(out.max_depth,3);
 assert.equal(out.tasks.length,6);
});
