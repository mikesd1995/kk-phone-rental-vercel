'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const Webhook=require('../server/line-booking-webhook');

const OWNER='U'+'a'.repeat(32), CUSTOMER='U'+'c'.repeat(32);
const SECRET='synthetic_initial_dispatch_private_20261114';
const env=()=>({KK_LINE_BOOKING_AUTOMATION_ENABLED:'true',
 KK_LINE_INITIAL_OUTBOX_V1_ENABLED:'true',KK_LINE_INITIAL_OUTBOX_DISPATCH_SECRET:SECRET,
 KK_ADMIN_SCRIPT_URL:'https://script.google.com/macros/s/SYNTHETIC/exec',
 KK_ADMIN_API_KEY:'synthetic-admin-key',KK_OWNER_LINE_USER_ID:OWNER,
 LINE_CHANNEL_ACCESS_TOKEN:'synthetic-token',LINE_CHANNEL_SECRET:'synthetic-secret'});
const event=()=>({type:'message',replyToken:'SYNTHETIC_PRIVATE_REPLY_TOKEN',
 webhookEventId:'SYNTHETIC_INITIAL_001',source:{type:'user',userId:CUSTOMER},message:{type:'text',
 text:'สนใจเช่า Phone\nงาน: Synthetic Event\nวันที่: 18/12/2027\nสถานที่: Test Arena\nชื่อเล่น: Synthetic Renter\nเวลารับอุปกรณ์: 12:00'}});
const json=value=>({ok:true,status:200,headers:{get:()=> 'synthetic-provider-request'},text:async()=>JSON.stringify(value)});
function dataFetch(url){
 if(String(url).includes('08_Web_Ready'))return {ok:true,text:async()=>
  'event_id,event_name,event_date_text,venue,poster_image_url,action_for_web,booking_status_for_web,available_phone_count\n'+
  'EVT-SYNTHETIC,Synthetic Event,18/12/2027,Test Arena,,show,เปิดจอง,1'};
 if(String(url).includes('09_Web_Packages'))return {ok:true,text:async()=>
  'package_id,event_id,package_type,model_display,price,available_count,package_status\n'+
  'TPL-SYNTHETIC,EVT-SYNTHETIC,phone_only,Phone,100,1,available'};
 return null;
}

test('enabled initial outbox requires compatible GAS preflight before Pending or provider calls',async()=>{
 const calls=[];
 await assert.rejects(()=>Webhook._test.processEvent(event(),env(),async(url,options)=>{
  const data=dataFetch(url);if(data)return data;
  const body=JSON.parse(options.body);calls.push(body.action||String(url));
  if(body.action==='lineInitialOutboxReadiness')return json({ok:true,ready:false});
  if(body.action==='createLineBookingPending')return json({ok:true,booking_id:'BK-SYNTHETIC',idempotent_replay:false});
  return json({sentMessages:[{id:'synthetic-message'}]});
 },{signatureVerified:true}),e=>e.code==='LINE_INITIAL_OUTBOX_PREFLIGHT_FAILED');
 assert.deepEqual(calls,['lineInitialOutboxReadiness']);
});

test('durable initial delivery refuses an unverified event before writer or provider access',async()=>{
 const calls=[];
 await assert.rejects(()=>Webhook._test.processEvent(event(),env(),async(url,options)=>{
  const data=dataFetch(url);if(data)return data;
  const body=JSON.parse(options.body);calls.push(body.action||String(url));
  return json({ok:true,booking_id:'BK-SYNTHETIC',idempotent_replay:false});
 }),e=>e.code==='LINE_INITIAL_OUTBOX_VERIFIED_EVENT_REQUIRED');
 assert.equal(calls.length,0);
});

const Initial=require('../server/line-initial-durable-outbox');
const Intake=require('../server/line-booking-intake');
const Approval=require('../server/line-booking-owner-approval');
function flow(options={}){
 const calls=[],provider=[],bookingId='BK-SYNTHETIC',requestId=Intake.requestIdFromLineEvent(event());
 let ledger,settlementLost=false;
 const fetchImpl=async(url,request)=>{
  const data=dataFetch(url);if(data)return data;
  const body=JSON.parse(request.body);
  if(!String(url).includes('script.google.com')){
   const kind=String(url).endsWith('/push')?'OWNER_APPROVAL_PUSH':'CUSTOMER_PENDING_REPLY';
   calls.push('provider:'+kind);provider.push({kind,body,headers:request.headers});
   if(options.providerFailure===kind)throw Error('SYNTHETIC_PRIVATE_PROVIDER_BODY');
   if(options.missingReceipt===kind)return json({});
   if(options.badBody===kind)return {ok:true,status:200,text:async()=>{throw Error('SYNTHETIC_PRIVATE_BODY');}};
   return json({sentMessages:[{id:'synthetic-'+kind}]});
  }
  calls.push(body.action+(body.kind?':'+body.kind:''));
  if(body.action==='lineInitialOutboxReadiness')return json({ok:true,ready:true,
   initial_outbox_mode:Initial.VERSION,columns:14,owner_target:OWNER});
  if(body.action==='createLineBookingPending'){
   if(!ledger){
    const input=body.initial_notification;
    ledger={mode:Initial.VERSION,booking_id:bookingId,request_id:requestId,owner_target:OWNER,
     context_json:input.context_json,context_hash:input.context_hash,
     deliveries:Initial.KINDS.map(kind=>({kind,outbox_id:Initial.idFor(bookingId,kind),booking_id:bookingId,
      request_id:requestId,recipient:kind===Initial.KINDS[0]?OWNER:CUSTOMER,state:'READY',
      claim_key:'',message_hash:'',provider_message_id:'',provider_request_id:''}))};
    if(options.ownerSent)Object.assign(ledger.deliveries[0],{state:'SENT',
     claim_key:'23ce4567-e89b-42d3-a456-426614174002',message_hash:options.corruptMessageHash?'b'.repeat(64):
      Initial.hash(JSON.stringify(Approval.ownerApprovalMessage({...JSON.parse(ledger.context_json),booking_id:bookingId},env()))),
     provider_message_id:'old-owner-receipt'});
   }
   const snapshot=JSON.parse(JSON.stringify(ledger));
   if(options.corruptEnvelope)snapshot.context_hash='0'.repeat(64);
   return json({ok:true,booking_id:bookingId,idempotent_replay:true,initial_outbox:snapshot});
  }
  const row=ledger.deliveries.find(r=>r.kind===body.kind);
  const echo={mode:Initial.VERSION,booking_id:bookingId,request_id:requestId,
   kind:row.kind,outbox_id:row.outbox_id,recipient:row.recipient,context_hash:ledger.context_hash,
   message_hash:body.message_hash,claim_key:body.claim_key};
  if(body.action==='claimLineBookingInitialDelivery'){
   if(row.state!=='READY')return json({ok:true,...echo,state:row.state,claimed:false});
   Object.assign(row,{state:'CLAIMED',claim_key:body.claim_key,message_hash:body.message_hash});
   if(options.lostClaim)throw Error('SYNTHETIC_PRIVATE_CLAIM_RESPONSE');
   return json({ok:true,...echo,state:'CLAIMED',claimed:true,
    ...(options.badClaim?{recipient:'U'+'d'.repeat(32)}:{})});
  }
  if(body.action==='settleLineBookingInitialDelivery'){
   if(options.lostSettlement==='before-write'&&!settlementLost){settlementLost=true;throw Error('Lost settlement');}
   Object.assign(row,{state:body.delivery_state,provider_message_id:body.provider_message_id,
    provider_request_id:body.provider_request_id});
   if(options.lostSettlement==='after-write'&&!settlementLost){settlementLost=true;throw Error('Lost settlement');}
   return json({ok:true,...echo,state:row.state,provider_message_id:row.provider_message_id,
    provider_request_id:row.provider_request_id});
  }
  throw Error('Unexpected mock action');
 };
 return {calls,provider,fetchImpl,get ledger(){return ledger;},
  run:()=>Webhook._test.processEvent(event(),env(),fetchImpl,{signatureVerified:true})};
}

test('durable replay claims owner then customer exactly once and repeated replay sends nothing',async()=>{
 const f=flow(),result=await f.run();
 assert.equal(result.automation_status,'PENDING_OWNER_APPROVAL');
 assert.equal(result.requires_manual_delivery_review,false);
 assert.deepEqual(f.provider.map(p=>p.kind),Initial.KINDS);
 assert.deepEqual(f.calls.slice(2),[
  'claimLineBookingInitialDelivery:OWNER_APPROVAL_PUSH','provider:OWNER_APPROVAL_PUSH',
  'settleLineBookingInitialDelivery:OWNER_APPROVAL_PUSH',
  'claimLineBookingInitialDelivery:CUSTOMER_PENDING_REPLY','provider:CUSTOMER_PENDING_REPLY',
  'settleLineBookingInitialDelivery:CUSTOMER_PENDING_REPLY']);
 assert.match(f.provider[0].headers['X-Line-Retry-Key'],/^[a-f0-9-]{36}$/);
 assert.equal(f.provider[1].headers['X-Line-Retry-Key'],undefined);
 assert.equal(f.provider[1].body.replyToken,event().replyToken);
 assert.match(JSON.stringify(f.provider[0].body),/Booking รออนุมัติ/);
 assert.match(JSON.stringify(f.provider[1].body),/กรุณารอร้านตรวจสอบคิว/);
 assert.equal(f.provider[1].body.to,undefined,'customer remains Reply, never converted to Push');
 const again=await f.run();assert.equal(again.initial_delivery_status,'SENT');
 assert.equal(f.provider.length,2);assert.equal(again.owner_notifications,0);
 assert.doesNotMatch(JSON.stringify(f.ledger),/SYNTHETIC_PRIVATE_REPLY_TOKEN|synthetic-token|synthetic_initial_dispatch/);
});

test('owner receipt already SENT recovers only the never-claimed customer reply',async()=>{
 const f=flow({ownerSent:true}),result=await f.run();
 assert.equal(result.requires_manual_delivery_review,false);
 assert.deepEqual(f.provider.map(p=>p.kind),['CUSTOMER_PENDING_REPLY']);
 assert.equal(result.owner_notifications,0);assert.equal(result.customer_notifications,1);
});

for(const kind of Initial.KINDS){
 for(const failure of ['providerFailure','missingReceipt','badBody']){
  test(kind+' '+failure+' stays UNCERTAIN and replay never resends',async()=>{
   const f=flow({[failure]:kind}),result=await f.run();
   assert.equal(result.requires_manual_delivery_review,true);
   assert.equal(f.ledger.deliveries.find(r=>r.kind===kind).state,'UNCERTAIN');
   const count=f.provider.length;await f.run();assert.equal(f.provider.length,count);
   assert.doesNotMatch(JSON.stringify(result),/PRIVATE|synthetic-token|Renter|Test Arena/);
  });
 }
}

test('lost claim response or invalid claim readback never reaches a provider',async()=>{
 for(const options of [{lostClaim:true},{badClaim:true}]){
  const f=flow(options);assert.equal((await f.run()).requires_manual_delivery_review,true);
  assert.equal(f.provider.length,0);assert.equal(f.ledger.deliveries[0].state,'CLAIMED');
  await f.run();assert.equal(f.provider.length,0);
 }
});

test('provider acceptance with lost settlement never repeats the owner push',async()=>{
 for(const point of ['before-write','after-write']){
  const f=flow({lostSettlement:point});assert.equal((await f.run()).requires_manual_delivery_review,true);
  assert.equal(f.provider.length,1);
  const recovered=await f.run();
  assert.equal(f.provider.filter(p=>p.kind==='OWNER_APPROVAL_PUSH').length,1);
  assert.equal(f.provider.filter(p=>p.kind==='CUSTOMER_PENDING_REPLY').length,point==='after-write'?1:0);
  assert.equal(recovered.requires_manual_delivery_review,point!=='after-write');
 }
});

test('concurrent redelivery never creates two claims or provider sends for either leg',async()=>{
 const f=flow();await Promise.all([f.run(),f.run()]);
 for(const kind of Initial.KINDS)assert.equal(f.provider.filter(p=>p.kind===kind).length,1);
});

test('mismatched context digest fails closed before claims or provider calls',async()=>{
 const f=flow({corruptEnvelope:true});
 await assert.rejects(()=>f.run(),e=>e.code==='LINE_INITIAL_OUTBOX_READBACK_REQUIRED');
 assert.equal(f.provider.length,0);assert.equal(f.calls.some(c=>c.startsWith('claim')),false);
});

test('initial dispatch configuration requires a separate credential before GAS calls',async()=>{
 for(const config of [{KK_LINE_INITIAL_OUTBOX_DISPATCH_SECRET:'short'},
  {KK_ADMIN_API_KEY:SECRET},{KK_LINE_OWNER_OUTBOX_DISPATCH_SECRET:SECRET}]){
  const f=flow();await assert.rejects(()=>Webhook._test.processEvent(event(),{...env(),...config},
   f.fetchImpl,{signatureVerified:true}),e=>e.code==='LINE_INITIAL_OUTBOX_DISPATCH_NOT_READY');
  assert.equal(f.calls.length,0);
 }
});

test('rendered owner message drift blocks a never-claimed customer reply',async()=>{
 const f=flow({ownerSent:true,corruptMessageHash:true}),result=await f.run();
 assert.equal(result.requires_manual_delivery_review,true);
 assert.equal(f.provider.length,0);
 assert.equal(f.calls.some(c=>c.startsWith('claimLine')),false);
});

test('multibyte private context stays within the durable property byte budget',()=>{
 const context=JSON.parse(Initial.contextJson({event_name:'Synthetic',event_date:'2027-12-18',nickname:'Demo'},
  {package_name:'Phone',price_display:'100 synthetic units'},'NOT_CONFIRMED'));
 for(const key of ['event_name','venue','package_name','nickname','pickup_time'])context[key]='ก'.repeat(512);
 const raw=JSON.stringify(context);assert.ok(Buffer.byteLength(raw,'utf8')>6000);
 assert.throws(()=>Initial.parseContext(raw,Initial.hash(raw)),e=>e.code==='LINE_INITIAL_OUTBOX_CONTEXT_INVALID');
});

test('hidden or unavailable canonical snapshot on durable replay cannot bypass the ledger with a generic reply',async()=>{
 for(const options of [{},{lostClaim:true},{providerFailure:'OWNER_APPROVAL_PUSH'}]){
  const f=flow(options);await f.run();const before=f.provider.length;
  const result=await Webhook._test.processEvent(event(),env(),async(url,request)=>{
   if(String(url).includes('08_Web_Ready')){
    const original=dataFetch(url);return {ok:true,text:async()=>(await original.text()).replace(',show,เปิดจอง,1',',hide,เปิดจอง,1')};
   }
   return f.fetchImpl(url,request);
  },{signatureVerified:true});
  assert.equal(result.requires_manual_delivery_review,true);
  assert.equal(result.automation_status,'CANONICAL_REVIEW_REQUIRED');
  assert.equal(f.provider.length,before);
 }
});

test('lost authenticated terms evidence on replay never claims no Booking or bypasses initial ledger with a Reply',async()=>{
 const Receipt=require('../server/kk-line-booking-terms-receipt');
 const original=Receipt.lookupSignedLineAcceptance;
 try{
  for(const options of [{},{providerFailure:'OWNER_APPROVAL_PUSH'}]){
   const f=flow(options),config={...env(),KK_CUSTOMER_LOGIN_ENABLED:'true'};
   Receipt.lookupSignedLineAcceptance=async()=>({accepted:true,status:'VERIFIED_LINE_IDENTITY_TERMS_ACCEPTED'});
   await Webhook._test.processEvent(event(),config,f.fetchImpl,{signatureVerified:true});
   const count=f.provider.length;
   Receipt.lookupSignedLineAcceptance=async()=>({accepted:false,status:'EVIDENCE_UNAVAILABLE'});
   const result=await Webhook._test.processEvent(event(),config,f.fetchImpl,{signatureVerified:true});
   assert.equal(result.automation_status,'TERMS_EVIDENCE_REVIEW_REQUIRED');
   assert.equal(result.requires_manual_delivery_review,true);assert.equal(f.provider.length,count);
  }
 }finally{Receipt.lookupSignedLineAcceptance=original;}
});
