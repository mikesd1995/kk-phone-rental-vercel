'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const P=require('../server/kk-verifier-storefront-promotion.js');

const candidate={
 status:'READY_FOR_FINAL_VERIFIER',title:'Test Event',event_date:'2026-10-03',venue:'IMPACT',
 pricing:{complete:true,independent_competitors:3,market_median:990,proposal:{proposal_available:true,proposal_source:'EXACT_EVENT_MEDIAN',confidence:'HIGH',proposed_reference_price:990,auto_final_price:false}},
 poster:{selected:{image_url:'https://example.com/poster.jpg'}}
};
test('promotion plan restores existing createEvent storefront path only after final approval',()=>{
 const r=P.preparePromotion({candidate,verifier_approved:true,owner_publish_allowed:true,final_prices:[{template_id:'TPL-X300',override_price:890}]});
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
 const plan=P.preparePromotion({candidate,verifier_approved:true,owner_publish_allowed:true,final_prices:[{template_id:'TPL-X300',override_price:890}]});
 const r=P.verifyStorefrontReadback(plan,{event:{event_id:'EVT-1',event_name:'Test Event',venue:'IMPACT',active_on_web:true,poster_image_url:'https://example.com/poster.jpg'},packages:[{package_id:'EVT-1-TPL-X300',price:890}]});
 assert.equal(r.status,'STOREFRONT_PROMOTION_VERIFIED');
 assert.equal(r.verified,true);
});

test('promotion accepts zero-competitor evidenced proposal but still requires explicit final KK price',()=>{
 const noCompetitor={...candidate,pricing:{complete:false,independent_competitors:0,market_median:null,proposal:{proposal_available:true,proposal_source:'KK_APPROVED_BASELINE',confidence:'LOW',proposed_reference_price:890,auto_final_price:false}}};
 const r=P.preparePromotion({candidate:noCompetitor,verifier_approved:true,owner_publish_allowed:true,final_prices:[{template_id:'TPL-X300',override_price:890}]});
 assert.equal(r.status,'READY_FOR_GOVERNED_ADMIN_CREATE');
 assert.equal(r.admin_payload.event_price_overrides[0].override_price,890);
});


test('verifier promotion forces standalone lens package hidden on create',()=>{
 const r=P.preparePromotion({candidate,verifier_approved:true,owner_publish_allowed:true,final_prices:[
  {template_id:'TPL-VIVO-X300-PRO-PHONE',override_price:890},
  {template_id:'TPL-ZEISS-2-35X-LENS',override_price:390,active_override:true},
  {template_id:'TPL-VIVO-X300-PRO-BUNDLE',override_price:1090}
 ]});
 const lens=r.admin_payload.event_price_overrides.find(x=>x.template_id==='TPL-ZEISS-2-35X-LENS');
 assert.equal(lens.active_override,false);
});

test('readback fails closed if standalone lens is visible immediately after create',()=>{
 const plan=P.preparePromotion({candidate,verifier_approved:true,owner_publish_allowed:true,final_prices:[
  {template_id:'TPL-VIVO-X300-PRO-PHONE',override_price:890},
  {template_id:'TPL-ZEISS-2-35X-LENS',override_price:390},
  {template_id:'TPL-VIVO-X300-PRO-BUNDLE',override_price:1090}
 ]});
 const r=P.verifyStorefrontReadback(plan,{event:{event_id:'EVT-1',event_name:'Test Event',venue:'IMPACT',active_on_web:true,poster_image_url:'https://example.com/poster.jpg'},packages:[
  {package_id:'EVT-1-TPL-VIVO-X300-PRO-PHONE',price:890,package_status:'available'},
  {package_id:'EVT-1-TPL-ZEISS-2-35X-LENS',price:390,package_status:'available'},
  {package_id:'EVT-1-TPL-VIVO-X300-PRO-BUNDLE',price:1090,package_status:'available'}
 ]});
 assert.equal(r.status,'PROMOTION_READBACK_FAILED');
 assert.ok(r.blockers.includes('LENS_ONLY_VISIBLE_ON_CREATE:TPL-ZEISS-2-35X-LENS'));
});
