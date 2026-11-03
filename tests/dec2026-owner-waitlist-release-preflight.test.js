'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {TARGETS,PHONES,GATES,preflightBusWaitlist}=require('../server/dec2026-owner-waitlist-release-preflight');
function base(){
  const events=[],bookings=[],web_ready=[],visibility_locks=[],web_packages=[];
  TARGETS.forEach((target,i)=>{
    const date=target.date;
    events.push({event_id:target.event_id,event_name:'Happy BUSDAY 1 + 2 = 3',
      event_date:date,status:'open',active_on_web:false,data_health:'OK',
      poster_image_url:'https://drive.google.com/thumbnail?id='+target.poster_id+'&sz=w1200'});
    visibility_locks.push({event_id:target.event_id,lock_state:'LOCKED',
      lock_reason:'BOOKED_DAY_OTHER_EVENT_HIDE_2026-10-12'});
    web_ready.push({event_id:target.event_id,available_phone_count:0,available_lens_count:i===0?1:0,
      action_for_web:'hide'});
    ['phone_only','lens_only','phone_lens_bundle'].forEach(type=>
      web_packages.push({event_id:target.event_id,package_type:type,
        package_status:'hidden',available_count:type==='lens_only'&&i===0?1:0}));
    PHONES.forEach((phone,j)=>{
      const event_id=i===0?'EVT-20261205-BTS-WORLD-TOUR-ARIRANG':'EVT-20261206-WILLIAM-EST-REIGN-TOGETHER-C';
      bookings.push({event_id,status:'confirmed',phone_id:phone});
    });
  });
  return {events,bookings,web_ready,visibility_locks,web_packages};
}
const approved=()=>Object.fromEntries(GATES.map(x=>[x,true]));
const containsCode=(result,code)=>assert.ok(result.blockers.some(x=>x.includes(code)),result.blockers.join('; '));
test('BUS owner-reopen plan never writes and stays blocked without release gates',()=>{
  const p=preflightBusWaitlist(base());
  assert.equal(p.production_writes,0);assert.equal(p.calls_performed,0);
  assert.equal(p.safe_to_execute_by_this_function,false);
  assert.equal(p.status,'BLOCKED');
  assert.equal(p.proposed_rows.length,2);
  assert.equal(p.proposed_rows.every(x=>x.proposed_admin_action&&x.expected_action==='show_full'),true);
  containsCode(p,'RELEASE_GATE_MISSING');
});
test('exact fully-booked BUS dates produce two distinct gated Admin payloads only',()=>{
  const p=preflightBusWaitlist(base(),approved());
  assert.equal(p.status,'PROPOSAL_READY_FOR_GOVERNED_OWNER_ADMIN');
  assert.deepEqual(p.blockers,[]);
  assert.deepEqual(p.proposed_rows.map(x=>x.proposed_admin_action),TARGETS.map(t=>({
    action:'updateEvent',payload:{
      event_id:t.event_id,active_on_web:true,visibility_owner_intent:'explicit_owner_reopen'
    }
  })));
  assert.equal(p.proposed_rows.every(x=>!x.booking_confirmation_allowed&&x.available_phone_count===0),true);
  assert.equal(p.production_writes,0);
});
test('wrong historical owner lock does not become automatic authorization',()=>{
  const x=base();x.visibility_locks[0].lock_state='SEEN_CORE';
  containsCode(preflightBusWaitlist(x,approved()),'OWNER_TOMBSTONE_NOT_EXPECTED');
});
test('lost date-stock reservation blocks reopening instead of fabricating new phone',()=>{
  const x=base();x.bookings[0].status='cancelled';
  containsCode(preflightBusWaitlist(x,approved()),'DATE_SHARED_STOCK_NOT_EXACTLY_FULL');
});
test('unknown phone identifier and overbooking both block',()=>{
  const x=base();x.bookings[0].phone_id='PHONE-999';
  containsCode(preflightBusWaitlist(x,approved()),'BOOKED_DEVICE_ID_UNKNOWN');
  const y=base();y.bookings.push({...y.bookings[0]});
  containsCode(preflightBusWaitlist(y,approved()),'DATE_SHARED_STOCK_NOT_EXACTLY_FULL');
});
test('visible package or nonzero phone package cannot go to waitlist-only publish',()=>{
  const x=base();x.web_packages[0].package_status='available';
  containsCode(preflightBusWaitlist(x,approved()),'PACKAGES_MUST_BE_UNAVAILABLE');
  const y=base();y.web_packages[0].available_count=1;
  containsCode(preflightBusWaitlist(y,approved()),'PACKAGES_MUST_BE_UNAVAILABLE');
});
test('duplicate ID, unexpected core or web baseline and changed poster fail closed',()=>{
  const x=base();x.events.push({...x.events[0]});
  containsCode(preflightBusWaitlist(x,approved()),'EXACT_SOURCE_ID_MISSING_OR_DUPLICATE');
  const y=base();y.events[0].active_on_web=true;
  containsCode(preflightBusWaitlist(y,approved()),'EVENT_SOURCE_NOT_EXACT_HIDDEN');
  const z=base();z.web_ready[0].action_for_web='show';
  containsCode(preflightBusWaitlist(z,approved()),'WEB_READY_UNEXPECTED_BASELINE');
  const w=base();w.events[0].poster_image_url='https://drive.google.com/thumbnail?id=UNRELATED';
  containsCode(preflightBusWaitlist(w,approved()),'EXISTING_POSTER_ID_CHANGED');
});
test('one missing release gate always blocks even when live source state is healthy',()=>{
  for(const name of GATES){
    const gates=approved();gates[name]=false;
    containsCode(preflightBusWaitlist(base(),gates),'RELEASE_GATE_MISSING:'+name);
  }
});
test('empty snapshot or current BUS customer booking fails closed',()=>{
  containsCode(preflightBusWaitlist({},approved()),'REQUIRED_LIVE_SNAPSHOT_MISSING');
  const x=base();x.bookings[0].event_id=TARGETS[0].event_id;
  containsCode(preflightBusWaitlist(x,approved()),'DATE_SHARED_STOCK_NOT_EXACTLY_FULL');
});
