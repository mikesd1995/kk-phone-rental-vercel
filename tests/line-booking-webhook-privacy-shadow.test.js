'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Webhook=require('../server/line-booking-webhook')._test;
const SECRET='SYNTHETIC_CUSTOMER_PRIVATE_0123456789';
const ENV={KK_LINE_BOOKING_AUTOMATION_ENABLED:'true',
 KK_ADMIN_SCRIPT_URL:'https://script.google.com/macros/s/SYNTHETIC/exec',
 KK_ADMIN_API_KEY:'mock-admin-secret',LINE_CHANNEL_ACCESS_TOKEN:'mock-line-token',
 LINE_CHANNEL_SECRET:'mock-line-secret',KK_OWNER_LINE_USER_ID:'UOWNER',KK_OWNER_LINE_TARGET_ID:'UOWNER'};

test('LINE Booking Flex reply rejection never echoes untrusted provider response',async()=>{
 let calls=0;
 await assert.rejects(()=>Webhook.replyFlex('MOCK_REPLY',{type:'text',text:'synthetic'},ENV.LINE_CHANNEL_ACCESS_TOKEN,async()=>{
   calls++;return {ok:false,status:429,text:async()=>SECRET};
 }),err=>err.code==='LINE_BOOKING_REPLY_FAILED'&&err.status===429&&!err.message.includes(SECRET));
 assert.equal(calls,1);
});

test('LINE Booking Flex thrown transport error is sanitized without retry',async()=>{
 let calls=0;
 await assert.rejects(()=>Webhook.replyFlex('MOCK_REPLY',{type:'text',text:'synthetic'},ENV.LINE_CHANNEL_ACCESS_TOKEN,async()=>{
   calls++;throw Error('TLS private content '+SECRET);
 }),err=>err.code==='LINE_BOOKING_REPLY_TRANSPORT_FAILED'&&!err.message.includes(SECRET));
 assert.equal(calls,1);
});

test('canonical unresolved event warning carries no webhook ID, event name or customer content',async()=>{
 const warnings=[];
 const original=console.warn;
 console.warn=(...args)=>warnings.push(args.map(String).join(' '));
 let result;
 const event={type:'message',replyToken:'MOCK_REPLY',webhookEventId:'WEBHOOK_'+SECRET,
   message:{type:'text',text:'งาน: '+SECRET+'\nวันที่: 18/10/2026\nสถานที่: TEST VENUE\nรุ่น: vivo X300 Pro'}};
 try{
   result=await Webhook.processEvent(event,ENV,async url=>{
     if(String(url).startsWith('https://kk-phone-rental.vercel.app/api/kk-data'))
       return {ok:true,text:async()=> 'event_id,event_name,event_date_text,venue\n'};
     if(String(url).endsWith('/reply'))return {ok:true,status:200};
     throw Error('Unexpected outbound request '+String(url));
   });
 }finally{console.warn=original;}
 assert.equal(result.handled,true);
 assert.equal(result.automation_status,'CANONICAL_REQUIRED');
 assert.equal(warnings.length,1);
 assert.match(warnings[0],/PUBLIC_EVENT_NOT_BOOKABLE_OR_CANONICAL_UNVERIFIED/);
 assert.doesNotMatch(warnings[0],new RegExp(SECRET));
 assert.doesNotMatch(warnings[0],/webhook_event_id|event_name|WEBHOOK_/);
});
