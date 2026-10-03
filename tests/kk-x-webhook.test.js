'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const X=require('../server/kk-x-webhook');
const env={KK_X_CONSUMER_SECRET:'consumer-secret'};
test('CRC is HMAC-SHA256 and fails closed without consumer secret',()=>{
 const expected='sha256='+crypto.createHmac('sha256','consumer-secret').update('challenge').digest('base64');
 assert.deepEqual(X.crcResponse('challenge',env),{response_token:expected});
 assert.throws(()=>X.crcResponse('challenge',{}),/required/);
});
test('POST signature verifies exact raw body and rejects mutation',()=>{
 const raw=Buffer.from('{"direct_message_events":[]}');
 const sig='sha256='+crypto.createHmac('sha256','consumer-secret').update(raw).digest('base64');
 assert.equal(X.verifySignature(raw,sig,env),true);
 assert.equal(X.verifySignature(Buffer.from(raw+' '),sig,env),false);
 assert.equal(X.verifySignature(raw,sig,{}),false);
});
test('only valid message_create DM events enter normalization boundary',()=>{
 const out=X.inboundEvents({direct_message_events:[{id:'1',type:'message_create',created_timestamp:'10',message_create:{sender_id:'u1',target:{recipient_id:'owner'},message_data:{text:'hello'}}},{id:'2',type:'other'}]});
 assert.deepEqual(out,[{id:'1',created_timestamp:'10',sender_id:'u1',recipient_id:'owner',text:'hello'}]);
});
