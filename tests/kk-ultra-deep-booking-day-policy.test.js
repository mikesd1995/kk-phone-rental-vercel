'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Adapter=require('../server/kk-ultra-deep-v2-runtime-adapter.js');
const Prod=require('../server/kk-ultra-deep-production-runtime.js');

function snapshot(){
 return {
  events:[
   {event_id:'EVT-BOOK',event_name:'Booked Main Show',event_date:'2026-10-24',venue:'Hall A',active_on_web:true},
   {event_id:'EVT-OTHER',event_name:'Unbooked Same Day Show',event_date:'2026-10-24',venue:'Hall B',active_on_web:true}
  ],
  web_ready:[],web_packages:[],packages:[],visibility_locks:[],
  assets:[{asset_id:'P1',asset_type:'phone',status:'available'},{asset_id:'P2',asset_type:'phone',status:'available'}],
  bookings:[{booking_id:'B1',event_id:'EVT-BOOK',booking_status:'confirmed',event_date:'2026-10-24'}]
 };
}
const strongDemand={
 competitor_rental_activity:100,social_engagement:100,ticket_demand:100,
 fandom_photo_intent:100,venue_capture_value:100,historical_market_rental:100
};
const candidates=[
 {event_key:'BOOKED',title:'Booked Main Show',event_date:'2026-10-24',venue:'Hall A',...strongDemand},
 {event_key:'OTHER',title:'Unbooked Same Day Show',event_date:'2026-10-24',venue:'Hall B',...strongDemand},
 {event_key:'NEW',title:'New Exclusive Fanmeeting',event_date:'2026-10-24',venue:'Hall C',...strongDemand}
];

test('one active booking forbids another commercial event despite spare phone inventory',()=>{
 const snap=snapshot();
 assert.equal(Prod.phoneInventoryCapacity(snap),2);
 assert.equal(Adapter.availableOnDate(snap,'2026-10-24'),1);
 assert.equal(Adapter.bookingCountOnDate(snap,'2026-10-24'),1);
 const [booked,other,newEvent]=candidates.map(c=>Adapter.normalizeCandidate(c,snap));
 assert.equal(booked.booking_day_excluded,false);
 assert.equal(booked.booking_count,1);
 assert.equal(booked.rentability.decision,'EXISTING_CANONICAL_MAINTENANCE');
 assert.equal(other.booking_day_excluded,true);
 assert.equal(other.rentability.decision,'ACTIVE_BOOKING_DATE_EXCLUDED');
 assert.equal(newEvent.booking_day_excluded,true);
 assert.equal(newEvent.rentability.publish_eligible,false);
 const out=Adapter.buildReadOnlyPlan({month:'2026-10',candidates,snapshot:snap});
 assert.equal(out.selected_count,1);
 assert.equal(out.excluded_count,2);
 assert.equal(out.production_writes,0);
});

test('cancellation releases booking-day discovery only when no other active booking remains',()=>{
 const snap=snapshot();
 snap.bookings[0].booking_status='cancelled';
 assert.equal(Adapter.bookingCountOnDate(snap,'2026-10-24'),0);
 const resumed=Adapter.normalizeCandidate(candidates[2],snap);
 assert.equal(resumed.booking_day_excluded,false);
 assert.equal(resumed.rentability.decision,'FULL_LOOP');
 snap.bookings=[{booking_id:'B2',event_id:'EVT-BOOK',booking_status:'pending',event_date:'2026-10-24'}];
 assert.equal(Adapter.normalizeCandidate(candidates[2],snap).booking_day_excluded,true);
});


test('same-title Oct30 and Oct31 rounds cannot silently become an unverified date edit',()=>{
 const snap=snapshot();
 snap.events=[{event_id:'EVT-DAOU-30',event_name:'DAOUOFFROAD HALLOWEEN FAN PARTY 2026',
  event_date:'2026-10-30',venue:'centralwOrld Live',active_on_web:true}];
 snap.bookings=[];
 const oct31={event_key:'DAOU-31',title:'DAOUOFFROAD HALLOWEEN FAN PARTY 2026',
  event_date:'2026-10-31',venue:'centralwOrld Live',...strongDemand};
 const match=Adapter.matchForV2(oct31,Prod.snapshotEvents(snap));
 assert.equal(match.match,null);
 assert.equal(match.ambiguous,true);
 const candidate=Adapter.normalizeCandidate(oct31,snap);
 assert.equal(candidate.exists_in_canonical,false);
 assert.equal(candidate.identity_ambiguous,true);
 assert.equal(candidate.rentability.decision,'HOLD_DATE_SIBLING_IDENTITY');
 const plan=Adapter.buildReadOnlyPlan({month:'2026-10',candidates:[oct31],snapshot:snap});
 assert.equal(plan.selected_count,0);
 assert.equal(plan.production_writes,0);
});
test('explicit documented added-show identity keeps existing original date intact',()=>{
 const snap=snapshot();
 snap.events=[{event_id:'EVT-DAOU-30',event_name:'DAOUOFFROAD HALLOWEEN FAN PARTY 2026',
  event_date:'2026-10-30',venue:'centralwOrld Live',active_on_web:true}];
 snap.bookings=[];
 const oct31={event_key:'DAOU-31',title:'DAOUOFFROAD HALLOWEEN FAN PARTY 2026',
  event_date:'2026-10-31',venue:'centralwOrld Live',
  verified_added_show:true,change_state:'ADDED_SHOW',...strongDemand};
 const match=Adapter.matchForV2(oct31,Prod.snapshotEvents(snap));
 assert.equal(match.match,null);
 assert.equal(match.ambiguous,false);
 const candidate=Adapter.normalizeCandidate(oct31,snap);
 assert.equal(candidate.identity_ambiguous,false);
 assert.equal(candidate.exists_in_canonical,false,'cannot overwrite the existing Oct30 event');
 assert.equal(candidate.current_date,'');
 assert.equal(snap.events[0].event_date,'2026-10-30');
});
test('verified reschedule requires original canonical ID; title overlap is not sufficient',()=>{
 const snap=snapshot();
 snap.events=[{event_id:'EVT-DAOU-30',event_name:'DAOUOFFROAD HALLOWEEN FAN PARTY 2026',
  event_date:'2026-10-30',venue:'centralwOrld Live',active_on_web:true}];
 snap.bookings=[];
 const candidate={event_key:'POSTPONED',title:'DAOUOFFROAD HALLOWEEN FAN PARTY 2026',
  event_date:'2026-11-01',venue:'centralwOrld Live',
  official_date_change_verified:true,change_state:'POSTPONED',
  canonical_event_id:'EVT-DAOU-30',...strongDemand};
 const m=Adapter.matchForV2(candidate,Prod.snapshotEvents(snap));
 assert.equal(m.match.event.event_id,'EVT-DAOU-30');
 assert.equal(m.match.reason,'OFFICIALLY_VERIFIED_DATE_CHANGE');
 assert.equal(Adapter.normalizeCandidate(candidate,snap).canonical_event_id,'EVT-DAOU-30');
 const bad={...candidate,canonical_event_id:'WRONG-EVENT-ID'};
 assert.equal(Adapter.normalizeCandidate(bad,snap).rentability.decision,'HOLD_DATE_SIBLING_IDENTITY');
});
