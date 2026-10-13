'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');const root=path.join(__dirname,'..');

test('admin exposes governed LINE send, provider names and owner customer labels',()=>{
 const html=fs.readFileSync(path.join(root,'admin/index.html'),'utf8'),js=fs.readFileSync(path.join(root,'admin/inbox-preview.js'),'utf8');
 assert.match(html,/data-tab="inbox"/);assert.match(html,/id="tab-inbox"/);assert.match(html,/id="inboxConversationList"/);
 assert.match(html,/id="inboxComposeText"/);assert.match(html,/id="inboxSendBtn"/);assert.match(html,/id="inboxComposeStatus"/);
 assert.match(html,/id="inboxRenameBtn"/);assert.match(html,/id="inboxRenameDialog"/);assert.match(html,/id="inboxRenameInput"/);assert.match(html,/id="inboxRenameSave"/);
 assert.match(html,/ใช้ชื่อโปรไฟล์/);
 assert.match(js,/\/api\/kk-admin-guard/);assert.match(js,/inboxListConversations/);assert.match(js,/inboxHydrateLineProfiles/);assert.match(js,/inboxSendLineMessage/);assert.match(js,/inboxSetOwnerLabel/);assert.match(js,/inboxMarkRead/);
 assert.match(js,/owner_label\|\|row\?\.display_name/);assert.match(js,/ชื่อโปรไฟล์:/);assert.match(js,/owner_approved:true/);assert.match(js,/send_request_id:sendRequestId/);assert.match(js,/window\.confirm/);
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
  renderThreadHeader:()=>{},prepareComposerForThread:()=>{},composeState:message=>messages.push(String(message||'')),
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
  clearSelectionAfterFilter:()=>{},
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
  $:()=>input,window:{confirm:()=>true,crypto:{randomUUID:()=> '123e4567-e89b-42d3-a456-426614174000'}},composeState:()=>{},
  api:(action,payload)=>new Promise(resolve=>{calls.push({action,payload});finish=resolve;}),
  loadThread:async id=>threads.push(id),
  loadList:async()=>lists.push('refreshed')
 };
 vm.runInNewContext(
  "let selected='conv_A',selectedRow={conversation_id:'conv_A',channel:'line'},sending=false;const inboxDrafts=Object.create(null);const uncertainSendRooms=new Set();\n"+
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
  $:()=>input,window:{confirm:()=>true,crypto:{randomUUID:()=> '123e4567-e89b-42d3-a456-426614174000'}},composeState:()=>{},
  api:(action,payload)=>new Promise(resolve=>{calls.push({action,payload});pending.push(resolve);}),
  loadThread:async id=>threads.push(id),loadList:async()=>{}
 };
 vm.runInNewContext(
  "let selected='conv_A',selectedRow={conversation_id:'conv_A',channel:'line'},sending=false;const inboxDrafts=Object.create(null);const uncertainSendRooms=new Set();\n"+
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


test('drafts are separated by conversation and restored only when returning to that conversation',()=>{
 const vm=require('node:vm');
 const js=fs.readFileSync(path.join(root,'admin/inbox-preview.js'),'utf8');
 const start=js.indexOf('function prepareComposerForThread(requestId){');
 const end=js.indexOf('\nasync function loadThread(',start);
 assert.ok(start>0&&end>start);
 const input={value:'unsent draft A'},ctx={$:()=>input};
 vm.runInNewContext(
  "let selected='conv_A';const inboxDrafts=Object.create(null);\n"+
  js.slice(start,end)+"\nglobalThis.prepare=prepareComposerForThread;globalThis.setRoom=id=>{selected=id};",ctx
 );
 ctx.prepare('conv_B');ctx.setRoom('conv_B');
 assert.equal(input.value,'','customer B must not see customer A draft');
 input.value='unsent draft B';
 ctx.prepare('conv_A');ctx.setRoom('conv_A');
 assert.equal(input.value,'unsent draft A');
 ctx.prepare('conv_B');ctx.setRoom('conv_B');
 assert.equal(input.value,'unsent draft B');
});

test('successful in-flight reply cannot resurrect a sent draft after switching rooms',async()=>{
 const vm=require('node:vm');
 const js=fs.readFileSync(path.join(root,'admin/inbox-preview.js'),'utf8');
 const helperStart=js.indexOf('function prepareComposerForThread(requestId){');
 const helperEnd=js.indexOf('\nasync function loadThread(',helperStart);
 const sendStart=js.indexOf('async function sendMessage(){');
 const sendEnd=js.indexOf('\nfunction scheduleSearch(',sendStart);
 const input={value:'send A'},threads=[];
 let resolveSend;
 const ctx={
  $:()=>input,window:{confirm:()=>true,crypto:{randomUUID:()=> '123e4567-e89b-42d3-a456-426614174000'}},composeState:()=>{},
  api:()=>new Promise(resolve=>{resolveSend=resolve}),
  loadThread:async id=>threads.push(id),loadList:async()=>{}
 };
 vm.runInNewContext(
  "let selected='conv_A',selectedRow={conversation_id:'conv_A',channel:'line'},sending=false;const inboxDrafts=Object.create(null);const uncertainSendRooms=new Set();\n"+
  js.slice(helperStart,helperEnd)+"\n"+js.slice(sendStart,sendEnd)+
  "\nglobalThis.sendMessage=sendMessage;globalThis.switchRoom=id=>{prepareComposerForThread(id);selected=id;selectedRow={conversation_id:id,channel:'line'};};",ctx
 );
 const pending=ctx.sendMessage();
 ctx.switchRoom('conv_B');input.value='unsent B';
 resolveSend({ok:true});await pending;
 assert.equal(input.value,'unsent B');
 ctx.switchRoom('conv_A');
 assert.equal(input.value,'','the completed A message must not become an unsent draft');
 assert.deepEqual(threads,[],'do not refresh a different room after send');
});

test('filtering out a selected room disables reply and clears customer draft from shared composer',async()=>{
 const vm=require('node:vm'),js=fs.readFileSync(path.join(root,'admin/inbox-preview.js'),'utf8');
 const a=js.indexOf('function clearSelectionAfterFilter(){');
 const b=js.indexOf('\nasync function loadList(',a);
 const c=js.indexOf('\nasync function refreshInboxNow(',b);
 assert.ok(a>0&&b>a&&c>b);
 const input={value:'private reply for room A'},thread={innerHTML:'old thread'},list=[];
 const ctx={
  $:id=>id==='#inboxComposeText'?input:id==='#inboxThread'?thread:{value:''},
  api:async()=>({conversations:[{conversation_id:'conv_B'}],outbound_enabled:true}),
  conversationVersion:()=>'',renderList:v=>list.push(v.length),
  renderThreadHeader:()=>{},composeState:()=>{},markRefreshed:()=>{},
  releaseInboxImages:()=>{},hydrateMissingProfiles:()=>{},loadThread:async()=>{},
  liveStatus:()=>{},showError:()=>{}
 };
 vm.runInNewContext(
  "let selected='conv_A',selectedRow={conversation_id:'conv_A',channel:'line'},threadRequestSeq=0,listRequestSeq=0,outboundEnabled=false;const inboxDrafts=Object.create(null);\n"+
  js.slice(a,c)+
  "\nglobalThis.loadList=loadList;globalThis.get=()=>({selected,selectedRow,version:threadRequestSeq,saved:inboxDrafts.conv_A});",ctx
 );
 await ctx.loadList(false);
 const state=ctx.get();
 assert.equal(state.selected,'');assert.equal(state.selectedRow,null);
 assert.equal(state.version,1);assert.equal(state.saved,'private reply for room A');
 assert.equal(input.value,'');
 assert.match(thread.innerHTML,/เลือกบทสนทนา/);
 assert.deepEqual(list,[1]);
});

test('mismatched conversation metadata cannot begin a message request',async()=>{
 const vm=require('node:vm'),js=fs.readFileSync(path.join(root,'admin/inbox-preview.js'),'utf8');
 const a=js.indexOf('async function loadThread(id,row,options={}){'),b=js.indexOf('\nfunction clearSelectionAfterFilter(',a);
 assert.ok(a>0&&b>a);
 let calls=0;
 const ctx={api:async()=>{calls++;return {messages:[]}},renderThreadHeader:()=>{},composeState:()=>{}};
 vm.runInNewContext(
  "let selected='conv_A',selectedRow={conversation_id:'conv_A'},threadRequestSeq=0;\n"+
  js.slice(a,b)+"\nglobalThis.loadThread=loadThread;",ctx
 );
 await ctx.loadThread('conv_B',{conversation_id:'conv_A'});
 await ctx.loadThread('conv_B',null);
 assert.equal(calls,0);
});

test('ambiguous LINE send outcome prevents another send in the same page session',async()=>{
 const vm=require('node:vm'),js=fs.readFileSync(path.join(root,'admin/inbox-preview.js'),'utf8');
 const a=js.indexOf('async function sendMessage(){'),b=js.indexOf('\nfunction scheduleSearch(',a);
 assert.ok(a>0&&b>a);
 const input={value:'reply A'},calls=[],statuses=[];
 let rejectSend;
 const ctx={
  $:()=>input,window:{confirm:()=>true,crypto:{randomUUID:()=> '123e4567-e89b-42d3-a456-426614174000'}},composeState:s=>statuses.push(s||''),
  api:(action,payload)=>new Promise((resolve,reject)=>{calls.push({action,payload});rejectSend=reject}),
  loadList:async()=>{},loadThread:async()=>{}
 };
 vm.runInNewContext(
  "let selected='conv_A',selectedRow={conversation_id:'conv_A',channel:'line'},sending=false;const inboxDrafts=Object.create(null),uncertainSendRooms=new Set();\n"+
  js.slice(a,b)+"\nglobalThis.sendMessage=sendMessage;globalThis.held=()=>uncertainSendRooms.has('conv_A');",ctx
 );
 const first=ctx.sendMessage();
 rejectSend(Object.assign(new Error('post-send receipt unavailable'),{code:'INBOX_OUTBOUND_PERSIST_FAILED_AFTER_SEND'}));
 await first;
 assert.equal(ctx.held(),true);assert.equal(input.value,'reply A');
 await ctx.sendMessage();
 assert.equal(calls.length,1,'never send a second LINE push while outcome is unknown');
});

test('unknown LINE send disables the composer until review instead of advertising retry',()=>{
 const vm=require('node:vm'),js=fs.readFileSync(path.join(root,'admin/inbox-preview.js'),'utf8');
 const a=js.indexOf('function composeState(message){'),b=js.indexOf('\nfunction renderThreadHeader(',a);
 assert.ok(a>0&&b>a);
 const elements={
  '#inboxComposeText':{disabled:false},
  '#inboxSendBtn':{disabled:false},
  '#inboxComposeStatus':{textContent:''}
 };
 const ctx={$:key=>elements[key]};
 vm.runInNewContext(
  "let selected='conv_A',selectedRow={conversation_id:'conv_A',channel:'line'},outboundEnabled=true,sending=false;const uncertainSendRooms=new Set(['conv_A']);\n"+
  js.slice(a,b)+"\nglobalThis.composeState=composeState;",ctx
 );
 ctx.composeState();
 assert.equal(elements['#inboxComposeText'].disabled,true);
 assert.equal(elements['#inboxSendBtn'].disabled,true);
 assert.match(elements['#inboxComposeStatus'].textContent,/LINE OA/);
});

test('owner send refuses identity mismatch before any LINE request',async()=>{
 const vm=require('node:vm'),js=fs.readFileSync(path.join(root,'admin/inbox-preview.js'),'utf8');
 const a=js.indexOf('async function sendMessage(){'),b=js.indexOf('\nfunction scheduleSearch(',a);
 assert.ok(a>0&&b>a);
 let calls=0;
 const ctx={
  $:()=>({value:'send to A'}),window:{confirm:()=>true,crypto:{randomUUID:()=> '123e4567-e89b-42d3-a456-426614174000'}},
  api:async()=>{calls++},composeState:()=>{},loadList:async()=>{},loadThread:async()=>{}
 };
 vm.runInNewContext(
  "let selected='conv_B',selectedRow={conversation_id:'conv_A',channel:'line'},sending=false;const inboxDrafts=Object.create(null),uncertainSendRooms=new Set();\n"+
  js.slice(a,b)+"\nglobalThis.sendMessage=sendMessage;",ctx
 );
 await ctx.sendMessage();
 assert.equal(calls,0);
});
