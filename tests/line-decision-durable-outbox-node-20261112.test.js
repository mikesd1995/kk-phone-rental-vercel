'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Approval=require('../server/line-booking-owner-approval');

const CUSTOMER='U'+'a'.repeat(32), BOOKING='BK-20261112-001';
const VERSION='KK_LINE_DECISION_OUTBOX_V1';
const env=()=>({
  KK_LINE_BOOKING_AUTOMATION_ENABLED:'true',
  KK_LINE_DECISION_DURABLE_OUTBOX_ENABLED:'true',
  KK_ADMIN_SCRIPT_URL:'https://script.google.com/macros/s/TEST/exec',
  KK_ADMIN_API_KEY:'test-key',
  LINE_CHANNEL_ACCESS_TOKEN:'test-token',
  LINE_CHANNEL_SECRET:'test-secret',
  KK_OWNER_LINE_USER_ID:'UOWNER'
});
const response=(body,status=200)=>({
  ok:status>=200&&status<300,status,text:async()=>JSON.stringify(body)
});
const ownerEvent=e=>({
  type:'postback',replyToken:'synthetic-reply',
  source:{type:'user',userId:'UOWNER'},
  postback:{data:Approval.decisionData('approve',BOOKING,e)}
});
function decision(replay=false){
  return {ok:true,booking_id:BOOKING,booking_status:'confirmed',decision:'approve',
    idempotent_replay:replay,customer_contact:CUSTOMER,
    outbox_version:VERSION,delivery_state:'PREPARED'};
}
function claim(state='CLAIMED',claimed=true){
  return {ok:true,booking_id:BOOKING,booking_status:'confirmed',decision:'approve',
    outbox_version:VERSION,delivery_state:state,claimed,
    claim_id:'234e4567-e89b-42d3-a456-426614174000',customer_contact:CUSTOMER};
}
function ack(){
  return {ok:true,booking_id:BOOKING,booking_status:'confirmed',decision:'approve',
    outbox_version:VERSION,delivery_state:'SENT',
    claim_id:'234e4567-e89b-42d3-a456-426614174000'};
}
function simulate(overrides={}){
  const calls=[],e=overrides.env||env();
  const fetchImpl=async(url,options)=>{
    const action=url.startsWith('https://script.google.com/')
      ?JSON.parse(options.body).action:url.endsWith('/push')?'PUSH':'REPLY';
    calls.push({action,options});
    if(overrides[action])return overrides[action](options);
    if(action==='decideLineBookingPending')return response(decision(overrides.replay===true));
    if(action==='claimLineBookingDecisionDelivery')return response(claim());
    if(action==='ackLineBookingDecisionDelivery')return response(ack());
    if(action==='markLineBookingDecisionUncertain')return response({
      ok:true,booking_id:BOOKING,decision:'approve',outbox_version:VERSION,delivery_state:'UNCERTAIN'
    });
    if(action==='PUSH')return response({sentMessages:[{id:'17592423394857'}]});
    if(action==='REPLY')return response({sentMessages:[{id:'17592423394858'}]});
    throw Error('unhandled synthetic action '+action);
  };
  return {e,calls,fetchImpl};
}

test('v2 initial owner approval: decision -> claim -> provider receipt -> ack -> owner reply',async()=>{
  const s=simulate();
  const out=await Approval.processOwnerPostback(ownerEvent(s.e),s.e,s.fetchImpl);
  assert.equal(out.status,'CONFIRMED');
  assert.equal(out.delivery_state,'SENT');
  assert.deepEqual(s.calls.map(c=>c.action),[
    'decideLineBookingPending','claimLineBookingDecisionDelivery',
    'PUSH','ackLineBookingDecisionDelivery','REPLY'
  ]);
  assert.equal(JSON.parse(s.calls[2].options.body).to,CUSTOMER);
  const ackBody=JSON.parse(s.calls[3].options.body);
  assert.equal(ackBody.provider_message_id,'17592423394857');
  assert.equal(ackBody.claim_id,'234e4567-e89b-42d3-a456-426614174000');
});

test('v2 crash after canonical decision: replay with PREPARED intent sends once',async()=>{
  const s=simulate({replay:true});
  const out=await Approval.processOwnerPostback(ownerEvent(s.e),s.e,s.fetchImpl);
  assert.equal(out.delivery_state,'SENT');
  assert.equal(s.calls.filter(c=>c.action==='PUSH').length,1);
});

test('v2 claimed, uncertain or sent replay never calls provider',async()=>{
  for(const state of ['CLAIMED','UNCERTAIN','SENT']){
    const s=simulate({replay:true,claimLineBookingDecisionDelivery:()=>response(claim(state,false))});
    const out=await Approval.processOwnerPostback(ownerEvent(s.e),s.e,s.fetchImpl);
    assert.equal(out.status,'DELIVERY_REVIEW_REQUIRED');
    assert.equal(out.delivery_state,state);
    assert.equal(out.requires_manual_delivery_review,true);
    assert.deepEqual(s.calls.map(c=>c.action),[
      'decideLineBookingPending','claimLineBookingDecisionDelivery'
    ]);
  }
});

test('v2 provider timeout marks uncertain without owner success or resend',async()=>{
  const s=simulate({PUSH:async()=>{throw Error('untrusted customer phone secret')}});
  await assert.rejects(
    ()=>Approval.processOwnerPostback(ownerEvent(s.e),s.e,s.fetchImpl),
    error=>error.code==='LINE_DELIVERY_TRANSPORT_UNCERTAIN' &&
      !String(error.message).includes('secret')
  );
  assert.deepEqual(s.calls.map(c=>c.action),[
    'decideLineBookingPending','claimLineBookingDecisionDelivery',
    'PUSH','markLineBookingDecisionUncertain'
  ]);
});

test('v2 missing provider receipt becomes uncertain; no ACK or owner success',async()=>{
  const s=simulate({PUSH:()=>response({sentMessages:[]})});
  await assert.rejects(
    ()=>Approval.processOwnerPostback(ownerEvent(s.e),s.e,s.fetchImpl),
    error=>error.code==='LINE_DELIVERY_RECEIPT_UNVERIFIED'
  );
  assert.equal(s.calls.some(c=>c.action==='ackLineBookingDecisionDelivery'),false);
  assert.equal(s.calls.at(-1).action,'markLineBookingDecisionUncertain');
  assert.equal(s.calls.some(c=>c.action==='REPLY'),false);
});

test('v2 ACK failure becomes uncertain and does not reply success to owner',async()=>{
  const s=simulate({ackLineBookingDecisionDelivery:()=>response({
    ok:false,error:'fake provider customer contact'
  },503)});
  await assert.rejects(
    ()=>Approval.processOwnerPostback(ownerEvent(s.e),s.e,s.fetchImpl),
    error=>error.code==='LINE_BOOKING_UPSTREAM_FAILED' && !String(error.message).includes('contact')
  );
  assert.deepEqual(s.calls.map(c=>c.action),[
    'decideLineBookingPending','claimLineBookingDecisionDelivery',
    'PUSH','ackLineBookingDecisionDelivery','markLineBookingDecisionUncertain'
  ]);
});

test('new GAS outbox without enabled sender fails closed before LINE',async()=>{
  const e={...env(),KK_LINE_DECISION_DURABLE_OUTBOX_ENABLED:'false'};
  const s=simulate({env:e});
  await assert.rejects(
    ()=>Approval.processOwnerPostback(ownerEvent(e),e,s.fetchImpl),
    error=>error.code==='LINE_DECISION_OUTBOX_SENDER_DISABLED'
  );
  assert.deepEqual(s.calls.map(c=>c.action),['decideLineBookingPending']);
});

test('enabled sender refuses old GAS contract after booking decision',async()=>{
  const s=simulate({decideLineBookingPending:()=>response({
    ok:true,booking_id:BOOKING,booking_status:'confirmed',
    decision:'approve',idempotent_replay:false,customer_contact:CUSTOMER
  })});
  await assert.rejects(
    ()=>Approval.processOwnerPostback(ownerEvent(s.e),s.e,s.fetchImpl),
    error=>error.code==='LINE_DECISION_OUTBOX_CONTRACT_REQUIRED'
  );
  assert.deepEqual(s.calls.map(c=>c.action),['decideLineBookingPending']);
});

test('malformed claim readback cannot authorize provider send',async()=>{
  for(const invalid of [
    {...claim(),booking_id:'BK-OTHER'},
    {...claim(),customer_contact:'attacker@example.com'},
    {...claim(),customer_contact:'U'+'b'.repeat(32)},
    {...claim(),claim_id:'not-uuid'},
    {...claim(),claimed:'true'},
    {...claim(),delivery_state:'SENT'}
  ]){
    const s=simulate({claimLineBookingDecisionDelivery:()=>response(invalid)});
    await assert.rejects(
      ()=>Approval.processOwnerPostback(ownerEvent(s.e),s.e,s.fetchImpl),
      error=>error.code==='LINE_DELIVERY_CLAIM_READBACK_INVALID'
    );
    assert.equal(s.calls.some(c=>c.action==='PUSH'),false);
  }
});

test('missing verified LINE recipient in canonical decision prevents claim and sends',async()=>{
  const s=simulate({decideLineBookingPending:()=>response({
    ...decision(),customer_contact:'not-a-line-id'
  })});
  await assert.rejects(
    ()=>Approval.processOwnerPostback(ownerEvent(s.e),s.e,s.fetchImpl),
    error=>error.code==='LINE_DELIVERY_RECIPIENT_READBACK_REQUIRED'
  );
  assert.deepEqual(s.calls.map(c=>c.action),['decideLineBookingPending']);
});
