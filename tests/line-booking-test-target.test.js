'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Target=require('../server/kk-line-booking-test-target');
const NOW=Date.parse('2026-11-17T06:15:00.000Z');
const OWNER='U'+'a'.repeat(32),CUSTOMER='U'+'b'.repeat(32);
function env(){return {KK_LINE_BOOKING_TEST_MODE:'true',KK_LINE_BOOKING_TEST_USER_IDS:OWNER+','+CUSTOMER,
 KK_OWNER_LINE_USER_ID:OWNER,
 KK_LINE_BOOKING_TEST_ORIGIN:'https://s2-booking.invalid',KK_LINE_BOOKING_TEST_SCOPE:'s2_dummy_run_0001',
 KK_LINE_BOOKING_TEST_WINDOW_START:'2026-11-17T06:00:00.000Z',KK_LINE_BOOKING_TEST_WINDOW_END:'2026-11-17T07:00:00.000Z',
 KK_LINE_BOOKING_TEST_EVENT_IDS:'EVT-S2-DUMMY',KK_LINE_APPROVAL_SECRET:'synthetic_s2_approval_key_0123456789',
 LINE_CHANNEL_SECRET:'synthetic_channel',KK_ADMIN_API_KEY:'synthetic_admin',
 KK_LINE_INITIAL_OUTBOX_DISPATCH_SECRET:'synthetic_initial_key_01234567890123',
 KK_LINE_OWNER_OUTBOX_DISPATCH_SECRET:'synthetic_decision_key_0123456789012'};}
const event=()=>({webhookEventId:'immutable_dummy_event',timestamp:NOW,source:{type:'user',userId:CUSTOMER}});
test('production target keeps fixed origin and forbids accidental test overrides outside test mode',()=>{
 assert.equal(Target.configuration({}).origin,'https://kk-phone-rental.vercel.app');
 assert.equal(Target.configuration({}).enabled,false);
 assert.throws(()=>Target.configuration({KK_LINE_BOOKING_TEST_ORIGIN:'https://s2-booking.invalid'}),{code:'LINE_BOOKING_TEST_TARGET_INVALID'});
});
test('test target requires exact safe origin, bounded window, scope, event allowlist and distinct explicit signing key',()=>{
 const valid=env(),cfg=Target.configuration(valid);assert.equal(cfg.enabled,true);
 for(const key of ['KK_LINE_BOOKING_TEST_ORIGIN','KK_LINE_BOOKING_TEST_SCOPE','KK_LINE_BOOKING_TEST_WINDOW_START',
  'KK_LINE_BOOKING_TEST_WINDOW_END','KK_LINE_BOOKING_TEST_EVENT_IDS','KK_LINE_APPROVAL_SECRET']){
  const value={...valid};delete value[key];assert.throws(()=>Target.configuration(value),{code:'LINE_BOOKING_TEST_TARGET_INVALID'});
 }
 for(const origin of ['http://s2-booking.invalid','https://kk-phone-rental.vercel.app','https://s2-booking.invalid/path',
  'https://s2-booking.invalid/?q=1','https://user:pass@s2-booking.invalid','https://127.0.0.1','https://localhost','https://s2-booking.invalid:8443','https://s2-booking.invalid/#x'])
  assert.throws(()=>Target.configuration({...valid,KK_LINE_BOOKING_TEST_ORIGIN:origin}),{code:'LINE_BOOKING_TEST_TARGET_INVALID'});
 for(const patch of [{KK_LINE_BOOKING_TEST_SCOPE:'short'}, {KK_LINE_BOOKING_TEST_EVENT_IDS:'EVT-S2-DUMMY,EVT-S2-DUMMY'},
  {KK_LINE_BOOKING_TEST_WINDOW_END:'2026-11-17T08:00:00.000Z'}, {KK_LINE_BOOKING_TEST_WINDOW_END:valid.KK_LINE_BOOKING_TEST_WINDOW_START},
  {KK_LINE_APPROVAL_SECRET:valid.LINE_CHANNEL_SECRET},{KK_LINE_APPROVAL_SECRET:valid.KK_LINE_INITIAL_OUTBOX_DISPATCH_SECRET}])
  assert.throws(()=>Target.configuration({...valid,...patch}),{code:'LINE_BOOKING_TEST_TARGET_INVALID'});
});
test('direct target guards require private owner membership, actual host and recheck each transport start',async()=>{
 const e=env();
 assert.throws(()=>Target.configuration({...e,KK_OWNER_LINE_TARGET_ID:'C'+'a'.repeat(32)}),{code:'LINE_BOOKING_TEST_CONFIG_INVALID'});
 assert.throws(()=>Target.configuration({...e,LINE_CHANNEL_SECRET:' '+e.KK_LINE_APPROVAL_SECRET+' '}),{code:'LINE_BOOKING_TEST_TARGET_INVALID'});
 const cfg=Target.configuration(e);
 assert.doesNotThrow(()=>Target.assertHost({headers:{host:'s2-booking.invalid'}},cfg));
 for(const headers of [{},{host:'kk-phone-rental.vercel.app'},{host:'s2-booking.invalid.evil'},{'x-forwarded-host':'s2-booking.invalid'}])
  assert.throws(()=>Target.assertHost({headers},cfg),{code:'LINE_BOOKING_TEST_TARGET_HOST_MISMATCH'});
 let calls=0;const oldNow=Date.now;
 try{
  Date.now=()=>NOW;const transport=Target.guardFetch(async()=>{calls++;return {ok:true};},cfg);
  await transport('https://fixture.invalid');
  Date.now=()=>cfg.end+1;await assert.rejects(()=>transport('https://fixture.invalid'),{code:'LINE_BOOKING_TEST_WINDOW_CLOSED'});
  assert.equal(calls,1);
 }finally{Date.now=oldNow;}
});
test('freshness and actor guards reject old, missing, future and nonprivate events before I/O',()=>{
 const cfg=Target.configuration(env());assert.equal(Target.isEventAllowed(event(),cfg,NOW),true);
 for(const changed of [{timestamp:undefined},{timestamp:String(NOW)},{timestamp:NOW-3600001},{timestamp:NOW+3600001},
  {source:{type:'group',userId:CUSTOMER}},{source:{type:'user',userId:'U'+'c'.repeat(32)}}])
  assert.equal(Target.isEventAllowed({...event(),...changed},cfg,NOW),false);
 assert.equal(Target.isEventAllowed(event(),cfg,NOW+3600001),false);
 assert.equal(Target.isCanonicalAllowed({event_id:'EVT-S2-DUMMY'},cfg),true);
 assert.equal(Target.isCanonicalAllowed({event_id:'EVT-OLD'},cfg),false);
});
test('scoped immutable event ID is deterministic but differs across scope/origin; missing original ID stays invalid',()=>{
 const cfg=Target.configuration(env());const e=event();
 const a=Target.scopedEvent(e,cfg);assert.notEqual(a,e);assert.equal(e.webhookEventId,'immutable_dummy_event');
 assert.equal(a.webhookEventId,Target.scopedEvent({...e,replyToken:'different'},cfg).webhookEventId);
 assert.notEqual(a.webhookEventId,Target.scopedEvent(e,Target.configuration({...env(),KK_LINE_BOOKING_TEST_SCOPE:'s2_dummy_run_0002'})).webhookEventId);
 assert.notEqual(a.webhookEventId,Target.scopedEvent(e,Target.configuration({...env(),KK_LINE_BOOKING_TEST_ORIGIN:'https://other-s2.invalid'})).webhookEventId);
 assert.throws(()=>Target.scopedEvent({...e,webhookEventId:''},cfg),{code:'LINE_EVENT_ID_REQUIRED'});
});
