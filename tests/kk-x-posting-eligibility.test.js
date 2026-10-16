'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const E=require('../server/kk-x-posting-eligibility.js');
const Planner=require('../server/kk-x-posting-plan.js');

const NOW='2026-10-13T02:39:00+07:00';
const RECORD='2026-10-13T02:30:00+07:00';
const ID='EVT-20261017-K-LIVE-EXAMPLE';
const DAY='17/10/2026';
function candidate(overrides={}){
  return {
    event:'K-LIVE EXAMPLE',event_id:ID,event_date_text:DAY,
    verified_event:true,verified_pricing:true,event_is_today:true,
    engagement_velocity:100,conversation_volume:100,
    verified_pricing:true,inventory_available:true,inventory_remaining:1,
    ...overrides
  };
}
function input(overrides={}){
  return {now:NOW,candidates:[candidate()],
    storefront_source:'08_Web_Ready',storefront_verified:true,storefront_readback_at:RECORD,
    storefront_rows:[{event_id:ID,event_date_text:DAY,action_for_web:'show',booking_status_for_web:'เปิดจอง',available_phone_count:1}],
    post_log_verified:true,post_log_readback_at:RECORD,post_log:[],
    ...overrides};
}
test('06:00 Bangkok operating day keeps midnight posts on the previous day',()=>{
  assert.equal(E.operatingDay('2026-10-13T02:39:00+07:00'),'2026-10-12');
  assert.equal(E.operatingDay('2026-10-13T05:59:00+07:00'),'2026-10-12');
  assert.equal(E.operatingDay('2026-10-13T06:00:00+07:00'),'2026-10-13');
  assert.equal(E.operatingDay('13/10/2026 02:39'),'2026-10-12');
  assert.equal(E.eventDay(DAY),'2026-10-17');
});
test('strict canonical show/open/positive phone is required, even if event itself is verified',()=>{
  assert.equal(E.eligibility(candidate(),input()).eligible,true);
  for(const row of [
    {action_for_web:'hide',booking_status_for_web:'เปิดจอง',available_phone_count:2},
    {action_for_web:'show_full',booking_status_for_web:'เต็ม',available_phone_count:0},
    {action_for_web:'show',booking_status_for_web:'เต็ม',available_phone_count:2},
    {action_for_web:'show',booking_status_for_web:'เปิดจอง',available_phone_count:0}
  ]){
    const modified=input({storefront_rows:[{event_id:ID,event_date_text:DAY,...row}]});
    assert.ok(E.eligibility(candidate(),modified).errors.includes('STOREFRONT_NOT_RENTABLE'));
  }
  assert.ok(E.eligibility(candidate(),input({storefront_rows:[]})).errors.includes('EXACT_STOREFRONT_ROW_REQUIRED'));
  assert.ok(E.eligibility(candidate({event_date_text:'18/10/2026'}),input()).errors.includes('EXACT_STOREFRONT_ROW_REQUIRED'));
});
test('missing/stale/unverified readbacks and event dates fail closed',()=>{
  for(const props of [
    {storefront_rows:undefined}, {storefront_verified:false},{storefront_readback_at:'2026-10-12T17:00:00+07:00'},
    {post_log_verified:false},{post_log_readback_at:'2026-10-12T17:00:00+07:00'},{post_log:undefined}
  ]){
    const p=Planner.plan(input(props));
    assert.equal(p.status,'BLOCKED_NO_ELIGIBLE_EVENTS');
    assert.equal(p.slots.some(slot=>slot.event),false);
  }
  assert.ok(E.eligibility(candidate({verified_event:false}),input()).errors.includes('EVENT_NOT_VERIFIED'));
  assert.ok(E.eligibility(candidate({verified_pricing:false}),input()).errors.includes('PRICE_NOT_VERIFIED'));
  assert.ok(E.eligibility(candidate({event_date_text:'11/10/2026'}),input()).errors.includes('EVENT_DATE_IN_PAST'));
});
test('assumed and planned posts block duplicate day but do not qualify as published analytics',()=>{
  for(const status of ['confirmed_posted','assumed_posted','planned']){
    const post_log=[{event_id:ID,planned_at:'2026-10-12T23:30:00+07:00',status}];
    const p=Planner.plan(input({post_log}));
    assert.equal(p.status,'BLOCKED_NO_ELIGIBLE_EVENTS');
    assert.ok(p.rejected_candidates[0].reasons.includes('DAILY_DUPLICATE_REJECT'));
  }
  assert.equal(Planner.plan(input({post_log:[{event_id:ID,planned_at:'2026-10-12T23:30:00+07:00',status:'superseded'}]})).status,'READY_FOR_OWNER_REVIEW');
  assert.equal(Planner.plan(input({post_log:[{event_id:ID,planned_at:'2026-10-11T23:30:00+07:00',status:'confirmed_posted'}]})).status,'READY_FOR_OWNER_REVIEW');
});
test('undated post log and missing event name cannot silently pass eligibility',()=>{
  const undated=E.eligibility(candidate(),input({post_log:[{event_id:ID,status:'assumed_posted',planned_at:''}]}));
  assert.ok(undated.errors.includes('POST_LOG_DATE_UNVERIFIED'));
  const missingName=E.eligibility(candidate({event:''}),input());
  assert.ok(missingName.errors.includes('EVENT_NAME_REQUIRED'));
});
test('fresh available event with an existing booking remains promotable when one phone is left',()=>{
  const p=Planner.plan(input({candidates:[candidate({booking_already_confirmed:true,inventory_available:false,inventory_remaining:0})]}));
  assert.equal(p.status,'READY_FOR_OWNER_REVIEW');
  assert.equal(p.slots[0].event,'K-LIVE EXAMPLE');
  assert.equal(p.ranking[0].dimensions.event_proximity,62);
  assert.equal(p.ranking[0].candidate.inventory_remaining,1);
  assert.equal(p.ranking[0].marketing_agent.campaign_mode!=='HOLD_NO_PHONE_INVENTORY',true);
  assert.equal(p.ranking[0].confidence,'LOW_NO_VERIFIED_X');
  assert.equal(p.ranking[0].dimensions.conversation_volume,0);
  assert.equal(p.safety.auto_publish,false);
  assert.equal(p.production_writes,0);
});
test('one event occupies at most one slot regardless of duplicated candidate or date',()=>{
  const p=Planner.plan(input({candidates:[candidate(),candidate({event_id:ID,event:'k-live example'})]}));
  assert.equal(p.slots.filter(slot=>slot.event).length,1);
});
test('no X performance learning from assumed rows or bare numbers without verified post URL',()=>{
  const c=candidate({performance_rows:[
    {status:'assumed_posted',impressions:999999,engagements:99999},
    {status:'measured',impressions:500000,engagements:15000},
    {status:'confirmed_posted',impressions:300,engagements:20,x_post_url:'https://x.com/kk/status/123456',evidence_verified:true}
  ]});
  const plan=Planner.plan(input({candidates:[c]}));
  assert.equal(plan.ranking[0].marketing_agent.measured_posts,1);
  assert.equal(plan.ranking[0].marketing_agent.evidence_state,'PERFORMANCE_INFORMED');
  assert.equal(plan.ranking[0].confidence,'LOW_NO_VERIFIED_X');
  assert.equal(plan.safety.auto_spend,false);
});
