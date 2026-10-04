'use strict';const test=require('node:test');const assert=require('node:assert/strict');const Store=require('../server/kk-inbox-postgrest-store.js');

test('server adapter calls transactional inbound persistence RPC',async()=>{let call;const s=Store.createPostgrestStore({url:'https://example.supabase.co',serviceKey:'secret',fetchImpl:async(url,opt)=>{call={url,opt};return{ok:true,status:200,text:async()=>JSON.stringify([{duplicate:false,writes:1}])};}});const r=await s.persistInbound({message_id:'m1'});assert.match(call.url,/\/rest\/v1\/rpc\/kk_inbox_persist_inbound$/);assert.equal(call.opt.headers.Authorization,'Bearer secret');assert.equal(r.writes,1);});
test('missing server credentials fails closed before network',()=>{assert.throws(()=>Store.createPostgrestStore({url:'',serviceKey:''}),/required/);});

test('server adapter uses service-role RPCs for read, profile and outbound operations',async()=>{
 const calls=[];const store=Store.createPostgrestStore({url:'https://example.supabase.co',serviceKey:'secret',fetchImpl:async(url,opt)=>{calls.push({url,opt});let body=[];if(/get_conversation$/.test(url))body={conversation_id:'c1',channel:'line',external_user_id:'U1'};if(/update_line_profile$/.test(url))body=[{updated:true,writes:1}];if(/record_outbound$/.test(url))body=[{duplicate:false,writes:1}];return{ok:true,status:200,text:async()=>JSON.stringify(body)}}});
 await store.listConversations({channel:'line',search:'mint'});
 await store.listMessages('c1');
 const conv=await store.getConversation('c1');
 const profile=await store.updateLineProfile('U1','Mint');
 const outbound=await store.recordOutbound({message_id:'m2'});
 assert.equal(conv.external_user_id,'U1');assert.equal(profile.updated,true);assert.equal(outbound.writes,1);
 assert.deepEqual(calls.map(x=>x.url.split('/').pop()),['kk_inbox_list_conversations','kk_inbox_list_messages','kk_inbox_get_conversation','kk_inbox_update_line_profile','kk_inbox_record_outbound']);
 assert.equal(calls.every(x=>x.opt.headers.Authorization==='Bearer secret'),true);
});
