'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Native=require('../server/line-booking-native-consent');
const OWNER='U'+'a'.repeat(32),CUSTOMER='U'+'b'.repeat(32),STRANGER='U'+'c'.repeat(32);
const BID='BK-SYNTHETIC-2026-001';
const RID='line:'+'d'.repeat(48);
const NOW=Date.now();
function env(){
  return {
    KK_LINE_BOOKING_AUTOMATION_ENABLED:'true',
    KK_LINE_NATIVE_CONSENT_V1_ENABLED:'true',
    KK_LINE_INITIAL_OUTBOX_V1_ENABLED:'true',KK_LINE_OWNER_OUTBOX_V1_ENABLED:'true',
    KK_ADMIN_API_KEY:'test-admin-not-for-provider',
    KK_ADMIN_SCRIPT_URL:'https://script.google.com/macros/s/TEST_ONLY/exec',
    KK_OWNER_LINE_USER_ID:OWNER,LINE_CHANNEL_SECRET:'test-messaging-api-signature-key',
    LINE_CHANNEL_ACCESS_TOKEN:'test-provider-access-token',
    KK_LINE_NATIVE_CONSENT_DISPATCH_SECRET:'isolated_synthetic_native_consent_secret_2026',
    KK_LINE_INITIAL_OUTBOX_DISPATCH_SECRET:'isolated_synthetic_initial_outbox_secret',
    KK_LINE_OWNER_OUTBOX_DISPATCH_SECRET:'isolated_synthetic_owner_outbox_secret'
  };
}
function event(data,userId=CUSTOMER){
  return {type:'postback',replyToken:'SYNTHETIC_REPLY',
    source:{type:'user',userId},postback:{data}};
}
function issue(e=env()){
  return Native.issue({bookingId:BID,requestId:RID,userId:CUSTOMER,timestamp:NOW},e,NOW);
}
test('native consent is default-OFF and needs separate durable owner/initial dispatcher gates',()=>{
  assert.equal(Native.enabled({}),false);
  assert.equal(Native.ready({}),false);
  assert.throws(()=>Native.issue({bookingId:BID,requestId:RID,userId:CUSTOMER,timestamp:NOW},{}),
    {code:'LINE_NATIVE_CONSENT_NOT_READY'});
  for(const key of ['KK_LINE_INITIAL_OUTBOX_V1_ENABLED','KK_LINE_OWNER_OUTBOX_V1_ENABLED',
                    'KK_LINE_NATIVE_CONSENT_DISPATCH_SECRET']){
    const e={...env(),[key]:''};
    assert.equal(Native.ready(e),false,key);
  }
  for(const other of ['KK_ADMIN_API_KEY','KK_LINE_INITIAL_OUTBOX_DISPATCH_SECRET',
                      'KK_LINE_OWNER_OUTBOX_DISPATCH_SECRET','LINE_CHANNEL_SECRET']){
    assert.equal(Native.ready({...env(),KK_LINE_NATIVE_CONSENT_DISPATCH_SECRET:env()[other]}),false);
  }
});
test('signed consent token is per-booking, per-request, per-LINE user and time-bound',()=>{
  const e=env(),t=issue(e),userEvent=event(t);
  const parsed=Native.parse(t,userEvent,e,NOW);
  assert.equal(parsed.booking_id,BID);
  assert.equal(parsed.request_id,RID);
  assert.equal(parsed.user_id,CUSTOMER);
  assert.match(t,/^kkc1\|BK-SYNTHETIC-2026-001\|line:[a-f0-9]{48}\|[0-9]{13}\|[A-Za-z0-9_-]{32}$/);
  assert.equal(Native.parse(t,event(t,STRANGER),e,NOW),null);
  assert.equal(Native.parse(t,{...userEvent,source:{type:'group',userId:CUSTOMER}},e,NOW),null);
  assert.equal(Native.parse(t,event(t.replace(BID,BID+'x')),e,NOW),null);
  assert.equal(Native.parse(t,event(t.replace(RID,'line:'+'e'.repeat(48))),e,NOW),null);
  assert.equal(Native.parse(t,userEvent,{...e,LINE_CHANNEL_SECRET:'rotated-secret'},NOW),null);
  assert.equal(Native.parse(t,userEvent,e,NOW+7*86400000+1),null);
  assert.throws(()=>Native.issue({bookingId:BID,requestId:RID,userId:CUSTOMER,
    timestamp:NOW-7*86400000-1},e,NOW),{code:'LINE_NATIVE_CONSENT_TIME_INVALID'});
});
test('accepted native postback writes one exact authenticated canonical receipt, reply only after readback',async()=>{
  const e=env(),data=issue(),calls=[],replies=[];
  const accepted=await Native.processPostback(event(data),e,async()=>{throw Error('unexpected fetch');},{
    signatureVerified:true,
    appsScriptCall:async payload=>{calls.push(payload);return {data:{
      booking_id:BID,request_id:RID,terms_version:'KK-TERMS-2026-11-06',
      booking_status:'pending',terms_confirmed:true,idempotent_replay:false
    }};},
    reply:async(token,message)=>replies.push({token,message})
  });
  assert.equal(accepted.status,'ACCEPTED');
  assert.equal(calls.length,1);
  assert.deepEqual(Object.keys(calls[0]).sort(),[
    'action','booking_id','native_consent_dispatch_key','request_id',
    'source_user_id','terms_version'
  ]);
  assert.equal(calls[0].action,Native.CONSENT_ACTION);
  assert.equal(calls[0].source_user_id,CUSTOMER);
  assert.equal(replies.length,1);
  assert.match(replies[0].message.text,/บันทึกการยอมรับเงื่อนไข/);
});
test('invalid, unsigned and foreign LINE postbacks never touch canonical data or send LINE',async()=>{
  const e=env(),t=issue();let calls=0,replies=0;
  const deps={appsScriptCall:async()=>{calls++;throw Error('not allowed');},
    reply:async()=>{replies++;throw Error('not allowed');}};
  for(const [value,ev,verified] of [
    [t,event(t,STRANGER),true],
    [t,event(t),false],
    [t.replace('kkc1','kkc2'),event(t.replace('kkc1','kkc2')),true],
    [t,{...event(t),source:{type:'group',userId:CUSTOMER}},true]
  ]){
    const out=await Native.processPostback(ev,e,async()=>{},{
      ...deps,signatureVerified:verified});
    assert.notEqual(out.status,'ACCEPTED');
  }
  assert.equal(calls,0);assert.equal(replies,0);
});
test('idempotent canonical replay never emits a duplicate customer confirmation',async()=>{
  const e=env(),data=issue();let sent=0;
  const r=await Native.processPostback(event(data),e,async()=>{},{
    signatureVerified:true,
    appsScriptCall:async()=>({ok:true,data:{booking_id:BID,request_id:RID,
      terms_version:'KK-TERMS-2026-11-06',booking_status:'pending',
      terms_confirmed:true,idempotent_replay:true}}),
    reply:async()=>{sent++;}
  });
  assert.equal(r.status,'ALREADY_ACCEPTED');assert.equal(sent,0);
});
test('canonical response mismatch fails closed before replying to the customer',async()=>{
  const e=env(),t=issue();let replies=0;
  await assert.rejects(()=>Native.processPostback(event(t),e,async()=>{},{
    signatureVerified:true,
    appsScriptCall:async()=>({data:{booking_id:'FOREIGN',request_id:RID,
      terms_version:'KK-TERMS-2026-11-06',booking_status:'pending',
      terms_confirmed:true,idempotent_replay:false}}),
    reply:async()=>{replies++;}
  }),{code:'LINE_NATIVE_CONSENT_READBACK_FAILED'});
  assert.equal(replies,0);
});
test('canonical GAS accepts same LINE customer only under document lock and blocks premature Confirm',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','apps-script','Code.gs'),'utf8');
  assert.match(source,/case 'acceptLineBookingTerms': result = kkApiAcceptLineBookingTerms_\(payload\); break;/);
  const begin=source.indexOf('function kkApiAcceptLineBookingTerms_');
  const end=source.indexOf('function kkApiDecideLineBookingPending_',begin);
  assert.ok(begin>0&&end>begin);
  const body=source.slice(begin,end);
  assert.match(body,/kkLineNativeConsentRequireDispatch_\(payload\)/);
  assert.match(body,/kkAcquireDocumentLock_\('LINE native consent receipt',12000\)/);
  assert.match(body,/String\(current\[5\]\|\|''\)\.trim\(\)!==userId/);
  assert.match(body,/kkBookingRequestIdFromNote_\(note\)!==requestId/);
  assert.match(body,/kkLineNativeConsentAccepted_\(after\[19\]\)/);
  assert.match(source,/kkLineNativeConsentApprovalReady_\(canonical\.current\[19\],decision\)/);
  assert.match(source,/kkLineNativeConsentApprovalReady_\(current\[19\],decision\)/);
  assert.match(source,/terms_confirmation_required:true,idempotent_replay:true/);
  assert.doesNotMatch(body,/createSheet\(|insertSheet\(|createBooking\(/);
});
