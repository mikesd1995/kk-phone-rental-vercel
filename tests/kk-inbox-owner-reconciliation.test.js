'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Durable=require('../server/kk-inbox-outbound-delivery');
const {createPostgrestStore}=require('../server/kk-inbox-postgrest-store');

const conversationId='conv_'+'a'.repeat(24);
const lineUser='U12345678901234567890123456789012';
const priorId='123e4567-e89b-42d3-a456-426614174000';
const newId='123e4567-e89b-42d3-a456-426614174001';
const retryKey='234e4567-e89b-42d3-a456-426614174000';
const input={conversationId,conversation:{conversation_id:conversationId,channel:'line',external_user_id:lineUser},
 body:'Approved intentional repeat message',requestId:newId};
const deps=(store,line)=>({
 store,lineMessaging:line,serviceKey:'test-secret-only',lineToken:'test-token',
 fetchImpl:()=>{throw new Error('never call LINE network in unit tests')}
});
const fakeLine=()=>{
 const sent=[];
 return {sent,async pushText(data,options){
  sent.push({data,options});
  return {provider_confirmed:true,external_message_id:'provider-msg-new',provider_request_id:'line-request-new',
          sent_at:'2026-10-13T09:00:00.000Z'};
 }};
};
function ledger(parentStatus='SENT',reviewStatus='VERIFIED_SENT',isLatest=true){
 const reservations=new Map(),saved=[];
 let parent={request_id:priorId,conversation_id:conversationId,status:parentStatus,
             review_status:reviewStatus,provider_message_id:'line-msg-prior',
             review_evidence_ref:'LINE-OA-12345'};
 const store={
  reservations,saved,parent,
  async reserveOutbound(requestId,room,digest,options={}){
   if(reservations.has(requestId))return {allowed:false,status:'ALREADY_RESERVED'};
   if(options.repeatOf){
    if(options.repeatOf!==parent.request_id||parent.status!=='SENT'||
       parent.review_status!=='VERIFIED_SENT'||!parent.provider_message_id||
       !parent.review_evidence_ref||!isLatest||options.repeatReason.length<12)
       return {allowed:false,status:'DUPLICATE_CONTENT_UNDER_REVIEW'};
   }else return {allowed:false,status:'DUPLICATE_CONTENT_UNDER_REVIEW'};
   reservations.set(requestId,{status:'RESERVED',room,digest,options});
   return {allowed:true,retry_key:retryKey};
  },
  async recordOutbound(message){saved.push(message);return {ok:true,duplicate:false,writes:1}},
  async finishOutbound(requestId,status){reservations.get(requestId).status=status;return {status}}
 };
 return store;
}
function send(store,line,extra={}){
 return Durable.sendOnce({...input,...extra},deps(store,line));
}
const reviewApproved={repeatOf:priorId,repeatReason:'Owner verified historical LINE OA receipt',repeatApproved:true};

test('intentional repeat requires separate owner approval and long reason before DB or LINE',async()=>{
 const store=ledger(),line=fakeLine();
 for(const extra of [
  {repeatOf:priorId,repeatReason:'Owner verified historical LINE OA receipt'},
  {repeatOf:priorId,repeatReason:'short',repeatApproved:true},
  {repeatOf:'invalid',repeatReason:'Owner verified historical LINE OA receipt',repeatApproved:true},
  {repeatOf:newId,repeatReason:'Owner verified historical LINE OA receipt',repeatApproved:true},
  {repeatReason:'Owner verified historical LINE OA receipt'}
 ]){
  const response=await send(store,line,extra);
  assert.equal(response.ok,false);
  assert.equal(response.http_status,409);
 }
 assert.equal(store.reservations.size,0);
 assert.equal(line.sent.length,0);
});

test('explicit reviewed SENT repeat reserves NEW ID and pushes LINE once',async()=>{
 const store=ledger(),line=fakeLine();
 const response=await send(store,line,reviewApproved);
 assert.equal(response.ok,true);
 assert.equal(line.sent.length,1);
 assert.equal(line.sent[0].options.retryKey,retryKey);
 assert.equal(store.saved[0].outbound_request_id,newId);
 assert.equal(store.reservations.get(newId).options.repeatOf,priorId);
 assert.equal(store.reservations.get(newId).status,'SENT');
 const repeat=await send(store,line,reviewApproved);
 assert.equal(repeat.http_status,409);
 assert.equal(line.sent.length,1);
});

test('UNCERTAIN and RESERVED parent are never eligible for intentional repeat',async()=>{
 for(const state of ['UNCERTAIN','RESERVED']){
  const store=ledger(state,'VERIFIED_SENT'),line=fakeLine();
  const response=await send(store,line,reviewApproved);
  assert.equal(response.http_status,409);
  assert.equal(line.sent.length,0);
 }
});

test('SENT without reviewed evidence, or non-latest parent, cannot override 30-day block',async()=>{
 for(const [state,review,latest] of [['SENT','UNREVIEWED',true],['SENT','NEEDS_INVESTIGATION',true],['SENT','VERIFIED_SENT',false]]){
  const store=ledger(state,review,latest),line=fakeLine();
  const response=await send(store,line,reviewApproved);
  assert.equal(response.http_status,409);
  assert.equal(line.sent.length,0);
 }
});

test('owner reconciliation PostgREST RPC is private and excludes provider push',async()=>{
 const calls=[];
 const store=createPostgrestStore({
  url:'https://inbox.example.invalid',serviceKey:'private-test-service',
  fetchImpl:async(url,req)=>{
   calls.push({url,req,body:JSON.parse(req.body)});
   if(url.endsWith('/kk_inbox_list_outbound_attempts'))
    return new Response(JSON.stringify([{request_id:priorId,conversation_id:conversationId,status:'SENT',review_status:'UNREVIEWED'}]),{status:200});
   if(url.endsWith('/kk_inbox_review_outbound'))
    return new Response(JSON.stringify({ok:true,request_id:priorId,review_status:'VERIFIED_SENT',provider_sends:0}),{status:200});
   if(url.endsWith('/kk_inbox_reserve_outbound'))
    return new Response(JSON.stringify({allowed:false,status:'DUPLICATE_CONTENT_UNDER_REVIEW'}),{status:200});
   throw new Error('Unknown RPC called');
  }
 });
 const list=await store.listOutboundAttempts(conversationId,30);
 assert.equal(list.length,1);
 const r=await store.reviewOutboundAttempt({
  conversationId,requestId:priorId,reviewStatus:'VERIFIED_SENT',evidenceRef:'LINE-OA-12345',note:'Receipt reviewed'});
 assert.equal(r.ok,true);
 const reserved=await store.reserveOutbound(newId,conversationId,'a'.repeat(64),
  {repeatOf:priorId,repeatReason:'Verified deliberate follow up'});
 assert.equal(reserved.allowed,false);
 assert.equal(calls.length,3);
 for(const c of calls){
  assert.match(c.url,/\/rest\/v1\/rpc\/kk_inbox_/);
  assert.equal(c.req.headers.Authorization,'Bearer private-test-service');
  assert.doesNotMatch(c.url,/api\.line\.me/);
 }
 assert.equal(calls[1].body.p_review_status,'VERIFIED_SENT');
 assert.equal(calls[1].body.p_request_id,priorId);
 assert.equal(calls[2].body.p_repeat_of,priorId);
});

test('RPC outage yields fail-closed readback and never silently returns empty list',async()=>{
 const store=createPostgrestStore({
  url:'https://inbox.example.invalid',serviceKey:'fake-key',
  fetchImpl:async()=>new Response('RPC unavailable',{status:404})
 });
 await assert.rejects(()=>store.listOutboundAttempts(conversationId));
 await assert.rejects(()=>store.reviewOutboundAttempt({
  conversationId,requestId:priorId,reviewStatus:'VERIFIED_SENT',evidenceRef:'LINE-OA-12345'}));
});

test('SQL prevents uncertain repeat, requires owner-reviewed evidence and latest match',()=>{
 const root=path.join(__dirname,'..');
 const sql=fs.readFileSync(path.join(root,'supabase/migrations/20261013163000_kk_inbox_outbound_owner_review.sql'),'utf8');
 assert.match(sql,/v_match\.status<>'SENT'/);
 assert.match(sql,/v_match\.review_status<>'VERIFIED_SENT'/);
 assert.match(sql,/p_repeat_of<>v_match\.request_id/);
 assert.match(sql,/length\(v_reason\)<12/);
 assert.match(sql,/pg_advisory_xact_lock/);
 assert.match(sql,/UNRESOLVED_OUTBOUND_IN_WINDOW/);
 assert.match(sql,/status in \('RESERVED','UNCERTAIN'\)/);
 assert.match(sql,/notify pgrst, 'reload schema'/);
 assert.match(sql,/grant execute on function public\.kk_inbox_reserve_outbound\(uuid,text,text,uuid,text\) to service_role/);
 assert.match(sql,/drop function if exists public\.kk_inbox_reserve_outbound\(uuid,text,text\)/);
 assert.doesNotMatch(sql,/grant execute .* to authenticated/i);
 assert.doesNotMatch(sql,/customer_phone|customer_name|body_text|channel_access_token/i);
});

test('API has guarded owner-only review actions, no automatic LINE send',()=>{
 const root=path.join(__dirname,'..');
 const api=fs.readFileSync(path.join(root,'api/kk-admin-guard.js'),'utf8');
 const ui=fs.readFileSync(path.join(root,'admin/inbox-preview.js'),'utf8');
 const html=fs.readFileSync(path.join(root,'admin/index.html'),'utf8');
 assert.match(api,/inboxListOutboundAttempts/);
 assert.match(api,/inboxReviewOutboundAttempt/);
 assert.match(api,/payload\.owner_approved!==true/);
 assert.match(api,/intentional_repeat_approved/);
 assert.match(ui,/pendingIntentionalRepeat/);
 assert.match(ui,/inboxPrepareRepeatBtn/);
 assert.match(ui,/saveOutboundReview/);
 assert.match(html,/id="inboxOutboundReviewPanel"/);
 assert.match(html,/id="inboxOutboundSaveReviewBtn"/);
 assert.match(html,/id="inboxPrepareRepeatBtn"/);
});

test('owner history UI reads ledger but cannot auto-send or expose retry keys',async()=>{
 const vm=require('node:vm');
 const js=fs.readFileSync(path.join(__dirname,'../admin/inbox-preview.js'),'utf8');
 const a=js.indexOf('function renderOutboundReview(){'),b=js.indexOf('async function sendMessage(){',a);
 assert.ok(a>0&&b>a);
 const elements={
  '#inboxOutboundReviewPanel':{hidden:true},
  '#inboxOutboundReviewStatus':{textContent:''},
  '#inboxOutboundAttempts':{innerHTML:''},
  '#inboxOutboundSaveReviewBtn':{disabled:true},
  '#inboxPrepareRepeatBtn':{disabled:true}
 };
 const calls=[];
 const ctx={
  $:key=>elements[key]||{value:''},
  esc:val=>String(val).replaceAll('<','&lt;').replaceAll('>','&gt;'),
  api:async(action,payload)=>{
   calls.push({action,payload});
   if(action!=='inboxListOutboundAttempts')throw Error('Unexpected send or mutation');
   return {ok:true,attempts:[{
    request_id:priorId,created_at:'2026-10-13T09:00:00Z',status:'UNCERTAIN',review_status:'UNREVIEWED',
    retry_key:'must-not-show',body_fingerprint:'must-not-show'
   }]};
  },
  window:{confirm:()=>true},composeState:()=>{}
 };
 vm.runInNewContext(
  "let selected='"+conversationId+"',selectedRow={conversation_id:'"+conversationId+"',channel:'line'};"+
  "let outboundReviewSeq=0,outboundReviewRows=[],outboundSelected=null,pendingIntentionalRepeat=null;\n"+
  js.slice(a,b)+"\nglobalThis.load=loadOutboundHistory;",ctx
 );
 await ctx.load();
 assert.equal(elements['#inboxOutboundReviewPanel'].hidden,false);
 assert.equal(calls.length,1);
 assert.equal(calls[0].action,'inboxListOutboundAttempts');
 assert.doesNotMatch(elements['#inboxOutboundAttempts'].innerHTML,/must-not-show/);
 assert.match(elements['#inboxOutboundAttempts'].innerHTML,/UNCERTAIN/);
 assert.equal(elements['#inboxPrepareRepeatBtn'].disabled,true);
});

test('owner cannot prepare an UNCERTAIN send as a deliberate repeat',()=>{
 const vm=require('node:vm'),js=fs.readFileSync(path.join(__dirname,'../admin/inbox-preview.js'),'utf8');
 const a=js.indexOf('function renderOutboundReview(){'),b=js.indexOf('async function sendMessage(){',a);
 let confirmations=0;
 const elements={
  '#inboxIntentionalRepeatReason':{value:'Documented deliberate repeat of receipt'},
  '#inboxComposeText':{value:'original text'},
  '#inboxOutboundReviewStatus':{textContent:''}
 };
 const ctx={
  $:key=>elements[key]||{disabled:true,innerHTML:''},
  window:{confirm:()=>{confirmations++;return true}},
  composeState:()=>{},esc:s=>String(s)
 };
 vm.runInNewContext(
  "let selected='"+conversationId+"',selectedRow={conversation_id:'"+conversationId+"',channel:'line'};"+
  "let outboundReviewSeq=0,outboundReviewRows=[],outboundSelected={request_id:'"+priorId+"',status:'UNCERTAIN',review_status:'VERIFIED_SENT',provider_message_id:'x'},pendingIntentionalRepeat=null;\n"+
  js.slice(a,b)+"\nglobalThis.prepare=prepareIntentionalRepeat;globalThis.pending=()=>pendingIntentionalRepeat;",ctx
 );
 ctx.prepare();
 assert.equal(ctx.pending(),null);
 assert.equal(confirmations,0);
 assert.match(elements['#inboxOutboundReviewStatus'].textContent,/SENT/);
});
