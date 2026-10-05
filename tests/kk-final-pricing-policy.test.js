'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const P=require('../server/kk-final-pricing-policy.js');
const V=require('../server/kk-verifier-storefront-promotion.js');

test('approved KK baselines resolve deterministic final prices',()=>{
 const r=P.resolve({store_baseline_prices:[
  {template_id:'PHONE',price:690,approved:true},
  {template_id:'LENS',price:200,approved:true},
  {template_id:'BAD',price:1,approved:false}
 ]});
 assert.equal(r.status,'FINAL_PRICES_RESOLVED');
 assert.deepEqual(r.final_prices.map(x=>x.override_price),[690,200]);
 assert.equal(r.competitor_reference_used_as_final,false);
});

test('unapproved baselines cannot auto-final',()=>{
 const r=P.resolve({store_baseline_prices:[{template_id:'PHONE',price:690}]});
 assert.equal(r.status,'HOLD_FOR_APPROVED_BASELINE');
 assert.equal(r.final_prices.length,0);
});

test('promotion can use approved baseline policy without per-event price approval',()=>{
 const candidate={
  status:'READY_FOR_FINAL_VERIFIER',
  title:'THE PINK AURA',
  event_date:'2026-09-28',
  venue:'CentralWorld',
  poster:{selected:{image_url:'https://example.com/poster.jpg'}},
  pricing:{proposal:{proposal_available:true,proposed_reference_price:690,auto_final_price:false}}
 };
 const policy=P.resolve({store_baseline_prices:[
  {template_id:'PHONE',price:690,approved:true},
  {template_id:'LENS',price:200,approved:true}
 ]});
 const r=V.preparePromotion({candidate,final_pricing_policy:policy,verifier_approved:true});
 assert.equal(r.status,'READY_FOR_GOVERNED_ADMIN_CREATE');
 assert.equal(r.admin_payload.event_price_overrides.length,2);
});

test('active 03_Packages templates are authoritative fallback final prices',()=>{
 const r=P.resolve({package_templates:[
  {template_id:'TPL-PHONE',standard_price:890,active:true},
  {template_id:'TPL-LENS',standard_price:390,active:true},
  {template_id:'TPL-BUNDLE',standard_price:1090,active:true},
  {template_id:'OFF',standard_price:1,active:false}
 ]});
 assert.equal(r.status,'FINAL_PRICES_RESOLVED');
 assert.equal(r.source,'KK_ACTIVE_STANDARD_PACKAGE_SOT');
 assert.deepEqual(r.final_prices.map(x=>x.override_price),[890,390,1090]);
 assert.equal(r.competitor_reference_used_as_final,false);
});

test('weekend high-score event with zero exact competitors gets provisional score fallback',()=>{
 const r=P.resolve({
  event_date:'2026-10-24',
  rental_fit_score:9.1,
  pricing:{independent_competitors:0}
 });
 assert.equal(r.status,'FINAL_PRICES_RESOLVED');
 assert.equal(r.source,'KK_RENTAL_FIT_SCORE_FALLBACK');
 assert.equal(r.pricing_status,'PROVISIONAL_NEEDS_PRICE_RECHECK');
 assert.equal(r.needs_price_recheck,true);
 assert.equal(r.price_confidence,'PROVISIONAL');
 assert.deepEqual(r.final_prices.map(x=>x.override_price),[890,200,1090]);
 assert.deepEqual(r.final_prices.map(x=>x.active_override),[true,false,true]);
 assert.ok(r.final_prices.every(x=>x.override_note.includes('PROVISIONAL_NEEDS_PRICE_RECHECK')));
});

test('weekday high-score event with zero exact competitors may use approved score fallback without provisional flag',()=>{
 const r=P.resolve({
  event_date:'2026-10-21',
  rental_fit_score:8.4,
  pricing:{independent_competitors:0}
 });
 assert.equal(r.status,'FINAL_PRICES_RESOLVED');
 assert.equal(r.source,'KK_RENTAL_FIT_SCORE_FALLBACK');
 assert.equal(r.pricing_status,'APPROVED_SCORE_FALLBACK');
 assert.equal(r.needs_price_recheck,false);
 assert.deepEqual(r.final_prices.map(x=>x.override_price),[790,200,990]);
 assert.deepEqual(r.final_prices.map(x=>x.active_override),[true,false,true]);
});

test('score below publish threshold does not create score fallback prices',()=>{
 const r=P.resolve({
  event_date:'2026-10-24',
  rental_fit_score:6.9,
  pricing:{independent_competitors:0}
 });
 assert.equal(r.status,'HOLD_FOR_APPROVED_BASELINE');
 assert.equal(r.final_prices.length,0);
});

test('exact competitor evidence drives market-aligned phone and bundle prices',()=>{
 const r=P.resolve({
  event_date:'2026-10-24',
  rental_fit_score:9.4,
  pricing:{
   independent_competitors:2,
   evidence:[
    {package_type:'PHONE_ONLY',price:690},
    {package_type:'PHONE_LENS',price:990}
   ]
  },
  package_templates:[
   {template_id:'PHONE',package_type:'phone_only',standard_price:890,active:true},
   {template_id:'LENS',package_type:'lens_only',standard_price:200,active:false},
   {template_id:'BUNDLE',package_type:'phone_lens_bundle',standard_price:1090,active:true}
  ]
 });
 assert.equal(r.source,'EXACT_EVENT_COMPETITOR_MEDIAN');
 assert.equal(r.needs_price_recheck,false);
 assert.equal(r.pricing_status,'APPROVED_EXACT_EVENT_MEDIAN');
 assert.equal(r.competitor_reference_used_as_final,true);
 assert.deepEqual(r.final_prices.map(x=>x.override_price),[740,200,940]);
});


test('accepted Phase3 price decision is preserved exactly and not recomputed',()=>{
 const r=P.resolve({
  phase3_price_decision:{
   status:'PRICE_READY',
   price_source:'COMPARABLE_EVENT_MEDIAN',
   price_confidence:'MEDIUM_LOW',
   target_prices:{phone:790,bundle:990,lens:200}
  },
  pricing:{independent_competitors:9,evidence:[
   {package_type:'PHONE_ONLY',price:1290},
   {package_type:'PHONE_ONLY',price:1390}
  ]}
 });
 assert.equal(r.source,'PHASE3_LOCKED_TARGET');
 assert.equal(r.upstream_price_source,'COMPARABLE_EVENT_MEDIAN');
 assert.deepEqual(r.final_prices.map(x=>x.override_price),[790,200,990]);
 assert.equal(r.needs_price_recheck,false);
});

test('booked Phase3 price lock remains unchanged downstream',()=>{
 const r=P.resolve({
  phase3_price_decision:{
   status:'PRICE_LOCKED_BOOKING',
   price_source:'CURRENT_BOOKED_PRICE',
   target_prices:{phone:590,bundle:790,lens:200}
  }
 });
 assert.equal(r.source,'PHASE3_LOCKED_TARGET');
 assert.deepEqual(r.final_prices.map(x=>x.override_price),[590,200,790]);
});
