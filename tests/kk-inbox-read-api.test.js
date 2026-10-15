'use strict';const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');const root=path.join(__dirname,'..');
test('Inbox reads retain authentication boundaries and cannot mutate data',()=>{
 const api=fs.readFileSync(path.join(root,'api/kk-admin-guard.js'),'utf8');
 assert.match(api,/const INBOX_ACTIONS = new Set/);
 assert.match(api,/INBOX_ACTIONS\.has\(action\)/);
 assert.match(api,/createPostgrestStore/);
 assert.match(api,/if\(action==='inboxListMessages'\)[\s\S]*?production_writes:0/);
 assert.match(api,/if\(action==='inboxListConversations'\)[\s\S]*?production_writes:0/);
 assert.match(api,/payload\.owner_approved!==true/);
});

test('Inbox SQL keeps read RPCs unavailable to browser roles',()=>{const sql=fs.readFileSync(path.join(root,'supabase/kk_inbox_v1.sql'),'utf8');assert.match(sql,/kk_inbox_list_conversations/);assert.match(sql,/kk_inbox_list_messages/);assert.match(sql,/revoke all on function public\.kk_inbox_list_conversations[\s\S]*anon,authenticated/);assert.match(sql,/grant execute on function public\.kk_inbox_list_conversations[\s\S]*service_role/);});