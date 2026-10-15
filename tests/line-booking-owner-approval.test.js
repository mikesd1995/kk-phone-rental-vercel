'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Approval=require('../server/line-booking-owner-approval');

function env(){
  return {
    KK_LINE_BOOKING_AUTOMATION_ENABLED:'true',
    KK_ADMIN_SCRIPT_URL:'https://script.google.com/macros/s/DEPLOYMENT/exec',
    KK_ADMIN_API_KEY:'admin-api-key',
    LINE_CHANNEL_ACCESS_TOKEN:'line-token',
    LINE_CHANNEL_SECRET:'line-secret',
    KK_OWNER_LINE_USER_ID:'UOWNER',
    KK_OWNER_LINE_TARGET_ID:'UOWNER'
  };
}
function response(body,status=200){
  return {ok:status>=200&&status<300,status,text:async()=>typeof body==='string'?body:JSON.stringify(body)};
}

test('automation stays fail-closed until all production bindings are present',()=>{
  const r=Approval.automationReadiness({});
  assert.equal(r.ready,false);
  assert.ok(r.reasons.includes('AUTOMATION_DISABLED'));
  assert.ok(r.reasons.includes('OWNER_USER_ID_MISSING'));
});

test('signed approval payload rejects tampering',()=>{
  const e=env();
  const data=Approval.decisionData('approve','BK-1',e);
  assert.deepEqual(Approval.parseDecisionData(data,e),{decision:'approve',booking_id:'BK-1'});
  assert.equal(Approval.parseDecisionData(data.replace('BK-1','BK-2'),e),null);
});

test('pending intake writes only the governed pending action and requires booking_id readback',async()=>{
  const calls=[];
  const fetchImpl=async(url,opt)=>{
    calls.push({url,opt,body:JSON.parse(opt.body)});
    return response({ok:true,booking_id:'BK-20261003-001',row_number:25,booking_status:'pending'});
  };
  const result=await Approval.createPendingBooking(
    {webhookEventId:'evt-1',source:{userId:'UCUSTOMER'}},
    {nickname:'Mint',phone:'0812345678',pickup_time:'16:00'},
    {event_id:'EVT-1',template_id:'TPL-1',package_id:'PKG-1'},
    env(),fetchImpl
  );
  assert.equal(result.booking_id,'BK-20261003-001');
  assert.equal(calls.length,1);
  assert.equal(calls[0].body.action,'createLineBookingPending');
  assert.match(calls[0].body.request_id,/^line:[a-f0-9]{48}$/);
  assert.equal(calls[0].body.booking_status,'pending');
  assert.equal(calls[0].body.payment_status,'unpaid');
  assert.equal(calls[0].body.phone_asset_id,undefined);
  assert.equal(calls[0].body.lens_asset_id,undefined);
});


test('missing customer LINE identity fails before any booking write',async()=>{
  let calls=0;
  await assert.rejects(
    ()=>Approval.createPendingBooking(
      {webhookEventId:'evt-no-user',source:{type:'group'}},
      {nickname:'Mint',phone:'0812345678'},
      {event_id:'EVT-1',template_id:'TPL-1'},
      env(),
      async()=>{calls++;throw new Error('network must not run');}
    ),
    err=>err&&err.code==='LINE_CUSTOMER_USER_ID_REQUIRED'
  );
  assert.equal(calls,0);
});

test('owner approval requires exact owner identity and performs atomic decision before customer send',async()=>{
  const e=env();
  const data=Approval.decisionData('approve','BK-1',e);
  let calls=[];
  const fetchImpl=async(url,opt)=>{
    const body=JSON.parse(opt.body);
    calls.push({url,body});
    if(url.startsWith('https://script.google.com/')){
      assert.equal(body.action,'decideLineBookingPending');
      assert.equal(body.booking_id,'BK-1');
      assert.equal(body.decision,'approve');
      return response({ok:true,booking_id:'BK-1',booking_status:'confirmed',customer_contact:'UCUSTOMER',idempotent_replay:false});
    }
    return response({ok:true});
  };
  const r=await Approval.processOwnerPostback({
    type:'postback',replyToken:'reply-owner',source:{type:'user',userId:'UOWNER'},postback:{data}
  },e,fetchImpl);
  assert.equal(r.handled,true);
  assert.equal(r.status,'CONFIRMED');
  assert.equal(calls.filter(x=>x.url.startsWith('https://script.google.com/')).length,1);
  assert.equal(calls.filter(x=>x.url.includes('/reply')).length,1);
  const customerPush=calls.find(x=>x.url.includes('/push')&&x.body.to==='UCUSTOMER');
  assert.ok(customerPush);
  assert.match(customerPush.body.messages[0].text,/ยืนยันการจองแล้ว/);
});


test('owner decision fails closed if canonical customer contact is missing',async()=>{
  const e=env();
  const data=Approval.decisionData('approve','BK-NO-CONTACT',e);
  let lineSends=0;
  await assert.rejects(
    ()=>Approval.processOwnerPostback({
      type:'postback',source:{type:'user',userId:'UOWNER'},postback:{data}
    },e,async(url,opt)=>{
      if(String(url).startsWith('https://script.google.com/')){
        return response({ok:true,booking_id:'BK-NO-CONTACT',booking_status:'confirmed',idempotent_replay:false});
      }
      lineSends++;
      return response({ok:true});
    }),
    err=>err&&err.code==='LINE_CUSTOMER_CONTACT_READBACK_REQUIRED'
  );
  assert.equal(lineSends,0);
});

test('non-owner postback cannot mutate booking state',async()=>{
  const e=env();
  const data=Approval.decisionData('reject','BK-2',e);
  let calls=0;
  const r=await Approval.processOwnerPostback({
    type:'postback',source:{type:'user',userId:'UATTACKER'},postback:{data}
  },e,async()=>{calls++;throw new Error('must not call network');});
  assert.equal(r.handled,true);
  assert.equal(r.status,'UNAUTHORIZED_OWNER');
  assert.equal(calls,0);
});

test('Apps Script owner decision is a separate atomic pending-only action',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','apps-script','Code.gs'),'utf8');
  assert.match(source,/case 'decideLineBookingPending': result = kkApiDecideLineBookingPending_\(payload\); break;/);
  const start=source.indexOf('function kkApiDecideLineBookingPending_');
  const end=source.indexOf('\nfunction kkApiCreateBooking_',start);
  assert.ok(start>=0&&end>start);
  const body=source.slice(start,end);
  assert.match(body,/kkAcquireDocumentLock_\('LINE owner booking decision', 12000\)/);
  assert.match(body,/currentStatus !== 'pending'/);
  assert.match(body,/targetStatus = decision === 'approve' \? 'confirmed' : 'cancelled'/);
  assert.match(body,/idempotent_replay: true/);
  assert.match(body,/SpreadsheetApp\.flush\(\)/);
  assert.match(body,/Owner decision readback failed/);
  assert.match(body,/LINE customer contact readback failed/);
  assert.match(body,/customer_contact: customerContact/);
  assert.match(body,/customerContact = String\(current\[5\]/);
  assert.match(body,/String\(persisted\[5\]/);
});
