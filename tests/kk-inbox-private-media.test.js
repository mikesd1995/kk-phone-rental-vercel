'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Media=require('../server/kk-inbox-media');
const Line=require('../server/kk-line-webhook');
const Tee=require('../server/kk-line-inbox-tee');
const id='msg_'+'a'.repeat(24),cid='conv_'+'b'.repeat(24);
const png=Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0,0,0]);
const options={url:'https://example.supabase.co',serviceKey:'private-service',token:'private-line-token'};

test('verified webhook retains LINE media ID independently from idempotent webhook event ID',()=>{
 const event={type:'message',webhookEventId:'webhook-event-xyz',source:{userId:'U100'},timestamp:1791656400000,message:{id:'1234567890123456789',type:'image'}};
 const normal=Line.normalizeEvent(event);
 assert.equal(normal.external_message_id,'webhook-event-xyz');
 assert.equal(normal.line_message_id,'1234567890123456789');
 assert.equal(normal.message_type,'image');
 assert.match(normal.message_id,/^msg_[a-f0-9]{24}$/);
});
test('verified tee archives images after durable persistence, without sending messages',async()=>{
 let uploads=0;
 const event={type:'message',webhookEventId:'webhook-image-1',source:{userId:'U100'},message:{id:'123456789',type:'image'}};
 const result=await Tee.persistVerifiedEvents([event],async()=>({duplicate:false}),{
  mediaFn:async(_event,message)=>{assert.equal(message.line_message_id,'123456789');uploads++;return{saved:true};}
 });
 assert.equal(result.media_saved,1);assert.equal(uploads,1);assert.equal(result.errors.length,0);
});
test('media capture failures are isolated from customer message persistence',async()=>{
 let records=0;
 const event={type:'message',webhookEventId:'webhook-image-2',source:{userId:'U100'},message:{id:'123456789',type:'image'}};
 const result=await Tee.persistVerifiedEvents([event],async()=>{records++;return{duplicate:false};},{
  mediaFn:async()=>{throw Object.assign(new Error('storage down'),{code:'INBOX_MEDIA_ARCHIVE_FAILED'});}
 });
 assert.equal(records,1);assert.equal(result.writes,1);assert.equal(result.status,'PARTIAL');
 assert.deepEqual(result.media_errors,[{code:'INBOX_MEDIA_ARCHIVE_FAILED'}]);
});
test('private storage capture keeps secret tokens server-side and never yields a public URL',async()=>{
 const calls=[];
 const fetchImpl=async(url,init={})=>{
  calls.push({url,init});
  if(url.startsWith('https://api-data.line.me/'))return new Response(png,{status:200,headers:{'Content-Type':'image/png'}});
  return new Response('{}',{status:200,headers:{'Content-Type':'application/json'}});
 };
 const r=await Media.capture({message:{id:'123456789',type:'image'}},{channel:'line',message_type:'image',message_id:id},{...options,fetchImpl});
 assert.equal(r.saved,true);assert.equal(calls.length,2);
 assert.match(calls[0].url,/api-data\.line\.me\/v2\/bot\/message\/123456789\/content/);
 assert.equal(calls[0].init.headers.Authorization,'Bearer private-line-token');
 assert.equal(calls[1].init.headers.apikey,'private-service');
 assert.equal(calls[1].init.headers['x-upsert'],'true');
 assert.match(calls[1].url,/\/storage\/v1\/object\/kk-inbox-media\/line\/msg_/);
 assert.equal(calls[1].init.headers['Content-Type'],'image/png');
 assert.ok(!JSON.stringify(r).includes('private-'));
});
test('archived image is read via private authenticated storage endpoint',async()=>{
 const fetchImpl=async(url,init)=>{
  assert.match(url,/\/storage\/v1\/object\/authenticated\/kk-inbox-media\/line\/msg_/);
  assert.equal(init.headers.Authorization,'Bearer private-service');
  return new Response(png,{status:200});
 };
 const r=await Media.readOrRecover({message_id:id,provider_message_id:''},{...options,fetchImpl});
 assert.equal(r.mime,'image/png');assert.equal(r.source,'archive');
});
test('not-yet-archived image recovers from provider while still retained by LINE',async()=>{
 const calls=[];
 const fetchImpl=async(url,init)=>{
  calls.push(url);
  if(url.includes('/object/authenticated/'))return new Response('not found',{status:404});
  if(url.startsWith('https://api-data.line.me/'))return new Response(png,{status:200});
  return new Response('{}',{status:200});
 };
 const r=await Media.readOrRecover({message_id:id,provider_message_id:'123456789'},{...options,fetchImpl});
 assert.equal(r.source,'recovered');assert.equal(calls.length,3);
});
test('historic media missing provider ID cannot be misrepresented as recovered',async()=>{
 const fetchImpl=async()=>new Response('not found',{status:404});
 await assert.rejects(Media.readOrRecover({message_id:id,provider_message_id:''},{...options,fetchImpl}),e=>e.code==='INBOX_MEDIA_NOT_ARCHIVED'&&e.status===404);
});
test('unsafe file types, untrusted IDs, oversized content are blocked',async()=>{
 assert.throws(()=>Media.pathFor('../secrets'),e=>e.code==='INBOX_MEDIA_ID_INVALID');
 assert.throws(()=>Media.imageType(Buffer.from('<svg onload=alert(1)>')),e=>e.code==='INBOX_MEDIA_UNSAFE_TYPE');
 await assert.rejects(Media.checkedBytes(new Response(png,{headers:{'Content-Length':String(Media.MAX_BYTES+1)}})),e=>e.code==='INBOX_MEDIA_TOO_LARGE');
});
test('Admin image route authenticates, checks exact conversation membership, and uses binary response',()=>{
 const root=path.join(__dirname,'..');
 const guard=fs.readFileSync(path.join(root,'api/kk-admin-guard.js'),'utf8');
 const browser=fs.readFileSync(path.join(root,'admin/inbox-preview.js'),'utf8');
 const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261010213000_kk_inbox_private_line_media.sql'),'utf8');
 assert.match(guard,/if\(!signedSession&&!legacyPinOk\)/);
 assert.match(guard,/if\(action==='inboxGetImage'\)/);
 assert.match(guard,/store\.getMediaMetadata\(conversationId,messageId\)/);
 assert.match(guard,/res\.end\(image\.bytes\)/);
 assert.match(browser,/data-inbox-image/);
 assert.match(browser,/URL\.createObjectURL/);
 assert.match(browser,/URL\.revokeObjectURL/);
 assert.match(browser,/action:'inboxGetImage'/);
 assert.doesNotMatch(browser,/SERVICE_ROLE|SUPABASE_SERVICE/i);
 assert.ok(migration.includes("values('kk-inbox-media','kk-inbox-media',false"));
 assert.match(migration,/revoke all on function public\.kk_inbox_media_metadata/);
});

test('store exposes only service-role exact-conversation media lookup and normalizes RPC null',async()=>{
 const {createPostgrestStore}=require('../server/kk-inbox-postgrest-store.js');
 const requests=[];
 const expected={message_id:'msg-test',conversation_id:'conv-test',channel:'line',direction:'inbound',message_type:'image',provider_message_id:'line-original'};
 const store=createPostgrestStore({
  url:'https://inbox.example.invalid',
  serviceKey:'unit-test-service-only',
  fetchImpl:async (url,request)=>{
   requests.push({url,request});
   return new Response(JSON.stringify(expected),{status:200,headers:{'Content-Type':'application/json'}});
  }
 });
 const one=await store.getMediaMetadata(' conv-test ',' msg-test ');
 assert.deepEqual(one,expected);
 assert.equal(requests.length,1);
 assert.equal(requests[0].url,'https://inbox.example.invalid/rest/v1/rpc/kk_inbox_media_metadata');
 assert.equal(requests[0].request.headers.Authorization,'Bearer unit-test-service-only');
 assert.deepEqual(JSON.parse(requests[0].request.body),{p_conversation_id:'conv-test',p_message_id:'msg-test'});
 const missing=createPostgrestStore({
  url:'https://inbox.example.invalid',serviceKey:'fixture-key',
  fetchImpl:async()=>new Response('null',{status:200})
 });
 assert.equal(await missing.getMediaMetadata('other-conv','msg-test'),null);
});
