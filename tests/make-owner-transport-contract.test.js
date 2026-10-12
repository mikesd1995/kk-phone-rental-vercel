'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../server/make-owner-transport-contract.js');

const KEY='a-test-only-signing-key-not-used-in-production';
const NOW=new Date('2026-10-12T10:00:00.000Z');
const fields={
  notification_id:'notify_20261012_123456',
  request_id:'request_20261012_123456',
  event_type:'OWNER_ALERT',
  entity_id:'EVT-20261012-TEST',
  content_version:'a'.repeat(64),
  text:'Owner alert: event verified. No business write authorized.'
};
const signed=()=>C.buildEnvelope(fields,KEY,NOW);

test('owner-only signed envelope validates at creation',()=>{
  const e=signed();
  assert.equal(e.audience,C.AUDIENCE);
  assert.equal(C.verifyEnvelope(e,KEY,NOW).ok,true);
  assert.equal(e.chat_id,undefined);
});
test('tampering message, event, identity or revision breaks authorization',()=>{
  for(const patch of [
    {text:'Injected message'}, {event_type:'OWNER_APPROVAL_PREVIEW'},
    {entity_id:'EVT-OTHER'}, {content_version:'b'.repeat(64)},
    {notification_id:'notify_20261012_other'}
  ]){
    const result=C.verifyEnvelope({...signed(),...patch},KEY,NOW);
    assert.equal(result.ok,false,JSON.stringify(patch));
  }
});
test('old queued deliveries expire within two minutes',()=>{
  const envelope=signed();
  assert.equal(C.verifyEnvelope(envelope,KEY,new Date(NOW.getTime()+120000)).error_code,'TRANSPORT_EXPIRED');
  assert.equal(C.verifyEnvelope(envelope,KEY,new Date(NOW.getTime()+86400000)).error_code,'TRANSPORT_EXPIRED');
});
test('wrong audience, arbitrary targets, booking mutations and publishing are forbidden',()=>{
  for(const patch of [
    {audience:'ANY'},
    {chat_id:'untrusted'},
    {recipient:'customer'},
    {booking_status:'confirmed'},
    {price_write:true},
    {publish_x:true},
    {event_type:'BOOKING_CONFIRM'}
  ]){
    assert.equal(C.verifyEnvelope({...signed(),...patch},KEY,NOW).ok,false,JSON.stringify(patch));
  }
});
test('no secret, signature forgery, malformed signature and clock future fail closed',()=>{
  assert.equal(C.verifyEnvelope(signed(),'',NOW).error_code,'SIGNING_KEY_MISSING');
  assert.equal(C.verifyEnvelope({...signed(),signature:'abc'},KEY,NOW).error_code,'SIGNATURE_INVALID');
  assert.equal(C.verifyEnvelope(signed(),KEY,new Date(NOW.getTime()-16000)).error_code,'TRANSPORT_EXPIRED');
});
test('oversized text and missing exact content version are rejected by signer',()=>{
  for(const patch of [{text:'x'.repeat(2050)},{content_version:''},{event_type:'X_POST'}]){
    assert.throws(()=>C.buildEnvelope({...fields,...patch},KEY,NOW));
  }
});
test('delivery fails closed without durable atomic claim',async()=>{
  const result=await C.prepareDispatch(signed(),{secret:KEY,now:NOW,ownerChatId:'-555'});
  assert.equal(result.send_allowed,false);
  assert.equal(result.error_code,'DURABLE_CLAIM_UNAVAILABLE');
});
test('duplicate/rejected/uncertain claim never produces send authorization',async()=>{
  for(const status of ['DUPLICATE','ALREADY_SENT','UNKNOWN','CONFLICT']){
    const result=await C.prepareDispatch(signed(),{
      secret:KEY,now:NOW,ownerChatId:'-555',
      claimFn:async()=>({status,receipt_id:'11111111-2222-4333-8444-555555555555'})
    });
    assert.equal(result.send_allowed,false,status);
    assert.equal(result.provider_sends,0);
  }
});
test('owner chat is a trusted server option, not caller payload',async()=>{
  let seen;
  const result=await C.prepareDispatch(signed(),{
    secret:KEY,now:NOW,ownerChatId:'-555',
    claimFn:async req=>{seen=req;return {status:'RESERVED',receipt_id:'11111111-2222-4333-8444-555555555555'};}
  });
  assert.equal(result.send_allowed,true);
  assert.equal(result.target_chat_id,'-555');
  assert.equal(result.receipt_id,'11111111-2222-4333-8444-555555555555');
  assert.equal(result.provider_sends,0);
  assert.equal(seen.entity_id,fields.entity_id);
  assert.equal(seen.text_sha256,C.hash(fields.text));
  assert.equal(seen.text,undefined);
});
test('claim failure or missing owner chat cannot authorize dispatch',async()=>{
  const a=await C.prepareDispatch(signed(),{secret:KEY,now:NOW,ownerChatId:'-555',claimFn:async()=>{throw Error('db down');}});
  assert.equal(a.error_code,'DURABLE_CLAIM_FAILED');
  const b=await C.prepareDispatch(signed(),{secret:KEY,now:NOW,claimFn:async()=>({status:'RESERVED',receipt_id:'11111111-2222-4333-8444-555555555555'})});
  assert.equal(b.error_code,'OWNER_CHAT_NOT_CONFIGURED');
});

test('malformed reserved receipt cannot unlock provider send',async()=>{
  const r=await C.prepareDispatch(signed(),{
    secret:KEY,now:NOW,ownerChatId:'-555',
    claimFn:async()=>({status:'RESERVED',receipt_id:'not-a-uuid'})
  });
  assert.equal(r.send_allowed,false);
  assert.equal(r.error_code,'DISPATCH_NOT_RESERVED');
});
test('missing configured owner chat does not consume the durable reservation',async()=>{
  let claims=0;
  const r=await C.prepareDispatch(signed(),{
    secret:KEY,now:NOW,
    claimFn:async()=>{claims++;return {status:'RESERVED',receipt_id:'11111111-2222-4333-8444-555555555555'};}
  });
  assert.equal(r.send_allowed,false);
  assert.equal(r.error_code,'OWNER_CHAT_NOT_CONFIGURED');
  assert.equal(claims,0);
});

test('null, arrays and primitive envelopes are rejected without a parser exception',()=>{
  for(const value of [null,[],42,'invalid']){
    assert.doesNotThrow(()=>C.verifyEnvelope(value,KEY,NOW));
    const r=C.verifyEnvelope(value,KEY,NOW);
    assert.equal(r.ok,false);
    assert.equal(r.error_code,'TRANSPORT_ENVELOPE_INVALID');
  }
});
test('unsigned shadow fields are forbidden even when signature for known fields is valid',()=>{
  for(const field of ['owner_approved','chatId','reply_markup','booking_id','price']){
    const r=C.verifyEnvelope({...signed(),[field]:'injected'},KEY,NOW);
    assert.equal(r.ok,false,field);
    assert.equal(r.error_code,'FORBIDDEN_TRANSPORT_FIELD');
  }
});
