'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Executor=require('../server/kk-governed-storefront-executor.js');

const plan={
 status:'READY_FOR_GOVERNED_ADMIN_CREATE',
 admin_action:'createEvent',
 duplicate_guard_required:true,
 exact_storefront_readback_required:true,
 admin_payload:{
  action:'createEvent',event_name:'Test Event',event_date:'2026-10-04',venue:'Test Venue',
  poster_url:'https://example.com/poster.jpg',status:'open',active_on_web:true,
  event_price_overrides:[{template_id:'TPL-X300',override_price:590,active_override:true,override_note:'VERIFIER_APPROVED'}]
 }
};

test('executor rejects anything except governed ready plan',async()=>{
 await assert.rejects(()=>Executor.execute({status:'HOLD_FOR_FINAL_PROMOTION'}),e=>e.code==='PROMOTION_PLAN_NOT_READY');
});

test('executor calls existing admin createEvent guard with server credential',async()=>{
 let request;
 const fetchImpl=async(url,init)=>{
  request={url,init};
  return {ok:true,status:200,json:async()=>({ok:true,data:{event_id:'EVT-1'}})};
 };
 const result=await Executor.execute(plan,{
  env:{KK_ADMIN_PIN:'secret',KK_SITE_URL:'https://kk.example'},
  fetchImpl
 });
 assert.equal(request.url,'https://kk.example/api/kk-admin-guard');
 assert.equal(request.init.headers['x-admin-pin'],'secret');
 assert.equal(JSON.parse(request.init.body).action,'createEvent');
 assert.equal(result.status,'CREATED_READBACK_REQUIRED');
 assert.equal(result.production_writes,1);
});

test('executor verifies exact storefront readback when supplied',async()=>{
 const fetchImpl=async()=>({ok:true,status:200,json:async()=>({ok:true,data:{event_id:'EVT-1'}})});
 const result=await Executor.execute(plan,{
  env:{KK_ADMIN_PIN:'secret'},
  fetchImpl,
  readbackFn:async()=>({
   event:{event_id:'EVT-1',event_name:'Test Event',venue:'Test Venue',active_on_web:true,poster_image_url:'https://example.com/poster.jpg'},
   packages:[{template_id:'TPL-X300',price:590}]
  })
 });
 assert.equal(result.status,'STOREFRONT_PROMOTION_VERIFIED');
 assert.equal(result.readback_verified,true);
});
