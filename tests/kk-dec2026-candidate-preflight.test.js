'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const A=require('../server/kk-dec2026-candidate-preflight.js');
const Pricing=require('../server/kk-final-pricing-policy.js');

const NOW='2026-11-07T09:00:00.000Z';
function candidate(overrides={}){
 return {
  title:'2026 K-POP Chronicle Live SUHO Fan-Con in Bangkok',
  event_date:'2026-12-27',venue:'Island Hall, Fashion Island',
  primary_source_url:'https://example.org/official/suho-2026',
  primary_source_verified:true,
  poster_url:'https://example.org/images/suho-2026.jpg',poster_verified:true,
  access_type:'PUBLIC',photo_allowed:true,lens_allowed:true,bundle_requested:true,
  rental_fit_score:8,
  pricing:Pricing.resolve({rental_fit_score:8,event_date:'2026-12-27'}),
  ...overrides
 };
}
function snapshot(overrides={}){
 return {
  snapshot_verified:true,checked_at:'2026-11-07T08:59:00.000Z',
  bookings:[],events:[],owner_locks:[],
  candidates:[candidate()],...overrides
 };
}
function audit(s){return A.evaluate(s,{now_iso:NOW});}
function codes(s){return audit(s).results[0].blockers;}
test('December candidate pass is ONLY preflight, never production authorization',()=>{
 const r=audit(snapshot());
 assert.equal(r.status,'PREPARED_FOR_INDEPENDENT_VERIFIER');
 assert.equal(r.preflight_pass_count,1);
 assert.equal(r.production_writes,0);
 assert.equal(r.publication_authorized,false);
 assert.equal(r.results[0].publication_authorized,false);
 assert.equal(r.results[0].verifier_required,true);
});
test('booked event-day is blocked even when another phone is available',()=>{
 const s=snapshot({bookings:[{event_id:'EVT-20261227-BOSSNOEUL',status:'confirmed',phone:'PHONE-002'}]});
 assert.ok(codes(s).includes('ANY_CONFIRMED_OR_NONCANCELLED_BOOKING_ON_DATE'));
 assert.equal(audit(s).results[0].booking_day_matches,1);
});
test('cancelled booking is excluded; pending and unknown booking statuses fail closed',()=>{
 const cancelled=snapshot({bookings:[{event_id:'EVT-20261227-ANOTHER',status:'cancelled'}]});
 assert.equal(codes(cancelled).length,0);
 for(const status of ['pending','confirmed','custom_status']){
  const s=snapshot({bookings:[{event_id:'EVT-20261227-ANOTHER',status}]});
  assert.ok(codes(s).includes('ANY_CONFIRMED_OR_NONCANCELLED_BOOKING_ON_DATE'),status);
 }
});
test('booking without a resolvable event date fails closed rather than assuming free stock',()=>{
 const s=snapshot({bookings:[{event_id:'some-unknown-id',status:'confirmed'}]});
 assert.ok(codes(s).includes('BOOKING_DATE_UNRESOLVED'));
});
test('owner locked alias blocks recreation, even if proposed event id is new',()=>{
 const s=snapshot({owner_locks:[{
  event_id:'EVT-20261227-OLD-OWNER-HIDE',
  event_date:'27/12/2026',
  name:'2026 K-POP Chronicle Live: SUHO Fan Con in Bangkok',
  state:'LOCKED',reason:'OWNER_NO_REPUBLISH'
 }]});
 // Explicit override to match normalized canonical string, bypassing punctuation.
 s.owner_locks[0].name=candidate().title.replace('SUHO Fan-Con','SUHO Fan-Con:');
 assert.ok(codes(s).includes('OWNER_HIDDEN_HISTORY_LOCK'));
});
test('owner date-exclusive lock blocks even unrelated candidate names',()=>{
 const s=snapshot({owner_locks:[{event_id:'EVT-20261227-OTHER',state:'LOCKED',reason:'OWNER_DAY_EXCLUSIVE_2026'}]});
 assert.ok(codes(s).includes('OWNER_HIDDEN_HISTORY_LOCK'));
});
test('existing hidden Core event cannot be re-created under new id',()=>{
 const s=snapshot({events:[{event_id:'EVT-20261227-LEGACY',event_date:'27/12/2026',title:candidate().title,active_on_web:false}]});
 assert.ok(codes(s).includes('EXISTING_CORE_RECORD_RECONCILE_NOT_CREATE'));
});
test('missing snapshots and stale reads block publication preflight',()=>{
 const s=snapshot({bookings:null,owner_locks:null,checked_at:'2026-11-06T08:59:00.000Z'});
 const x=codes(s);
 for(const b of ['BOOKING_SNAPSHOT_MISSING','OWNER_LOCK_SNAPSHOT_MISSING','FRESH_SOT_READBACK_REQUIRED'])assert.ok(x.includes(b),b);
});
test('restricted brand Lucky Fan requires verified access rights and disclosed rules',()=>{
 const s=snapshot({candidates:[candidate({
  event_date:'2026-12-09',access_type:'RESTRICTED',access_verified:false,access_terms_disclosed:false
 })]});
 assert.ok(codes(s).includes('EVENT_ADMISSION_ACCESS_UNVERIFIED'));
});
test('unverified poster, unsupported photographing, and lens rules are separate blockers',()=>{
 const s=snapshot({candidates:[candidate({poster_verified:false,photo_allowed:null,lens_allowed:null})]});
 const b=codes(s);
 assert.ok(b.includes('OFFICIAL_POSTER_NOT_VERIFIED'));
 assert.ok(b.includes('PHONE_PHOTOGRAPHY_PERMISSION_NOT_VERIFIED'));
 assert.ok(b.includes('ADDON_LENS_PERMISSION_NOT_VERIFIED'));
});
test('phone-only publication must not expose an active lens bundle',()=>{
 const s=snapshot({candidates:[candidate({bundle_requested:false,lens_allowed:null})]});
 assert.ok(codes(s).includes('PACKAGE_PRICE_OR_LENS_ONLY_VISIBILITY_INVALID'));
});
test('score fallback must match approved V4 price tier, without guessing a tier',()=>{
 const bad=Pricing.resolve({event_date:'2026-12-27',rental_fit_score:8});
 bad.final_prices=bad.final_prices.map(row=>row.template_id==='TPL-VIVO-X300-PRO-PHONE'?{...row,override_price:590}:row);
 assert.ok(codes(snapshot({candidates:[candidate({pricing:bad})]})).includes('SCORE_FALLBACK_TIER_MISMATCH'));
 assert.ok(codes(snapshot({candidates:[candidate({rental_fit_score:null})]})).includes('RENTAL_FIT_NOT_VERIFIED_OR_BELOW_PUBLISH_GATE'));
 assert.ok(codes(snapshot({candidates:[candidate({rental_fit_score:6})]})).includes('RENTAL_FIT_NOT_VERIFIED_OR_BELOW_PUBLISH_GATE'));
});
test('Friday-Sunday unquoted fallback requires provisional price recheck',()=>{
 const bad={...Pricing.resolve({event_date:'2026-12-27',rental_fit_score:8}),needs_price_recheck:false};
 assert.ok(codes(snapshot({candidates:[candidate({pricing:bad})]})).includes('WEEKEND_FALLBACK_PRICE_RECHECK_MISSING'));
});
test('ticket admission amount cannot masquerade as the KK price source',()=>{
 const bad={...Pricing.resolve({event_date:'2026-12-27',rental_fit_score:8}),source:'TICKET_ADMISSION_PRICE'};
 assert.ok(codes(snapshot({candidates:[candidate({pricing:bad})]})).includes('FINAL_KK_PRICING_POLICY_NOT_VERIFIED'));
});
test('exact-event competitor median requires counted comparable evidence',()=>{
 const p={...Pricing.resolve({event_date:'2026-12-27',rental_fit_score:8}),
  source:'EXACT_EVENT_COMPETITOR_MEDIAN',competitor_evidence_count:0,exact_comparables_verified:false};
 assert.ok(codes(snapshot({candidates:[candidate({pricing:p})]})).includes('EXACT_EVENT_COMPETITOR_PROOF_MISSING'));
});
test('invalid months and empty candidates cannot be mistaken for ready-to-publish',()=>{
 const jan=snapshot({candidates:[candidate({event_date:'2027-01-01'})]});
 assert.ok(codes(jan).includes('DECEMBER_DATE_NOT_VERIFIED'));
 assert.equal(audit(snapshot({candidates:[]})).status,'HOLD');
});
