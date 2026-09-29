'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('crypto');
const Line=require('../server/kk-line-webhook.js');

const secret='test-secret';
function signed(payload){
 const raw=JSON.stringify(payload);
 return {raw,signature:crypto.createHmac('sha256',secret).update(Buffer.from(raw)).digest('base64')};
}
test('rejects spoofed webhook with zero writes',async()=>{
 let writes=0;
 const r=await Line.ingest({rawBody:'{"events":[]}',signature:'bad',channelSecret:secret},{persistFn:async()=>{writes++;}});
 assert.equal(r.status,'REJECTED_INVALID_SIGNATURE'); assert.equal(r.writes,0); assert.equal(writes,0);
});
test('verifies exact raw body before parsing',()=>{
 const raw='{"destination":"x","events":[]}';
 const sig=crypto.createHmac('sha256',secret).update(Buffer.from(raw)).digest('base64');
 assert.equal(Line.verifySignature(raw,sig,secret),true);
 assert.equal(Line.verifySignature(raw+'\n',sig,secret),false);
});
test('accepts LINE verification request with empty events',async()=>{
 const s=signed({destination:'U123',events:[]});
 const r=await Line.ingest({rawBody:s.raw,signature:s.signature,channelSecret:secret},{persistFn:async()=>({})});
 assert.equal(r.http_status,200); assert.equal(r.writes,0);
});
test('normalizes webhookEventId and redelivery',async()=>{
 const s=signed({events:[{type:'message',webhookEventId:'01ABC',timestamp:1790726400000,deliveryContext:{isRedelivery:true},source:{type:'user',userId:'U1'},message:{id:'m1',type:'text',text:'จองงานนี้ค่ะ'}}]});
 const stored=[];
 const r=await Line.ingest({rawBody:s.raw,signature:s.signature,channelSecret:secret},{persistFn:async m=>{stored.push(m);return {duplicate:false};}});
 assert.equal(r.writes,1); assert.equal(stored[0].external_message_id,'01ABC'); assert.equal(stored[0].redelivery,true); assert.equal(stored[0].text,'จองงานนี้ค่ะ');
});
test('fails closed when persistence is unavailable',async()=>{
 const s=signed({events:[{type:'message',webhookEventId:'01ABC',source:{type:'user',userId:'U1'},message:{id:'m1',type:'text',text:'hello'}}]});
 const r=await Line.ingest({rawBody:s.raw,signature:s.signature,channelSecret:secret});
 assert.equal(r.status,'BLOCKED_PERSISTENCE_UNAVAILABLE'); assert.equal(r.http_status,503); assert.equal(r.writes,0);
});
