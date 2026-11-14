'use strict';
// Actual Node dispatcher + actual GAS candidate in VM; provider and storage I/O
// remain synthetic. These tests cannot establish LINE delivery or cloud health.
const test=require('node:test');const assert=require('node:assert/strict');
const Webhook=require('../server/line-booking-webhook');
const {harness,OWNER,CUSTOMER,SECRET,BID}=require('./fixtures/line-initial-outbox-harness');
const env=()=>({KK_LINE_BOOKING_AUTOMATION_ENABLED:'true',KK_LINE_INITIAL_OUTBOX_V1_ENABLED:'true',
 KK_LINE_INITIAL_OUTBOX_DISPATCH_SECRET:SECRET,KK_ADMIN_SCRIPT_URL:'https://script.google.com/macros/s/SYNTHETIC/exec',
 KK_ADMIN_API_KEY:'distinct-admin-key',KK_OWNER_LINE_USER_ID:OWNER,LINE_CHANNEL_ACCESS_TOKEN:'synthetic-token',LINE_CHANNEL_SECRET:'synthetic-secret'});
const event=()=>({type:'message',replyToken:'PRIVATE_SYNTHETIC_REPLY_TOKEN',webhookEventId:'SYNTHETIC_INTEGRATION_1',
 source:{type:'user',userId:CUSTOMER},message:{type:'text',text:
  'สนใจเช่า Phone\nงาน: Synthetic Event\nวันที่: 18/11/2026\nสถานที่: Synthetic Hall\nชื่อเล่น: Synthetic Customer\nเวลารับอุปกรณ์: 16:00'}});
function integration(options={}){
 const h=harness(options),provider=[],actions=[];let lost=false;
 const json=value=>({ok:true,status:200,headers:{get:()=> 'synthetic-request-id'},text:async()=>JSON.stringify(value)});
 const fetchImpl=async(url,request)=>{
  if(String(url).includes('08_Web_Ready'))return {ok:true,text:async()=>
   'event_id,event_name,event_date_text,venue,poster_image_url,action_for_web,booking_status_for_web,available_phone_count\n'+
   'EVT-SYNTHETIC,Synthetic Event,18/11/2026,Synthetic Hall,,show,เปิดจอง,1'};
  if(String(url).includes('09_Web_Packages'))return {ok:true,text:async()=>
   'package_id,event_id,package_type,model_display,price,available_count,package_status\nTPL-PHONE,EVT-SYNTHETIC,phone_only,Phone,790,1,available'};
  const body=JSON.parse(request.body);
  if(String(url).includes('script.google.com')){
   actions.push(body.action);
   try{
    const functions={lineInitialOutboxReadiness:h.ready,createLineBookingPending:h.create,
     claimLineBookingInitialDelivery:h.claim,settleLineBookingInitialDelivery:h.settle};
    const data=functions[body.action](body);
    if(options.lostOwnerSettlement&&body.action==='settleLineBookingInitialDelivery'
     &&body.kind==='OWNER_APPROVAL_PUSH'&&!lost){lost=true;throw Error('SYNTHETIC_SETTLEMENT_ACK_LOST');}
    return json({ok:true,...data});
   }catch(_){return json({ok:false,error:'SYNTHETIC_WRITER_UNAVAILABLE'});}
  }
  const kind=String(url).endsWith('/push')?'owner':'customer';provider.push({kind,body});
  if(options.failOwner&&kind==='owner')throw Error('PRIVATE_SYNTHETIC_PROVIDER_FAILURE');
  return json({sentMessages:[{id:'synthetic-'+kind+'-receipt'}]});
 };
 return {h,provider,actions,run:()=>Webhook._test.processEvent(event(),env(),fetchImpl,{signatureVerified:true})};
}

test('real candidate Node/GAS pair persists, claims and settles two initial receipts once',async()=>{
 const f=integration(),result=await f.run();
 assert.equal(result.initial_delivery_status,'SENT');assert.equal(result.booking_id,BID);
 assert.deepEqual(f.provider.map(p=>p.kind),['owner','customer']);
 assert.deepEqual(f.h.ledger.rows.slice(1).map(r=>r[3]),['SENT','SENT']);
 assert.equal(f.h.stats().allocations,1);
 await f.run();assert.equal(f.provider.length,2);assert.equal(f.h.stats().allocations,1);
 assert.equal(f.h.ledger.rows.length,3);
 const requestClaims=Object.fromEntries(Object.entries(f.h.stored).filter(([key])=>key.startsWith('KK_LINE_BOOKING_REQ_')));
 assert.doesNotMatch(JSON.stringify({ledger:f.h.ledger.rows,claims:requestClaims}),/PRIVATE_SYNTHETIC_REPLY_TOKEN|synthetic-token|synthetic_initial_dispatch_secret/);
});

test('crash after actual canonical Booking flush recovers only original two durable intents',async()=>{
 const f=integration();f.h.crashAt(3);
 await assert.rejects(()=>f.run(),e=>e.code==='LINE_BOOKING_UPSTREAM_FAILED');
 assert.equal(f.h.bookings.rows[4][0],BID);assert.equal(f.provider.length,0);
 assert.deepEqual(f.h.ledger.rows.slice(1).map(r=>r[3]),['INTENT','INTENT']);
 f.h.crashAt(0);assert.equal((await f.run()).initial_delivery_status,'SENT');
 assert.equal(f.h.stats().allocations,1);assert.equal(f.h.ledger.rows.length,3);
 assert.equal(f.provider.length,2);
});

test('lost actual owner settlement ACK resumes only customer after persisted owner receipt',async()=>{
 const f=integration({lostOwnerSettlement:true});
 assert.equal((await f.run()).requires_manual_delivery_review,true);
 assert.deepEqual(f.h.ledger.rows.slice(1).map(r=>r[3]),['SENT','READY']);
 assert.equal((await f.run()).initial_delivery_status,'SENT');
 assert.deepEqual(f.provider.map(p=>p.kind),['owner','customer']);
});

test('actual canonical UNCERTAIN is never reclaimed after provider transport failure',async()=>{
 const f=integration({failOwner:true});
 assert.equal((await f.run()).requires_manual_delivery_review,true);
 assert.deepEqual(f.h.ledger.rows.slice(1).map(r=>r[3]),['UNCERTAIN','READY']);
 await f.run();assert.equal(f.provider.length,1);
});

test('concurrent actual Node/GAS executions preserve one Booking and one send per leg',async()=>{
 const f=integration();await Promise.all([f.run(),f.run()]);
 assert.equal(f.h.stats().allocations,1);assert.equal(f.h.ledger.rows.length,3);
 assert.deepEqual(f.provider.map(p=>p.kind),['owner','customer']);
});

test('disabled or drifted actual GAS readiness stops Node before creating Booking',async()=>{
 for(const options of [{enabled:false},{noLedger:true},{properties:{KK_LINE_INITIAL_OUTBOX_OWNER_TARGET:'U'+'b'.repeat(32)}}]){
  const f=integration(options);await assert.rejects(()=>f.run(),e=>
   ['LINE_BOOKING_UPSTREAM_FAILED','LINE_INITIAL_OUTBOX_PREFLIGHT_FAILED'].includes(e.code));
  assert.equal(f.h.stats().allocations,0);assert.equal(f.provider.length,0);
 }
});
