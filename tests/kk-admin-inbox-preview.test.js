'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');const root=path.join(__dirname,'..');

test('admin exposes governed LINE send, provider names and owner customer labels',()=>{
 const html=fs.readFileSync(path.join(root,'admin/index.html'),'utf8'),js=fs.readFileSync(path.join(root,'admin/inbox-preview.js'),'utf8');
 assert.match(html,/data-tab="inbox"/);assert.match(html,/id="tab-inbox"/);assert.match(html,/id="inboxConversationList"/);
 assert.match(html,/id="inboxComposeText"/);assert.match(html,/id="inboxSendBtn"/);assert.match(html,/id="inboxComposeStatus"/);
 assert.match(html,/id="inboxRenameBtn"/);assert.match(html,/id="inboxRenameDialog"/);assert.match(html,/id="inboxRenameInput"/);assert.match(html,/id="inboxRenameSave"/);
 assert.match(html,/ใช้ชื่อโปรไฟล์/);
 assert.match(js,/\/api\/kk-admin-guard/);assert.match(js,/inboxListConversations/);assert.match(js,/inboxHydrateLineProfiles/);assert.match(js,/inboxSendLineMessage/);assert.match(js,/inboxSetOwnerLabel/);assert.match(js,/inboxMarkRead/);
 assert.match(js,/owner_label\|\|row\?\.display_name/);assert.match(js,/ชื่อโปรไฟล์:/);assert.match(js,/owner_approved:true/);assert.match(js,/window\.confirm/);
 assert.match(js,/'X-Admin-Pin':pin\(\)/);assert.match(js,/autoMerge:false/);
 assert.doesNotMatch(js,/SERVICE_ROLE|SUPABASE_SERVICE/i);
});

test('admin Inbox refreshes live without logout or login',()=>{
 const html=fs.readFileSync(path.join(root,'admin/index.html'),'utf8'),js=fs.readFileSync(path.join(root,'admin/inbox-preview.js'),'utf8');
 assert.match(html,/id="inboxLiveStatus"/);
 assert.match(js,/const POLL_MS=4000/);
 assert.match(js,/setInterval\(pollInbox,POLL_MS\)/);
 assert.match(js,/function isInboxActive\(\)/);
 assert.match(js,/classList\.contains\('active'\)/);
 assert.match(js,/document\.addEventListener\('visibilitychange'/);
 assert.match(js,/window\.addEventListener\('focus'/);
 assert.match(js,/window\.addEventListener\('online'/);
 assert.match(js,/refreshSelected:true/);
 assert.match(js,/conversationVersion\(refreshed\)!==previousVersion/);
 assert.match(js,/preserveScroll:true/);
 assert.match(js,/#refreshBtn/);
 assert.match(js,/mode:'owner-approved-line-send-owner-label-live-refresh-read-state'/);
 assert.doesNotMatch(js,/location\.reload|logout/i);
});

test('admin Inbox has readable timestamps, non-text fallbacks and read-state cleanup',()=>{
 const js=fs.readFileSync(path.join(root,'admin/inbox-preview.js'),'utf8');
 assert.match(js,/timeZone:'Asia\/Bangkok'/);
 assert.match(js,/MESSAGE_TYPE_LABELS/);
 assert.match(js,/data-inbox-image/);assert.match(js,/inboxGetImage/);
 assert.match(js,/ข้อความเสียง \(ยังเปิดฟังจาก Inbox นี้ไม่ได้\)/);
 assert.match(js,/unreadBadge=unread\\?/);
 assert.match(js,/async function markConversationRead/);
 assert.match(js,/shouldMarkRead=options\.markRead!==false/);
 assert.match(js,/clearUnreadBadge/);
});

test('older concurrent message fetch cannot overwrite newer thread data or show stale failures',async()=>{
 const vm=require('node:vm');
 const js=fs.readFileSync(path.join(root,'admin/inbox-preview.js'),'utf8');
 const start=js.indexOf('async function loadThread(id,row,options={}){');
 const end=js.indexOf('\nasync function loadList(',start);
 assert.ok(start>0 && end>start,'loadThread block is present');
 const pending=[],rendered=[],messages=[];
 const ctx={
  api:()=>new Promise((resolve,reject)=>pending.push({resolve,reject})),
  renderThreadHeader:()=>{},composeState:message=>messages.push(String(message||'')),
  renderThread:rows=>{rendered.push(rows.map(row=>row.body_text).join('|'));return {wasNearBottom:true}},
  markConversationRead:async()=>{},markRefreshed:()=>{},liveStatus:()=>{},
  $:()=>({set innerHTML(v){messages.push(v)}}),esc:x=>String(x||'')
 };
 vm.runInNewContext(
  "let selected='',selectedRow=null,outboundEnabled=false,threadRequestSeq=0;\n"+
  js.slice(start,end)+"\nglobalThis.loadThread=loadThread;",ctx
 );
 const room={conversation_id:'conv_demo'};
 const stale=ctx.loadThread('conv_demo',room,{markRead:false});
 const newest=ctx.loadThread('conv_demo',room,{markRead:false});
 assert.equal(pending.length,2);
 pending[1].resolve({messages:[{body_text:'newest'}],outbound_enabled:true});
 await newest;
 pending[0].resolve({messages:[{body_text:'stale'}],outbound_enabled:true});
 await stale;
 assert.deepEqual(rendered,['newest'],'later HTTP response must be the only rendered thread');
 const olderError=ctx.loadThread('conv_demo',room,{markRead:false});
 const latest=ctx.loadThread('conv_demo',room,{markRead:false});
 pending[3].resolve({messages:[{body_text:'latest'}],outbound_enabled:true});
 await latest;
 pending[2].reject(new Error('outdated network error'));
 await olderError;
 assert.deepEqual(rendered,['newest','latest']);
 assert.equal(messages.some(m=>m.includes('outdated network error')),false);
});

test('overlapping Inbox lists discard stale success and stale failures',async()=>{
 const vm=require('node:vm');
 const js=fs.readFileSync(path.join(root,'admin/inbox-preview.js'),'utf8');
 const start=js.indexOf('async function loadList(runHydration=true,options={}){');
 const end=js.indexOf('\nasync function refreshInboxNow(',start);
 assert.ok(start>0&&end>start);
 const pending=[],rendered=[],errors=[];
 const ctx={
  api:()=>new Promise((resolve,reject)=>pending.push({resolve,reject})),
  $:()=>({value:''}),conversationVersion:r=>String(r?.updated_at||''),
  renderList:rows=>rendered.push(rows.map(r=>r.conversation_id).join(',')),
  renderThreadHeader:()=>{},composeState:()=>{},markRefreshed:()=>{},
  hydrateMissingProfiles:()=>{},loadThread:async()=>{},
  liveStatus:v=>errors.push(String(v)),showError:e=>errors.push(e.message)
 };
 vm.runInNewContext(
  "let selected='',selectedRow=null,outboundEnabled=false,listRequestSeq=0;\n"+
  js.slice(start,end)+"\nglobalThis.loadList=loadList;",ctx
 );
 const stale=ctx.loadList(false),latest=ctx.loadList(false);
 assert.equal(pending.length,2);
 pending[1].resolve({conversations:[{conversation_id:'conv_latest'}],outbound_enabled:true});
 await latest;
 pending[0].resolve({conversations:[{conversation_id:'conv_old'}],outbound_enabled:false});
 await stale;
 assert.deepEqual(rendered,['conv_latest']);
 const staleFailure=ctx.loadList(false),newer=ctx.loadList(false);
 pending[3].resolve({conversations:[{conversation_id:'conv_newer'}],outbound_enabled:true});
 await newer;
 pending[2].reject(new Error('obsolete list failure'));
 await staleFailure;
 assert.deepEqual(rendered,['conv_latest','conv_newer']);
 assert.equal(errors.some(e=>e.includes('obsolete list failure')),false);
});

test('switching LINE rooms during send never wipes another customer draft or refreshes the wrong thread',async()=>{
 const vm=require('node:vm');
 const js=fs.readFileSync(path.join(root,'admin/inbox-preview.js'),'utf8');
 const start=js.indexOf('async function sendMessage(){');
 const end=js.indexOf('\nfunction scheduleSearch(',start);
 assert.ok(start>0&&end>start);
 const input={value:'  reply to customer A  '},calls=[],threads=[],lists=[];
 let finish;
 const ctx={
  $:()=>input,window:{confirm:()=>true},composeState:()=>{},
  api:(action,payload)=>new Promise(resolve=>{calls.push({action,payload});finish=resolve;}),
  loadThread:async id=>threads.push(id),
  loadList:async()=>lists.push('refreshed')
 };
 vm.runInNewContext(
  "let selected='conv_A',selectedRow={conversation_id:'conv_A',channel:'line'},sending=false;\n"+
  js.slice(start,end)+"\nglobalThis.sendMessage=sendMessage;globalThis.switchRoom=id=>{selected=id;selectedRow={conversation_id:id,channel:'line'};};",ctx
 );
 const request=ctx.sendMessage();
 assert.equal(calls.length,1);
 assert.equal(calls[0].payload.conversation_id,'conv_A');
 assert.equal(calls[0].payload.text,'reply to customer A');
 ctx.switchRoom('conv_B');
 input.value='draft for customer B';
 finish({ok:true});
 await request;
 assert.equal(input.value,'draft for customer B');
 assert.deepEqual(threads,[]);
 assert.deepEqual(lists,['refreshed']);
});

test('LINE owner reply preserves an edited draft but clears the original completed draft',async()=>{
 const vm=require('node:vm');
 const js=fs.readFileSync(path.join(root,'admin/inbox-preview.js'),'utf8');
 const start=js.indexOf('async function sendMessage(){');
 const end=js.indexOf('\nfunction scheduleSearch(',start);
 const input={value:'first draft'},threads=[],calls=[];
 const pending=[];
 const ctx={
  $:()=>input,window:{confirm:()=>true},composeState:()=>{},
  api:(action,payload)=>new Promise(resolve=>{calls.push({action,payload});pending.push(resolve);}),
  loadThread:async id=>threads.push(id),loadList:async()=>{}
 };
 vm.runInNewContext(
  "let selected='conv_A',selectedRow={conversation_id:'conv_A',channel:'line'},sending=false;\n"+
  js.slice(start,end)+"\nglobalThis.sendMessage=sendMessage;",ctx
 );
 const first=ctx.sendMessage();
 input.value='new unsent draft';
 pending.shift()({ok:true});
 await first;
 assert.equal(input.value,'new unsent draft');
 assert.deepEqual(threads,['conv_A']);
 const second=ctx.sendMessage();
 pending.shift()({ok:true});
 await second;
 assert.equal(input.value,'');
 assert.deepEqual(threads,['conv_A','conv_A']);
 assert.deepEqual(calls.map(c=>c.payload.text),['first draft','new unsent draft']);
});
