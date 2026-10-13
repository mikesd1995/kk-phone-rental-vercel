'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Recovery=require('../server/kk-x-visibility-recovery.js');
const Planner=require('../server/kk-x-posting-plan.js');
const NOW='2026-10-13T18:00:00+07:00';
const READ='2026-10-13T17:55:00+07:00';
function input(overrides={}){
  const candidates=Array.from({length:4},(_,i)=>({
    event:'Event '+(i+1),event_id:'EVENT-'+(i+1),
    event_date_text:'17/10/2026',verified_event:true,verified_pricing:true
  }));
  return {
    now:NOW,candidates,
    storefront_source:'08_Web_Ready',storefront_verified:true,storefront_readback_at:READ,
    storefront_rows:candidates.map(c=>({
      event_id:c.event_id,event_date_text:c.event_date_text,action_for_web:'show',
      booking_status_for_web:'เปิดจอง',available_phone_count:1
    })),
    post_log_verified:true,post_log_readback_at:READ,post_log:[],
    ...overrides
  };
}
test('temporary precaution is two account-wide recommendations, not X official limit',()=>{
  const result=Planner.plan(input());
  assert.equal(result.status,'READY_FOR_OWNER_REVIEW');
  assert.equal(result.visibility_recovery.mode,'CONSERVATIVE_SHADOWBAN_RISK_RECOVERY_ADVISORY');
  assert.equal(result.slots.filter(s=>s.event).length,2);
  assert.equal(result.slots[2].reason[0],'RECOVERY_DAILY_POST_CAP');
  assert.equal(result.slots[3].event,'');
  assert.equal(result.safety.auto_publish,false);
  assert.equal(result.production_writes,0);
});
test('two confirmed or reserved cross-event posts exhaust operating-day cap',()=>{
  const p=Planner.plan(input({post_log:[
    {event_id:'OTHER',planned_at:'2026-10-13T07:00:00+07:00',status:'confirmed_posted'},
    {event_id:'OTHER2',planned_at:'2026-10-13T10:00:00+07:00',status:'planned'}
  ]}));
  assert.equal(p.status,'BLOCKED_VISIBILITY_RECOVERY');
  assert.equal(p.visibility_recovery.existing_active_post_log_rows,2);
  assert.ok(p.slots.every(s=>!s.event));
});
test('one existing other-event post blocks too-close slot and leaves one later slot',()=>{
  const p=Planner.plan(input({post_log:[
    {event_id:'OTHER',planned_at:'2026-10-13T19:10:00+07:00',status:'assumed_posted'}
  ]}));
  assert.equal(p.visibility_recovery.existing_active_post_log_rows,1);
  assert.equal(p.slots[0].reason[0],'RECOVERY_SPACING_UNDER_90_MIN');
  assert.ok(p.slots[1].event);
  assert.equal(p.slots.filter(s=>s.event).length,1);
});
test('exactly 90 minutes is accepted and midnight maps to same operating day',()=>{
  assert.equal(Recovery.slotMs('2026-10-13','00:00'),Date.parse('2026-10-14T00:00:00+07:00'));
  const r=Recovery.assess(input(),[
    {time:'19:30'}, {time:'21:00'}, {time:'21:40'}, {time:'00:00'}
  ]);
  assert.deepEqual(r.allowed_indexes,[0,1]);
  assert.equal(r.slot_reasons[2],'RECOVERY_DAILY_POST_CAP');
});
test('invalid active post date blocks entire account-wide recommendation',()=>{
  const p=Planner.plan(input({post_log:[{event_id:'OTHER',status:'confirmed_posted',planned_at:''}]}));
  assert.equal(p.status,'BLOCKED_VISIBILITY_RECOVERY');
  assert.ok(p.visibility_recovery.errors.includes('ACTIVE_POST_LOG_TIME_UNVERIFIED'));
  assert.equal(p.slots.some(s=>s.event),false);
});
test('old/superseded posts do not consume today's capacity; Thai timestamp supported',()=>{
  const p=Planner.plan(input({post_log:[
    {event_id:'OLD',planned_at:'12/10/2026 16:30',status:'confirmed_posted'},
    {event_id:'IGNORED',planned_at:'13/10/2026 15:00',status:'superseded'}
  ]}));
  assert.equal(p.visibility_recovery.existing_active_post_log_rows,0);
  assert.equal(p.slots.filter(s=>s.event).length,2);
});
test('stale canonical readback blocks recovery advisory instead of inventing post volume',()=>{
  const p=Planner.plan(input({post_log_readback_at:'2026-10-12T10:00:00+07:00'}));
  assert.equal(p.status,'BLOCKED_NO_ELIGIBLE_EVENTS');
  assert.ok(p.visibility_recovery.errors.includes('FRESH_POST_LOG_READBACK_REQUIRED'));
  assert.ok(p.slots.every(s=>!s.event));
});
