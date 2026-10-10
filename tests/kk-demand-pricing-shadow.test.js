'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const S=require('../server/kk-demand-pricing-shadow.js');
const Registry=require('../server/kk-agent-registry.js');
const Router=require('../server/kk-agent-task-router.js');
const mkSignals=(f=86,p=72,t=74,q=82)=>({
 fandom_photo_intent:{score:f,verified:true,source_url:'https://example.org/fandom',observed_at:'2026-10-10'},
 public_engagement:{score:p,verified:true,source_url:'https://example.org/post',observed_at:'2026-10-10'},
 ticket_demand:{score:t,verified:true,source_url:'https://example.org/tickets',observed_at:'2026-10-10'},
 qualified_inquiry_intent:{score:q,verified:true,source_ref:'KK_ANON_AGGREGATE',observed_at:'2026-10-10'}
});
const base=()=>({event_id:'EVT-TEST-TT-20261014',event_date:'2026-10-14',
 event_verified:true,available_inventory:2,
 current_phone_price:590,current_bundle_price:790,
 independent_competitors:0,competitor_market_status:'NO_COMPETITOR_FOUND',
 signals:mkSignals(),completed_history:[
 {event_id:'EVT-20260912-TT',event_date:'2026-09-12',booking_status:'completed',
  paid_phone_price:790,verified:true,comparable_verified:true,source_ref:'BOOKING_AGG_001'},
 {event_id:'EVT-20260920-TT',event_date:'2026-09-20',booking_status:'completed',
  paid_phone_price:790,verified:true,comparable_verified:true,source_ref:'BOOKING_AGG_002'}
 ]});
test('weekday strong fandom can propose higher than current weekday price',()=>{
 const r=S.propose(base());
 assert.equal(r.status,'SHADOW_PRICE_PROPOSAL_OWNER_REVIEW');
 assert.equal(r.price_basis.used_weekday_multiplier,false);
 assert.ok(r.suggested_prices.phone>=790);
 assert.equal(r.suggested_prices.bundle-r.suggested_prices.phone,200);
 assert.equal(r.current_prices.phone,590);
 assert.equal(r.existing_prices_preserved,true);
 assert.equal(r.production_writes,0);
 assert.equal(r.owner_approval_required,true);
 assert.equal(r.model_type,'ZERO_COST_EVIDENCE_WEIGHTED_HEURISTIC_NOT_TRAINED_AI');
});
test('date weekday/weekend does not influence identical event evidence proposal',()=>{
 const thu=S.propose({...base(),event_date:'2026-10-15'});
 const sat=S.propose({...base(),event_date:'2026-10-17'});
 assert.deepEqual(thu.suggested_prices,sat.suggested_prices);
 assert.equal(thu.demand_score,sat.demand_score);
});
test('zero or dubious evidence fails closed, no invented proposal',()=>{
 const r=S.propose({...base(),signals:{fandom_photo_intent:{score:99}}});
 assert.equal(r.status,'HOLD_INSUFFICIENT_DEMAND_EVIDENCE');
 assert.equal(r.suggested_prices,null);
 assert.equal(r.production_writes,0);
});
test('one or two competitors always report raw prices and wait for owner',()=>{
 for(const n of [1,2]){
  const r=S.propose({...base(),independent_competitors:n,competitor_evidence:[
   {shop:'A',package_type:'PHONE_ONLY',price:890,source_url:'https://example.org/a'},
   ...(n===2?[{shop:'B',package_type:'BUNDLE',price:1090,source_url:'https://example.org/b'}]:[])
  ]});
  assert.equal(r.status,'HOLD_COMPETITOR_QUOTES_OWNER_DECISION');
  assert.equal(r.suggested_prices,null);
  assert.equal(r.production_writes,0);
  assert.equal(r.competitor_quotes.length,n);
  assert.equal(r.competitor_quotes[0].phone_price,890);
  assert.equal(r.competitor_quotes[0].bundle_price,null);
 }
});
test('detected competitor without a readable price never treated as no-competitor',()=>{
 const r=S.propose({...base(),independent_competitors:0,
  competitor_market_status:'COMPETITOR_FOUND_NO_VALID_QUOTE'});
 assert.equal(r.status,'HOLD_COMPETITOR_QUOTES_OWNER_DECISION');
 assert.equal(r.production_writes,0);
});
test('three shops with only 2 verifiable price quotes must HOLD',()=>{
 const r=S.propose({...base(),independent_competitors:3,competitor_evidence:[
  {shop:'A',package_type:'PHONE_ONLY',price:890},
  {shop:'B',package_type:'PHONE_ONLY',price:990}
 ]});
 assert.equal(r.status,'HOLD_COMPETITOR_EVIDENCE_INCOMPLETE');
 assert.equal(r.suggested_prices,null);
});
test('owner locks, booking-day locks, tombstones and inventory collisions take precedence',()=>{
 for(const [key,expected] of [
  ['has_active_booking_on_date','HOLD_BOOKING_DATE_PRICE_LOCK'],
  ['owner_hidden','HOLD_OWNER_HIDDEN_TOMBSTONE'],
  ['tombstone_locked','HOLD_OWNER_HIDDEN_TOMBSTONE'],
  ['owner_price_locked','HOLD_OWNER_FINAL_PRICE_LOCK'],
  ['inventory_conflict','HOLD_NO_INVENTORY_OR_COLLISION']]){
  const r=S.propose({...base(),[key]:true});
  assert.equal(r.status,expected,key);
  assert.equal(r.suggested_prices,null);
  assert.equal(r.production_writes,0);
 }
 assert.equal(S.propose({...base(),available_inventory:0}).status,'HOLD_NO_INVENTORY_OR_COLLISION');
});
test('invalid date or event identity and unverified event fail closed',()=>{
 assert.equal(S.propose({...base(),event_date:'2026-10-32'}).status,'HOLD_EVENT_IDENTITY_DATE_REQUIRED');
 assert.equal(S.propose({...base(),event_verified:false}).status,'HOLD_EVENT_NOT_VERIFIED');
});
test('cost floor never knowingly undercut',()=>{
 const r=S.propose({...base(),minimum_viable_phone_price:1290});
 assert.equal(r.status,'HOLD_BELOW_VERIFIED_PRICE_FLOOR');
 assert.equal(r.production_writes,0);
});
test('historical observation requires completed, verified and independent comparable event',()=>{
 const history=[
 {event_id:'other',event_date:'2026-09-12',paid_phone_price:990,verified:true,comparable_verified:true,booking_status:'completed',source_ref:'AGG'},
 {event_id:'other2',event_date:'2026-09-10',paid_phone_price:1390,verified:true,comparable_verified:true,booking_status:'cancelled',source_ref:'AGG'},
 {event_id:'EVT-TEST-TT-20261014',event_date:'2026-10-14',paid_phone_price:1290,verified:true,comparable_verified:true,booking_status:'completed',source_ref:'AGG'},
 {event_id:'another',event_date:'2026-09-02',paid_phone_price:1190,verified:true,comparable_verified:false,booking_status:'completed',source_ref:'AGG'}
 ];
 assert.equal(S.verifiedPaidHistory(history,'EVT-TEST-TT-20261014').length,1);
});
test('learning is observational and never claims profit causality or auto-trains',()=>{
 const r=S.learn({proposal:S.propose(base()),outcomes:[
  {event_id:'EVT-TEST-TT-20261014',booking_status:'completed',paid_price:790,verified:true,source_ref:'AGG1'},
  {event_id:'EVT-TEST-TT-20261014',booking_status:'cancelled',paid_price:990,verified:true,source_ref:'AGG2'},
  {event_id:'EVT-TEST-TT-20261014',booking_status:'no_show',paid_price:1290,verified:true,source_ref:'AGG3'}
 ]});
 assert.equal(r.observed_completed_gross,790);
 assert.equal(r.completed_count,1);
 assert.equal(r.excluded_cancelled_or_no_show,2);
 assert.equal(r.causal_price_lift_claim,false);
 assert.equal(r.trained_model_updated,false);
 assert.equal(r.learning_writes,0);
 assert.equal(r.production_writes,0);
 assert.equal(r.status,'INSUFFICIENT_OBSERVED_OUTCOMES');
});
test('agent registry routes are owner-review read-only with matching agent contract',async()=>{
 const x=Registry.routeForIntent('demand_pricing_shadow');
 const y=Registry.routeForIntent('learn_demand_pricing_outcome');
 assert.equal(x.owner_review_required,true);
 assert.equal(y.owner_review_required,true);
 const result=await Router.executeTask('demand_pricing_shadow',base());
 assert.equal(result.result.status,'SHADOW_PRICE_PROPOSAL_OWNER_REVIEW');
 assert.equal(result.result.production_writes,0);
 assert.equal(Registry.validateInvocation('demand_pricing_shadow',result.invoked_agents).pass,true);
 const learning=await Router.executeTask('learn_demand_pricing_outcome',{proposal:result.result,outcomes:[]});
 assert.equal(learning.result.learning_writes,0);
 assert.equal(Registry.validateInvocation('learn_demand_pricing_outcome',learning.invoked_agents).pass,true);
});
