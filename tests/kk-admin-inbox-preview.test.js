'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');const root=path.join(__dirname,'..');

test('admin exposes owner-approved LINE send, provider names and owner customer labels',()=>{
 const html=fs.readFileSync(path.join(root,'admin/index.html'),'utf8'),js=fs.readFileSync(path.join(root,'admin/inbox-preview.js'),'utf8');
 assert.match(html,/data-tab="inbox"/);assert.match(html,/id="tab-inbox"/);assert.match(html,/id="inboxConversationList"/);
 assert.match(html,/id="inboxComposeText"/);assert.match(html,/id="inboxSendBtn"/);assert.match(html,/id="inboxComposeStatus"/);
 assert.match(html,/id="inboxRenameBtn"/);assert.match(html,/id="inboxRenameDialog"/);assert.match(html,/id="inboxRenameInput"/);assert.match(html,/id="inboxRenameSave"/);
 assert.match(js,/\/api\/kk-admin-guard/);assert.match(js,/inboxListConversations/);assert.match(js,/inboxHydrateLineProfiles/);assert.match(js,/inboxSendLineMessage/);assert.match(js,/inboxSetOwnerLabel/);
 assert.match(js,/owner_label\|\|row\?\.display_name/);assert.match(js,/ชื่อโปรไฟล์:/);assert.match(js,/owner_approved:true/);assert.match(js,/window\.confirm/);
 assert.match(js,/'X-Admin-Pin':pin\(\)/);assert.match(js,/mode:'owner-approved-line-send-with-owner-label'/);assert.match(js,/autoMerge:false/);
 assert.doesNotMatch(js,/SERVICE_ROLE|SUPABASE_SERVICE/i);
});
