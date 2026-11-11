'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const Approval = require('../server/line-booking-owner-approval');

const BOOKING = 'BK-20261112-001';
const CUSTOMER = 'U' + 'c'.repeat(32);
const OWNER = 'U' + 'o'.repeat(32);
const HEADERS = ['outbox_id','booking_id','decision','state',
  'retry_key','provider_message_id','recipient','message_type','request_id','updated_at','created_at'];
const RETRY = '23ce4567-e89b-42d3-a456-426614174002';
const DISPATCH = 'synthetic_line_owner_dispatch_private_key_2026';
const env = () => ({
  KK_LINE_BOOKING_AUTOMATION_ENABLED: 'true',
  KK_LINE_OWNER_OUTBOX_V1_ENABLED: 'true',
  KK_LINE_OWNER_OUTBOX_DISPATCH_SECRET: DISPATCH,
  KK_ADMIN_SCRIPT_URL: 'https://script.google.com/macros/s/SYNTHETIC/exec',
  KK_ADMIN_API_KEY: 'test-admin-key',
  KK_OWNER_LINE_USER_ID: OWNER,
  LINE_CHANNEL_ACCESS_TOKEN: 'test-token',
  LINE_CHANNEL_SECRET: 'test-secret'
});
const response = (value, code=200) => ({
  ok: code >= 200 && code < 300,
  status: code, headers: {get: ()=>'provider-request-1'},
  text: async () => JSON.stringify(value)
});
function makeBooking(status='pending') {
  const row = Array(20).fill('');
  row[0] = BOOKING; row[2] = status; row[5] = CUSTOMER;
  row[7] = 'LINE'; row[13] = 'unpaid';
  row[19] = '[KK_REQ:line:'+'a'.repeat(48)+']';
  return row;
}
function fakeSheet(rows) {
  return {
    rows,
    getLastRow(){return this.rows.length;},
    getRange(row,col,height,width) {
      const table=this;
      return {
        getValues() {
          return Array.from({length:height},(_,i)=>
            Array.from({length:width},(_,j)=>
              table.rows[row-1+i] ? table.rows[row-1+i][col-1+j] : ''));
        },
        setValues(values) {
          for(let i=0;i<height;i++){
            if(!table.rows[row-1+i])table.rows[row-1+i]=Array(Math.max(20,col+width-1)).fill('');
            for(let j=0;j<width;j++) table.rows[row-1+i][col-1+j]=values[i][j];
          }
        }
      };
    }
  };
}
function appsScriptHarness({outboxEnabled=true,header=HEADERS,booking='pending'}={}) {
  const source=fs.readFileSync(path.join(__dirname,'..','apps-script/Code.gs'),'utf8');
  const start=source.indexOf('const KK_LINE_OWNER_OUTBOX_VERSION_');
  const end=source.indexOf('function kkApiDecideLineBookingPending_(payload)',start);
  assert.ok(start>0 && end>start,'canonical outbox functions present');
  const bookingSheet=fakeSheet([Array(20).fill(''),Array(20).fill(''),
    Array(20).fill(''),Array(20).fill(''),makeBooking(booking)]);
  const ledger=fakeSheet([header]);
  let lockHeld=false,flushes=0,failOnFlush=0;
  const context={
    SpreadsheetApp: {flush(){flushes++;if(failOnFlush===flushes)throw Error('synthetic crash after write');}},
    PropertiesService:{getScriptProperties:()=>({getProperty:key=>key==='KK_LINE_OWNER_OUTBOX_V1_ENABLED'?(outboxEnabled?'true':'false'):
        key==='KK_LINE_OWNER_OUTBOX_DISPATCH_SECRET'?DISPATCH:
        key==='KK_ADMIN_API_KEY'?'distinct-admin-key':''})},
    Utilities:{
      DigestAlgorithm:{SHA_256:'sha256'},Charset:{UTF_8:'utf8'},
      computeDigest:(_alg,input)=>Array.from(crypto.createHash('sha256').update(input).digest())
    },
    kkSheet_(name){
      if(name==='00_Master_Booking')return bookingSheet;
      if(name==='19_Line_Decision_Outbox')return ledger;
      throw Error('Missing sheet');
    },
    KK:{bookings:'00_Master_Booking'},
    kkAcquireDocumentLock_(){
      assert.equal(lockHeld,false,'document lock must not nest');
      lockHeld=true;return {releaseLock(){lockHeld=false;}};
    },
    kkFindBookingRow_(_empty,id){if(id!==BOOKING)throw Error('Booking not found');return 5;},
    kkBookingRequestIdFromNote_(note){
      const m=String(note).match(/\[KK_REQ:([A-Za-z0-9._:-]{8,128})\]/);
      return m?m[1]:'';
    }
  };
  vm.createContext(context);
  vm.runInContext(source.slice(start,end),context,{filename:'AppsScriptOwnerOutbox.gs'});
  const api={
    decide:p=>context.kkApiDecideLineBookingPendingDurable_(p),
    claim:p=>context.kkApiClaimLineBookingDecisionDelivery_(p),
    settle:p=>context.kkApiSettleLineBookingDecisionDelivery_(p),
    readiness:()=>context.kkApiLineOwnerOutboxReadiness_(),
    bookingSheet,ledger,
    crashAtFlush:n=>{failOnFlush=n;},
    flushCount:()=>flushes
  };
  return api;
}
const decision = {booking_id:BOOKING,decision:'approve'};

test('canonical Apps Script: INTENT is durable before booking status and READY',()=>{
  const s=appsScriptHarness();
  const result=s.decide(decision);
  assert.equal(result.booking_status,'confirmed');
  assert.equal(result.idempotent_replay,true,'old webhook may never bypass durable sender');
  assert.equal(result.outbox_state,'READY');
  assert.equal(s.bookingSheet.rows[4][2],'confirmed');
  assert.equal(s.ledger.rows.length,2);
  assert.equal(s.ledger.rows[1][1],BOOKING);
  assert.equal(s.ledger.rows[1][6],CUSTOMER);
  assert.equal(s.ledger.rows[1][7],'CUSTOMER_DECISION');
  assert.equal(s.ledger.rows[1][8],'line:'+'a'.repeat(48));
  assert.deepEqual(JSON.parse(JSON.stringify(s.readiness())),{outbox_mode:'KK_LINE_OWNER_OUTBOX_V1',ready:true,columns:11});
  assert.equal(s.ledger.rows[1][3],'READY');
  assert.match(s.ledger.rows[1][0],/^LINE_OWNER_V1_[a-f0-9]{48}$/);
  assert.equal(s.decide(decision).outbox_state,'READY');
  assert.equal(s.ledger.rows.length,2,'canonical replay never creates a second intent');
});
test('canonical Apps Script: crash AFTER booking update recovers from durable INTENT',()=>{
  const s=appsScriptHarness();
  s.crashAtFlush(2);
  assert.throws(()=>s.decide(decision),/synthetic crash/);
  assert.equal(s.bookingSheet.rows[4][2],'confirmed');
  assert.equal(s.ledger.rows[1][3],'INTENT');
  s.crashAtFlush(0);
  assert.equal(s.decide(decision).outbox_state,'READY');
  assert.equal(s.ledger.rows.length,2);
});
test('canonical Apps Script: wrong schema fails before mutating Booking',()=>{
  const s=appsScriptHarness({header:['unexpected']});
  assert.throws(()=>s.decide(decision),/SCHEMA_MISMATCH/);
  assert.equal(s.bookingSheet.rows[4][2],'pending');
  assert.equal(s.ledger.rows.length,1);
});
test('canonical Apps Script: one-time CLAIM -> SENT and no second claim',()=>{
  const s=appsScriptHarness();
  const r=s.decide(decision);
  const p={...decision,outbox_id:r.outbox_id,retry_key:RETRY,outbox_dispatch_key:DISPATCH};
  const claim=s.claim(p);
  assert.equal(claim.claimed,true);
  assert.equal(claim.customer_contact,CUSTOMER);
  assert.equal(claim.retry_key,RETRY);
  assert.equal(s.claim(p).claimed,false);
  const ack=s.settle({...p,delivery_state:'SENT',provider_message_id:'line-msg-1'});
  assert.equal(ack.outbox_state,'SENT');
  assert.equal(ack.provider_message_id,'line-msg-1');
  assert.equal(s.settle({...p,delivery_state:'SENT',provider_message_id:'line-msg-1'}).outbox_state,'SENT');
  assert.equal(s.claim(p).claimed,false);
  assert.equal(s.decide(decision).outbox_state,'SENT');
  assert.equal(s.ledger.rows.length,2);
});
test('canonical Apps Script: uncertain provider state never reclaims',()=>{
  const s=appsScriptHarness();
  const r=s.decide(decision),p={...decision,outbox_id:r.outbox_id,retry_key:RETRY,outbox_dispatch_key:DISPATCH};
  assert.equal(s.claim(p).claimed,true);
  assert.equal(s.settle({...p,delivery_state:'UNCERTAIN'}).outbox_state,'UNCERTAIN');
  assert.equal(s.claim(p).claimed,false);
  assert.throws(()=>s.settle({...p,delivery_state:'SENT',provider_message_id:'other'}),/ALREADY_SETTLED/);
});
test('canonical Apps Script: wrong decision/key and tampered booking state fail closed',()=>{
  const s=appsScriptHarness(),r=s.decide(decision),p={...decision,outbox_id:r.outbox_id,retry_key:RETRY,outbox_dispatch_key:DISPATCH};
  assert.throws(()=>s.claim({...p,decision:'reject'}),/IDENTITY_OR_STATE_MISMATCH/);
  assert.throws(()=>s.claim({...p,outbox_id:'forged'}),/CLAIM_INVALID/);
  assert.equal(s.claim(p).claimed,true);
  s.bookingSheet.rows[4][2]='cancelled';
  assert.throws(()=>s.settle({...p,delivery_state:'SENT',provider_message_id:'line-msg-1'}),/STATUS_DRIFT/);
  assert.equal(s.ledger.rows[1][3],'CLAIMED');
});
test('canonical Apps Script: outbox disabled cannot claim even if sheet exists',()=>{
  const s=appsScriptHarness({outboxEnabled:false});
  assert.throws(()=>s.claim({...decision,outbox_id:'x',retry_key:RETRY,outbox_dispatch_key:DISPATCH}),/DISABLED/);
  assert.equal(s.bookingSheet.rows[4][2],'pending');
});
test('canonical Apps Script: historical approved booking creates no phantom notification',()=>{
  const s=appsScriptHarness({booking:'confirmed'});
  const r=s.decide(decision);
  assert.equal(r.outbox_state,'MISSING');
  assert.equal(r.idempotent_replay,true);
  assert.equal(s.ledger.rows.length,1);
});

function ownerEvent(e) {
  return {
    type:'postback',replyToken:'synthetic-owner-token',
    source:{type:'user',userId:OWNER},
    postback:{data:Approval.decisionData('approve',BOOKING,e)}
  };
}
function transport({initial='READY',provider='OK',claim='OK',settle='OK'}={}) {
  const e=env(),calls=[],outboxId='LINE_OWNER_V1_'+'a'.repeat(48);
  const fetchImpl=async(url,options)=>{
    const request=JSON.parse(options.body);calls.push({url,request,options});
    if(url.startsWith('https://script.google.com/')) {
      if(request.action==='lineOwnerOutboxReadiness')return response({ok:true,outbox_mode:'KK_LINE_OWNER_OUTBOX_V1',ready:true,columns:11});
      const baseline={ok:true,booking_id:BOOKING,decision:'approve',outbox_id:outboxId,
        outbox_mode:'KK_LINE_OWNER_OUTBOX_V1'};
      if(request.action==='decideLineBookingPending')return response({
        ...baseline,booking_status:'confirmed',idempotent_replay:true,outbox_state:initial,customer_contact:CUSTOMER
      });
      if(request.action==='claimLineBookingDecisionDelivery'){
        if(claim==='BAD')return response({...baseline,claimed:false,outbox_state:'CLAIMED'});
        return response({...baseline,claimed:true,retry_key:request.retry_key,
          outbox_state:'CLAIMED',customer_contact:CUSTOMER});
      }
      if(request.action==='settleLineBookingDecisionDelivery'){
        if(settle==='FAIL')return response({ok:false},503);
        return response({...baseline,outbox_state:request.delivery_state,
          provider_message_id:request.provider_message_id});
      }
      throw Error('unexpected Apps Script action '+request.action);
    }
    if(url.endsWith('/push')){
      if(provider==='THROW')throw Error('private provider exception');
      if(provider==='FAIL')return response({error:'private provider payload'},503);
      if(provider==='NO_RECEIPT')return response({sentMessages:[]});
      return response({sentMessages:[{id:'sent-real-id-01'}]});
    }
    if(url.endsWith('/reply'))return response({ok:true});
    throw Error('unexpected url');
  };
  return {e,calls,fetchImpl,outboxId};
}
async function approve(t) {
  return Approval.processOwnerPostback(ownerEvent(t.e),t.e,t.fetchImpl);
}
test('server: decision, claim, provider with durable retry key, settle, then owner reply',async()=>{
  const t=transport(),r=await approve(t);
  assert.equal(r.status,'CONFIRMED');assert.equal(r.delivery_status,'SENT');
  assert.equal(r.provider_receipt,true);assert.equal(r.customer_notifications,1);
  assert.deepEqual(t.calls.map(c=>c.url.startsWith('https://script.google.com/')?c.request.action:c.url.split('/').pop()),
    ['lineOwnerOutboxReadiness','decideLineBookingPending','claimLineBookingDecisionDelivery','push','settleLineBookingDecisionDelivery','reply']);
  const push=t.calls.find(c=>c.url.endsWith('/push'));
  assert.match(push.options.headers['X-Line-Retry-Key'],/^[0-9a-f-]{36}$/);
  assert.equal(push.request.to,CUSTOMER);
  assert.match(push.request.messages[0].text,/ยืนยันการจองแล้ว/);
});
test('server: already SENT does not claim, send or re-reply',async()=>{
  const t=transport({initial:'SENT'}),r=await approve(t);
  assert.equal(r.status,'ALREADY_NOTIFIED');assert.equal(t.calls.length,2);
});
test('server: refused claim cannot reach provider',async()=>{
  const t=transport({claim:'BAD'}),r=await approve(t);
  assert.equal(r.status,'DELIVERY_REVIEW_REQUIRED');
  assert.equal(t.calls.length,3);
});
test('server: provider timeout/rejection/missing receipt all settle UNCERTAIN without resend',async()=>{
  for(const provider of ['THROW','FAIL','NO_RECEIPT']){
    const t=transport({provider}),r=await approve(t);
    assert.equal(r.status,'DELIVERY_REVIEW_REQUIRED',provider);
    assert.equal(r.delivery_status,'UNCERTAIN',provider);
    assert.equal(t.calls.filter(c=>c.url.endsWith('/push')).length,1);
    assert.equal(t.calls.filter(c=>c.url.endsWith('/reply')).length,0);
    const settle=t.calls.find(c=>c.request.action==='settleLineBookingDecisionDelivery');
    assert.equal(settle.request.delivery_state,'UNCERTAIN');
  }
});
test('server: provider accepted but canonical settlement failed remains uncertain',async()=>{
  const t=transport({settle:'FAIL'}),r=await approve(t);
  assert.equal(r.status,'DELIVERY_REVIEW_REQUIRED');
  assert.equal(r.delivery_status,'SETTLEMENT_UNCERTAIN');
  assert.equal(t.calls.filter(c=>c.url.endsWith('/push')).length,1);
  assert.equal(t.calls.filter(c=>c.url.endsWith('/reply')).length,0);
});
test('server: writer without outbox proof stops before claim and provider',async()=>{
  const t=transport(),fetchOrig=t.fetchImpl;
  t.fetchImpl=async(url,opt)=>{
    const r=await fetchOrig(url,opt);
    if(url.startsWith('https://script.google.com/')){
      const x=JSON.parse(await r.text());
      if(JSON.parse(opt.body).action==='decideLineBookingPending')delete x.outbox_mode;
      return response(x);
    }
    return r;
  };
  await assert.rejects(()=>approve(t),err=>err.code==='LINE_OWNER_OUTBOX_READBACK_REQUIRED');
  assert.equal(t.calls.length,2);
});

test('server: unavailable outbox preflight blocks booking decision and provider',async()=>{
  const t=transport(),original=t.fetchImpl;
  t.fetchImpl=async(url,options)=>{
    if(url.startsWith('https://script.google.com/') &&
      JSON.parse(options.body).action==='lineOwnerOutboxReadiness'){
      t.calls.push({url,request:JSON.parse(options.body),options});
      return response({ok:false},503);
    }
    return original(url,options);
  };
  await assert.rejects(()=>approve(t),err=>err.code==='LINE_BOOKING_UPSTREAM_FAILED');
  assert.deepEqual(t.calls.map(c=>c.request.action),['lineOwnerOutboxReadiness']);
});
test('canonical Apps Script: recipient drift after intent cannot authorize claim',()=>{
  const s=appsScriptHarness(),r=s.decide(decision);
  s.bookingSheet.rows[4][5]='U'+'z'.repeat(32);
  assert.throws(()=>s.claim({...decision,outbox_id:r.outbox_id,retry_key:RETRY,outbox_dispatch_key:DISPATCH}),
    /IDENTITY_OR_STATE_MISMATCH/);
  assert.equal(s.ledger.rows[1][3],'READY');
});

test('server: missing dispatch secret stops BEFORE even reading canonical booking',async()=>{
  const t=transport();
  delete t.e.KK_LINE_OWNER_OUTBOX_DISPATCH_SECRET;
  await assert.rejects(()=>approve(t),err=>err.code==='LINE_OWNER_OUTBOX_DISPATCH_NOT_READY');
  assert.equal(t.calls.length,0);
});
test('canonical GAS: forged dispatch credential cannot claim or settle',()=>{
  const s=appsScriptHarness(),r=s.decide(decision);
  const p={...decision,outbox_id:r.outbox_id,retry_key:RETRY};
  assert.throws(()=>s.claim({...p,outbox_dispatch_key:'wrong'}),/DISPATCH_UNAUTHORIZED/);
  assert.equal(s.ledger.rows[1][3],'READY');
  assert.equal(s.claim({...p,outbox_dispatch_key:DISPATCH}).claimed,true);
  assert.throws(()=>s.settle({...p,delivery_state:'SENT',provider_message_id:'line-msg-1',
    outbox_dispatch_key:'wrong'}),/DISPATCH_UNAUTHORIZED/);
  assert.equal(s.ledger.rows[1][3],'CLAIMED');
});
test('canonical GAS: a changed request ID never reuses a prior delivery intent',()=>{
  const s=appsScriptHarness(),r=s.decide(decision);
  s.bookingSheet.rows[4][19]='[KK_REQ:line:'+'b'.repeat(48)+']';
  assert.throws(()=>s.claim({...decision,outbox_id:r.outbox_id,retry_key:RETRY,
    outbox_dispatch_key:DISPATCH}),/IDENTITY_OR_STATE_MISMATCH/);
  assert.equal(s.ledger.rows[1][3],'READY');
});
