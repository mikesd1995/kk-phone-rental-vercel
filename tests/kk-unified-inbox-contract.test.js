'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Inbox=require('../server/kk-unified-inbox-contract.js');

test('normalizes LINE inbound deterministically and preserves redelivery',()=>{
  const a=Inbox.normalizeInbound({channel:'line',external_message_id:'m1',external_user_id:'u1',text:'สวัสดี',redelivery:true,received_at:'2026-09-30T00:00:00Z'});
  const b=Inbox.normalizeInbound({channel:'line',external_message_id:'m1',external_user_id:'u1',text:'สวัสดี',received_at:'2026-09-30T00:00:00Z'});
  assert.equal(a.message_id,b.message_id);
  assert.equal(a.conversation_id,b.conversation_id);
  assert.equal(a.redelivery,true);
});
test('same external user id on different channels never auto-merges',()=>{
  const line=Inbox.normalizeInbound({channel:'line',external_message_id:'1',external_user_id:'same'});
  const x=Inbox.normalizeInbound({channel:'x',external_message_id:'1',external_user_id:'same'});
  assert.notEqual(line.conversation_id,x.conversation_id);
});
test('outbound is fail-closed until owner authorizes',()=>{
  const d=Inbox.outboundDraft({channel:'line',conversation_id:'conv_1',text:'ตอบลูกค้า'});
  assert.equal(d.send_authorized,false);
  assert.equal(d.production_writes,0);
  const approved=Inbox.authorizeSend(d);
  assert.equal(approved.send_authorized,true);
});
test('rejects unsupported channels',()=>{
  assert.throws(()=>Inbox.normalizeInbound({channel:'ig',external_message_id:'1',external_user_id:'1'}),/unsupported inbox channel/);
});
