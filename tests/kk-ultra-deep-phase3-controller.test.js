'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const P=require('../server/kk-ultra-deep-phase3-controller.js');

const accepted={status:'PHASE2_ACCEPTED',ready_for_phase3:true,production_writes:0,phase3_started:false};

test('official Phase3 fails closed until Phase2 accepted',()=>{
 const r=P.evaluate({phase2:{status:'PHASE2_HOLD'},candidates:[{candidate_id:'c1'}]});
 assert.equal(r.status,'PHASE3_BLOCKED');assert.ok(r.blockers.includes('PHASE2_ACCEPTED_REQUIRED'));assert.equal(r.production_writes,0);
});

test('diagnostic preflight can test pricing without crossing phase boundary',()=>{
 const r=P.evaluate({candidates:[{candidate_id:'c1',phase2_disposition:'VERIFIED'}]},{diagnostic_only:true});
 assert.equal(r.status,'PHASE3_ACCEPTED');assert.equal(r.ready_for_phase4,false);assert.equal(r.results[0].price_source,'BASE_690_890');
});

test('exact competitor median becomes target price',()=>{
 const r=P.evaluate({phase2:accepted,candidates:[{candidate_id:'c1',phase2_disposition:'VERIFIED'}],competitor_prices:[
  {event_key:'c1',competitor_id:'a',package_type:'PHONE_ONLY',price:790,source_url:'https://x.com/a/1',exact_event:true},
  {event_key:'c1',competitor_id:'b',package_type:'PHONE_ONLY',price:890,source_url:'https://x.com/b/1',exact_event:true}
 ]});
 assert.equal(r.status,'PHASE3_ACCEPTED');assert.equal(r.results[0].target_prices.phone,840);assert.equal(r.results[0].target_prices.bundle,1040);
});

test('booking locks current price and never reprices',()=>{
 const r=P.evaluate({phase2:accepted,candidates:[{candidate_id:'c1',phase2_disposition:'VERIFIED',booking_count:1,current_prices:{phone:590,bundle:790}}],competitor_prices:[
  {event_key:'c1',competitor_id:'a',package_type:'PHONE_ONLY',price:990,source_url:'https://x.com/a/1',exact_event:true}
 ]});
 assert.equal(r.results[0].status,'PRICE_LOCKED_BOOKING');assert.equal(r.results[0].target_prices.phone,590);
});

test('booking without canonical current price fails closed',()=>{
 const r=P.evaluate({phase2:accepted,candidates:[{candidate_id:'c1',phase2_disposition:'VERIFIED',booking_count:1}]});
 assert.equal(r.status,'PHASE3_HOLD');assert.equal(r.results[0].reason,'BOOKED_PRICE_SOT_REQUIRED');
});

test('fallback order comparable then prior month then base',()=>{
 let r=P.evaluate({phase2:accepted,candidates:[{candidate_id:'c1',phase2_disposition:'VERIFIED',comparable_prices:[{price:790}]}]});
 assert.equal(r.results[0].price_source,'COMPARABLE_EVENT_MEDIAN');assert.equal(r.results[0].target_prices.phone,790);
 r=P.evaluate({phase2:accepted,candidates:[{candidate_id:'c1',phase2_disposition:'VERIFIED',prior_month_comparable_prices:[{price:890}]}]});
 assert.equal(r.results[0].price_source,'PRIOR_MONTH_COMPARABLE_MEDIAN');assert.equal(r.results[0].target_prices.phone,890);
 r=P.evaluate({phase2:accepted,candidates:[{candidate_id:'c1',phase2_disposition:'VERIFIED'}]});
 assert.equal(r.results[0].price_source,'BASE_690_890');assert.deepEqual(r.results[0].target_prices,{phone:690,bundle:890,lens:200});
});

test('demand/seatmap adjustment is bounded and only applies after base fallback',()=>{
 const r=P.evaluate({phase2:accepted,candidates:[{candidate_id:'c1',phase2_disposition:'VERIFIED',demand_seatmap_adjustment:1000}]});
 assert.equal(r.results[0].adjustment,400);assert.deepEqual(r.results[0].target_prices,{phone:1090,bundle:1290,lens:200});
});

test('hidden/tombstoned event is never repriced for re-add',()=>{
 const r=P.evaluate({phase2:accepted,candidates:[{candidate_id:'c1',phase2_disposition:'VERIFIED',owner_hidden:true}]});
 assert.equal(r.results[0].status,'SKIP_OWNER_HIDDEN');assert.equal(r.status,'PHASE3_ACCEPTED');
});

test('competitor evidence cannot bleed across candidates',()=>{
 const r=P.evaluate({phase2:accepted,candidates:[
  {candidate_id:'c1',phase2_disposition:'VERIFIED'},
  {candidate_id:'c2',phase2_disposition:'VERIFIED'}
 ],competitor_prices:[
  {event_key:'c1',competitor_id:'a',package_type:'PHONE_ONLY',price:990,source_url:'https://x.com/a/1',exact_event:true}
 ]});
 assert.equal(r.results[0].price_source,'EXACT_EVENT_COMPETITOR_MEDIAN');
 assert.equal(r.results[1].price_source,'BASE_690_890');
});
