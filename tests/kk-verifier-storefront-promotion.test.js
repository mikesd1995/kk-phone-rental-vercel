'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const P=require('../server/kk-verifier-storefront-promotion.js');

const candidate={
 status:'READY_FOR_FINAL_VERIFIER',
 title:'Test Event',
 event_date:'2026-10-03',
 venue:'IMPACT',
 pricing:{
  complete:true,
  independent_competitors:3,
  market_median:990,
  proposal:{
   proposal_available:true,
   proposal_source:'EXACT_EVENT_MEDIAN',
   confidence:'HIGH',
   proposed_reference_price:990,
   auto_final_price:false
  }
 },
 poster:{selected:{image_url:'https://example.com/poster.jpg'}}
};

test('promotion plan restores existing createEvent storefront path only after final approval',()=>{
 const r=P.preparePromotion({
  candidate,
  verifier_approved:true,
  owner_publish_allowed:true,
  final_prices:[{template_id:'TPL-X300',override_price:890}]
 });
 assert.equal(r.status,'READY_FOR_GOVERNED_ADMIN_CREATE');
 assert.equal(r.admin_payload.action,'createEvent');
 assert.equal(r.admin_payload.active_on_web,true);
 assert.equal(r.admin_payload.event_price_overrides[0].override_price,890);
 assert.equal(r.duplicate_guard_required,true);
 assert.equal(r.exact_storefront_readback_required,true);
});

test('promotion plan fails closed without verifier, owner policy or final KK price',()=>{
 const r=P.preparePromotion({candidate});
 assert.equal(r.status,'HOLD_FOR_FINAL_PROMOTION');
 assert.ok(r.blockers.includes('FINAL_VERIFIER_APPROVAL_REQUIRED'));
 assert.ok(r.blockers.includes('OWNER_PUBLISH_POLICY_REQUIRED'));
 assert.ok(r.blockers.includes('FINAL_KK_PRICE_REQUIRED'));
 assert.equal(r.admin_payload,null);
});

test('storefront readback verifies event poster visibility and exact package price',()=>{
 const plan=P.preparePromotion({
  candidate,
  verifier_approved:true,
  owner_publish_allowed:true,
  final_prices:[{template_id:'TPL-X300',override_price:890}]
 });
 const r=P.verifyStorefrontReadback(plan,{
  event:{event_id:'EVT-1',event_name:'Test Event',venue:'IMPACT',active_on_web:true,poster_image_url:'https://example.com/poster.jpg'},
  packages:[{package_id:'EVT-1-TPL-X300',price:890}]
 });
 assert.equal(r.status,'STOREFRONT_PROMOTION_VERIFIED');
 assert.equal(r.verified,true);
});

test('promotion accepts zero-competitor evidenced proposal but still requires explicit final KK price',()=>{
 const noCompetitor={
  ...candidate,
  pricing:{
   complete:false,
   independent_competitors:0,
   market_median:null,
   proposal:{
    proposal_available:true,
    proposal_source:'KK_APPROVED_BASELINE',
    confidence:'LOW',
    proposed_reference_price:890,
    auto_final_price:false
   }
  }
 };
 const r=P.preparePromotion({
  candidate:noCompetitor,
  verifier_approved:true,
  owner_publish_allowed:true,
  final_prices:[{template_id:'TPL-X300',override_price:890}]
 });
 assert.equal(r.status,'READY_FOR_GOVERNED_ADMIN_CREATE');
 assert.equal(r.admin_payload.event_price_overrides[0].override_price,890);
});

test('score-qualified weekend candidate can publish without competitor reference using approved provisional policy',()=>{
 const scoreQualified={
  status:'READY_FOR_FINAL_VERIFIER',
  title:'Score Qualified Event',
  event_date:'2026-10-24',
  venue:'BITEC',
  rental_fit_score:9.1,
  publish_eligibility:{status:'ELIGIBLE',eligible:true,rental_fit_score:9.1,minimum_publish_score:7},
  pricing:{
   independent_competitors:0,
   proposal:{proposal_available:false,proposal_source:'NONE',auto_final_price:false}
  },
  poster:{selected:{image_url:'https://example.com/score.jpg'}}
 };
 const policy={
  policy_approved:true,
  source:'KK_RENTAL_FIT_SCORE_FALLBACK',
  pricing_status:'PROVISIONAL_NEEDS_PRICE_RECHECK',
  price_confidence:'PROVISIONAL',
  needs_price_recheck:true,
  final_prices:[
   {template_id:'TPL-VIVO-X300-PRO-PHONE',override_price:890,active_override:true,override_note:'OWNER_APPROVED_RENTAL_FIT_FALLBACK'},
   {template_id:'TPL-ZEISS-2-35X-LENS',override_price:200,active_override:true,override_note:'LENS_ONLY_HIDDEN_STORE_BASELINE'},
   {template_id:'TPL-VIVO-X300-PRO-BUNDLE',override_price:1090,active_override:true,override_note:'OWNER_APPROVED_RENTAL_FIT_FALLBACK'}
  ]
 };
 const r=P.preparePromotion({candidate:scoreQualified,final_pricing_policy:policy,verifier_approved:true});
 assert.equal(r.status,'READY_FOR_GOVERNED_ADMIN_CREATE');
 assert.equal(r.needs_price_recheck,true);
 assert.equal(r.pricing_status,'PROVISIONAL_NEEDS_PRICE_RECHECK');
 assert.match(r.admin_payload.note,/PROVISIONAL_NEEDS_PRICE_RECHECK/);
 const lens=r.admin_payload.event_price_overrides.find(x=>x.template_id==='TPL-ZEISS-2-35X-LENS');
 assert.equal(lens.active_override,false);
 assert.ok(r.admin_payload.event_price_overrides.every(x=>x.override_note.includes('PROVISIONAL_NEEDS_PRICE_RECHECK')));
});

test('low rental-fit candidate cannot use missing competitor evidence as a shortcut to publish',()=>{
 const lowFit={
  ...candidate,
  rental_fit_score:6.2,
  publish_eligibility:{status:'REJECTED_LOW_RENTAL_FIT',eligible:false,rental_fit_score:6.2,minimum_publish_score:7},
  pricing:{independent_competitors:0,proposal:{proposal_available:false,auto_final_price:false}}
 };
 const policy={
  policy_approved:true,
  source:'KK_RENTAL_FIT_SCORE_FALLBACK',
  final_prices:[{template_id:'PHONE',override_price:690}]
 };
 const r=P.preparePromotion({candidate:lowFit,final_pricing_policy:policy,verifier_approved:true});
 assert.equal(r.status,'HOLD_FOR_FINAL_PROMOTION');
 assert.ok(r.blockers.includes('RENTAL_FIT_BELOW_PUBLISH_THRESHOLD'));
 assert.equal(r.admin_payload,null);
});

test('owner-hidden existing event cannot be silently recreated or reopened by verifier promotion',()=>{
 const r=P.preparePromotion({
  candidate,
  verifier_approved:true,
  owner_publish_allowed:true,
  final_prices:[{template_id:'PHONE',override_price:890}],
  existing_event:{event_id:'EVT-HIDDEN',active_on_web:false}
 });
 assert.equal(r.status,'HOLD_FOR_FINAL_PROMOTION');
 assert.ok(r.blockers.includes('OWNER_HIDDEN_REOPEN_PROHIBITED'));
 assert.equal(r.admin_payload,null);
});

test('explicit owner reopen is routed away from createEvent promotion path',()=>{
 const r=P.preparePromotion({
  candidate,
  verifier_approved:true,
  owner_publish_allowed:true,
  final_prices:[{template_id:'PHONE',override_price:890}],
  existing_event:{event_id:'EVT-HIDDEN',active_on_web:false},
  visibility_owner_intent:P.OWNER_REOPEN_INTENT
 });
 assert.equal(r.status,'HOLD_FOR_FINAL_PROMOTION');
 assert.ok(r.blockers.includes('OWNER_REOPEN_REQUIRES_EXISTING_EVENT_UPDATE'));
});

test('verifier promotion forces standalone lens package hidden on create',()=>{
 const r=P.preparePromotion({
  candidate,
  verifier_approved:true,
  owner_publish_allowed:true,
  final_prices:[
   {template_id:'TPL-VIVO-X300-PRO-PHONE',override_price:890},
   {template_id:'TPL-ZEISS-2-35X-LENS',override_price:390,active_override:true},
   {template_id:'TPL-VIVO-X300-PRO-BUNDLE',override_price:1090}
  ]
 });
 const lens=r.admin_payload.event_price_overrides.find(x=>x.template_id==='TPL-ZEISS-2-35X-LENS');
 assert.equal(lens.active_override,false);
});

test('readback fails closed if standalone lens is visible immediately after create',()=>{
 const plan=P.preparePromotion({
  candidate,
  verifier_approved:true,
  owner_publish_allowed:true,
  final_prices:[
   {template_id:'TPL-VIVO-X300-PRO-PHONE',override_price:890},
   {template_id:'TPL-ZEISS-2-35X-LENS',override_price:390},
   {template_id:'TPL-VIVO-X300-PRO-BUNDLE',override_price:1090}
  ]
 });
 const r=P.verifyStorefrontReadback(plan,{
  event:{event_id:'EVT-1',event_name:'Test Event',venue:'IMPACT',active_on_web:true,poster_image_url:'https://example.com/poster.jpg'},
  packages:[
   {package_id:'EVT-1-TPL-VIVO-X300-PRO-PHONE',price:890,package_status:'available'},
   {package_id:'EVT-1-TPL-ZEISS-2-35X-LENS',price:390,package_status:'available'},
   {package_id:'EVT-1-TPL-VIVO-X300-PRO-BUNDLE',price:1090,package_status:'available'}
  ]
 });
 assert.equal(r.status,'PROMOTION_READBACK_FAILED');
 assert.ok(r.blockers.includes('LENS_ONLY_VISIBLE_ON_CREATE:TPL-ZEISS-2-35X-LENS'));
});


test('persistent owner tombstone blocks verifier recreation under a new event id',()=>{
 const r=P.preparePromotion({
  candidate,
  verifier_approved:true,
  owner_publish_allowed:true,
  final_prices:[{template_id:'PHONE',override_price:890}],
  visibility_locks:[{
   event_id:'EVT-OLD',
   event_name:'Test Event',
   event_date:'2026-10-03',
   venue:'IMPACT',
   lock_state:'LOCKED'
  }]
 });
 assert.equal(r.status,'HOLD_FOR_FINAL_PROMOTION');
 assert.ok(r.blockers.includes('OWNER_HIDDEN_RECREATE_PROHIBITED'));
 assert.equal(r.admin_payload,null);
});

test('previously seen Core history blocks verifier from treating rediscovery as a new event',()=>{
 const r=P.preparePromotion({
  candidate,
  verifier_approved:true,
  owner_publish_allowed:true,
  final_prices:[{template_id:'PHONE',override_price:890}],
  visibility_locks:[{
   event_id:'EVT-HISTORY',
   event_name:'Test Event',
   event_date:'2026-10-03',
   venue:'IMPACT',
   lock_state:'SEEN_CORE'
  }]
 });
 assert.equal(r.status,'HOLD_FOR_FINAL_PROMOTION');
 assert.ok(r.blockers.includes('HISTORICAL_EVENT_RECREATE_PROHIBITED'));
});

test('existing visible Core event is reconcile-only and never sent through createEvent promotion',()=>{
 const r=P.preparePromotion({
  candidate,
  verifier_approved:true,
  owner_publish_allowed:true,
  final_prices:[{template_id:'PHONE',override_price:890}],
  existing_event:{event_id:'EVT-EXISTING',active_on_web:true}
 });
 assert.equal(r.status,'HOLD_FOR_FINAL_PROMOTION');
 assert.ok(r.blockers.includes('EXISTING_EVENT_RECONCILE_REQUIRED'));
});


test('promotion accepts exact-event competitor median policy as final price authority',()=>{
 const marketCandidate={
  ...candidate,
  publish_eligibility:{status:'ELIGIBLE',eligible:true,rental_fit_score:8.2,minimum_publish_score:7}
 };
 const policy={
  policy_approved:true,
  source:'EXACT_EVENT_COMPETITOR_MEDIAN',
  pricing_status:'APPROVED_EXACT_EVENT_MEDIAN',
  price_confidence:'HIGH',
  needs_price_recheck:false,
  final_prices:[
   {template_id:'TPL-VIVO-X300-PRO-PHONE',override_price:690,active_override:true,override_note:'EXACT_EVENT_COMPETITOR_MEDIAN'},
   {template_id:'TPL-ZEISS-2-35X-LENS',override_price:200,active_override:false,override_note:'LENS_ONLY_HIDDEN_STORE_BASELINE'},
   {template_id:'TPL-VIVO-X300-PRO-BUNDLE',override_price:890,active_override:true,override_note:'EXACT_EVENT_COMPETITOR_MEDIAN_PLUS_LENS'}
  ]
 };
 const r=P.preparePromotion({candidate:marketCandidate,final_pricing_policy:policy,verifier_approved:true});
 assert.equal(r.status,'READY_FOR_GOVERNED_ADMIN_CREATE');
 assert.equal(r.pricing_status,'APPROVED_EXACT_EVENT_MEDIAN');
 assert.deepEqual(r.admin_payload.event_price_overrides.map(x=>x.override_price),[690,200,890]);
});
