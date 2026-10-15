'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const R=require('../server/kk-ultra-deep-production-runtime.js');

function snapshot(){
 return {
  events:[
   {event_id:'EVT-EX',event_name:'LYKN REFLEXION CONCERT',event_date:'2026-10-23',venue:'IMPACT Arena',poster_url:'https://img/ex.jpg',active_on_web:true},
   {event_id:'EVT-HID',event_name:'Hidden Fan Meeting',event_date:'2026-10-25',venue:'Union Hall',poster_url:'https://img/h.jpg',active_on_web:false}
  ],
  web_ready:[
   {event_id:'EVT-EX',event_name:'LYKN REFLEXION CONCERT',event_date:'2026-10-23',venue:'IMPACT Arena',poster_image_url:'https://img/ex.jpg',action_for_web:'show'},
   {event_id:'EVT-HID',event_name:'Hidden Fan Meeting',event_date:'2026-10-25',venue:'Union Hall',poster_image_url:'https://img/h.jpg',action_for_web:'hide'}
  ],
  web_packages:[
   {package_id:'EVT-EX-TPL-VIVO-X300-PRO-PHONE',event_id:'EVT-EX',package_type:'phone_only',price:790,available_count:1,package_status:'available'}
  ],
  packages:[
   {template_id:'TPL-VIVO-X300-PRO-PHONE',package_type:'phone_only',standard_price:790,active:true}
  ],
  assets:[{asset_id:'PHONE-1',asset_type:'phone',status:'available'},{asset_id:'PHONE-2',asset_type:'phone',status:'available'}],
  bookings:[{booking_id:'B1',event_date:'2026-10-26',booking_status:'confirmed'}],
  visibility_locks:[{event_id:'EVT-HID',event_name:'Hidden Fan Meeting',event_date:'2026-10-25',venue:'Union Hall',lock_state:'LOCKED'}]
 };
}

test('reconciliation pins exact existing, skips booked and hidden history, leaves safe new',()=>{
 const out=R.reconcileCandidates([
  {event_key:'A',title:'LYKN REFLEXION CONCERT',event_date:'2026-10-23',venue:'IMPACT Arena'},
  {event_key:'B',title:'Hidden Fan Meeting',event_date:'2026-10-25',venue:'Union Hall'},
  {event_key:'C',title:'New Artist Fan Meeting',event_date:'2026-10-26',venue:'BITEC'},
  {event_key:'D',title:'Another Concert',event_date:'2026-10-27',venue:'BITEC'}
 ],snapshot());
 assert.equal(out.safe_candidates.length,3);
 assert.equal(out.safe_candidates[0].existing_event_id,'EVT-EX');
 assert.equal(out.dispositions.find(x=>x.event_key==='B').status,'SKIPPED_EVENT_HISTORY');
 assert.equal(out.dispositions.find(x=>x.event_key==='C').status,'SAFE_NEW');
 assert.equal(out.dispositions.find(x=>x.event_key==='D').status,'SAFE_NEW');
 assert.equal(out.phone_capacity,2);
 assert.deepEqual(out.full_booked_dates,[]);
});

test('same date venue with two close existing matches holds ambiguous',()=>{
 const s=snapshot();
 s.events=[
  {event_id:'1',event_name:'Artist Live Bangkok',event_date:'2026-10-20',venue:'BITEC',active_on_web:true},
  {event_id:'2',event_name:'Artist Live Bangkok Special',event_date:'2026-10-20',venue:'BITEC',active_on_web:true}
 ];
 s.web_ready=[];s.web_packages=[];s.visibility_locks=[];s.bookings=[];
 const out=R.reconcileCandidates([{event_key:'X',title:'Artist Live Bangkok Show',event_date:'2026-10-20',venue:'BITEC'}],s);
 assert.equal(out.safe_candidates.length,0);
 assert.equal(out.dispositions[0].status,'HOLD_AMBIGUOUS_EXISTING');
});

test('readback converts public action to active flag and returns event packages',()=>{
 const rb=R.readbackForEvent(snapshot(),'EVT-EX');
 assert.equal(rb.event.active_on_web,true);
 assert.equal(rb.packages.length,1);
 assert.equal(R.packageTemplateId(rb.packages[0].package_id),'TPL-VIVO-X300-PRO-PHONE');
});


test('malformed auto-created Ultra Deep storefront rows are quarantine candidates only when automation-marked',()=>{
 const s=snapshot();
 s.events.push(
  {event_id:'EVT-BAD',event_name:'The Mall Lifestore Bangkapi | Bangkok - FacebookTEETEE PHILIPPINES on X: Bangkok Post',event_date:'2026-10-18',venue:'MCC Hall',active_on_web:true,note:'Verifier-approved discovery promotion | PRICING=PROVISIONAL_NEEDS_PRICE_RECHECK'},
  {event_id:'EVT-OWNER',event_name:'Owner Long Event | Facebook on X Bangkok Post',event_date:'2026-10-19',venue:'MCC Hall',active_on_web:true,note:'owner-created'}
 );
 s.web_ready.push(
  {event_id:'EVT-BAD',event_name:'The Mall Lifestore Bangkapi | Bangkok - FacebookTEETEE PHILIPPINES on X: Bangkok Post',event_date:'2026-10-18',venue:'MCC Hall',event_note:'Verifier-approved discovery promotion | PRICING=PROVISIONAL_NEEDS_PRICE_RECHECK',action_for_web:'show'},
  {event_id:'EVT-OWNER',event_name:'Owner Long Event | Facebook on X Bangkok Post',event_date:'2026-10-19',venue:'MCC Hall',event_note:'owner-created',action_for_web:'show'}
 );
 const rows=R.malformedAutoPromotionRows(s);
 assert.equal(rows.length,1);
 assert.equal(rows[0].event_id,'EVT-BAD');
 assert.ok(rows[0].quality.reasons.includes('AGGREGATED_SEARCH_RESULT_TITLE'));
});

test('already hidden malformed automation row is not quarantined again',()=>{
 const s=snapshot();
 s.events.push({event_id:'EVT-BAD',event_name:'Bad Facebook on X Bangkok Post',event_date:'2026-10-18',active_on_web:false,note:'Verifier-approved discovery promotion'});
 s.web_ready.push({event_id:'EVT-BAD',event_name:'Bad Facebook on X Bangkok Post',event_date:'2026-10-18',event_note:'Verifier-approved discovery promotion',action_for_web:'hide'});
 assert.deepEqual(R.malformedAutoPromotionRows(s),[]);
});

test('production runtime completes zero-write when every verified candidate is safely terminally skipped',async()=>{
 const s=snapshot();
 s.bookings.push(
   {booking_id:'B2',event_date:'2026-10-23',booking_status:'confirmed'},
   {booking_id:'B3',event_date:'2026-10-23',booking_status:'confirmed'}
 );
 s.visibility_locks.push({
   event_id:'EVT-HIST',
   event_name:'Historical Concert',
   event_date:'2026-10-28',
   venue:'BITEC',
   lock_state:'SEEN_CORE'
 });
 const handoff={
   month:'2026-10',
   verifier:{
     verified_candidates:[
       {event_key:'BOOKED',title:'New Fixture Showcase',event_date:'2026-10-23',venue:'IMPACT Arena'},
       {event_key:'HISTORY',title:'Historical Concert',event_date:'2026-10-28',venue:'BITEC'}
     ]
   },
   competitor_prices:[],
   posters:[]
 };
 const out=await R.execute(handoff,{snapshot:s,executeWrites:false});
 assert.equal(out.status,'COMPLETE');
 assert.equal(out.production_writes,0);
 assert.equal(out.blockers.length,0);
 assert.equal(out.orchestrator.acceptance.complete,true);
 assert.equal(out.orchestrator.acceptance.completion_mode,'SAFE_NOOP_TERMINAL_DISPOSITIONS');
 assert.equal(out.orchestrator.acceptance.verified_candidate_count,2);
 assert.equal(out.orchestrator.acceptance.terminal_disposition_count,2);
 assert.deepEqual(out.dispositions.map(x=>x.status),['SKIPPED_FULL_BOOKING_DATE','SKIPPED_EVENT_HISTORY']);
});

test('production runtime still fails closed when reconciliation has an ambiguous unresolved candidate',async()=>{
 const s=snapshot();
 s.events=[
   {event_id:'1',event_name:'Artist Live Bangkok',event_date:'2026-10-20',venue:'BITEC',active_on_web:true},
   {event_id:'2',event_name:'Artist Live Bangkok Special',event_date:'2026-10-20',venue:'BITEC',active_on_web:true}
 ];
 s.web_ready=[];s.web_packages=[];s.visibility_locks=[];s.bookings=[];
 const handoff={
   month:'2026-10',
   verifier:{verified_candidates:[{event_key:'X',title:'Artist Live Bangkok Show',event_date:'2026-10-20',venue:'BITEC'}]},
   competitor_prices:[],
   posters:[]
 };
 const out=await R.execute(handoff,{snapshot:s,executeWrites:false});
 assert.equal(out.status,'PARTIAL_SAFE_EXECUTION');
 assert.equal(out.production_writes,0);
 assert.ok(out.blockers.includes('AMBIGUOUS_EXISTING_EVENT_REVIEW'));
 assert.equal(out.orchestrator.acceptance.complete,false);
 assert.ok(out.orchestrator.acceptance.blockers.includes('UNSAFE_TERMINAL_DISPOSITION'));
});



test('full booking date requires all phone capacity; one booking with two phones stays discoverable',()=>{
 const s=snapshot();
 s.bookings=[{booking_id:'ONE',event_date:'2026-10-30',booking_status:'confirmed'}];
 assert.equal(R.phoneInventoryCapacity(s),2);
 assert.deepEqual([...R.fullBookingDateSet(s)],[]);
 let out=R.reconcileCandidates([{event_key:'N',title:'New Event',event_date:'2026-10-30',venue:'Bangkok'}],s);
 assert.equal(out.dispositions[0].status,'SAFE_NEW');
 s.bookings.push({booking_id:'TWO',event_date:'2026-10-30',booking_status:'pending'});
 assert.deepEqual([...R.fullBookingDateSet(s)],['2026-10-30']);
 out=R.reconcileCandidates([{event_key:'N',title:'New Event',event_date:'2026-10-30',venue:'Bangkok'}],s);
 assert.equal(out.dispositions[0].status,'SKIPPED_FULL_BOOKING_DATE');
});

test('locked historical event reports verified metadata changes but remains excluded from publish candidates',()=>{
 const s=snapshot();
 const out=R.reconcileCandidates([{event_key:'LOCKED-UPDATE',canonical_event_id:'EVT-HID',title:'Hidden Fan Meeting',event_date:'2026-10-25',venue:'New Union Hall',poster_url:'https://img/new-h.jpg'}],s);
 assert.equal(out.safe_candidates.length,0);
 assert.equal(out.dispositions[0].status,'SKIPPED_EVENT_HISTORY');
 assert.equal(out.dispositions[0].update_report.publish_allowed,false);
 assert.equal(out.dispositions[0].update_report.material_update,true);
 assert.deepEqual(out.dispositions[0].update_report.changes.map(x=>x.field).sort(),['poster','venue']);
 assert.equal(out.suppressed_updates.length,1);
});

test('canonical id keeps a locked event suppressed even when the verified official date changes',()=>{
 const s=snapshot();
 const out=R.reconcileCandidates([{event_key:'LOCKED-DATE',canonical_event_id:'EVT-HID',title:'Hidden Fan Meeting',event_date:'2026-10-26',venue:'Union Hall'}],s);
 assert.equal(out.safe_candidates.length,0);
 assert.equal(out.dispositions[0].status,'SKIPPED_EVENT_HISTORY');
 assert.equal(out.dispositions[0].update_report.changes[0].field,'event_date');
 assert.equal(out.dispositions[0].update_report.changes[0].to,'2026-10-26');
});

test('existing active event remains eligible for metadata reconciliation even when the date is at full phone capacity',()=>{
 const s=snapshot();
 s.bookings=[
  {booking_id:'B2',event_id:'EVT-EX',event_date:'2026-10-23',booking_status:'confirmed'},
  {booking_id:'B3',event_id:'OTHER',event_date:'2026-10-23',booking_status:'confirmed'}
 ];
 const out=R.reconcileCandidates([{event_key:'EXISTING-FULL',canonical_event_id:'EVT-EX',title:'LYKN REFLEXION CONCERT',event_date:'2026-10-23',venue:'IMPACT Arena'}],s);
 assert.equal(out.full_booked_dates.includes('2026-10-23'),true);
 assert.equal(out.safe_candidates.length,1);
 assert.equal(out.dispositions[0].status,'SAFE_EXISTING');
 assert.equal(out.safe_candidates[0].existing_event_id,'EVT-EX');
});


test('full booking blocks fuzzy existing candidates but preserves canonical direct reconciliation',()=>{
 const s=snapshot();
 s.bookings=[
  {booking_id:'B2',event_id:'EVT-EX',event_date:'2026-10-23',booking_status:'confirmed'},
  {booking_id:'B3',event_id:'OTHER',event_date:'2026-10-23',booking_status:'confirmed'}
 ];
 const candidate={event_key:'FUZZY',title:'LYKN REFLEXION CONCERT',event_date:'2026-10-23',venue:'IMPACT Arena'};
 const fuzzy=R.reconcileCandidates([candidate],s);
 assert.equal(fuzzy.full_booked_dates.includes('2026-10-23'),true);
 assert.equal(fuzzy.dispositions[0].status,'SKIPPED_FULL_BOOKING_DATE');
 assert.equal(fuzzy.safe_candidates.length,0);
 const direct=R.reconcileCandidates([{...candidate,canonical_event_id:'EVT-EX'}],s);
 assert.equal(direct.dispositions[0].status,'SAFE_EXISTING');
 assert.equal(direct.safe_candidates[0].existing_event_id,'EVT-EX');
});
