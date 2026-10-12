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

test('weekend high-score event with no exact competitor listing uses owner 790/990, never score markup',()=>{
 const r=P.resolve({
  event_date:'2026-10-24',
  rental_fit_score:9.1,
  pricing:{independent_competitors:0}
 });
 assert.equal(r.status,'FINAL_PRICES_RESOLVED');
 assert.equal(r.source,'OWNER_WEEKPART_FALLBACK');
 assert.equal(r.pricing_status,'PROVISIONAL_NEEDS_PRICE_RECHECK');
 assert.equal(r.needs_price_recheck,true);
 assert.equal(r.price_confidence,'PROVISIONAL');
 assert.deepEqual(r.final_prices.map(x=>x.override_price),[790,200,990]);
 assert.deepEqual(r.final_prices.map(x=>x.active_override),[true,false,true]);
 assert.ok(r.final_prices.every(x=>x.override_note.includes('PROVISIONAL_NEEDS_PRICE_RECHECK')));
});

test('weekday high-score event with zero exact competitors uses owner weekday price',()=>{
 const r=P.resolve({
  event_date:'2026-10-21',
  rental_fit_score:8.4,
  pricing:{independent_competitors:0}
 });
 assert.equal(r.status,'FINAL_PRICES_RESOLVED');
 assert.equal(r.source,'OWNER_WEEKPART_FALLBACK');
 assert.equal(r.pricing_status,'PROVISIONAL_NEEDS_PRICE_RECHECK');
 assert.equal(r.needs_price_recheck,true);
 assert.deepEqual(r.final_prices.map(x=>x.override_price),[490,200,590]);
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
 const r=P.resolve({event_date:'2026-10-24',rental_fit_score:9.4,
  store_baseline_prices:[{template_id:'PHONE',price:790,approved:true}],
  pricing:{independent_competitors:2,evidence:[
   {shop:'shop-a',package_type:'PHONE_ONLY',price:690,post_url:'https://example.com/a'},
   {shop:'shop-b',package_type:'PHONE_LENS',price:990,post_url:'https://example.com/b'}
  ]}});
 assert.equal(r.status,'HOLD_FOR_OWNER_COMPETITOR_PRICE_DECISION');
 assert.equal(r.source,'COMPETITOR_QUOTES_REPORT_ONLY');
 assert.equal(r.requires_per_event_owner_price_decision,true);
 assert.equal(r.competitor_reference_used_as_final,false);
 assert.equal(r.production_writes,0);
 assert.deepEqual(r.final_prices,[]);
 assert.deepEqual(r.competitor_quotes.map(x=>[x.shop,x.phone_price,x.bundle_price,x.source_url]),[
  ['shop-a',690,null,'https://example.com/a'],['shop-b',null,990,'https://example.com/b']]);
 assert.equal(r.existing_prices_preserved,true);
});

test('owner weekpart is calendar-correct for each Nov 2026 weekdays and weekends',()=>{
 const cases=[
  ['2026-11-02',490,590], // Monday
  ['2026-11-03',490,590], // Tuesday
  ['2026-11-04',490,590], // Wednesday
  ['2026-11-05',490,590], // Thursday
  ['2026-11-06',790,990], // Friday, NO competitor found
  ['2026-11-07',790,990], // Saturday, NO competitor found
  ['2026-11-08',790,990], // Sunday, NO competitor found
  ['2026-11-20',790,990],['2026-11-26',490,590],
  ['2026-11-27',790,990],['2026-11-29',790,990]
 ];
 for(const [event_date,phone,bundle] of cases){
  const result=P.resolve({event_date,pricing:{independent_competitors:0},
   rental_fit_score:9.7});
  assert.equal(result.status,'FINAL_PRICES_RESOLVED',event_date);
  assert.equal(result.source,'OWNER_WEEKPART_FALLBACK',event_date);
  assert.equal(result.final_prices[0].override_price,phone,event_date);
  assert.equal(result.final_prices[2].override_price,bundle,event_date);
  assert.equal(result.final_prices[1].active_override,false);
  assert.ok(result.final_prices[0].override_note.includes('NOT_COMPETITOR_MEDIAN'));
  assert.equal(result.needs_price_recheck,true);
 }
});
test('active booking locks ALL price overrides even when inventory remains',()=>{
 const r=P.resolve({event_date:'2026-11-29',has_active_booking_on_date:true,
  rental_fit_score:9.2,pricing:{independent_competitors:0}});
 assert.equal(r.status,'HOLD_BOOKING_DATE_PRICE_LOCK');
 assert.equal(r.final_prices.length,0);
 assert.equal(r.production_writes,0);
});
test('missing reliable exact-event competitor evidence cannot trigger old expensive scored price',()=>{
 const r=P.resolve({event_date:'2026-11-26',rental_fit_score:10,
  pricing:{independent_competitors:5,evidence:[]},
  package_templates:[{template_id:'PHONE',package_type:'phone_only',standard_price:890,active:true},
   {template_id:'BUNDLE',package_type:'phone_lens_bundle',standard_price:1090,active:true}]});
 assert.equal(r.status,'HOLD_FOR_OWNER_COMPETITOR_PRICE_DECISION');
 assert.deepEqual(r.final_prices,[]);
 assert.deepEqual(r.competitor_quotes,[]);
 assert.equal(r.existing_prices_preserved,true);
 assert.equal(r.production_writes,0);
});

test('pricing refuses to invent a calendar price from an invalid date',()=>{
 assert.equal(P.ownerWeekpartFallback({event_date:'2026-11-31'}),null);
 assert.equal(P.ownerWeekpartFallback({event_date:'2026-11'}),null);
});

test('live Google Sheets DD/MM/YYYY dates resolve the identical owner prices',()=>{
 for(const [date,phone,bundle] of [
   ['05/11/2026',490,590],['06/11/2026',790,990],
   ['20/11/2026',790,990],['26/11/2026',490,590],
   ['27/11/2026',790,990],['29/11/2026',790,990]
 ]){
  const result=P.resolve({event_date:date,rental_fit_score:9.8,
   pricing:{independent_competitors:0}});
  assert.equal(result.source,'OWNER_WEEKPART_FALLBACK',date);
  assert.equal(result.final_prices[0].override_price,phone,date);
  assert.equal(result.final_prices[2].override_price,bundle,date);
 }
});

test('invalid nonempty event date holds rather than falling into expensive scored price',()=>{
 const p=P.resolve({event_date:'2026-11-31',rental_fit_score:10,pricing:{independent_competitors:0}});
 assert.equal(p.status,'HOLD_FOR_VALID_EVENT_DATE');
 assert.equal(p.final_prices.length,0);
 assert.equal(p.production_writes,0);
});

test('one verified competing shop is a provisional price reference, NOT a market median',()=>{
 const r=P.resolve({event_date:'2026-11-06',rental_fit_score:8,
  pricing:{independent_competitors:1,evidence:[
   {package_type:'PHONE_ONLY',shop:'shop-a',price:820,post_url:'https://example.com/shop-a',checked_at:'2026-10-10'}
  ]}});
 assert.equal(r.status,'HOLD_FOR_OWNER_COMPETITOR_PRICE_DECISION');
 assert.equal(r.source,'COMPETITOR_QUOTES_REPORT_ONLY');
 assert.equal(r.pricing_status,'OWNER_REVIEW_1_2_COMPETITOR_QUOTES');
 assert.equal(r.requires_per_event_owner_price_decision,true);
 assert.equal(r.needs_price_recheck,true);
 assert.equal(r.competitor_evidence_count,1);
 assert.deepEqual(r.final_prices,[]);
 assert.deepEqual(r.competitor_quotes,[{
  shop:'shop-a',phone_price:820,bundle_price:null,
  source_url:'https://example.com/shop-a',checked_at:'2026-10-10',freshness:''
 }]);
});

test('two independent competing shops give midpoint/range reference without pretending high-confidence median',()=>{
 const r=P.resolve({event_date:'2026-10-17',pricing:{independent_competitors:2,evidence:[
  {package_type:'PHONE_ONLY',shop:'shop-a',price:690},
  {package_type:'PHONE_ONLY',shop:'shop-b',price:990}
 ]}});
 assert.equal(r.status,'HOLD_FOR_OWNER_COMPETITOR_PRICE_DECISION');
 assert.deepEqual(r.competitor_quotes.map(x=>({shop:x.shop,price:x.phone_price})),[
  {shop:'shop-a',price:690},{shop:'shop-b',price:990}]);
 assert.equal(r.competitor_evidence_count,2);
 assert.equal(r.competitor_reference_used_as_final,false);
 assert.equal(r.requires_per_event_owner_price_decision,true);
 assert.deepEqual(r.final_prices,[]);
 assert.equal(r.production_writes,0);
});

test('three independent comparable shops qualify for real median and not a provisional reference',()=>{
 const r=P.resolve({event_date:'2026-10-17',pricing:{independent_competitors:3,evidence:[
  {package_type:'PHONE_ONLY',shop:'shop-a',price:690},
  {package_type:'PHONE_ONLY',shop:'shop-b',price:790},
  {package_type:'PHONE_ONLY',shop:'shop-c',price:990}
 ]}});
 assert.equal(r.source,'EXACT_EVENT_COMPETITOR_MEDIAN');
 assert.equal(r.pricing_status,'APPROVED_EXACT_EVENT_MEDIAN');
 assert.equal(r.needs_price_recheck,false);
 assert.equal(r.price_confidence,'HIGH');
 assert.deepEqual(r.final_prices.map(x=>x.override_price),[790,200,990]);
});

test('reposted quotes from one shop do not inflate the independent shop count',()=>{
 const r=P.resolve({event_date:'2026-10-17',pricing:{independent_competitors:3,evidence:[
  {package_type:'PHONE_ONLY',shop:'shop-a',price:690},
  {package_type:'PHONE_ONLY',shop:'shop-a',price:1190},
  {package_type:'PHONE_ONLY',shop:'shop-b',price:990}
 ]}});
 assert.equal(r.status,'HOLD_FOR_OWNER_COMPETITOR_PRICE_DECISION');
 assert.deepEqual(r.final_prices,[]);
 assert.deepEqual(r.competitor_quotes.map(x=>x.shop),['shop-a','shop-b']);
 assert.equal(r.production_writes,0);
});

test('existing competitor with unpriced or stale offer must NEVER get zero-competitor weekend uplift',()=>{
 const r=P.resolve({event_date:'2026-10-17',pricing:{independent_competitors:1,evidence:[]}});
 assert.equal(r.status,'HOLD_FOR_OWNER_COMPETITOR_PRICE_DECISION');
 assert.equal(r.pricing_status,'COMPETITOR_FOUND_PRICE_EVIDENCE_MISSING');
 assert.deepEqual(r.competitor_quotes,[]);
 assert.deepEqual(r.final_prices,[]);
 assert.equal(r.existing_prices_preserved,true);
 assert.equal(r.production_writes,0);
});

test('owner-approved prices never reprice regardless of competing shop count',()=>{
 const r=P.resolve({event_date:'2026-11-14',owner_price_locked:true,
  pricing:{independent_competitors:1,evidence:[{package_type:'PHONE_ONLY',price:990}]}});
 assert.equal(r.status,'HOLD_OWNER_FINAL_PRICE_LOCK');
 assert.deepEqual(r.final_prices,[]);
 assert.equal(r.production_writes,0);
});

test('competitor search not performed or declared cannot be misclassified as zero competitors',()=>{
 const unknown=P.resolve({event_date:'2026-11-06',rental_fit_score:8.4});
 assert.deepEqual(unknown.final_prices.map(x=>x.override_price),[690,200,890]);
 assert.ok(unknown.final_prices[0].override_note.includes('COMPETITOR_STATUS_UNKNOWN'));
 assert.equal(P.explicitCompetitorCount({}),null);
 assert.equal(P.explicitCompetitorCount({pricing:{independent_competitors:null}}),null);
 const noShop=P.resolve({event_date:'2026-11-06',rental_fit_score:8.4,
  pricing:{independent_competitors:0}});
 assert.deepEqual(noShop.final_prices.map(x=>x.override_price),[790,200,990]);
 assert.ok(noShop.final_prices[0].override_note.includes('NO_COMPETITOR_FOUND'));
});

test('explicit found shop has priority over conflicting zero count; never zero-shop uplift',()=>{
 const r=P.resolve({event_date:'2026-11-06',pricing:{
  independent_competitors:0,
  evidence:[{package_type:'PHONE_ONLY',shop:'shop-a',price:800}]
 }});
 assert.equal(r.status,'HOLD_FOR_OWNER_COMPETITOR_PRICE_DECISION');
 assert.deepEqual(r.final_prices,[]);
 assert.deepEqual(r.competitor_quotes.map(x=>[x.shop,x.phone_price]),[['shop-a',800]]);
 assert.equal(r.production_writes,0);
});

test('one shop quoting both phone and actual bundle uses each advertised price, not assumed lens add-on',()=>{
 const r=P.resolve({event_date:'2026-10-17',pricing:{independent_competitors:1,evidence:[
  {shop:'duen_munk',package_type:'PHONE_ONLY',price:900},
  {shop:'duen_munk',package_type:'BUNDLE',price:1200}
 ]}});
 assert.equal(r.status,'HOLD_FOR_OWNER_COMPETITOR_PRICE_DECISION');
 assert.deepEqual(r.final_prices,[]);
 assert.equal(r.competitor_evidence_count,1);
 assert.deepEqual(r.competitor_quotes.map(x=>[x.shop,x.phone_price,x.bundle_price]),
  [['duen_munk',900,1200]]);
 assert.equal(r.requires_per_event_owner_price_decision,true);
 assert.equal(r.production_writes,0);
});

test('two shops never trigger price change even when store already has 790/990 prices',()=>{
 const r=P.resolve({event_date:'2026-11-27',
  store_baseline_prices:[{template_id:'PHONE',price:790,approved:true},
   {template_id:'BUNDLE',price:990,approved:true}],
  pricing:{independent_competitors:2,evidence:[
   {shop:'A',package_type:'PHONE_ONLY',price:790},
   {shop:'B',package_type:'BUNDLE',price:1190}
  ]}});
 assert.equal(r.status,'HOLD_FOR_OWNER_COMPETITOR_PRICE_DECISION');
 assert.equal(r.existing_prices_preserved,true);
 assert.deepEqual(r.final_prices,[]);
 assert.equal(r.production_writes,0);
});

test('one shop remains a report-only case even if event score is high',()=>{
 const r=P.resolve({event_date:'2026-10-17',rental_fit_score:9.9,
   pricing:{independent_competitors:1,evidence:[{shop:'A',package_type:'BUNDLE',price:990}]}});
 assert.deepEqual(r.final_prices,[]);
 assert.equal(r.production_writes,0);
 assert.equal(r.competitor_quotes[0].bundle_price,990);
 assert.equal(r.competitor_quotes[0].phone_price,null);
});
