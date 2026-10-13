'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Dedup=require('../server/kk-inbox-outbound-delivery');
const Line=require('../server/kk-line-messaging-api');

const userId='U12345678901234567890123456789012';
const conversationId='conv_'+'a'.repeat(24);
const requestA='123e4567-e89b-42d3-a456-426614174000';
const requestB='123e4567-e89b-42d3-a456-426614174001';
const same={conversationId,conversation:{conversation_id:conversationId,channel:'line',external_user_id:userId},body:'Thanks for contacting KK',requestId:requestA};

function makeStore(){
 const byRequest=new Map(),byContent=new Map(),saved=[];
 const store={
  saved,byRequest,
  async reserveOutbound(requestId,room,digest){
   if(byRequest.has(requestId))return {allowed:false,status:'ALREADY_RESERVED'};
   const key=room+':'+digest;
   if(byContent.has(key))return {allowed:false,status:'DUPLICATE_CONTENT_UNDER_REVIEW'};
   const retry_key='234e4567-e89b-42d3-a456-426614174000';
   const row={status:'RESERVED',retry_key,room,digest};
   byRequest.set(requestId,row);byContent.set(key,row);
   return {allowed:true,status:'RESERVED',retry_key};
  },
  async recordOutbound(message){saved.push(message);return {ok:true,writes:1}},
  async finishOutbound(requestId,status){const row=byRequest.get(requestId);row.status=status;return {status}}
 };
 return store;
}
function lineMock(onPush=()=>{}){
 const calls=[];
 return {
  calls,
  async pushText(data,opts){
   calls.push({data,opts});
   await onPush(data,opts);
   return {provider_confirmed:true,external_message_id:'provider_msg_1',
    provider_request_id:'provider_req_1',sent_at:'2026-10-13T00:00:00.000Z'};
  }
 };
}
function run(store,line,input=same){
 return Dedup.sendOnce(input,{store,lineMessaging:line,serviceKey:'private-test-key',lineToken:'private-line-token',fetchImpl:()=>{throw new Error('never actually fetch LINE')}});
}

test('HMAC dedupe never stores raw customer text and isolates recipients',()=>{
 const a=Dedup.fingerprint(conversationId,'hello','private-test-key');
 assert.match(a,/^[a-f0-9]{64}$/);
 assert.equal(a,Dedup.fingerprint(conversationId,'hello','private-test-key'));
 assert.notEqual(a,Dedup.fingerprint('conv_different','hello','private-test-key'));
 assert.notEqual(a,Dedup.fingerprint(conversationId,'other','private-test-key'));
 assert.equal(a.includes('hello'),false);
});

test('durable reservation permits one provider call and records exact retry key',async()=>{
 const store=makeStore(),line=lineMock();
 const result=await run(store,line);
 assert.equal(result.ok,true);
 assert.equal(result.provider_sends,1);
 assert.equal(line.calls.length,1);
 assert.equal(line.calls[0].data.to,userId);
 assert.equal(line.calls[0].opts.retryKey,'234e4567-e89b-42d3-a456-426614174000');
 assert.equal(store.byRequest.get(requestA).status,'SENT');
 assert.equal(store.saved.length,1);
 assert.equal(store.saved[0].outbound_request_id,requestA);
 assert.equal(store.saved[0].retry_key,line.calls[0].opts.retryKey);
});

test('replay after reload and same-body different request remain blocked server-side',async()=>{
 const store=makeStore(),line=lineMock();
 await run(store,line);
 const identical=await run(store,line);
 const newClick=await run(store,line,{...same,requestId:requestB});
 assert.equal(identical.http_status,409);
 assert.equal(newClick.http_status,409);
 assert.equal(line.calls.length,1);
 assert.equal(store.saved.length,1);
});

test('simultaneous duplicate requests cannot both call LINE',async()=>{
 const store=makeStore(),line=lineMock(async()=>await Promise.resolve());
 const all=await Promise.all([
  run(store,line),
  run(store,line,{...same,requestId:requestB})
 ]);
 assert.equal(all.filter(x=>x.ok).length,1);
 assert.equal(all.filter(x=>x.http_status===409).length,1);
 assert.equal(line.calls.length,1);
});

test('unavailable migration RPC or invalid reservation fails closed BEFORE provider call',async()=>{
 const line=lineMock();
 assert.equal((await run({},line)).error_code,'INBOX_OUTBOUND_LEDGER_UNAVAILABLE');
 const broken=makeStore();broken.reserveOutbound=async()=>{throw Error('RPC not installed')};
 assert.equal((await run(broken,line)).error_code,'INBOX_OUTBOUND_LEDGER_UNAVAILABLE');
 const malformed=makeStore();malformed.reserveOutbound=async()=>({allowed:true,retry_key:'not-a-uuid'});
 assert.equal((await run(malformed,line)).error_code,'INBOX_OUTBOUND_RETRY_KEY_MISSING');
 assert.equal(line.calls.length,0);
});

test('provider timeout leaves durable UNCERTAIN claim; no automatic resend',async()=>{
 const store=makeStore(),line=lineMock(async()=>{throw Error('upstream timeout')});
 const result=await run(store,line);
 assert.equal(result.ok,false);
 assert.equal(result.error_code,'INBOX_LINE_SEND_UNCERTAIN');
 assert.equal(result.provider_sends,null);
 assert.equal(store.byRequest.get(requestA).status,'UNCERTAIN');
 const replay=await run(store,line);
 assert.equal(replay.http_status,409);
 assert.equal(line.calls.length,1);
});

test('post-send Inbox persist failure prevents a second provider push',async()=>{
 const store=makeStore(),line=lineMock();
 store.recordOutbound=async()=>{throw Error('persistence offline')};
 const result=await run(store,line);
 assert.equal(result.error_code,'INBOX_OUTBOUND_PERSIST_UNCERTAIN');
 assert.equal(result.provider_sends,1);
 assert.equal(store.byRequest.get(requestA).status,'UNCERTAIN');
 assert.equal((await run(store,line)).http_status,409);
 assert.equal(line.calls.length,1);
});

test('post-send reservation finalize failure still blocks new send',async()=>{
 const store=makeStore(),line=lineMock();
 store.finishOutbound=async()=>{throw Error('ledger unavailable')};
 const result=await run(store,line);
 assert.equal(result.error_code,'INBOX_OUTBOUND_FINALIZE_UNCERTAIN');
 assert.equal(store.saved.length,1);
 assert.equal((await run(store,line)).http_status,409);
 assert.equal(line.calls.length,1);
});

test('invalid recipient or request identity never reserves or reaches LINE',async()=>{
 const store=makeStore(),line=lineMock();
 assert.equal((await run(store,line,{...same,requestId:'not-uuid'})).http_status,400);
 assert.equal((await run(store,line,{...same,conversation:{...same.conversation,conversation_id:'wrong'}})).http_status,409);
 assert.equal((await run(store,line,{...same,conversation:{...same.conversation,external_user_id:'Cgroup-id'}})).http_status,409);
 assert.equal(store.byRequest.size,0);
 assert.equal(line.calls.length,0);
});

test('LINE provider response lacking real sentMessages identity is NOT accepted as sent',async()=>{
 const store=makeStore(),calls=[];
 const fakeLine={async pushText(_input,opts){
  calls.push(opts.retryKey);
  const raw=await Line.pushText({to:userId,text:'hello'},{
   token:'test-token',retryKey:opts.retryKey,
   fetchImpl:async()=>({ok:true,status:200,headers:{get:()=>''},text:async()=>JSON.stringify({sentMessages:[]})})
  });
  return raw;
 }};
 const result=await run(store,fakeLine);
 assert.equal(result.error_code,'INBOX_LINE_SEND_UNCERTAIN');
 assert.equal(store.byRequest.get(requestA).status,'UNCERTAIN');
 assert.equal(calls.length,1);
});

test('static API, frontend and migration contracts require owner approval and server-only ledger',()=>{
 const root=path.join(__dirname,'..');
 const api=fs.readFileSync(path.join(root,'api/kk-admin-guard.js'),'utf8');
 const ui=fs.readFileSync(path.join(root,'admin/inbox-preview.js'),'utf8');
 const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261013152000_kk_inbox_durable_outbound_reservations.sql'),'utf8');
 const store=fs.readFileSync(path.join(root,'server/kk-inbox-postgrest-store.js'),'utf8');
 assert.match(api,/payload\.owner_approved!==true/);
 assert.match(api,/DurableLineSend\.sendOnce/);
 assert.match(api,/send_request_id/);
 assert.match(ui,/window\.crypto\?\.randomUUID/);
 assert.match(ui,/send_request_id:sendRequestId/);
 assert.match(store,/kk_inbox_reserve_outbound/);
 assert.match(store,/kk_inbox_finish_outbound/);
 assert.match(migration,/pg_advisory_xact_lock/);
 assert.match(migration,/enable row level security/);
 assert.match(migration,/revoke all .* from public,anon,authenticated/i);
 assert.match(migration,/grant execute .* to service_role/i);
 assert.doesNotMatch(migration,/customer_phone|customer_name|booking_status|\bbody_text\b/i);
});

test('missing, empty, or duplicate Inbox persistence receipts cannot confirm a LINE send',async()=>{
 for(const receipt of [null,undefined,{ok:true,writes:0},{ok:true,writes:1,duplicate:true},{ok:false,writes:1}]){
  const store=makeStore(),line=lineMock();
  store.recordOutbound=async()=>receipt;
  const result=await run(store,line);
  assert.equal(result.ok,false);
  assert.equal(result.error_code,'INBOX_OUTBOUND_PERSIST_UNCERTAIN');
  assert.equal(result.provider_sends,1);
  assert.equal(store.byRequest.get(requestA).status,'UNCERTAIN');
  const again=await run(store,line);
  assert.equal(again.http_status,409);
  assert.equal(line.calls.length,1);
 }
});

test('verified Inbox persistence requires an exact single newly written row',async()=>{
 const store=makeStore(),line=lineMock();
 store.recordOutbound=async()=>({ok:true,writes:'1'});
 const result=await run(store,line);
 assert.equal(result.error_code,'INBOX_OUTBOUND_PERSIST_UNCERTAIN',
  'string or malformed row counts are not proof of committed Inbox write');
 assert.equal(store.byRequest.get(requestA).status,'UNCERTAIN');
 assert.equal(line.calls.length,1);
});
