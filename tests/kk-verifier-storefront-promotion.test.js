'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const P=require('../server/kk-verifier-storefront-promotion.js');

const candidate={
 status:'READY_FOR_FINAL_VERIFIER',title:'Test Event',event_date:'2026-10-03',venue:'IMPACT',
 pricing:{complete:true,independent_competitors:3,market_median:990},
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
