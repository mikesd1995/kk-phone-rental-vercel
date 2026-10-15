'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Approval=require('../server/line-booking-owner-approval');
const ENV={KK_LINE_BOOKING_AUTOMATION_ENABLED:'true',
 KK_ADMIN_SCRIPT_URL:'https://script.google.com/macros/s/TEST_ONLY/exec',
 KK_ADMIN_API_KEY:'synthetic-admin-key',LINE_CHANNEL_ACCESS_TOKEN:'synthetic-token',
 LINE_CHANNEL_SECRET:'synthetic-secret',KK_OWNER_LINE_USER_ID:'UOWNER',KK_OWNER_LINE_TARGET_ID:'UOWNER'};
const upstream=body=>({ok:true,status:200,text:async()=>JSON.stringify(body)});
function event(decision,id,actor='UOWNER'){
 return {type:'postback',replyToken:'synthetic-owner-reply',
 source:{userId:actor},postback:{data:Approval.decisionData(decision,id,ENV)}};
}
test('undefined/null/string/numeric replay flags fail closed without customer/owner LINE sends',async()=>{
 for(const flag of [undefined,null,'true','false',0,1]){
  const calls=[];
  await assert.rejects(()=>Approval.processOwnerPostback(event('approve','BK-MOCK'),ENV,async url=>{
   calls.push(url);
   if(url.startsWith('https://script.google.com/'))return upstream({
    ok:true,booking_id:'BK-MOCK',booking_status:'confirmed',customer_contact:'UCUSTOMER',idempotent_replay:flag});
   throw Error('no outbound LINE for invalid replay flag');
  }),e=>e.code==='LINE_OWNER_DECISION_REPLAY_READBACK_REQUIRED');
  assert.equal(calls.length,1);
 }
});
test('replayed approvals/rejections need no customer contact and require manual delivery review',async()=>{
 for(const decision of ['approve','reject']){
  const calls=[],id='BK-'+decision;
  const result=await Approval.processOwnerPostback(event(decision,id),ENV,async url=>{
   calls.push(url);
   if(url.startsWith('https://script.google.com/'))return upstream({
    ok:true,booking_id:id,booking_status:decision==='approve'?'confirmed':'cancelled',idempotent_replay:true});
   throw Error('never send LINE on replay');
  });
  assert.equal(calls.length,1);
  assert.equal(result.status,'ALREADY_APPLIED');
  assert.equal(result.requires_manual_delivery_review,true);
  assert.equal(result.customer_notifications,0);
  assert.equal(result.owner_notifications,0);
 }
});
test('fresh decision sends customer first, then owner acknowledgement',async()=>{
 const calls=[];
 const result=await Approval.processOwnerPostback(event('approve','BK-NEW'),ENV,async url=>{
  calls.push(url);
  if(url.startsWith('https://script.google.com/'))return upstream({
   ok:true,booking_id:'BK-NEW',booking_status:'confirmed',customer_contact:'UCUSTOMER',idempotent_replay:false});
  return {ok:true,status:200};
 });
 assert.equal(result.status,'CONFIRMED');
 assert.equal(result.idempotent_replay,false);
 assert.equal(calls.length,3);
 assert.ok(calls[1].endsWith('/push'));
 assert.ok(calls[2].endsWith('/reply'));
});
test('wrong owner, missing contact and mismatch never send a LINE message',async()=>{
 let calls=0;
 const denied=await Approval.processOwnerPostback(event('reject','BK-DENIED','UATTACKER'),ENV,async()=>{calls++;throw Error('no network');});
 assert.equal(denied.status,'UNAUTHORIZED_OWNER');assert.equal(calls,0);
 for(const bad of [{booking_id:'OTHER',booking_status:'confirmed',customer_contact:'UCUSTOMER'},
                    {booking_id:'BK-FAIL',booking_status:'confirmed',customer_contact:''}]){
  const seen=[];
  await assert.rejects(()=>Approval.processOwnerPostback(event('approve','BK-FAIL'),ENV,async url=>{
   seen.push(url);
   if(url.startsWith('https://script.google.com/'))return upstream({ok:true,idempotent_replay:false,...bad});
   throw Error('no LINE sends');
  }),e=>['LINE_OWNER_DECISION_BOOKING_ID_MISMATCH','LINE_CUSTOMER_CONTACT_READBACK_REQUIRED'].includes(e.code));
  assert.equal(seen.length,1);
 }
});
