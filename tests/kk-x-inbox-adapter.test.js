const test=require('node:test');
const assert=require('node:assert/strict');
const X=require('../server/kk-x-inbox-adapter');

test('X adapter stays disabled without all server credentials',()=>{
  assert.equal(X.xCredentials({KK_X_CLIENT_ID:'a',KK_X_CLIENT_SECRET:'b'}),null);
  assert.deepEqual(X.entitlementState({}),{status:'DISABLED_NO_CREDENTIALS',production_writes:0});
});
test('X adapter never treats credentials as verified entitlement',()=>{
  const state=X.entitlementState({KK_X_CLIENT_ID:'a',KK_X_CLIENT_SECRET:'b',KK_X_USER_ACCESS_TOKEN:'c'});
  assert.equal(state.status,'CREDENTIALS_PRESENT_UNVERIFIED');
  assert.equal(state.production_writes,0);
});
test('X DM normalizes into the shared channel contract',()=>{
  const m=X.normalizeDmEvent({id:'dm-1',sender_id:'x-user-1',created_at:'2026-09-30T12:00:00Z',text:'ขอเช่าเครื่องงานนี้ค่ะ'});
  assert.equal(m.channel,'x');
  assert.equal(m.external_message_id,'dm-1');
  assert.equal(m.external_user_id,'x-user-1');
  assert.equal(m.text,'ขอเช่าเครื่องงานนี้ค่ะ');
  assert.equal(m.status,'new');
});
test('X and LINE identities remain channel-separated',()=>{
  const x=X.normalizeDmEvent({id:'1',sender_id:'same',text:'x'});
  assert.match(x.conversation_id,/^conv_/);
  assert.notEqual(x.conversation_id,require('../server/kk-unified-inbox-contract').normalizeInbound({channel:'line',external_message_id:'1',external_user_id:'same',text:'line'}).conversation_id);
});
