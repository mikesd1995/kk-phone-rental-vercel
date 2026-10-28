'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const Webhook=require('../server/kk-line-webhook.js');

const SECRET='synthetic-line-channel-secret-not-production';
function signed(events, overrides={}) {
  const payload=Object.hasOwn(overrides,'payload')?overrides.payload:{events};
  const rawBody=JSON.stringify(payload);
  const signature=crypto.createHmac('sha256',SECRET).update(rawBody).digest('base64');
  return {rawBody,signature,channelSecret:SECRET};
}
function event(overrides={}){
  return {
    type:'message',
    source:{type:'user',userId:'synthetic-user'},
    webhookEventId:'synthetic-hook-1',
    timestamp:1772000000000,
    message:{type:'text',id:'synthetic-msg-1',text:'hello'},
    ...overrides
  };
}

test('signed valid LINE message has stable normalized shape and preserves text',async()=>{
  const saved=[];
  const r=await Webhook.ingest(signed([event()]),{persistFn:async msg=>{saved.push(msg);return {duplicate:false};}});
  assert.equal(r.http_status,200);
  assert.equal(r.status,'ACCEPTED');
  assert.equal(r.writes,1);
  assert.equal(saved.length,1);
  assert.equal(saved[0].text,'hello');
  assert.equal(saved[0].external_message_id,'synthetic-hook-1');
  assert.equal(saved[0].channel,'line');
});
test('signed malformed event members do not prevent the following valid message',async()=>{
  const malformed=[
    null,false,'unexpected',42,[],{},
    {type:'message',source:null,message:{id:'bad'}},
    {type:'message',source:{userId:'someone'},message:null},
    {type:'message',source:{userId:'someone'},message:{type:'text',text:'missing ID'}},
    {type:'follow',source:{userId:'someone'},webhookEventId:'follow'}
  ];
  const saved=[];
  const r=await Webhook.ingest(signed([...malformed,event()]),{persistFn:async msg=>{saved.push(msg);return {duplicate:false};}});
  assert.equal(r.writes,1);
  assert.equal(r.messages.length,1);
  assert.equal(saved.length,1);
});
test('oversized timestamp is tolerated and inbound receipt remains a real ISO date',async()=>{
  const r=await Webhook.ingest(signed([event({timestamp:1e25})]),{persistFn:async()=>({duplicate:false})});
  assert.equal(r.writes,1);
  assert.ok(Number.isFinite(Date.parse(r.messages[0].received_at)));
});
test('non-numeric and missing timestamps use safe receive-time fallback',async()=>{
  for(const timestamp of ['n/a',undefined,null]){
    const r=await Webhook.ingest(signed([event({timestamp})]),{persistFn:async()=>({duplicate:false})});
    assert.equal(r.writes,1);
    assert.ok(Math.abs(Date.now()-Date.parse(r.messages[0].received_at))<15000);
  }
});
test('valid timestamp is preserved, including redelivery and group identity',()=>{
  const e=event({source:{type:'group',groupId:'synthetic-group'},deliveryContext:{isRedelivery:true}});
  const msg=Webhook.normalizeEvent(e);
  assert.equal(msg.external_user_id,'synthetic-group');
  assert.equal(msg.redelivery,true);
  assert.equal(msg.received_at,new Date(1772000000000).toISOString());
});
test('payload null, primitive or missing events fail safely with no writes',async()=>{
  for(const payload of [null,false,42,'hi',{events:null},{events:{}},{events:[]}]) {
    const r=await Webhook.ingest(signed([], {payload}));
    assert.equal(r.status,'ACCEPTED_NO_EVENTS');
    assert.equal(r.http_status,200);
    assert.equal(r.writes,0);
  }
});
test('missing persistence prevents any acknowledgement of meaningful inbound message',async()=>{
  const r=await Webhook.ingest(signed([event()]));
  assert.equal(r.status,'BLOCKED_PERSISTENCE_UNAVAILABLE');
  assert.equal(r.http_status,503);
  assert.equal(r.writes,0);
});
test('wrong HMAC rejects and never invokes persistence',async()=>{
  let writes=0;
  const bad=signed([event()]);bad.channelSecret='wrong-secret';
  const r=await Webhook.ingest(bad,{persistFn:async()=>{writes++;return {duplicate:false};}});
  assert.equal(r.status,'REJECTED_INVALID_SIGNATURE');
  assert.equal(r.http_status,401);
  assert.equal(writes,0);
});
test('signed invalid JSON is rejected, with no writes',async()=>{
  const rawBody='{broken';
  const signature=crypto.createHmac('sha256',SECRET).update(rawBody).digest('base64');
  const r=await Webhook.ingest({rawBody,signature,channelSecret:SECRET});
  assert.equal(r.status,'REJECTED_INVALID_JSON');
  assert.equal(r.http_status,400);
  assert.equal(r.writes,0);
});
test('duplicate receipt remains counted separately, no extra persisted write',async()=>{
  const r=await Webhook.ingest(signed([event()]),{persistFn:async()=>({duplicate:true})});
  assert.equal(r.writes,0);
  assert.equal(r.duplicates,1);
});
test('persistence errors do not turn failed inbox writes into acknowledged success',async()=>{
  await assert.rejects(()=>Webhook.ingest(signed([event()]),{persistFn:async()=>{throw Error('synthetic transient failure');}}),/synthetic transient failure/);
});
test('normalized event intentionally excludes unreviewed raw fields',()=>{
  const msg=Webhook.normalizeEvent(event({accessToken:'not-to-be-exposed',source:{userId:'synthetic-user',phone:'not-to-be-exposed'}}));
  assert.equal(msg.accessToken,undefined);
  assert.equal(msg.phone,undefined);
});
