'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const Approval=require('../server/line-booking-owner-approval');

const GAS=fs.readFileSync(path.join(__dirname,'../apps-script/Code.gs'),'utf8');
const OUTBOX=fs.readFileSync(path.join(__dirname,'../apps-script/LineDeliveryOutbox.gs'),'utf8');
const REQUEST='line:'+'a'.repeat(48);

function gasFixture(status='pending',enabled=true){
  const sheets=new Map(),locks={count:0};
  const booking=Array.from({length:20},()=> '');
  booking[0]='BK-TEST';
  booking[2]=status;
  booking[5]='UCUSTOMER';
  booking[7]='LINE';
  booking[13]='unpaid';
  booking[19]='[KK_REQ:'+REQUEST+']';
  const cells=new Map();
  class Sheet{
    constructor(name){this.name=name;this.cells=new Map();this.failNextState=null;}
    getLastRow(){
      const keys=[...this.cells.keys()];
      return keys.length?Math.max(...keys.map(k=>Number(k.split(':')[0]))):0;
    }
    getRange(row,col,rows,cols){
      const self=this;
      return {
        getValues(){
          return Array.from({length:rows},(_,ri)=>
            Array.from({length:cols},(_,ci)=>self.cells.get((row+ri)+':'+(col+ci))??''));
        },
        setValues(values){
          if(self.failNextState && self.name==='19_Line_Delivery_Outbox' &&
            values[0][4]===self.failNextState){
            self.failNextState=null;throw new Error('synthetic interrupted outbox write');
          }
          if(self.failBooking && self.name==='00_Master_Booking'){
            self.failBooking=false;throw new Error('synthetic interrupted booking write');
          }
          assert.equal(values.length,rows);
          for(let ri=0;ri<rows;ri++){
            assert.equal(values[ri].length,cols);
            for(let ci=0;ci<cols;ci++)self.cells.set((row+ri)+':'+(col+ci),values[ri][ci]);
          }
        }
      };
    }
  }
  const bookings=new Sheet('00_Master_Booking');
  bookings.getRange(5,1,1,20).setValues([booking]);
  sheets.set('00_Master_Booking',bookings);
  const ss={
    getSheetByName(name){return sheets.get(name)||null;},
    insertSheet(name){assert.equal(sheets.has(name),false);const sh=new Sheet(name);sheets.set(name,sh);return sh;}
  };
  const props={KK_LINE_DELIVERY_OUTBOX_ENABLED:enabled?'true':'false'};
  let uuid=0;
  const ctx={
    console,Date,JSON,Math,Number,String,Object,Array,RegExp,Error,Set,Map,
    PropertiesService:{getScriptProperties(){return {getProperty(k){return props[k]??null;}};}},
    SpreadsheetApp:{getActive(){return ss;},flush(){}},
    Utilities:{
      DigestAlgorithm:{SHA_256:'sha256'},
      Charset:{UTF_8:'utf8'},
      computeDigest(_,value){return [...crypto.createHash('sha256').update(value,'utf8').digest()].map(b=>b>=128?b-256:b);},
      getUuid(){uuid++;return '123e4567-e89b-42d3-a456-'+String(uuid).padStart(12,'0');}
    },
    LockService:{getDocumentLock(){return {
      tryLock(){locks.count++;return true;},releaseLock(){locks.count--;}
    }}},
  };
  vm.createContext(ctx);
  vm.runInContext(GAS,ctx,{filename:'apps-script/Code.gs'});
  vm.runInContext(OUTBOX,ctx,{filename:'apps-script/LineDeliveryOutbox.gs'});
  ctx.kkFindBookingRow_=(_id,bookingId)=>{
    if(bookingId!=='BK-TEST')throw new Error('synthetic booking not found');return 5;
  };
  return {ctx,sheets,bookings,props,locks,ss};
}
function readBook(f){return f.bookings.getRange(5,1,1,20).getValues()[0];}
function decide(f,decision){return f.ctx.kkApiDecideLineBookingPending_({booking_id:'BK-TEST',decision,outbox_contract:f.props.KK_LINE_DELIVERY_OUTBOX_ENABLED==='true'?'v1':'off'});}
function outboxSheet(f){return f.sheets.get('19_Line_Delivery_Outbox');}
function rows(f){const sh=outboxSheet(f);const n=sh.getLastRow();return n<2?[]:sh.getRange(2,1,n-1,11).getValues();}

test('GAS source/dispatcher compiles; no public outbox installation action exists',()=>{
  const f=gasFixture();
  assert.match(GAS,/case 'claimLineBookingNotification'/);
  assert.match(GAS,/case 'ackLineBookingNotification'/);
  assert.doesNotMatch(GAS,/case 'kkInstallLineDeliveryOutbox_'/);
  assert.equal(typeof f.ctx.kkInstallLineDeliveryOutbox_,'function');
});
test('outbox installation is manual and decision fails closed before booking mutation if sheet missing',()=>{
  const f=gasFixture();
  assert.throws(()=>decide(f,'approve'),/OUTBOX_SHEET_MISSING/);
  assert.equal(readBook(f)[2],'pending');
  assert.equal(outboxSheet(f),undefined);
  const result=f.ctx.kkInstallLineDeliveryOutbox_();
  assert.equal(result.installed,true);
  assert.equal(f.ctx.kkLineDeliveryOutboxPreflight_().schema_ok,true);
  assert.equal(f.ctx.kkInstallLineDeliveryOutbox_().existing,true);
});
test('durable PREPARED intent persists before canonical decision and exact READY readback',()=>{
  const f=gasFixture();f.ctx.kkInstallLineDeliveryOutbox_();
  const res=decide(f,'approve');
  assert.equal(res.booking_status,'confirmed');
  assert.equal(res.idempotent_replay,false);
  assert.equal(res.outbox_status,'READY');
  assert.match(res.outbox_id,/^KLO-[0-9a-f]{40}$/);
  assert.equal(readBook(f)[2],'confirmed');
  assert.equal(rows(f).length,1);
  assert.equal(rows(f)[0][4],'READY');
  assert.equal(rows(f)[0][3],f.ctx.kkLineDeliveryDigest_('UCUSTOMER'));
  assert.equal(f.locks.count,0);
});
test('booking write exception leaves PREPARED outbox, not a false delivered notification; retry resumes',()=>{
  const f=gasFixture();f.ctx.kkInstallLineDeliveryOutbox_();
  f.bookings.failBooking=true;
  assert.throws(()=>decide(f,'approve'),/interrupted booking/);
  assert.equal(readBook(f)[2],'pending');
  assert.equal(rows(f)[0][4],'PREPARED');
  const res=decide(f,'approve');
  assert.equal(res.outbox_status,'READY');
  assert.equal(rows(f).length,1);
});
test('post-commit READY write exception is healed by canonical replay; intent remains unique',()=>{
  const f=gasFixture();f.ctx.kkInstallLineDeliveryOutbox_();
  outboxSheet(f).failNextState='READY';
  assert.throws(()=>decide(f,'approve'),/interrupted outbox/);
  assert.equal(readBook(f)[2],'confirmed');
  assert.equal(rows(f)[0][4],'PREPARED');
  const res=decide(f,'approve');
  assert.equal(res.idempotent_replay,true);
  assert.equal(res.outbox_status,'READY');
  assert.equal(rows(f).length,1);
});
test('claim and ACK are one-shot with durable acceptance and no second customer contact',()=>{
  const f=gasFixture();f.ctx.kkInstallLineDeliveryOutbox_();
  const d=decide(f,'approve');
  const args={booking_id:'BK-TEST',decision:'approve',outbox_id:d.outbox_id};
  const first=f.ctx.kkApiClaimLineBookingNotification_(args);
  assert.equal(first.status,'CLAIMED');
  assert.equal(first.customer_contact,'UCUSTOMER');
  assert.equal(f.ctx.kkApiClaimLineBookingNotification_(args).status,'IN_FLIGHT');
  assert.equal(rows(f)[0][8],1);
  assert.equal(f.ctx.kkApiAckLineBookingNotification_({...args,claim_id:first.claim_id,
    disposition:'ACCEPTED',provider_request_id:'provider-request-id'}).status,'ACCEPTED');
  assert.equal(f.ctx.kkApiClaimLineBookingNotification_(args).status,'ALREADY_ACCEPTED');
  assert.equal(f.ctx.kkApiAckLineBookingNotification_({...args,claim_id:first.claim_id,
    disposition:'ACCEPTED',provider_request_id:'provider-request-id'}).status,'ALREADY_ACKED');
  assert.equal(rows(f).length,1);
});
test('expired claim becomes UNCERTAIN and can never be claimed again',()=>{
  const f=gasFixture();f.ctx.kkInstallLineDeliveryOutbox_();
  const d=decide(f,'approve');
  const args={booking_id:'BK-TEST',decision:'approve',outbox_id:d.outbox_id};
  f.ctx.kkApiClaimLineBookingNotification_(args);
  outboxSheet(f).getRange(2,7,1,1).setValues([['2020-01-01T00:00:00.000Z']]);
  assert.equal(f.ctx.kkApiClaimLineBookingNotification_(args).status,'REQUIRES_MANUAL_RECONCILIATION');
  assert.equal(rows(f)[0][4],'UNCERTAIN');
  assert.equal(f.ctx.kkApiClaimLineBookingNotification_(args).status,'REQUIRES_MANUAL_RECONCILIATION');
});
test('failed uncertain delivery terminally holds replay for manual reconciliation',()=>{
  const f=gasFixture();f.ctx.kkInstallLineDeliveryOutbox_();
  const d=decide(f,'reject');
  assert.equal(readBook(f)[2],'cancelled');
  const args={booking_id:'BK-TEST',decision:'reject',outbox_id:d.outbox_id};
  const claim=f.ctx.kkApiClaimLineBookingNotification_(args);
  assert.equal(f.ctx.kkApiAckLineBookingNotification_({...args,claim_id:claim.claim_id,
    disposition:'FAILED_UNCERTAIN'}).status,'FAILED_UNCERTAIN');
  assert.equal(f.ctx.kkApiClaimLineBookingNotification_(args).status,'REQUIRES_MANUAL_RECONCILIATION');
  assert.equal(rows(f)[0][8],1);
});
test('legacy confirmed booking without intent fails closed rather than creating synthetic delivery',()=>{
  const f=gasFixture('confirmed');f.ctx.kkInstallLineDeliveryOutbox_();
  assert.throws(()=>decide(f,'approve'),/OUTBOX_IDENTITY_MISMATCH/);
  assert.equal(rows(f).length,0);
});
test('tampered recipient, stale booking status, duplicate outbox id all stop claims',()=>{
  const f=gasFixture();f.ctx.kkInstallLineDeliveryOutbox_();
  const d=decide(f,'approve');
  const args={booking_id:'BK-TEST',decision:'approve',outbox_id:d.outbox_id};
  f.bookings.getRange(5,6,1,1).setValues([['UATTACKER']]);
  assert.throws(()=>f.ctx.kkApiClaimLineBookingNotification_(args),/OUTBOX_IDENTITY_MISMATCH/);
  f.bookings.getRange(5,6,1,1).setValues([['UCUSTOMER']]);
  outboxSheet(f).getRange(3,1,1,11).setValues([rows(f)[0]]);
  assert.throws(()=>f.ctx.kkApiClaimLineBookingNotification_(args),/DUPLICATE_ID/);
});
test('disabled GAS feature preserves legacy booking decision without creating outbox sheet',()=>{
  const f=gasFixture('pending',false);
  const r=decide(f,'approve');
  assert.equal(r.idempotent_replay,false);
  assert.equal(r.outbox_id,undefined);
  assert.equal(readBook(f)[2],'confirmed');
  assert.equal(outboxSheet(f),undefined);
  assert.throws(()=>f.ctx.kkApiClaimLineBookingNotification_({}),/OUTBOX_DISABLED/);
});
test('invalid ACK claim or provider receipt is rejected without modifying ledger',()=>{
  const f=gasFixture();f.ctx.kkInstallLineDeliveryOutbox_();
  const d=decide(f,'approve');
  const args={booking_id:'BK-TEST',decision:'approve',outbox_id:d.outbox_id};
  const claim=f.ctx.kkApiClaimLineBookingNotification_(args);
  assert.throws(()=>f.ctx.kkApiAckLineBookingNotification_({...args,claim_id:claim.claim_id,
    disposition:'ACCEPTED',provider_request_id:'invalid receipt with PII'}),/INVALID_ACK/);
  assert.throws(()=>f.ctx.kkApiAckLineBookingNotification_({...args,
    claim_id:'00000000-0000-4000-8000-000000000000',disposition:'ACCEPTED'}),/CLAIM_CONFLICT/);
  assert.equal(rows(f)[0][4],'CLAIMED');
});

function env(){return {
  KK_LINE_BOOKING_AUTOMATION_ENABLED:'true',
  KK_LINE_DELIVERY_OUTBOX_ENABLED:'true',
  KK_ADMIN_SCRIPT_URL:'https://script.google.com/macros/s/TEST/exec',
  KK_ADMIN_API_KEY:'synthetic-key',
  LINE_CHANNEL_ACCESS_TOKEN:'synthetic-token',
  LINE_CHANNEL_SECRET:'synthetic-secret',
  KK_OWNER_LINE_USER_ID:'UOWNER'
};}
const ok=(body,status=200,receipt='')=>({
  ok:status>=200&&status<300,status,
  text:async()=>JSON.stringify(body),
  headers:{get(k){return k==='x-line-request-id'?receipt:null;}}
});
function event(decision,bookingId,e){
  return {type:'postback',replyToken:'synthetic-reply',source:{type:'user',userId:'UOWNER'},
    postback:{data:Approval.decisionData(decision,bookingId,e)}};
}
function canonical(decision,bookingId,overrides={}){
  return {ok:true,booking_id:bookingId,booking_status:decision==='approve'?'confirmed':'cancelled',
    decision,idempotent_replay:false,customer_contact:'UCUSTOMER',
    outbox_id:'KLO-'+'b'.repeat(40),outbox_status:'READY',...overrides};
}
function responseFor(action,bookingId,decision){
  if(action==='lineDeliveryOutboxReadiness')return {ok:true,outbox_contract:'v1',enabled:true,schema_ok:true};
  if(action==='decideLineBookingPending')return canonical(decision,bookingId);
  if(action==='claimLineBookingNotification')return {ok:true,
    status:'CLAIMED',booking_id:bookingId,decision,outbox_id:'KLO-'+'b'.repeat(40),
    claim_id:'123e4567-e89b-42d3-a456-000000000001',customer_contact:'UCUSTOMER'};
  if(action==='ackLineBookingNotification')return {ok:true,
    status:'ACCEPTED',booking_id:bookingId,decision,outbox_id:'KLO-'+'b'.repeat(40)};
  throw Error('unknown canonical action '+action);
}
test('outbox enabled: decision/claim/customer push/ACK/owner reply are strictly ordered',async()=>{
  const e=env(), seen=[];
  const bookingId='BK-NODE-OUTBOX',decision='approve';
  const result=await Approval.processOwnerPostback(event(decision,bookingId,e),e,async(url,opt)=>{
    if(url.startsWith('https://script.google.com/')){
      const action=JSON.parse(opt.body).action;seen.push(action);
      return ok(responseFor(action,bookingId,decision));
    }
    seen.push(url.endsWith('/push')?'customer-push':'owner-reply');
    if(url.endsWith('/push')){
      assert.equal(JSON.parse(opt.body).to,'UCUSTOMER');
      assert.match(opt.headers['X-Line-Retry-Key'],/^[0-9a-f-]{36}$/);
      return ok({},200,'line-request-001');
    }
    assert.equal(opt.headers['X-Line-Retry-Key'],undefined);
    return ok({});
  });
  assert.deepEqual(seen,['lineDeliveryOutboxReadiness','decideLineBookingPending','claimLineBookingNotification',
    'customer-push','ackLineBookingNotification','owner-reply']);
  assert.equal(result.delivery_status,'ACCEPTED');
  assert.equal(result.status,'CONFIRMED');
});
test('outbox provider failure ACKs FAILED_UNCERTAIN but never tells owner success',async()=>{
  const e=env(),seen=[];
  const bookingId='BK-NODE-FAILED',decision='approve';
  await assert.rejects(()=>Approval.processOwnerPostback(event(decision,bookingId,e),e,async(url,opt)=>{
    if(url.startsWith('https://script.google.com/')){
      const body=JSON.parse(opt.body);
      seen.push(body.action);
      if(body.action==='ackLineBookingNotification'){
        assert.equal(body.disposition,'FAILED_UNCERTAIN');
        return ok({...responseFor(body.action,bookingId,decision),status:'FAILED_UNCERTAIN'});
      }
      return ok(responseFor(body.action,bookingId,decision));
    }
    seen.push('customer-push');
    return ok({message:'untrusted'},503);
  }),err=>err&&err.code==='LINE_SEND_FAILED'&&err.status===503);
  assert.deepEqual(seen,['lineDeliveryOutboxReadiness','decideLineBookingPending','claimLineBookingNotification',
    'customer-push','customer-push','ackLineBookingNotification']);
});
test('outbox approval fails closed when deployment/worker flags disagree',async()=>{
  for(const mismatch of [{outbox_id:''},{outbox_id:undefined}]){
    const e=env();let sends=0;
    await assert.rejects(()=>Approval.processOwnerPostback(event('approve','BK-CONTRACT',e),e,async(url,options)=>{
      if(url.startsWith('https://script.google.com/')){
        const action=JSON.parse(options.body).action;
        return ok(action==='lineDeliveryOutboxReadiness'?responseFor(action,'BK-CONTRACT','approve'):canonical('approve','BK-CONTRACT',mismatch));
      }
      sends++;return ok({});
    }),err=>err&&err.code==='LINE_DELIVERY_OUTBOX_CONTRACT_MISMATCH');
    assert.equal(sends,0);
  }
  const e=env();delete e.KK_LINE_DELIVERY_OUTBOX_ENABLED;
  let sends=0;
  await assert.rejects(()=>Approval.processOwnerPostback(event('approve','BK-WRITER-ON',e),e,async(url)=>{
    if(url.startsWith('https://script.google.com/'))return ok(canonical('approve','BK-WRITER-ON'));
    sends++;return ok({});
  }),err=>err&&err.code==='LINE_DELIVERY_OUTBOX_CONTRACT_MISMATCH');
  assert.equal(sends,0);
});
test('outbox already accepted or in-flight claim never sends duplicate push',async()=>{
  for(const status of ['ALREADY_ACCEPTED','IN_FLIGHT','REQUIRES_MANUAL_RECONCILIATION']){
    const e=env();let sends=0;
    const result=await Approval.processOwnerPostback(event('approve','BK-REPLAY-OUTBOX',e),e,async(url,opt)=>{
      if(url.startsWith('https://script.google.com/')){
        const action=JSON.parse(opt.body).action;
        if(action==='lineDeliveryOutboxReadiness')return ok(responseFor(action,'BK-REPLAY-OUTBOX','approve'));
        if(action==='decideLineBookingPending')
          return ok(canonical('approve','BK-REPLAY-OUTBOX',{idempotent_replay:true}));
        return ok({...responseFor(action,'BK-REPLAY-OUTBOX','approve'),status});
      }
      sends++;return ok({});
    });
    assert.equal(sends,0);
    assert.equal(result.status,status==='ALREADY_ACCEPTED'?'ALREADY_APPLIED':'DELIVERY_REQUIRES_RECONCILIATION');
  }
});
test('provider accepted but ACK unavailable never sends owner success or blindly resends',async()=>{
  const e=env();let pushes=0,replies=0;
  await assert.rejects(()=>Approval.processOwnerPostback(event('approve','BK-ACK-FAIL',e),e,async(url,opt)=>{
    if(url.startsWith('https://script.google.com/')){
      const action=JSON.parse(opt.body).action;
      if(action==='ackLineBookingNotification')return ok({ok:false,error:'untrusted upstream'},503);
      return ok(responseFor(action,'BK-ACK-FAIL','approve'));
    }
    if(url.endsWith('/push')){pushes++;return ok({},200,'accepted-id');}
    replies++;return ok({});
  }),err=>err&&err.code==='LINE_BOOKING_UPSTREAM_FAILED');
  assert.equal(pushes,1);
  assert.equal(replies,0);
});

test('GAS rejects stale OFF worker before any booking or outbox write',()=>{
  const f=gasFixture();f.ctx.kkInstallLineDeliveryOutbox_();
  assert.throws(()=>f.ctx.kkApiDecideLineBookingPending_({
    booking_id:'BK-TEST',decision:'approve',outbox_contract:'off'
  }),/OUTBOX_ACTIVATION_MISMATCH/);
  assert.equal(readBook(f)[2],'pending');
  assert.equal(rows(f).length,0);
});
test('GAS readiness reads exact header schema and refuses drift',()=>{
  const f=gasFixture();f.ctx.kkInstallLineDeliveryOutbox_();
  assert.equal(f.ctx.kkApiLineDeliveryOutboxReadiness_().outbox_contract,'v1');
  outboxSheet(f).getRange(1,2,1,1).setValues([['tampered_header']]);
  assert.throws(()=>f.ctx.kkApiLineDeliveryOutboxReadiness_(),/OUTBOX_SCHEMA_DRIFT/);
  assert.throws(()=>decide(f,'approve'),/OUTBOX_SCHEMA_DRIFT/);
  assert.equal(readBook(f)[2],'pending');
});
test('Node fails health handshake before canonical booking mutation when installed GAS not ready',async()=>{
  const e=env();let decisionCalls=0,providerCalls=0;
  await assert.rejects(
    ()=>Approval.processOwnerPostback(event('approve','BK-NOT-READY',e),e,async(url,opt)=>{
      if(url.startsWith('https://script.google.com/')){
        const action=JSON.parse(opt.body).action;
        if(action==='lineDeliveryOutboxReadiness')
          return ok({ok:true,outbox_contract:'v1',enabled:false,schema_ok:true});
        decisionCalls++;return ok(canonical('approve','BK-NOT-READY'));
      }
      providerCalls++;return ok({});
    }),
    err=>err&&err.code==='LINE_DELIVERY_OUTBOX_NOT_READY'
  );
  assert.equal(decisionCalls,0);
  assert.equal(providerCalls,0);
});
