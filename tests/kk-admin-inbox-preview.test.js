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
 assert.match(js,/รูปภาพ \(ยังเปิดดูไฟล์จาก Inbox นี้ไม่ได้\)/);
 assert.match(js,/ข้อความเสียง \(ยังเปิดฟังจาก Inbox นี้ไม่ได้\)/);
 const vm=require('node:vm');
 const list={innerHTML:'',querySelectorAll:()=>[]},count={textContent:''};
 const document={readyState:'loading',addEventListener:()=>{},querySelector:selector=>selector==='#inboxConversationList'?list:selector==='#inboxCount'?count:null};
 const window={};
 // Expose the real renderer only inside the isolated test VM; do not run bind/polling.
 const source=js.replace('window.KKInboxPreview=Object.freeze({','window.testRenderList=renderList;\nwindow.KKInboxPreview=Object.freeze({');
 vm.runInNewContext(source,{document,window});
 window.testRenderList([{conversation_id:'c1',channel:'line',display_name:'<unsafe>',unread_count:3,last_message_type:'image'}]);
 assert.match(list.innerHTML,/<i>3 ใหม่<\/i>/);
 assert.match(list.innerHTML,/&lt;unsafe&gt;/);
 assert.match(list.innerHTML,/รูปภาพ/);
 assert.equal(count.textContent,'1 รายการ');
 for(const unread_count of [0,-2]){
  window.testRenderList([{conversation_id:'c1',channel:'line',display_name:'Test',unread_count}]);
  assert.doesNotMatch(list.innerHTML,/<i>/);
 }

 assert.match(js,/async function markConversationRead/);
 assert.match(js,/shouldMarkRead=options\.markRead!==false/);
 assert.match(js,/clearUnreadBadge/);
});
