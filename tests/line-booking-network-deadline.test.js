'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Webhook=require('../server/line-booking-webhook')._test;
const Approval=require('../server/line-booking-owner-approval');
const Messaging=require('../server/kk-line-messaging-api');

const CUSTOMER='U'+'c'.repeat(32),OWNER='U'+'a'.repeat(32);
const BOOKING='BK-SYNTHETIC-DEADLINE',OUTBOX='LINE_OWNER_V1_'+'a'.repeat(48);
const env=()=>({KK_LINE_BOOKING_AUTOMATION_ENABLED:'true',
  KK_ADMIN_SCRIPT_URL:'https://script.google.com/macros/s/SYNTHETIC/exec',
  KK_ADMIN_API_KEY:'synthetic-key',KK_OWNER_LINE_USER_ID:OWNER,
  LINE_CHANNEL_ACCESS_TOKEN:'synthetic-token',LINE_CHANNEL_SECRET:'synthetic-secret'});
const booking={event_name:'Synthetic Concert',event_date:'13 Nov 2026',venue:'Test Hall',package_name:'S25 Ultra'};
const webReady='event_id,event_name,event_date_text,venue,poster_image_url,action_for_web,booking_status_for_web,available_phone_count\nEVT-DEADLINE,Synthetic Concert,13 Nov 2026,Test Hall,https://example.com/poster.jpg,show,เปิดจอง,1';
const response=(body,status=200)=>({ok:status>=200&&status<300,status,
  headers:{get:()=>''},text:async()=>typeof body==='string'?body:JSON.stringify(body)});
const never=()=>new Promise(()=>{});
async function drain(){for(let i=0;i<40;i++)await Promise.resolve();}
async function withClock(run){
  const originalSet=globalThis.setTimeout,originalClear=globalThis.clearTimeout;
  let now=0,next=1;const timers=new Map();
  globalThis.setTimeout=(fn,ms)=>{const id=next++;timers.set(id,{fn,at:now+ms});return id;};
  globalThis.clearTimeout=id=>timers.delete(id);
  const clock={timers,async tick(ms){now+=ms;for(const [id,t] of [...timers]){
    if(t.at<=now){timers.delete(id);t.fn();}}
    await drain();}};
  try{await run(clock);}finally{globalThis.setTimeout=originalSet;globalThis.clearTimeout=originalClear;}
}
const cases=[
  ['poster read',f=>Webhook.resolvePoster(booking,f),'LINE_BOOKING_NETWORK_DEADLINE_EXCEEDED',true],
  ['canonical WebReady read',f=>Webhook.resolveCanonicalPackage(booking,f),'LINE_BOOKING_NETWORK_DEADLINE_EXCEEDED',true],
  ['canonical package read',f=>Webhook.resolveCanonicalPackage(booking,(u,o)=>
    u.includes('08_Web_Ready')?Promise.resolve(response(webReady)):f(u,o)),'LINE_BOOKING_NETWORK_DEADLINE_EXCEEDED',true],
  ['Apps Script action',f=>Approval.appsScriptCall({action:'createLineBookingPending'},env(),f),'LINE_BOOKING_UPSTREAM_TRANSPORT_FAILED',true],
  ['customer reply Flex',f=>Webhook.replyFlex('synthetic-reply',{type:'text',text:'test'},'synthetic-token',f),'LINE_BOOKING_REPLY_TRANSPORT_FAILED',false],
  ['owner push',f=>Approval.pushMessage(OWNER,{type:'text',text:'test'},env(),f),'LINE_SEND_TRANSPORT_FAILED',false],
  ['owner reply',f=>Approval.replyMessage('synthetic-reply',{type:'text',text:'test'},env(),f),'LINE_SEND_TRANSPORT_FAILED',false],
  ['customer decision push',f=>Messaging.pushText({to:CUSTOMER,text:'test'},{token:'synthetic-token',
    retryKey:'123e4567-e89b-42d3-a456-426614174000',fetchImpl:f}),'LINE_PUSH_FAILED',true],
  ['inbox profile read',f=>Messaging.getProfile(CUSTOMER,'synthetic-token',f),'LINE_PROFILE_FAILED',true]
];
for(const [name,run,code,readsBody] of cases){
  for(const stage of readsBody?['headers','body']:['headers']){
    test(name+' bounds stalled '+stage+' to six seconds without retry',async()=>withClock(async clock=>{
      let signal,calls=0,outcome;
      const pending=run(async(_url,options)=>{calls++;signal=options.signal;
        return stage==='headers'?never():{...response(''),text:never};});
      pending.then(value=>{outcome={value};},error=>{outcome={error};});
      await drain();await clock.tick(5999);assert.equal(outcome,undefined,'operation must retain its available budget');
      await clock.tick(1);assert.ok(outcome,'hung operation must settle at the absolute deadline');
      assert.equal(outcome.error&&outcome.error.code,code);
      assert.equal(signal&&signal.aborted,true,'deadline must abort its underlying request');
      await clock.tick(6000);assert.equal(calls,1,'timeout never authorizes a retry');
      assert.equal(clock.timers.size,0);
    }));
  }
}
test('Apps Script headers and response body share one absolute budget',async()=>withClock(async clock=>{
  let resolveHeaders,signal,outcome;
  const pending=Approval.appsScriptCall({action:'createLineBookingPending'},env(),async(_u,o)=>{
    signal=o.signal;return new Promise(resolve=>{resolveHeaders=resolve;});});
  pending.then(value=>{outcome={value};},error=>{outcome={error};});
  await drain();await clock.tick(4000);resolveHeaders({...response(''),text:never});await drain();
  await clock.tick(1999);assert.equal(outcome,undefined);await clock.tick(1);
  assert.equal(outcome&&outcome.error&&outcome.error.code,'LINE_BOOKING_UPSTREAM_TRANSPORT_FAILED');
  assert.equal(signal&&signal.aborted,true);assert.equal(clock.timers.size,0);
}));
for(const stage of ['headers','body']){
  test('event-local shared WebReady '+stage+' timeout remains one read and no canonical write',async()=>withClock(async clock=>{
    let reads=0,replies=0,signal,outcome;
    const event={type:'message',source:{type:'user',userId:CUSTOMER},replyToken:'synthetic-reply',
      message:{type:'text',text:'Event: Synthetic Concert\nDate: 13 Nov 2026\nVenue: Test Hall\nPackage / model: S25 Ultra\nNickname: Test'}};
    const pending=Webhook.processEvent(event,{LINE_CHANNEL_ACCESS_TOKEN:'synthetic-token'},async(url,options)=>{
      if(url.includes('08_Web_Ready')){reads++;signal=options.signal;
        return stage==='headers'?never():{...response(''),text:never};}
      if(url.endsWith('/reply')){replies++;return response({});}
      throw Error('canonical write or extra lookup forbidden after public read timeout');
    });
    pending.then(value=>{outcome={value};},error=>{outcome={error};});
    await drain();await clock.tick(6000);
    assert.equal(outcome&&outcome.value&&outcome.value.automation_status,'REPLY_ONLY');
    assert.equal(outcome.value.booking_id,'');assert.equal(reads,1);assert.equal(replies,1);
    assert.equal(signal&&signal.aborted,true);assert.equal(clock.timers.size,0);
  }));
}
test('successful Apps Script body clears its deadline without aborting or retrying',async()=>withClock(async clock=>{
  let signal,calls=0;
  const result=await Approval.appsScriptCall({action:'createLineBookingPending'},env(),async(_u,o)=>{
    calls++;signal=o.signal;return response({ok:true,data:{booking_id:BOOKING}});});
  assert.equal(result.data.booking_id,BOOKING);assert.equal(clock.timers.size,0);
  await clock.tick(6000);assert.equal(signal&&signal.aborted,false);assert.equal(calls,1);
}));
test('post-claim provider body timeout settles UNCERTAIN and never acknowledges owner success',async()=>withClock(async clock=>{
  const e={...env(),KK_LINE_OWNER_OUTBOX_V1_ENABLED:'true',
    KK_LINE_OWNER_OUTBOX_DISPATCH_SECRET:'synthetic_dispatch_secret_20261113'};
  const calls=[];let providerSignal,outcome;
  const event={type:'postback',source:{type:'user',userId:OWNER},replyToken:'synthetic-owner-reply',
    postback:{data:Approval.decisionData('approve',BOOKING,e)}};
  const pending=Approval.processOwnerPostback(event,e,async(url,options)=>{
    const body=JSON.parse(options.body);calls.push(body.action||url.split('/').pop());
    if(url.endsWith('/push')){providerSignal=options.signal;return {...response(''),text:never};}
    if(url.endsWith('/reply'))throw Error('owner success reply forbidden');
    const base={ok:true,booking_id:BOOKING,decision:'approve',outbox_id:OUTBOX,outbox_mode:'KK_LINE_OWNER_OUTBOX_V1'};
    if(body.action==='lineOwnerOutboxReadiness')return response({ok:true,ready:true,columns:11,outbox_mode:'KK_LINE_OWNER_OUTBOX_V1'});
    if(body.action==='decideLineBookingPending')return response({...base,booking_status:'confirmed',idempotent_replay:false,outbox_state:'READY'});
    if(body.action==='claimLineBookingDecisionDelivery')return response({...base,claimed:true,
      outbox_state:'CLAIMED',retry_key:body.retry_key,customer_contact:CUSTOMER});
    if(body.action==='settleLineBookingDecisionDelivery'){
      assert.equal(body.delivery_state,'UNCERTAIN');assert.equal(body.provider_message_id,'');
      return response({...base,outbox_state:body.delivery_state});}
    throw Error('unexpected synthetic boundary');
  });
  pending.then(value=>{outcome={value};},error=>{outcome={error};});await drain();await clock.tick(6000);
  assert.equal(outcome&&outcome.value&&outcome.value.status,'DELIVERY_REVIEW_REQUIRED');
  assert.equal(outcome.value.delivery_status,'UNCERTAIN');assert.equal(outcome.value.customer_notifications,0);
  assert.equal(providerSignal&&providerSignal.aborted,true);
  assert.deepEqual(calls,['lineOwnerOutboxReadiness','decideLineBookingPending',
    'claimLineBookingDecisionDelivery','push','settleLineBookingDecisionDelivery']);
  assert.equal(clock.timers.size,0);
}));
