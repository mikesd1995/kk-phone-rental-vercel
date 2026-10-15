'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Approval=require('../server/line-booking-owner-approval');
const ENV={
 KK_LINE_BOOKING_AUTOMATION_ENABLED:'true',
 KK_ADMIN_SCRIPT_URL:'https://script.google.com/macros/s/TEST_ONLY/exec',
 KK_ADMIN_API_KEY:'synthetic-api-key',
 LINE_CHANNEL_ACCESS_TOKEN:'synthetic-line-token',
 LINE_CHANNEL_SECRET:'synthetic-line-secret',
 KK_OWNER_LINE_USER_ID:'UOWNER',KK_OWNER_LINE_TARGET_ID:'UOWNER'
};
const SECRET_MARKER='SYNTHETIC_PRIVATE_CONTACT_0001234567';
function response(body,status=200){
 return {ok:status>=200&&status<300,status,
  text:async()=>typeof body==='string'?body:JSON.stringify(body)};
}
function event(decision,id='BK-SYNTHETIC'){
 return {type:'postback',replyToken:'synthetic-owner-reply',source:{type:'user',userId:'UOWNER'},
  postback:{data:Approval.decisionData(decision,id,ENV)}};
}
function canonical(decision,id){
 return {ok:true,booking_id:id,booking_status:decision==='approve'?'confirmed':'cancelled',
         customer_contact:'UCUSTOMER',idempotent_replay:false,decision};
}
test('Apps Script HTTP failure never exposes untrusted response body or error_code',async()=>{
 let calls=0;
 await assert.rejects(()=>Approval.appsScriptCall({action:'decideLineBookingPending'},ENV,async()=>{
  calls++;return response({ok:false,error:SECRET_MARKER,error_code:'LINE_SECRET_'+SECRET_MARKER},403);
 }),err=>{
  assert.equal(err.code,'LINE_BOOKING_UPSTREAM_FAILED');
  assert.equal(err.status,403);
  assert.doesNotMatch(err.message,/SYNTHETIC_PRIVATE|0001234567|LINE_SECRET_/);
  assert.doesNotMatch(err.code,/SYNTHETIC_PRIVATE|0001234567|LINE_SECRET_/);
  return true;
 });
 assert.equal(calls,1);
});
test('Apps Script 200 business rejection sanitizes message and code',async()=>{
 await assert.rejects(()=>Approval.appsScriptCall({action:'decideLineBookingPending'},ENV,async()=>
  response({ok:false,error:SECRET_MARKER,error_code:'UPSTREAM_'+SECRET_MARKER})),
  err=>err.code==='LINE_BOOKING_UPSTREAM_FAILED'&&!err.message.includes(SECRET_MARKER));
});
test('Apps Script invalid JSON never echoes raw payload or sends LINE',async()=>{
 let calls=0;
 await assert.rejects(()=>Approval.processOwnerPostback(event('approve'),ENV,async url=>{
  calls++;
  if(url.startsWith('https://script.google.com/'))return response('<html>'+SECRET_MARKER+'</html>',502);
  throw Error('No LINE send should happen');
 }),err=>{
  assert.equal(err.code,'LINE_BOOKING_UPSTREAM_NON_JSON');
  assert.doesNotMatch(err.message,/SYNTHETIC_PRIVATE|0001234567/);return true;
 });
 assert.equal(calls,1);
});
test('LINE provider rejected push has stable diagnostic and status only',async()=>{
 let calls=0;
 await assert.rejects(()=>Approval.pushMessage('UCUSTOMER',{type:'text',text:'synthetic'},ENV,async()=>{
  calls++;return response(SECRET_MARKER,429);
 }),err=>{
  assert.equal(err.code,'LINE_SEND_FAILED');
  assert.equal(err.status,429);
  assert.doesNotMatch(err.message,/SYNTHETIC_PRIVATE|0001234567/);return true;
 });
 assert.equal(calls,1);
});
test('fresh owner decision: provider push failure cannot ACK owner or log response body',async()=>{
 const calls=[];
 await assert.rejects(()=>Approval.processOwnerPostback(event('approve','BK-PUSH-REJECT'),ENV,async(url)=>{
  calls.push(url);
  if(url.startsWith('https://script.google.com/'))return response(canonical('approve','BK-PUSH-REJECT'));
  return response(SECRET_MARKER,503);
 }),err=>err.code==='LINE_SEND_FAILED'&&err.status===503&&!err.message.includes(SECRET_MARKER));
 assert.equal(calls.length,2);
 assert.match(calls[1],/\/push$/);
});
test('fresh reject: provider push failure cannot ACK owner',async()=>{
 const calls=[];
 await assert.rejects(()=>Approval.processOwnerPostback(event('reject','BK-REJECT'),ENV,async(url)=>{
  calls.push(url);
  if(url.startsWith('https://script.google.com/'))return response(canonical('reject','BK-REJECT'));
  return response(SECRET_MARKER,500);
 }),err=>err.code==='LINE_SEND_FAILED'&&err.status===500);
 assert.equal(calls.length,2);
 assert.match(calls[1],/\/push$/);
});
test('canonical writer decision mismatch cannot trigger customer or owner message',async()=>{
 const calls=[];
 await assert.rejects(()=>Approval.processOwnerPostback(event('approve','BK-MISMATCH'),ENV,async url=>{
  calls.push(url);
  if(url.startsWith('https://script.google.com/'))
   return response({...canonical('approve','BK-MISMATCH'),decision:'reject'});
  throw Error('Must not send LINE');
 }),err=>err.code==='LINE_OWNER_DECISION_READBACK_MISMATCH');
 assert.equal(calls.length,1);
});
test('replayed owner decision remains zero-send even when canonical has no contact',async()=>{
 const calls=[];
 const r=await Approval.processOwnerPostback(event('approve','BK-REPLAY'),ENV,async url=>{
  calls.push(url);
  if(url.startsWith('https://script.google.com/'))return response({
   ok:true,booking_id:'BK-REPLAY',booking_status:'confirmed',idempotent_replay:true,decision:'approve'});
  throw Error('No outbound LINE on replay');
 });
 assert.equal(r.status,'ALREADY_APPLIED');
 assert.equal(r.requires_manual_delivery_review,true);
 assert.equal(calls.length,1);
});
test('owner reply failure after one customer push has no blind retry',async()=>{
 const calls=[];
 await assert.rejects(()=>Approval.processOwnerPostback(event('approve','BK-REPLY-FAIL'),ENV,async url=>{
  calls.push(url);
  if(url.startsWith('https://script.google.com/'))return response(canonical('approve','BK-REPLY-FAIL'));
  if(url.endsWith('/push'))return response({ok:true});
  return response(SECRET_MARKER,429);
 }),err=>err.code==='LINE_SEND_FAILED'&&err.status===429&&!err.message.includes(SECRET_MARKER));
 assert.equal(calls.length,3);
 assert.match(calls[1],/\/push$/);
 assert.match(calls[2],/\/reply$/);
});
test('compatible Apps Script response with absent optional decision still blocks ambiguity via replay flag',async()=>{
 const calls=[];
 const r=await Approval.processOwnerPostback(event('approve','BK-LEGACY'),ENV,async url=>{
  calls.push(url);
  if(url.startsWith('https://script.google.com/'))return response({
   ok:true,booking_id:'BK-LEGACY',booking_status:'confirmed',customer_contact:'UCUSTOMER',idempotent_replay:false});
  return response({ok:true});
 });
 assert.equal(r.status,'CONFIRMED');
 assert.equal(calls.length,3);
});
