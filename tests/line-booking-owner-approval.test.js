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


test('foreign customer without phone stays pending via verified LINE contact; owner card is truthful',async()=>{
 const calls=[];
 const fetchImpl=async(_url,opt)=>{
   calls.push(JSON.parse(opt.body));
   return response({ok:true,booking_id:'BK-FOREIGN-001',row_number:26,booking_status:'pending'});
 };
 const result=await Approval.createPendingBooking(
   {webhookEventId:'evt-international-03',source:{userId:'UFOREIGNCUSTOMER001'}},
   {nickname:'Alex',phone:''},
   {event_id:'EVT-1',template_id:'TPL-1',package_id:'PKG-1'},
   env(),fetchImpl
 );
 assert.equal(result.booking_id,'BK-FOREIGN-001');
 assert.equal(calls.length,1);
 assert.equal(calls[0].customer_contact,'UFOREIGNCUSTOMER001');
 assert.equal(calls[0].customer_phone,'');
 assert.equal(calls[0].booking_status,'pending');
 assert.equal(calls[0].payment_status,'unpaid');
 const ownerCard=Approval.ownerApprovalMessage({
   booking_id:'BK-FOREIGN-001',event_name:'Concert',phone:'',nickname:'Alex'
 },env());
 assert.match(JSON.stringify(ownerCard),/ติดต่อทาง LINE · ไม่ระบุเบอร์โทรศัพท์/);
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


// 20261111 full-path: source-level E2E through the actual webhook and owner
// handlers. Synthetic data + injected fetch only: zero LIVE provider/Sheet writes.
async function syntheticBookingFullPath(decision) {
  const Webhook=require('../server/line-booking-webhook');
  const e=env();
  const bookingId=decision==='approve'?'BK-SYNTHETIC-APPROVE':'BK-SYNTHETIC-REJECT';
  const eventId='EVT-SYNTHETIC-20261117';
  const eventName='Synthetic Fan Event';
  const venue='Synthetic Hall';
  const ready=[
    'event_id,event_name,event_date_text,venue,poster_image_url,action_for_web,booking_status_for_web,available_phone_count',
    eventId+','+eventName+',17/11/2026,'+venue+',,show,เปิดจอง,1'
  ].join('\n');
  const packages=[
    'package_id,event_id,package_type,model_display,lens_display,price,available_count,package_status',
    eventId+'-TPL-BUNDLE,'+eventId+',phone_lens_bundle,Vivo X300 Pro,Lens Vivo,690,1,available'
  ].join('\n');
  const calls=[];
  let state='';
  const fakeFetch=async(url,opts={})=>{
    const u=String(url);
    if(u.includes('08_Web_Ready')) { calls.push({kind:'web-ready'}); return response(ready); }
    if(u.includes('09_Web_Packages')) { calls.push({kind:'web-packages'}); return response(packages); }
    if(u.startsWith('https://script.google.com/')){
      const body=JSON.parse(opts.body);
      if(body.action==='createLineBookingPending'){
        calls.push({kind:'create',body});
        assert.equal(state,'','test must allocate only one canonical row');
        assert.equal(body.request_id.startsWith('line:'),true);
        assert.equal(body.event_id,eventId);
        assert.equal(body.template_id,'TPL-BUNDLE');
        assert.equal(body.booking_status,'pending');
        assert.equal(body.payment_status,'unpaid');
        assert.equal(body.amount_received,0);
        assert.equal(body.customer_contact,'UCUSTOMER');
        assert.equal(body.phone_asset_id,undefined);
        state='pending';
        return response({ok:true,data:{booking_id:bookingId,row_number:50,booking_status:'pending'}});
      }
      if(body.action==='decideLineBookingPending'){
        calls.push({kind:'decide',body});
        assert.equal(state,'pending','only pending may transition');
        assert.equal(body.booking_id,bookingId,'same canonical booking ID');
        assert.equal(body.decision,decision);
        state=decision==='approve'?'confirmed':'cancelled';
        return response({ok:true,data:{
          booking_id:bookingId,booking_status:state,decision,
          idempotent_replay:false,customer_contact:'UCUSTOMER'
        }});
      }
      throw new Error('synthetic writer: unexpected action');
    }
    if(u.endsWith('/push')){
      const body=JSON.parse(opts.body);
      calls.push({kind:body.to==='UOWNER'?'owner-card':'customer-decision',body});
      assert.equal(body.messages.length,1);
      return response({ok:true});
    }
    if(u.endsWith('/reply')){
      calls.push({kind:'reply',body:JSON.parse(opts.body)});
      return response({ok:true});
    }
    throw new Error('synthetic fetch: unexpected URL');
  };
  const inbound={
    type:'message',webhookEventId:'SYNTHETIC-EVENT-20261111-'+decision,
    replyToken:'SYNTHETIC-CUSTOMER-REPLY',source:{type:'user',userId:'UCUSTOMER'},
    message:{type:'text',text:[
      '🎫 งาน: '+eventName,
      '📅 วันที่: 17/11/2026',
      '📍 สถานที่: '+venue,
      '📱 รุ่น/แพ็กเกจ: Vivo X300 Pro + Lens',
      '💰 ราคา: 590 บาท',
      '👤 ชื่อเล่น: Synthetic Customer'
    ].join('\n')}
  };
  const inboundResult=await Webhook._test.processEvent(inbound,e,fakeFetch);
  assert.equal(inboundResult.handled,true);
  assert.equal(inboundResult.booking_id,bookingId);
  assert.equal(inboundResult.automation_status,'PENDING_OWNER_APPROVAL');
  assert.equal(state,'pending');
  assert.equal(calls.filter(x=>x.kind==='create').length,1);
  const ownerCard=calls.find(x=>x.kind==='owner-card');
  assert.ok(ownerCard,'owner must receive card on actual pending');
  assert.equal(ownerCard.body.to,'UOWNER');
  const message=ownerCard.body.messages[0];
  assert.equal(message.type,'flex');
  const buttons=message.contents.footer.contents;
  assert.equal(buttons.length,2);
  for(const [button,wanted] of [[buttons[0],'approve'],[buttons[1],'reject']]){
    assert.deepEqual(Approval.parseDecisionData(button.action.data,e),{
      decision:wanted,booking_id:bookingId
    },'each button binds signed action to canonical booking');
  }
  const replies=calls.filter(x=>x.kind==='reply');
  assert.equal(replies.length,1);
  assert.equal(replies[0].body.messages[0].type,'flex');
  assert.match(JSON.stringify(replies[0].body.messages[0]),/690 บาท/);
  assert.doesNotMatch(JSON.stringify(replies[0].body.messages[0]),/ราคา  590 บาท/);
  const result=await Approval.processOwnerPostback({
    type:'postback',replyToken:'SYNTHETIC-OWNER-REPLY',
    source:{type:'user',userId:'UOWNER'},
    postback:{data:buttons[decision==='approve'?0:1].action.data}
  },e,fakeFetch);
  assert.equal(result.handled,true);
  assert.equal(result.status,state.toUpperCase());
  const customerPush=calls.find(x=>x.kind==='customer-decision');
  assert.ok(customerPush);
  assert.equal(customerPush.body.to,'UCUSTOMER');
  assert.match(customerPush.body.messages[0].text,new RegExp(bookingId));
  assert.equal(calls.filter(x=>x.kind==='decide').length,1);
  assert.equal(calls.filter(x=>x.kind==='reply').length,2);
  const seq=calls.map(x=>x.kind);
  assert.ok(seq.indexOf('create')<seq.indexOf('owner-card'));
  assert.ok(seq.indexOf('owner-card')<seq.indexOf('reply'));
  assert.ok(seq.indexOf('decide')<seq.indexOf('customer-decision'));
  assert.ok(seq.indexOf('customer-decision')<seq.lastIndexOf('reply'));
}
test('synthetic full-path inbound -> Pending -> owner Confirm -> customer notification',async()=>{
  await syntheticBookingFullPath('approve');
});
test('synthetic full-path inbound -> Pending -> owner Reject -> customer notification',async()=>{
  await syntheticBookingFullPath('reject');
});
