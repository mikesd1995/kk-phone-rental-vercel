'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Handler=require('../server/line-booking-webhook.js');

test('LINE inbox persistence remains disabled when durable credentials are absent',()=>{
 assert.equal(Handler._test.inboxPersistFn({},async()=>{throw new Error('network must not run');}),null);
});
test('LINE inbox persistence uses dedicated server credentials only',async()=>{
 let call;
 const persist=Handler._test.inboxPersistFn({
  KK_INBOX_SUPABASE_URL:'https://example.supabase.co',
  KK_INBOX_SUPABASE_SERVICE_ROLE_KEY:'server-secret'
 },async(url,opt)=>{call={url,opt};return{ok:true,status:200,text:async()=>JSON.stringify([{duplicate:false,writes:1}])};});
 const r=await persist({message_id:'m1'});
 assert.equal(r.writes,1);
 assert.match(call.url,/\/rest\/v1\/rpc\/kk_inbox_persist_inbound$/);
 assert.equal(call.opt.headers.Authorization,'Bearer server-secret');
});
