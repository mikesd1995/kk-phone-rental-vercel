'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');const root=path.join(__dirname,'..');
test('admin exposes authenticated read-only LINE/X inbox with outbound disabled',()=>{
 const html=fs.readFileSync(path.join(root,'admin/index.html'),'utf8'),js=fs.readFileSync(path.join(root,'admin/inbox-preview.js'),'utf8');
 assert.match(html,/data-tab="inbox"/);assert.match(html,/id="tab-inbox"/);assert.match(html,/id="inboxConversationList"/);
 assert.match(html,/textarea disabled/);assert.match(html,/button class="btn primary" type="button" disabled/);
 assert.match(js,/\/api\/kk-admin-guard/);assert.match(js,/inboxListConversations/);assert.match(js,/'X-Admin-Pin':pin\(\)/);assert.match(js,/mode:'authenticated-read-only'/);
 assert.doesNotMatch(js,/if\(!pin\(\)\)/);assert.match(js,/data-tab=\"inbox\"/);assert.doesNotMatch(js,/addEventListener\('input',schedule\);loadList\(\)/);
 assert.match(js,/productionWrites:0/);assert.match(js,/outboundEnabled:false/);assert.match(js,/autoMerge:false/);
 assert.doesNotMatch(js,/SERVICE_ROLE|SUPABASE_SERVICE|provider_sends/i);
});