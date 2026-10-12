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
test('Sheets boolean/text booking locks and inventory readings cannot bypass Shadow safety',()=>{
 for(const [field,value,expected] of [
  ['has_active_booking_on_date','TRUE','HOLD_BOOKING_DATE_PRICE_LOCK'],
  ['booking_day_locked','1','HOLD_BOOKING_DATE_PRICE_LOCK'],
  ['owner_hidden','YES','HOLD_OWNER_HIDDEN_TOMBSTONE'],
  ['tombstone_locked','true','HOLD_OWNER_HIDDEN_TOMBSTONE'],
  ['owner_price_locked','TRUE','HOLD_OWNER_FINAL_PRICE_LOCK'],
  ['owner_final_price','1','HOLD_OWNER_FINAL_PRICE_LOCK'],
  ['inventory_conflict','TRUE','HOLD_NO_INVENTORY_OR_COLLISION'],
  ['available_inventory','0','HOLD_NO_INVENTORY_OR_COLLISION'],
  ['available_inventory',-1,'HOLD_NO_INVENTORY_OR_COLLISION'],
  ['available_inventory','not-read','HOLD_INVENTORY_NOT_VERIFIED'],
  ['available_inventory',null,'HOLD_INVENTORY_NOT_VERIFIED']
 ]){
  const r=S.propose({...base(),[field]:value});
  assert.equal(r.status,expected,field+'='+String(value));
  assert.equal(r.suggested_prices,null);
  assert.equal(r.production_writes,0);
 }
 assert.equal(S.propose({...base(),available_inventory:'2',
   has_active_booking_on_date:'FALSE',owner_hidden:'FALSE'}).status,
   'SHADOW_PRICE_PROPOSAL_OWNER_REVIEW');
 assert.equal(S.propose({...base(),available_inventory:undefined}).status,
   'HOLD_INVENTORY_NOT_VERIFIED');
});
test('replayed outcome source cannot inflate completed gross or learning confidence',()=>{
 const proposal=S.propose(base());
 const receipt={event_id:proposal.event_id,booking_status:'completed',paid_price:790,
  verified:true,source_ref:'BOOKING_RECEIPT_01'};
 const replayed=S.learn({proposal,outcomes:Array(6).fill(receipt)});
 assert.equal(replayed.outcome_count,1);
 assert.equal(replayed.completed_count,1);
 assert.equal(replayed.observed_completed_gross,790);
 assert.equal(replayed.status,'INSUFFICIENT_OBSERVED_OUTCOMES');
 const distinct=S.learn({proposal,outcomes:[
  {...receipt,booking_id:'BOOKING_01'},
  {...receipt,booking_id:'BOOKING_02'}
 ]});
 assert.equal(distinct.outcome_count,2);
 assert.equal(distinct.observed_completed_gross,1580);
 assert.equal(distinct.production_writes,0);
});
test('formatted Thai baht values preserve existing bundle premium and completed Actual',()=>{
 const r=S.propose({...base(),current_phone_price:'1,090',current_bundle_price:'1,290',
  completed_history:[{event_id:'PRIOR-EVENT',event_date:'2026-09-01',
   booking_status:'completed',paid_phone_price:'1,090',verified:true,
   comparable_verified:true,source_ref:'PAID_OBS_1090'}]});
 assert.equal(r.status,'SHADOW_PRICE_PROPOSAL_OWNER_REVIEW');
 assert.equal(r.current_prices.phone,1090);
 assert.equal(r.current_prices.bundle,1290);
 assert.equal(r.historical_paid_price_median,1090);
 assert.equal(r.suggested_prices.bundle-r.suggested_prices.phone,200);
 const bad=S.propose({...base(),current_phone_price:'1,09',current_bundle_price:'1,290'});
 assert.equal(bad.current_prices.phone,null);
 assert.equal(bad.suggested_prices.bundle,null);
 const learned=S.learn({proposal:r,outcomes:[{event_id:r.event_id,
  booking_status:'completed',paid_price:'1,090',verified:true,source_ref:'REC_1090'}]});
 assert.equal(learned.observed_completed_gross,1090);
 assert.equal(learned.observed_completed_average_paid,1090);
 assert.equal(learned.production_writes,0);
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

test('TeeTeePor prior completed BUNDLE 690 is bundle observation, never phone-only willingness to pay',()=>{
 const history=[
  {event_id:'EVT-20261007-RYO-HAIR-X-TEETEEPOR',booking_id:'BK-20261007-001',
   event_date:'2026-10-07',package_type:'phone_lens_bundle',booking_status:'completed',
   paid_price:690,comparable_verified:true,verified:true,source_ref:'BOOKING_AGG_BK-20261007-001'},
  {event_id:'EVT-20261001-THE-MALL-LIFESTORE-SPORT-DAY-AFTER-MATCH',
   booking_id:'BK-20261001-001',event_date:'2026-10-01',
   package_type:'phone_lens_bundle',booking_status:'completed',paid_price:690,
   comparable_verified:true,verified:true,source_ref:'BOOKING_AGG_BK-20261001-001'}
 ];
 const rows=S.verifiedPaidHistory(history,'EVT-20261028-BENTON-JOURNEY-BACK-TO-GLOW');
 assert.equal(rows.length,2);
 assert.ok(rows.every(r=>r.paid_phone_price===null&&r.paid_bundle_price===690));
 const r=S.propose({...base(),completed_history:history});
 assert.equal(r.status,'SHADOW_PRICE_PROPOSAL_OWNER_REVIEW');
 assert.equal(r.historical_paid_price_median,null);
 assert.equal(r.historical_paid_bundle_median,690);
 assert.equal(r.historical_phone_comparables,0);
 assert.equal(r.historical_bundle_comparables,2);
 assert.equal(r.confidence,'LOW');
 assert.equal(r.existing_prices_preserved,true);
 assert.equal(r.production_writes,0);
});
test('insufficient demand still surfaces verified past bundle evidence without repricing',()=>{
 const history=[{event_id:'EVT-RYO',event_date:'2026-10-07',package_type:'phone_lens_bundle',
  booking_status:'completed',paid_price:690,comparable_verified:true,verified:true,source_ref:'BOOKING_AGG_RYO'}];
 const r=S.propose({...base(),signals:{},completed_history:history});
 assert.equal(r.status,'HOLD_INSUFFICIENT_DEMAND_EVIDENCE');
 assert.equal(r.historical_paid_bundle_median,690);
 assert.equal(r.historical_phone_comparables,0);
 assert.equal(r.suggested_prices,null);
 assert.equal(r.production_writes,0);
});
test('completed learning separates phone and bundle realized revenue, never counts future or cancelled',()=>{
 const proposal={event_id:'EVT-TT'};
 const outcomes=[
  {booking_id:'a',event_id:'EVT-TT',booking_status:'completed',package_type:'phone_only',paid_price:490,verified:true,source_ref:'AGG_A'},
  {booking_id:'b',event_id:'EVT-TT',booking_status:'completed',package_type:'phone_lens_bundle',paid_price:690,verified:true,source_ref:'AGG_B'},
  {booking_id:'c',event_id:'EVT-TT',booking_status:'confirmed',package_type:'phone_lens_bundle',paid_price:1290,verified:true,source_ref:'AGG_C'},
  {booking_id:'d',event_id:'EVT-TT',booking_status:'cancelled',package_type:'phone_only',paid_price:990,verified:true,source_ref:'AGG_D'},
  {booking_id:'b',event_id:'EVT-TT',booking_status:'completed',package_type:'phone_lens_bundle',paid_price:690,verified:true,source_ref:'AGG_B'}
 ];
 const r=S.learn({proposal,outcomes});
 assert.equal(r.observed_completed_gross,1180);
 assert.equal(r.completed_count,2);
 assert.equal(r.completed_by_package.phone_only.observed_paid_median,490);
 assert.equal(r.completed_by_package.phone_lens_bundle.observed_paid_median,690);
 assert.equal(r.completed_by_package.unattributed.completed_count,0);
 assert.equal(r.outcome_count,3);
 assert.equal(r.production_writes,0);
});

test('three claimed shops without dated same-event verified receipts cannot unlock shadow price',()=>{
 const rows=['A','B','C'].map(shop=>({
  shop,package_type:'PHONE_ONLY',price:890,
  source_url:'https://example.org/'+shop
 }));
 const p=S.propose({...base(),independent_competitors:3,competitor_market_status:'COMPETITOR_FOUND',competitor_evidence:rows});
 assert.equal(p.status,'HOLD_COMPETITOR_EVIDENCE_INCOMPLETE');
 assert.equal(p.suggested_prices,null);
 assert.equal(p.production_writes,0);
 assert.equal(p.verified_competitor_quotes.length,0);
});

test('only three distinct exact-event and exact-day independently sourced shops clear evidence gate',()=>{
 const b=base();
 const receipt=(shop)=>({shop,event_id:b.event_id,event_date:b.event_date,
  package_type:'PHONE_ONLY',price:890,
  verified:true,comparable_verified:true,
  source_url:'https://example.org/'+shop,observed_at:'2026-10-10'});
 const rows=[receipt('A'),receipt('A'),receipt('B'),receipt('C')];
 const out=S.propose({...b,independent_competitors:3,competitor_market_status:'COMPETITOR_FOUND',competitor_evidence:rows});
 assert.equal(out.status,'SHADOW_PRICE_PROPOSAL_OWNER_REVIEW');
 assert.equal(out.verified_competitor_quotes.length,3);
 assert.equal(out.production_writes,0);
 assert.equal(out.owner_approval_required,true);
 const two=S.propose({...b,independent_competitors:3,competitor_market_status:'COMPETITOR_FOUND',
  competitor_evidence:[receipt('A'),receipt('A'),receipt('B')]});
 assert.equal(two.status,'HOLD_COMPETITOR_EVIDENCE_INCOMPLETE');
 assert.equal(two.suggested_prices,null);
});

test('quotes for wrong event or wrong date and unsearched market remain HOLD',()=>{
 const b=base();
 const receipt=(shop,event_id,event_date)=>({shop,event_id,event_date,
  package_type:'PHONE_ONLY',price:890,verified:true,comparable_verified:true,
  source_url:'https://example.org/'+shop,observed_at:'2026-10-10'});
 const r=S.propose({...b,independent_competitors:3,competitor_market_status:'COMPETITOR_FOUND',
  competitor_evidence:[receipt('A',b.event_id,b.event_date),
   receipt('B','WRONG-EVENT',b.event_date),receipt('C',b.event_id,'2026-10-15')]});
 assert.equal(r.status,'HOLD_COMPETITOR_EVIDENCE_INCOMPLETE');
 assert.equal(r.verified_competitor_quotes.length,1);
 const unsearched=S.propose({...b,independent_competitors:0,
  competitor_market_status:'UNKNOWN',competitor_evidence:[]});
 assert.equal(unsearched.status,'HOLD_COMPETITOR_MARKET_NOT_CHECKED');
 assert.equal(unsearched.production_writes,0);
});
