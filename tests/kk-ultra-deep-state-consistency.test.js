'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const State=require('../server/kk-ultra-deep-state-consistency.js');
const V2=require('../server/kk-ultra-deep-v2-runtime-adapter.js');
function snapshot(){return{
 events:[
  {event_id:'E1',event_name:'Booked Main Show',event_date:'23/10/2026',active_on_web:true},
  {event_id:'E2',event_name:'Unbooked Other Show',event_date:'23/10/2026',active_on_web:true}
 ],
 bookings:[{booking_id:'B1',event_id:'E1',event_date:'2026-10-23',booking_status:'confirmed'}],
 web_ready:[
  {event_id:'E1',action_for_web:'show_full'},
  {event_id:'E2',action_for_web:'show_full'}
 ],visibility_locks:[]
};}
test('real booking day is normalized and flags any other visible canonical event',()=>{
 const s=snapshot(),out=State.audit(s);
 assert.equal(out.status,'FAIL_CLOSED');
 assert.ok(out.violations.some(v=>v.event_id==='E2'&&v.code==='OTHER_EVENT_ACTIVE_ON_BOOKING_DAY'));
 assert.ok(out.violations.some(v=>v.event_id==='E2'&&v.code==='OTHER_EVENT_VISIBLE_ON_BOOKING_DAY'));
 assert.ok(!out.violations.some(v=>v.event_id==='E1'));
 assert.deepEqual(out.active_booking_dates,['2026-10-23']);
 assert.equal(V2.buildReadOnlyPlan({month:'2026-10',snapshot:s,candidates:[]}).status,'BLOCKED_STATE_CONSISTENCY');
 assert.equal(out.production_writes,0);
});
test('bookings only protect event ID when the event date matches exactly',()=>{
 const s=snapshot();
 s.bookings=[{booking_id:'B',event_id:'E1',event_date:'2026-10-24',booking_status:'confirmed'}];
 // The booking on Oct 24 cannot exempt E1 on Oct 23; both unrelated dates must be treated distinctly.
 const out=State.audit(s);
 assert.equal(out.active_booking_dates[0],'2026-10-24');
 assert.equal(out.status,'PASS');
 s.events.push({event_id:'E3',event_name:'Unbooked Same Day',event_date:'2026-10-24',active_on_web:true});
 const observed=State.audit(s);
 assert.ok(observed.violations.some(x=>x.event_id==='E3'&&x.code==='OTHER_EVENT_ACTIVE_ON_BOOKING_DAY'));
});
test('canonical tombstone cannot be visible in Core or public Web Ready',()=>{
 const s=snapshot();s.bookings=[];s.visibility_locks=[{event_id:'E2',lock_state:'LOCKED'}];
 const out=State.audit(s);
 assert.equal(out.status,'FAIL_CLOSED');
 assert.ok(out.violations.some(x=>x.code==='LOCKED_BUT_CORE_ACTIVE'));
 assert.ok(out.violations.some(x=>x.code==='LOCKED_BUT_PRODUCTION_VISIBLE'));
});
test('hide by governance resolves booking-day drift; audit never changes state on its own',()=>{
 const s=snapshot(),json=JSON.stringify(s);
 const before=State.audit(s);
 assert.equal(before.status,'FAIL_CLOSED');
 assert.equal(JSON.stringify(s),json);
 s.events[1].active_on_web=false;s.web_ready[1].action_for_web='hide';
 const after=State.audit(s);
 assert.equal(after.status,'PASS');
 const plan=V2.buildReadOnlyPlan({month:'2026-10',snapshot:s,candidates:[]});
 assert.equal(plan.state_consistency.status,'PASS');
 assert.equal(plan.production_writes,0);
});
test('missing booking event ID causes conservative same-date exclusion, never implicit ownership',()=>{
 const s=snapshot();
 s.bookings=[{booking_id:'B',event_date:'2026-10-23',booking_status:'pending'}];
 const out=State.audit(s);
 assert.equal(out.status,'FAIL_CLOSED');
 assert.ok(out.violations.some(x=>x.event_id==='E1'&&x.code==='OTHER_EVENT_ACTIVE_ON_BOOKING_DAY'));
});
