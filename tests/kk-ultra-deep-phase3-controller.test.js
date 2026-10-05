'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const P=require('../server/kk-ultra-deep-phase3-controller.js');
const A=require('../server/kk-ultra-deep-phase2-artifact.js');

function phase2Artifact(ids=['c1']){
 return A.freezePhase2({
  status:'PHASE2_ACCEPTED',ready_for_phase3:true,production_writes:0,phase3_started:false,
  month:'2026-10',phase1_fingerprint:'phase1-fingerprint',accepted_at:'2026-10-05T14:00:00Z',
  results:ids.map(id=>({candidate_id:id,title:'Event '+id,event_date:'2026-10-20',venue:'Hall',disposition:'VERIFIED',evidence:['https://official.example/'+id]}))
 });
}
function officialInput(candidates,extra={}){
 return {phase2:{status:'PHASE2_ACCEPTED',ready_for_phase3:true,production_writes:0,phase3_started:false},phase2_artifact:phase2Artifact(candidates.map(x=>x.candidate_id)),candidates,...extra};
}
const fresh='2026-10-04T12:00:00Z';

test('official Phase3 fails closed until Phase2 artifact is accepted',()=>{
 const r=P.evaluate({phase2:{status:'PHASE2_ACCEPTED',ready_for_phase3:true,production_writes:0,phase3_started:false},candidates:[{candidate_id:'c1'}]});
 assert.equal(r.status,'PHASE3_BLOCKED');assert.ok(r.blockers.includes('PHASE2_ARTIFACT_REQUIRED'));assert.equal(r.production_writes,0);
});

test('exact Phase2 to Phase3 candidate set mismatch fails closed',()=>{
 const artifact=phase2Artifact(['c1']);
 const r=P.evaluate({phase2:{status:'PHASE2_ACCEPTED',ready_for_phase3:true,production_writes:0,phase3_started:false},phase2_artifact:artifact,candidates:[{candidate_id:'c2'}]});
 assert.equal(r.status,'PHASE3_BLOCKED');assert.ok(r.blockers.includes('PHASE2_PHASE3_CANDIDATE_SET_MISMATCH'));
});

test('diagnostic preflight can test pricing without crossing phase boundary',()=>{
 const r=P.evaluate({candidates:[{candidate_id:'c1',phase2_disposition:'VERIFIED'}]},{diagnostic_only:true});
 assert.equal(r.status,'PHASE3_ACCEPTED');assert.equal(r.ready_for_phase4,false);assert.equal(r.results[0].price_source,'BASE_690_890');
});

test('fresh exact competitor median becomes target price',()=>{
 const r=P.evaluate(officialInput([{candidate_id:'c1',phase2_disposition:'VERIFIED'}],{now:'2026-10-05T12:00:00Z',competitor_prices:[
  {event_key:'c1',competitor_id:'a',package_type:'PHONE_ONLY',price:790,source_url:'https://x.com/a/status/1',source_published_at:fresh,semantic_confidence:'HIGH',exact_event:true},
  {event_key:'c1',competitor_id:'b',package_type:'PHONE_ONLY',price:890,source_url:'https://x.com/b/status/2',source_published_at:fresh,semantic_confidence:'HIGH',exact_event:true}
 ]}));
 assert.equal(r.status,'PHASE3_ACCEPTED');assert.equal(r.results[0].target_prices.phone,840);assert.equal(r.results[0].target_prices.bundle,1040);
});

test('exact evidence without candidate identity cannot bleed into another event',()=>{
 const r=P.evaluate(officialInput([{candidate_id:'c1',phase2_disposition:'VERIFIED'}],{now:'2026-10-05T12:00:00Z',competitor_prices:[
  {competitor_id:'a',package_type:'PHONE_ONLY',price:990,source_url:'https://x.com/a/status/1',source_published_at:fresh,semantic_confidence:'HIGH',exact_event:true}
 ]}));
 assert.equal(r.results[0].price_source,'BASE_690_890');
 assert.ok(r.learning_misses.some(x=>x.miss_class==='COMPETITOR_IDENTITY_GAP'));
});

test('stale and unknown-timestamp prices are excluded from current exact median',()=>{
 const r=P.evaluate(officialInput([{candidate_id:'c1',phase2_disposition:'VERIFIED'}],{now:'2026-10-05T12:00:00Z',competitor_prices:[
  {event_key:'c1',competitor_id:'a',package_type:'PHONE_ONLY',price:990,source_url:'https://x.com/a/status/1',source_published_at:'2026-08-01T00:00:00Z',semantic_confidence:'HIGH',exact_event:true},
  {event_key:'c1',competitor_id:'b',package_type:'PHONE_ONLY',price:890,source_url:'https://x.com/b/status/2',semantic_confidence:'HIGH',exact_event:true}
 ]}));
 assert.equal(r.results[0].price_source,'BASE_690_890');
 assert.ok(r.learning_misses.some(x=>x.miss_class==='STALE_PRICE_GAP'));
 assert.ok(r.learning_misses.some(x=>x.miss_class==='PRICE_FRESHNESS_UNKNOWN'));
});

test('booking lock uses max normalized event/date counts even when booking_count is string zero',()=>{
 const r=P.evaluate(officialInput([{candidate_id:'c1',phase2_disposition:'VERIFIED',booking_count:'0',date_booking_count:1,current_prices:{phone:590,bundle:790}}]));
 assert.equal(r.results[0].status,'PRICE_LOCKED_BOOKING');assert.equal(r.results[0].booking_count,1);assert.equal(r.results[0].target_prices.phone,590);
});

test('booking without canonical current price fails closed',()=>{
 const r=P.evaluate(officialInput([{candidate_id:'c1',phase2_disposition:'VERIFIED',booking_count:1}]));
 assert.equal(r.status,'PHASE3_HOLD');assert.equal(r.results[0].reason,'BOOKED_PRICE_SOT_REQUIRED');
});

test('comparable fallback requires provenance and similarity score',()=>{
 const candidate={candidate_id:'c1',phase2_disposition:'VERIFIED',artist:['A'],fandom:['F'],event_type:'FANMEETING',venue_capacity:3000,seat_map_class:'HALL'};
 const good={price:790,source_url:'https://evidence.example/ref',artist:['A'],fandom:['F'],event_type:'FANMEETING',venue_capacity:3200,seat_map_class:'HALL'};
 const bad={price:1290,source_url:'https://evidence.example/bad',artist:['Z'],fandom:['Z'],event_type:'FESTIVAL',venue_capacity:50000,seat_map_class:'STADIUM'};
 const r=P.evaluate(officialInput([candidate],{}));
 const r2=P.evaluate(officialInput([{...candidate,comparable_prices:[good,bad]}]));
 assert.equal(r.results[0].price_source,'BASE_690_890');
 assert.equal(r2.results[0].price_source,'COMPARABLE_EVENT_MEDIAN');assert.equal(r2.results[0].target_prices.phone,790);
 assert.equal(r2.results[0].comparable_evidence.length,1);
});

test('prior month comparable follows comparable ladder before base',()=>{
 const candidate={candidate_id:'c1',phase2_disposition:'VERIFIED',artist:['A'],event_type:'CONCERT',prior_month_comparable_prices:[
  {price:890,source_url:'https://evidence.example/prior',artist:['A'],event_type:'CONCERT'}
 ]};
 const r=P.evaluate(officialInput([candidate]));
 assert.equal(r.results[0].price_source,'PRIOR_MONTH_COMPARABLE_MEDIAN');assert.equal(r.results[0].target_prices.phone,890);
});

test('demand/seatmap adjustment is ignored unless signal is verified',()=>{
 let r=P.evaluate(officialInput([{candidate_id:'c1',phase2_disposition:'VERIFIED',demand_seatmap_adjustment:400}]));
 assert.equal(r.results[0].adjustment,0);assert.equal(r.results[0].target_prices.phone,690);
 r=P.evaluate(officialInput([{candidate_id:'c1',phase2_disposition:'VERIFIED',demand_seatmap_adjustment:1000,demand_signal_verified:true}]));
 assert.equal(r.results[0].adjustment,400);assert.equal(r.results[0].target_prices.phone,1090);
});

test('hidden/tombstoned event is never repriced for re-add',()=>{
 const r=P.evaluate(officialInput([{candidate_id:'c1',phase2_disposition:'VERIFIED',owner_hidden:true}]));
 assert.equal(r.results[0].status,'SKIP_OWNER_HIDDEN');assert.equal(r.status,'PHASE3_ACCEPTED');
});

test('outlier filtering requires broad sample and keeps median stable',()=>{
 const rows=[590,690,790,890,1990].map((price,i)=>({competitor_id:'c'+i,package_type:'PHONE_ONLY',price,source_url:'https://x.com/c'+i,source_published_at:fresh,freshness:'FRESH'}));
 const p=P.packageMedians(rows);
 assert.equal(p.phone,740);
 assert.equal(p.outliers.length,1);
});
