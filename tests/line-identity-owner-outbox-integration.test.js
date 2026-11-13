'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Approval=require('../server/line-booking-owner-approval');
const Terms=require('../server/kk-booking-terms-evidence');

const OWNER='U'+'a'.repeat(32);
const env={
  KK_LINE_BOOKING_AUTOMATION_ENABLED:'true',
  KK_LINE_OWNER_OUTBOX_V1_ENABLED:'true',
  KK_LINE_OWNER_OUTBOX_DISPATCH_SECRET:'synthetic-private-dispatch-credential-20261112',
  KK_ADMIN_SCRIPT_URL:'https://script.google.com/macros/s/SYNTHETIC/exec',
  KK_ADMIN_API_KEY:'synthetic-admin-key',
  KK_OWNER_LINE_USER_ID:OWNER,
  LINE_CHANNEL_ACCESS_TOKEN:'synthetic-token',
  LINE_CHANNEL_SECRET:'synthetic-secret'
};
function bubble(termsStatus){
  return Approval.ownerApprovalMessage({
    booking_id:'BK-20261113-SYNTH-1',event_name:'Synthetic Event',
    event_date:'2026-11-13',package_name:'Phone + Lens',
    price_display:'890',nickname:'Synthetic Customer',
    terms_version:Terms.VERSION,terms_status:termsStatus
  },env);
}
test('identity-verified Terms badge and owner durable outbox can coexist in one runtime',()=>{
  const b=bubble('VERIFIED_LINE_IDENTITY_TERMS_ACCEPTED');
  assert.equal(b.type,'flex');
  assert.match(JSON.stringify(b),/ยอมรับเงื่อนไขแล้ว/);
  assert.doesNotMatch(JSON.stringify(b),/ยังไม่พบข้อความยอมรับเงื่อนไข/);
  assert.equal(b.contents.footer.contents.length,2);
  const [approve,reject]=b.contents.footer.contents.map(x=>Approval.parseDecisionData(x.action.data,env));
  assert.equal(approve.decision,'approve');
  assert.equal(reject.decision,'reject');
  assert.equal(approve.booking_id,reject.booking_id);
  assert.equal(Approval.automationReadiness(env).ready,true);
  const source=fs.readFileSync(path.join(__dirname,'../server/line-booking-owner-approval.js'),'utf8');
  assert.match(source,/KK_LINE_OWNER_OUTBOX_V1_ENABLED/);
  assert.match(source,/lineOwnerOutboxReadiness/);
  assert.match(source,/DurableOutbox\.deliverDecision/);
  const webhook=fs.readFileSync(path.join(__dirname,'../server/line-booking-webhook.js'),'utf8');
  assert.match(webhook,/signatureVerified:true/);
  assert.match(webhook,/TERMS_EVIDENCE_REQUIRED/);
  assert.match(webhook,/ยังไม่ได้บันทึกคำขอจองค่ะ/);
  assert.match(webhook,/terms_status:termsStatus/);
});
test('missing Terms evidence cannot be marked accepted by mere legacy LINE copy',()=>{
  const b=bubble('NOT_CONFIRMED');
  assert.match(JSON.stringify(b),/ยังไม่พบข้อความยอมรับเงื่อนไข/);
  assert.doesNotMatch(JSON.stringify(b),/ยืนยัน LINE User ID จากหลักฐานหลังบ้าน/);
});

// Completes donor #870's mocked full-path coverage on the integrated consent +
// durable-outbox runtime. Every external boundary is synthetic and rejects
// unrecognized URLs; the real signed webhook/owner handlers execute unchanged.
async function signedBookingFullPath(decision){
  const crypto=require('node:crypto');
  const Webhook=require('../server/line-booking-webhook');
  const customer='U'+'c'.repeat(32), provider='synthetic-fullpath-provider';
  const eventId='EVT-SYNTHETIC-FULLPATH', bookingId='BK-SYNTHETIC-'+decision;
  const outboxId='LINE_OWNER_V1_'+'b'.repeat(48);
  const e={...env,KK_OWNER_LINE_TARGET_ID:'',KK_INBOX_SUPABASE_URL:'',
    KK_INBOX_SUPABASE_SERVICE_ROLE_KEY:'',KK_CUSTOMER_LOGIN_ENABLED:'true',
    KK_LINE_LOGIN_PROVIDER_VERIFIED:'true',KK_CUSTOMER_AUTH_MIGRATION_VERIFIED:'true',
    KK_LINE_LOGIN_PROVIDER_ID:provider,
    KK_CUSTOMER_AUTH_SUPABASE_URL:'https://example.supabase.co',
    KK_CUSTOMER_AUTH_SUPABASE_SERVICE_ROLE_KEY:'synthetic-fullpath-service-key'};
  const previous=Object.fromEntries(Object.keys(e).map(key=>[key,process.env[key]]));
  const previousFetch=global.fetch, calls=[];
  let bookingState='', outboxState='', retryKey='';
  const response=body=>({ok:true,status:200,
    text:async()=>typeof body==='string'?body:JSON.stringify(body),
    json:async()=>body,headers:{get:()=>''}});
  const proof=()=>({booking_id:bookingId,decision,booking_status:bookingState,
    outbox_id:outboxId,outbox_mode:'KK_LINE_OWNER_OUTBOX_V1',outbox_state:outboxState});
  async function signed(event,valid=true){
    const body=JSON.stringify({events:[event]});
    const signature=crypto.createHmac('sha256',e.LINE_CHANNEL_SECRET).update(body).digest('base64');
    const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},end(body){this.body=body;}};
    await Webhook({method:'POST',body,headers:{'x-line-signature':valid?signature:'invalid'}},res);
    return res;
  }
  try{
    Object.assign(process.env,e);
    global.fetch=async(url,options={})=>{
      const u=String(url), body=options.body?JSON.parse(options.body):null;
      if(u.includes('08_Web_Ready'))return response([
        'event_id,event_name,event_date_text,venue,poster_image_url,action_for_web,booking_status_for_web,available_phone_count',
        eventId+',Synthetic Fan Event,17/11/2026,Synthetic Hall,,show,เปิดจอง,1'].join('\n'));
      if(u.includes('09_Web_Packages'))return response([
        'package_id,event_id,package_type,model_display,lens_display,price,available_count,package_status',
        eventId+'-TPL-BUNDLE,'+eventId+',phone_lens_bundle,Vivo X300 Pro,Lens Vivo,690,1,available'].join('\n'));
      if(u==='https://example.supabase.co/rest/v1/rpc/kk_customer_terms_lookup_for_line_webhook'){
        assert.deepEqual(body,{p_provider_id:provider,p_line_user_id:customer,p_terms_version:Terms.VERSION});
        calls.push({kind:'consent'});
        return response([{provider_id:provider,line_user_id:customer,terms_version:Terms.VERSION,
          accepted_at:new Date().toISOString(),evidence_source:'AUTHENTICATED_WEB_ACTION',
          evidence_reference:'web:synthetic-fullpath-persisted-witness',evidence_verified:true}]);
      }
      if(u===e.KK_ADMIN_SCRIPT_URL){
        calls.push({kind:body.action,body});
        if(body.action==='createLineBookingPending'){
          assert.equal(bookingState,'');
          assert.equal(body.event_id,eventId);
          assert.equal(body.template_id,'TPL-BUNDLE');
          assert.equal(body.customer_contact,customer);
          assert.equal(body.booking_status,'pending');
          assert.equal(body.amount_received,0);
          assert.equal(body.phone_asset_id,undefined);
          assert.equal(body.lens_asset_id,undefined);
          assert.match(body.booking_note,/TERMS_ACK_BACKEND:KK-TERMS-2026-11-06/);
          bookingState='pending';
          return response({ok:true,data:{booking_id:bookingId,row_number:50,
            booking_status:'pending',idempotent_replay:false}});
        }
        if(body.action==='lineOwnerOutboxReadiness')return response({ok:true,data:{ready:true,outbox_mode:'KK_LINE_OWNER_OUTBOX_V1',columns:11}});
        if(body.action==='decideLineBookingPending'){
          assert.equal(body.booking_id,bookingId);
          assert.equal(body.decision,decision);
          const replay=bookingState!=='pending';
          if(!replay){bookingState=decision==='approve'?'confirmed':'cancelled';outboxState='READY';}
          return response({ok:true,data:{...proof(),idempotent_replay:replay}});
        }
        if(body.action==='claimLineBookingDecisionDelivery'){
          assert.equal(outboxState,'READY');
          retryKey=body.retry_key;outboxState='CLAIMED';
          return response({ok:true,data:{...proof(),claimed:true,retry_key:retryKey,customer_contact:customer}});
        }
        if(body.action==='settleLineBookingDecisionDelivery'){
          assert.equal(outboxState,'CLAIMED');
          assert.equal(body.retry_key,retryKey);
          assert.equal(body.delivery_state,'SENT');
          assert.equal(body.provider_message_id,'synthetic-provider-message');
          outboxState='SENT';
          return response({ok:true,data:{...proof(),provider_message_id:body.provider_message_id}});
        }
      }
      if(u==='https://api.line.me/v2/bot/message/push'){
        const owner=body.to===OWNER;
        calls.push({kind:owner?'owner-card':'customer-decision',body});
        assert.equal(body.to,owner?OWNER:customer);
        if(!owner)assert.equal(options.headers['X-Line-Retry-Key'],retryKey);
        return response({sentMessages:[{id:'synthetic-provider-message'}]});
      }
      if(u==='https://api.line.me/v2/bot/message/reply'){
        calls.push({kind:'reply',body});return response({});
      }
      throw Error('Unexpected synthetic full-path external boundary');
    };
    const inbound={type:'message',webhookEventId:'SYNTHETIC-FULLPATH-'+decision,
      replyToken:'synthetic-customer-reply',source:{type:'user',userId:customer},
      message:{type:'text',text:['Event: Synthetic Fan Event','Date: 17/11/2026',
        'Venue: Synthetic Hall','Model: Vivo X300 Pro + Lens',
        'Price: 590 THB','Nickname: Synthetic Customer'].join('\n')}};
    assert.equal((await signed(inbound,false)).statusCode,401);
    assert.equal(calls.length,0,'invalid signature cannot look up consent or create Pending');
    assert.equal((await signed(inbound)).statusCode,200);
    const ownerCard=calls.find(x=>x.kind==='owner-card').body.messages[0];
    assert.equal(ownerCard.type,'flex');
    assert.match(JSON.stringify(ownerCard),/LINE User ID/);
    const buttons=ownerCard.contents.footer.contents;
    assert.deepEqual(buttons.map(x=>Approval.parseDecisionData(x.action.data,e)),[
      {decision:'approve',booking_id:bookingId},{decision:'reject',booking_id:bookingId}]);
    const customerReply=calls.find(x=>x.kind==='reply').body.messages[0];
    assert.equal(customerReply.type,'flex');
    assert.match(JSON.stringify(customerReply),/690/);
    assert.doesNotMatch(JSON.stringify(customerReply),/590|KK-TERMS-2026-11-06|privacy\//);
    const ownerEvent={type:'postback',replyToken:'synthetic-owner-reply',
      source:{type:'user',userId:OWNER},postback:{data:buttons[decision==='approve'?0:1].action.data}};
    const beforeUnauthorized=calls.length;
    assert.equal((await signed({...ownerEvent,source:{type:'user',userId:'U'+'d'.repeat(32)}})).statusCode,200);
    assert.equal(calls.length,beforeUnauthorized,'a signed non-owner cannot decide or send');
    assert.equal((await signed(ownerEvent)).statusCode,200);
    assert.equal(bookingState,decision==='approve'?'confirmed':'cancelled');
    assert.equal(outboxState,'SENT');
    assert.equal((await signed(ownerEvent)).statusCode,200);
    for(const kind of ['createLineBookingPending','claimLineBookingDecisionDelivery','settleLineBookingDecisionDelivery','owner-card','customer-decision']){
      assert.equal(calls.filter(x=>x.kind===kind).length,1,kind+' occurs once across owner retry');
    }
    assert.equal(calls.filter(x=>x.kind==='reply').length,2,'one customer receipt and one owner ACK');
    const order=calls.map(x=>x.kind);
    assert.ok(order.indexOf('consent')<order.indexOf('createLineBookingPending'));
    assert.ok(order.indexOf('claimLineBookingDecisionDelivery')<order.indexOf('customer-decision'));
    assert.ok(order.indexOf('customer-decision')<order.indexOf('settleLineBookingDecisionDelivery'));
    assert.ok(order.indexOf('settleLineBookingDecisionDelivery')<order.lastIndexOf('reply'));
  }finally{
    global.fetch=previousFetch;
    for(const [key,value] of Object.entries(previous)){
      if(value===undefined)delete process.env[key];else process.env[key]=value;
    }
  }
}
for(const decision of ['approve','reject'])test('signed full-path consent -> Pending -> owner '+decision+' -> durable receipt and duplicate decision safety',async()=>{
  await signedBookingFullPath(decision);
});
