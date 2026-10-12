'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Approval=require('../server/line-booking-owner-approval');
const fs=require('node:fs');
const path=require('node:path');
const VERSION='b'.repeat(64);
const NOW=Date.UTC(2026,9,12,14,0,0);
function env(){return {
 KK_LINE_BOOKING_AUTOMATION_ENABLED:'true',
 KK_LINE_OWNER_APPROVAL_V2_ENABLED:'true',
 KK_LINE_OWNER_APPROVAL_V2_SOURCE_READY:'true',
 KK_ADMIN_SCRIPT_URL:'https://script.google.com/macros/s/DEPLOYMENT/exec',
 KK_ADMIN_API_KEY:'admin-api-key',LINE_CHANNEL_ACCESS_TOKEN:'line-token',
 LINE_CHANNEL_SECRET:'line-secret',KK_OWNER_LINE_USER_ID:'UOWNER',KK_OWNER_LINE_TARGET_ID:'UOWNER'
};}
function response(data){return {ok:true,status:200,text:async()=>JSON.stringify({ok:true,...data})};}
test('v2 cannot be enabled without confirmed Apps Script source binding',()=>{
 const e=env();delete e.KK_LINE_OWNER_APPROVAL_V2_SOURCE_READY;
 const result=Approval.automationReadiness(e);
 assert.equal(result.ready,false);
 assert.ok(result.reasons.includes('OWNER_V2_CANONICAL_APPS_SCRIPT_UNVERIFIED'));
});
test('v2 HMAC token is bound to booking+revision+decision+expiry and v1 is rejected',()=>{
 const e=env();
 const approve=Approval.decisionData('approve','BK-V2',e,VERSION,NOW);
 assert.match(approve,/^kkb2\|approve\|BK-V2\|[a-f0-9]{64}\|[0-9]{10}\|[A-Za-z0-9_-]{24}$/);
 assert.deepEqual(Approval.parseDecisionData(approve,e,NOW),{
  decision:'approve',booking_id:'BK-V2',approval_version:VERSION,
  expires_at:Math.floor(NOW/1000)+86400,protocol:'kkb2'
 });
 assert.equal(Approval.parseDecisionData(approve.replace('approve','reject'),e,NOW),null);
 assert.equal(Approval.parseDecisionData(approve.replace('BK-V2','BK-EVIL'),e,NOW),null);
 assert.equal(Approval.parseDecisionData(approve.replace(VERSION,'a'.repeat(64)),e,NOW),null);
 assert.equal(Approval.parseDecisionData(approve,e,NOW+86400*1000),null);
 assert.equal(Approval.parseDecisionData(approve,e,NOW-1000),null,'future challenge longer than 24h is rejected');
 const legacy=Approval.decisionData('approve','BK-V2',{...e,KK_LINE_OWNER_APPROVAL_V2_ENABLED:'false'});
 assert.equal(Approval.parseDecisionData(legacy,e,NOW),null);
});
test('owner flex buttons carry the verified version but never display it in body copy',()=>{
 const m=Approval.ownerApprovalMessage({booking_id:'BK-V2',approval_version:VERSION,
   event_name:'Test Event',event_date:'2026-11-14',price_display:'690'},env());
 const actions=m.contents.footer.contents.map(c=>c.action.data);
 assert.ok(actions.every(x=>x.startsWith('kkb2|')));
 assert.ok(actions.every(x=>x.includes(VERSION)));
 assert.ok(!JSON.stringify(m.contents.body).includes(VERSION));
});
test('v2 refuses intake missing source-backed A:T version even after upstream success',async()=>{
 let called=0;
 await assert.rejects(()=>Approval.createPendingBooking(
  {webhookEventId:'e-1',source:{userId:'UCUSTOMER'}},
  {nickname:'Mint',phone:'0812345678'},
  {event_id:'EVT-1',template_id:'TPL-1',package_id:'PKG-1'},env(),
  async()=>{called++;return response({booking_id:'BK-V2',booking_status:'pending',row_number:10});}
 ),err=>err.code==='LINE_OWNER_APPROVAL_VERSION_REQUIRED');
 assert.equal(called,1);
});
test('v2 owner callback sends only after atomic matching version and canonical booking id',async()=>{
 const e=env(),data=Approval.decisionData('approve','BK-V2',e,VERSION);
 const calls=[];
 const r=await Approval.processOwnerPostback({type:'postback',replyToken:'rr',source:{userId:'UOWNER'},
 postback:{data}},e,async(url,opts)=>{
  calls.push(url);
  if(url.startsWith('https://script.google.com/')){
   const body=JSON.parse(opts.body);
   assert.equal(body.action,'decideLineBookingPendingV2');
   assert.equal(body.expected_version,VERSION);
   assert.equal(body.booking_id,'BK-V2');
   return response({booking_id:'BK-V2',booking_status:'confirmed',approved_version:VERSION,
    customer_contact:'UCUSTOMER',idempotent_replay:false});
  }
  return response({});
 });
 assert.equal(r.status,'CONFIRMED');
 assert.equal(calls.filter(x=>x.includes('api.line.me')).length,2);
});
test('v2 readback missing or mismatched canonical version sends zero LINE messages',async()=>{
 const e=env(),data=Approval.decisionData('approve','BK-V2',e,VERSION);
 for(const value of [undefined,'a'.repeat(64)]){
  let sends=0;
  await assert.rejects(()=>Approval.processOwnerPostback({type:'postback',source:{userId:'UOWNER'},
   postback:{data}},e,async url=>{
    if(url.startsWith('https://script.google.com/'))return response({
     booking_id:'BK-V2',booking_status:'confirmed',approved_version:value,customer_contact:'UCUSTOMER'
    });
    sends++;return response({});
   }),err=>err.code==='LINE_OWNER_DECISION_VERSION_READBACK_MISMATCH');
  assert.equal(sends,0);
 }
});
test('version-bound callback is denied for a different LINE user with zero upstream calls',async()=>{
 const e=env(),data=Approval.decisionData('approve','BK-V2',e,VERSION);
 let calls=0;
 const r=await Approval.processOwnerPostback({type:'postback',source:{userId:'UOTHER'},postback:{data}},e,
  async()=>{calls++;return response({});});
 assert.equal(r.status,'UNAUTHORIZED_OWNER');assert.equal(calls,0);
});
test('webhook passes source-backed version into owner Flex message',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../server/line-booking-webhook.js'),'utf8');
 assert.match(source,/approval_version:pending\.approval_version/);
});

test('v2 pending intake explicitly requests version source and forwards it from canonical readback',async()=>{
 const e=env();let count=0;
 const result=await Approval.createPendingBooking(
  {webhookEventId:'event-v2',source:{userId:'UCUSTOMER'}},
  {nickname:'Mint',phone:'0812345678'},
  {event_id:'EVT-1',template_id:'TPL-1',package_id:'PKG-1'},e,
  async (_url,opt)=>{
   count++;const payload=JSON.parse(opt.body);
   assert.equal(payload.action,'createLineBookingPending');
   assert.equal(payload.approval_mode,'v2');
   return response({booking_id:'BK-V2',row_number:20,booking_status:'pending',approval_version:VERSION});
  });
 assert.equal(result.approval_version,VERSION);
 assert.equal(count,1);
});
test('legacy v1 remains compatible: pending intake does not demand new price/version contract',async()=>{
 const e={...env(),KK_LINE_OWNER_APPROVAL_V2_ENABLED:'false'};
 let count=0;
 const result=await Approval.createPendingBooking(
  {webhookEventId:'event-v1',source:{userId:'UCUSTOMER'}},
  {nickname:'Mint',phone:'0812345678'},
  {event_id:'EVT-1',template_id:'TPL-1'},e,
  async (_url,opt)=>{
   count++;const payload=JSON.parse(opt.body);
   assert.equal(Object.prototype.hasOwnProperty.call(payload,'approval_mode'),false);
   return response({booking_id:'BK-V1',row_number:21,booking_status:'pending'});
  });
 assert.equal(result.booking_id,'BK-V1');
 assert.equal(result.approval_version,'');
 assert.equal(count,1);
});


test('v2 missing, null or stringified replay flag cannot send customer or owner LINE messages',async()=>{
 const e=env(),data=Approval.decisionData('approve','BK-V2',e,VERSION);
 for(const replay of [undefined,null,'false',0]){
  let lineSends=0,upstreamCalls=0;
  await assert.rejects(()=>Approval.processOwnerPostback({type:'postback',replyToken:'reply',source:{userId:'UOWNER'},postback:{data}},e,
   async(url)=>{
    if(url.startsWith('https://script.google.com/')){
     upstreamCalls++;
     return response({booking_id:'BK-V2',booking_status:'confirmed',approved_version:VERSION,
      customer_contact:'UCUSTOMER',idempotent_replay:replay});
    }
    lineSends++;return response({});
   }),err=>err.code==='LINE_OWNER_DECISION_REPLAY_READBACK_REQUIRED');
  assert.equal(upstreamCalls,1);
  assert.equal(lineSends,0);
 }
});
test('v2 canonical replay:true triggers no provider calls and needs manual delivery reconciliation',async()=>{
 const e=env(),data=Approval.decisionData('reject','BK-V2',e,VERSION);
 let lineSends=0;
 const result=await Approval.processOwnerPostback({type:'postback',replyToken:'owner-reply',source:{userId:'UOWNER'},postback:{data}},e,
  async url=>{
   if(url.startsWith('https://script.google.com/'))return response({booking_id:'BK-V2',booking_status:'cancelled',approved_version:VERSION,
    customer_contact:'UCUSTOMER',idempotent_replay:true});
   lineSends++;return response({});
  });
 assert.equal(result.status,'ALREADY_APPLIED');
 assert.equal(result.requires_manual_delivery_review,true);
 assert.equal(lineSends,0);
});
