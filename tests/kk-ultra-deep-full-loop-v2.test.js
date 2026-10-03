'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const P=require('../server/kk-ultra-deep-full-loop-v2-policy.js');
const V2=require('../server/kk-ultra-deep-full-loop-v2.js');

test('any booking locks price even when stock remaining is zero',()=>{
 const x=P.plan({exists_in_canonical:true,booking_count:1,stock_remaining:0,current_price:1290,competitor_prices:[890,990]});
 assert.equal(x.decision,'SKIP_BOOKED');
 assert.equal(x.mutations.length,0);
});
test('hidden tombstone wins over create',()=>{
 const x=P.plan({exists_in_canonical:false,tombstone_locked:true,exact_event_verified:true,latest_official_poster_verified:true,latest_official_poster_url:'https://example.com/a.jpg',governed_fallback_price:690});
 assert.equal(x.decision,'SKIP_HIDDEN');
});
test('unbooked existing event aligns to exact competitor median',()=>{
 const x=P.plan({exists_in_canonical:true,current_price:690,competitor_prices:[790,890,990]});
 assert.equal(x.decision,'UPDATE');
 assert.deepEqual(x.mutations[0],{type:'UPDATE_PRICE',from:690,to:890,evidence:'FRESH_EXACT_EVENT_COMPETITOR_MEDIAN'});
});
test('new event holds without verified official poster',()=>{
 const x=P.plan({exists_in_canonical:false,exact_event_verified:true,competitor_prices:[690,890]});
 assert.equal(x.decision,'HOLD');
 assert.ok(x.holds.includes('VERIFIED_OFFICIAL_POSTER_REQUIRED'));
});
test('new verified event creates with market median',()=>{
 const x=P.plan({exists_in_canonical:false,exact_event_verified:true,latest_official_poster_verified:true,latest_official_poster_url:'https://example.com/p.jpg',competitor_prices:[690,890]});
 assert.equal(x.decision,'CREATE');
 assert.equal(x.mutations[0].price,790);
});
test('COMPLETE requires writes to equal plan and exact readback',()=>{
 const plan=V2.buildPlan({month:'2026-10',candidates:[{exists_in_canonical:true,current_price:690,competitor_prices:[890]}]});
 assert.equal(V2.acceptance(plan,{status:'COMPLETE',production_writes:1},{exact_match:true}).status,'COMPLETE');
 assert.equal(V2.acceptance(plan,{status:'COMPLETE',production_writes:1},{exact_match:false}).status,'INCOMPLETE');
});
