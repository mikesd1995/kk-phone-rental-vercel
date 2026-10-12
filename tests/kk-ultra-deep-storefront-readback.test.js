'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const R=require('../server/kk-ultra-deep-storefront-readback.js');

const core=[
 ['event_id','event_name','event_date','venue','poster_image_url','event_status','active_on_web'],
 ['EVT-SHOW','Shown','18/10/2026','Bangkok','','open','TRUE'],
 ['EVT-HIDDEN','Not public','17/10/2026','Bangkok','','open','TRUE'],
 ['EVT-BOOKED','Other event','18/10/2026','Bangkok','x','open','FALSE']
];
const web=[
 ['event_id','event_name','event_date_text','venue','poster_image_url','event_note','available_phone_count','available_lens_count','booking_status_for_web','action_for_web'],
 ['EVT-SHOW','Shown','18/10/2026','Bangkok','','','1','1','open','show'],
 ['EVT-HIDDEN','Not public','17/10/2026','Bangkok','','','0','0','hide','hide'],
 ['EVT-BOOKED','Other event','18/10/2026','Bangkok','x','','0','0','hide','hide']
];
const bookings=[
 ['booking_id','created_at','booking_status','event_id','event_date'],
 ['BOOK-1','','confirmed','EVT-BOOKED','18/10/2026'],
 ['BOOK-2','','cancelled','EVT-HIDDEN','17/10/2026']
];

test('do not conflate Core active flag with effective public action',()=>{
 const r=R.audit({core_rows:core,web_ready_rows:web,booking_rows:bookings,as_of_date:'2026-10-12'});
 assert.equal(r.counts.core_active,2);
 assert.equal(r.counts.effective_public_visible,1);
 assert.equal(r.counts.core_active_not_public,1);
 assert.equal(r.core_active_not_public[0].event_id,'EVT-HIDDEN');
 assert.equal(r.safety.auto_unhide,false);
 assert.equal(r.safety.production_writes,0);
});
test('public missing posters exclude suppressed Core rows',()=>{
 const r=R.audit({core_rows:core,web_ready_rows:web,booking_rows:bookings,as_of_date:'2026-10-12'});
 assert.equal(r.counts.public_missing_canonical_posters,1);
 assert.equal(r.public_missing_canonical_posters[0].event_id,'EVT-SHOW');
});
test('one booked event locks the calendar day for another public event',()=>{
 const r=R.audit({core_rows:core,web_ready_rows:web,booking_rows:bookings,as_of_date:'2026-10-12'});
 assert.equal(r.protected_dates.length,1);
 assert.equal(r.protected_dates[0].date,'2026-10-18');
 assert.equal(r.counts.public_future_on_booked_date,1);
 assert.equal(r.public_future_booked_date_locks[0].event_id,'EVT-SHOW');
 assert.equal(r.safety.pricing_write_authorized,false);
});
test('actual cancelled booking does not lock a date',()=>{
 const r=R.audit({core_rows:core,web_ready_rows:web,booking_rows:bookings,as_of_date:'2026-10-12'});
 assert.equal(r.protected_dates.some(x=>x.date==='2026-10-17'),false);
});
test('unknown/invalid date or source table never certifies safety',()=>{
 assert.throws(()=>R.audit({core_rows:core,web_ready_rows:web,booking_rows:bookings,as_of_date:'2026-10-99'}));
 assert.throws(()=>R.audit({core_rows:[],web_ready_rows:web,booking_rows:bookings,as_of_date:'2026-10-12'}));
 assert.equal(R.isoDate('31/02/2026'),'');
});
test('current/future boundary and public sold-out remain visible',()=>{
 const extra=[...web,['EVT-FULL','Full','31/10/2026','Bangkok','official','','0','0','fully booked','show_full']];
 const r=R.audit({core_rows:core,web_ready_rows:extra,booking_rows:bookings,as_of_date:'2026-10-12'});
 assert.equal(r.counts.effective_public_visible,2);
 assert.equal(r.counts.public_current_or_future,2);
 assert.equal(r.counts.owner_core_hidden_but_public,1);
});

test('an active booking with unknown event/date raises unresolved risk, never certifies an unbooked day',()=>{
 const b=[...bookings,['BOOK-UNKNOWN','','pending','EVT-NOT-IN-CORE','']];
 const r=R.audit({core_rows:core,web_ready_rows:web,booking_rows:b,as_of_date:'2026-10-12'});
 assert.equal(r.status,'READ_ONLY_AUDIT_WITH_UNRESOLVED_BOOKINGS');
 assert.equal(r.counts.unresolved_active_booking_dates,1);
 assert.equal(r.integrity.unresolved_active_booking_dates[0].event_id,'EVT-NOT-IN-CORE');
 assert.equal(r.safety.pricing_write_authorized,false);
});
