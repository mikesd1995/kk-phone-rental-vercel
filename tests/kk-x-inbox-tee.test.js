'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Tee=require('../server/kk-x-inbox-tee');
const payload={direct_message_events:[{id:'dm-1',type:'message_create',created_timestamp:'10',message_create:{sender_id:'u1',target:{recipient_id:'owner'},message_data:{text:'hello'}}}]};
test('X verified tee is disabled without durable store',async()=>{assert.deepEqual(await Tee.persistVerifiedPayload(payload,null),{status:'DISABLED_NO_STORE',writes:0,duplicates:0,skipped:0,failures:0});});
test('X verified tee persists normalized channel-scoped DM',async()=>{let saved;const r=await Tee.persistVerifiedPayload(payload,async m=>{saved=m;return{writes:1,duplicate:false};});assert.equal(r.status,'OK');assert.equal(r.writes,1);assert.equal(saved.channel,'x');assert.equal(saved.external_message_id,'dm-1');assert.equal(saved.external_user_id,'u1');});
test('duplicate receipt is counted without second logical write',async()=>{const r=await Tee.persistVerifiedPayload(payload,async()=>({writes:0,duplicate:true}));assert.equal(r.duplicates,1);assert.equal(r.writes,0);});
test('persistence failure is isolated and reported',async()=>{const r=await Tee.persistVerifiedPayload(payload,async()=>{throw new Error('db down');});assert.equal(r.status,'PARTIAL');assert.equal(r.failures,1);});
