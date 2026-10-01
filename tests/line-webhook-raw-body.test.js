'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {Readable}=require('node:stream');
const api=require('../api/line-webhook.js');
const hook=require('../server/line-booking-webhook.js');

test('dedicated LINE endpoint disables body parsing',()=>{
 assert.deepEqual(api.config,{api:{bodyParser:false}});
});

test('dedicated endpoint preserves exact JSON bytes for LINE HMAC',async()=>{
 const exact=' { "events" : [ ] }\n';
 const req=Readable.from([Buffer.from(exact.slice(0,8)),Buffer.from(exact.slice(8))]);
 const raw=await api._test.readRawBody(req);
 assert.equal(raw.toString('utf8'),exact);
 const secret='secret';
 const sig=crypto.createHmac('sha256',secret).update(raw).digest('base64');
 assert.equal(hook._test.validSignature(raw,sig,secret),true);
 assert.equal(hook._test.validSignature(JSON.stringify(JSON.parse(exact)),sig,secret),false);
});

test('raw body helper prefers captured rawBody without reserialization',async()=>{
 const req=Readable.from([]);
 req.rawBody=Buffer.from('{"b":2, "a":1}\n');
 const raw=await api._test.readRawBody(req);
 assert.equal(raw.toString('utf8'),'{"b":2, "a":1}\n');
});
