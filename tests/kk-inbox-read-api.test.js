'use strict';const test=require('node:test');const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');const root=path.join(__dirname,'..');
const {Readable}=require('node:stream');
const handler=require('../api/kk-admin-guard.js');

test('Inbox reads authenticate before storage and never call write or provider endpoints',async()=>{
 const changes={KK_ADMIN_PIN:'local-test-pin',KK_INBOX_SUPABASE_URL:'https://inbox.example.invalid',KK_INBOX_SUPABASE_SERVICE_ROLE_KEY:'local-test-key',LINE_CHANNEL_ACCESS_TOKEN:'local-test-token'};
 const previous=Object.fromEntries(Object.keys(changes).map(k=>[k,process.env[k]]));
 const oldFetch=global.fetch;
 const calls=[];
 Object.assign(process.env,changes);
 global.fetch=async(url,options)=>{
  calls.push({url,body:JSON.parse(options.body)});
  assert.ok(['https://inbox.example.invalid/rest/v1/rpc/kk_inbox_list_conversations','https://inbox.example.invalid/rest/v1/rpc/kk_inbox_list_messages'].includes(url),'read action must not perform any write or send');
  return {ok:true,status:200,text:async()=>JSON.stringify([{message_id:'fixture'}])};
 };
 async function request(action,authorized){
  const req=Readable.from([JSON.stringify({action,conversation_id:'fixture-conversation'})]);
  req.method='POST';req.headers=authorized?{'x-admin-pin':'local-test-pin'}:{};
  const res={statusCode:0,setHeader(){},end(body){this.body=JSON.parse(body);}};
  await handler(req,res);return res;
 }
 try{
  for(const action of ['inboxListConversations','inboxListMessages']){
   const before=calls.length;
   const denied=await request(action,false);
   assert.equal(denied.statusCode,401);
   assert.equal(calls.length,before);
   for(const token of ['', 'local-test-token']){
    process.env.LINE_CHANNEL_ACCESS_TOKEN=token;
    const result=await request(action,true);
    assert.equal(result.statusCode,200);
    assert.equal(result.body.production_writes,0);
    assert.equal(result.body.outbound_enabled,Boolean(token));
   }
  }
  assert.equal(calls.length,4);
 }finally{
  global.fetch=oldFetch;
  for(const [key,value] of Object.entries(previous)){if(value===undefined)delete process.env[key];else process.env[key]=value;}
 }
});
test('Inbox SQL keeps read RPCs unavailable to browser roles',()=>{const sql=fs.readFileSync(path.join(root,'supabase/kk_inbox_v1.sql'),'utf8');assert.match(sql,/kk_inbox_list_conversations/);assert.match(sql,/kk_inbox_list_messages/);assert.match(sql,/revoke all on function public\.kk_inbox_list_conversations[\s\S]*anon,authenticated/);assert.match(sql,/grant execute on function public\.kk_inbox_list_conversations[\s\S]*service_role/);});