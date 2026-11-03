'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {TARGETS,PHONES,GATES,preflightBusWaitlist}=require('../server/dec2026-owner-waitlist-release-preflight');
function base(){
  const events=[],bookings=[],web_ready=[],visibility_locks=[],web_packages=[];
  TARGETS.forEach((target,i)=>{
    const date=target.date;
    events.push({event_id:target.event_id,event_name:'Happy BUSDAY 1 + 2 = 3',
      event_date:date,event_status:'open',active_on_web:false,data_health:'OK',
      poster_image_url:'https://drive.google.com/thumbnail?id='+target.poster_id+'&sz=w1200'});
    visibility_locks.push({event_id:target.event_id,lock_state:'LOCKED',
      lock_reason:'BOOKED_DAY_OTHER_EVENT_HIDE_2026-10-12'});
    web_ready.push({event_id:target.event_id,event_date_text:date,available_phone_count:0,available_lens_count:i===0?1:0,
      action_for_web:'hide'});
    ['phone_only','lens_only','phone_lens_bundle'].forEach(type=>
      web_packages.push({package_id:target.event_id+'-TPL-'+type,event_id:target.event_id,package_type:type,
        package_status:'hidden',available_count:type==='lens_only'&&i===0?1:0}));
    PHONES.forEach((phone,j)=>{
      const event_id=i===0?'EVT-20261205-BTS-WORLD-TOUR-ARIRANG':'EVT-20261206-WILLIAM-EST-REIGN-TOGETHER-C';
      bookings.push({event_id,booking_status:'confirmed',phone_asset_id:phone});
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
  assert.equal(p.proposed_rows.every(x=>!x.proposed_admin_action&&x.expected_action==='show_full'),true);
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
  const x=base();x.bookings[0].booking_status='cancelled';
  containsCode(preflightBusWaitlist(x,approved()),'DATE_SHARED_STOCK_NOT_EXACTLY_FULL');
});
test('unknown phone identifier and overbooking both block',()=>{
  const x=base();x.bookings[0].phone_asset_id='PHONE-999';
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

test('canonical Google Sheets field names are authoritative over loose aliases',()=>{
  const x=base();
  x.bookings[0].status='cancelled';
  x.events[0].status='closed';
  assert.equal(preflightBusWaitlist(x,approved()).status,'PROPOSAL_READY_FOR_GOVERNED_OWNER_ADMIN');
  x.bookings[0].booking_status='cancelled';
  containsCode(preflightBusWaitlist(x,approved()),'DATE_SHARED_STOCK_NOT_EXACTLY_FULL');
});
test('missing lens-only row or duplicated package identity blocks operator plan',()=>{
  const x=base();x.web_packages=x.web_packages.filter(p=>!(p.event_id===TARGETS[0].event_id&&p.package_type==='lens_only'));
  containsCode(preflightBusWaitlist(x,approved()),'PACKAGES_MUST_BE_UNAVAILABLE');
  const y=base();y.web_packages[1].package_id=y.web_packages[0].package_id;
  containsCode(preflightBusWaitlist(y,approved()),'PACKAGES_MUST_BE_UNAVAILABLE');
});
test('date moved in derived Web Ready cannot be published with stale event poster',()=>{
  const x=base();x.web_ready[0].event_date_text='04/12/2026';
  containsCode(preflightBusWaitlist(x,approved()),'WEB_READY_UNEXPECTED_BASELINE');
});

test('missing phone count, missing package availability and blank Core visibility fail closed',()=>{
  const a=base();delete a.web_ready[0].available_phone_count;
  containsCode(preflightBusWaitlist(a,approved()),'WEB_READY_UNEXPECTED_BASELINE');
  const b=base();delete b.web_packages[0].available_count;
  containsCode(preflightBusWaitlist(b,approved()),'PACKAGES_MUST_BE_UNAVAILABLE');
  const c=base();delete c.events[0].active_on_web;
  containsCode(preflightBusWaitlist(c,approved()),'EVENT_SOURCE_NOT_EXACT_HIDDEN');
});

test('any failed date or release gate withholds ALL Admin payloads, even a valid other date',()=>{
  const x=base();x.events[1].active_on_web=true;
  const r=preflightBusWaitlist(x,approved());
  assert.equal(r.status,'BLOCKED');
  assert.equal(r.proposed_rows.every(row=>!Object.hasOwn(row,'proposed_admin_action')),true);
  const y=preflightBusWaitlist(base(),{});
  assert.equal(y.proposed_rows.every(row=>!Object.hasOwn(row,'proposed_admin_action')),true);
});
