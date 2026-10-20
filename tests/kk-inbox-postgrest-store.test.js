'use strict';const test=require('node:test');const assert=require('node:assert/strict');const Store=require('../server/kk-inbox-postgrest-store.js');

test('server adapter calls transactional inbound persistence RPC',async()=>{let call;const s=Store.createPostgrestStore({url:'https://example.supabase.co',serviceKey:'secret',fetchImpl:async(url,opt)=>{call={url,opt};return{ok:true,status:200,text:async()=>JSON.stringify([{duplicate:false,writes:1}])};}});const r=await s.persistInbound({message_id:'m1'});assert.match(call.url,/\/rest\/v1\/rpc\/kk_inbox_persist_inbound$/);assert.equal(call.opt.headers.Authorization,'Bearer secret');assert.equal(r.writes,1);});
test('missing server credentials fails closed before network',()=>{assert.throws(()=>Store.createPostgrestStore({url:'',serviceKey:''}),/required/);});

test('server adapter uses service-role RPCs for read, profile, owner label, mark-read and outbound operations',async()=>{
 const calls=[];const store=Store.createPostgrestStore({url:'https://example.supabase.co',serviceKey:'secret',fetchImpl:async(url,opt)=>{calls.push({url,opt});let body=[];if(/get_conversation$/.test(url))body={conversation_id:'c1',channel:'line',external_user_id:'U1'};if(/update_line_profile$/.test(url))body=[{updated:true,writes:1}];if(/set_owner_label$/.test(url))body={conversation_id:'c1',owner_label:'Mint · 24/10 · X300 Pro'};if(/mark_read$/.test(url))body={conversation_id:'c1',unread_count:0,marked_read:true};if(/record_outbound$/.test(url))body=[{duplicate:false,writes:1}];return{ok:true,status:200,text:async()=>JSON.stringify(body)};}});
 await store.listConversations({channel:'line',search:'mint'});
 await store.listMessages('c1');
 const conv=await store.getConversation('c1');
 const profile=await store.updateLineProfile('U1','Mint');
 const renamed=await store.setOwnerLabel('c1','Mint · 24/10 · X300 Pro');
 const read=await store.markRead('c1');
 const outbound=await store.recordOutbound({message_id:'m2'});
 assert.equal(conv.external_user_id,'U1');assert.equal(profile.updated,true);assert.equal(renamed.owner_label,'Mint · 24/10 · X300 Pro');assert.equal(read.unread_count,0);assert.equal(read.marked_read,true);assert.equal(outbound.writes,1);
 assert.deepEqual(calls.map(x=>x.url.split('/').pop()),['kk_inbox_list_conversations','kk_inbox_list_messages','kk_inbox_get_conversation','kk_inbox_update_line_profile','kk_inbox_set_owner_label','kk_inbox_mark_read','kk_inbox_record_outbound']);
 const renamePayload=JSON.parse(calls[4].opt.body);assert.equal(renamePayload.p_actor,'owner');assert.equal(renamePayload.p_owner_label,'Mint · 24/10 · X300 Pro');
 const readPayload=JSON.parse(calls[5].opt.body);assert.equal(readPayload.p_actor,'owner');assert.equal(readPayload.p_conversation_id,'c1');
 assert.equal(calls.every(x=>x.opt.headers.Authorization==='Bearer secret'),true);
});

test('legacy outbound history reads use the exact service-only RPC and preserve strict booleans',async()=>{
 for(const expected of [false,true]){
  let call;const store=Store.createPostgrestStore({url:'https://example.supabase.co',serviceKey:'private-test-only',fetchImpl:async(url,opt)=>{
   call={url,opt};return {ok:true,status:200,text:async()=>JSON.stringify(expected)};
  }});
  assert.equal(typeof store.hasLegacyOutbound,'function');
  assert.equal(await store.hasLegacyOutbound('  c1  ','  exact body  '),expected);
  assert.match(call.url,/\/rest\/v1\/rpc\/kk_inbox_has_legacy_outbound$/);
  assert.equal(call.opt.headers.Authorization,'Bearer private-test-only');
  assert.deepEqual(JSON.parse(call.opt.body),{p_conversation_id:'c1',p_body_text:'exact body'});
 }
});

test('legacy history RPC never coerces null, strings, arrays or objects into negative evidence',async()=>{
 for(const malformed of [null,'false','true',0,1,[],[false],{exists:false}]){
  const store=Store.createPostgrestStore({url:'https://example.supabase.co',serviceKey:'private-test-only',fetchImpl:async()=>({ok:true,status:200,text:async()=>JSON.stringify(malformed)})});
  assert.equal(typeof store.hasLegacyOutbound,'function');
  await assert.rejects(()=>store.hasLegacyOutbound('c1','exact body'),err=>err.code==='INBOX_LEGACY_OUTBOUND_UNAVAILABLE');
 }
 const unavailable=Store.createPostgrestStore({url:'https://example.supabase.co',serviceKey:'private-test-only',fetchImpl:async()=>({ok:false,status:503,text:async()=>'unavailable'})});
 assert.equal(typeof unavailable.hasLegacyOutbound,'function');
 await assert.rejects(()=>unavailable.hasLegacyOutbound('c1','exact body'),err=>err.code==='INBOX_LEGACY_OUTBOUND_UNAVAILABLE');
});
