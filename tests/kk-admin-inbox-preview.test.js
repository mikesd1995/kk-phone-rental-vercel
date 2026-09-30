'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
test('admin exposes LINE/X inbox preview without send controls enabled',()=>{
 const html=fs.readFileSync(path.join(root,'admin/index.html'),'utf8');
 const js=fs.readFileSync(path.join(root,'admin/inbox-preview.js'),'utf8');
 assert.match(html,/data-tab="inbox"/); assert.match(html,/id="tab-inbox"/);
 assert.match(html,/id="inboxChannelFilter"/); assert.match(html,/id="inboxConversationList"/);
 assert.match(html,/textarea disabled/); assert.match(html,/button class="btn primary" type="button" disabled/);
 assert.match(js,/productionWrites:0/); assert.match(js,/outboundEnabled:false/); assert.match(js,/autoMerge:false/);
 assert.doesNotMatch(js,/\bfetch\s*\(/);
});
