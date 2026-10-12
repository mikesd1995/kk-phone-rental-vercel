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
 ['EVT-SHOW','Shown','18/10/2026','Bangkok','','','0','0','fully booked','show_full'],
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

test('Core/Web Ready date disagreement is explicit fail-closed source integrity risk',()=>{
 const altered=web.map(r=>r[0]==='EVT-SHOW'?[...r.slice(0,2),'19/10/2026',...r.slice(3)]:r);
 const result=R.audit({core_rows:core,web_ready_rows:altered,booking_rows:bookings,as_of_date:'2026-10-12'});
 assert.equal(result.status,'READ_ONLY_AUDIT_WITH_INTEGRITY_CONFLICTS');
 assert.equal(result.counts.source_date_conflicts,1);
 assert.equal(result.integrity.source_date_conflicts[0].event_id,'EVT-SHOW');
 assert.equal(result.safety.production_writes,0);
});
test('active Booking explicit date conflicting with Core raises lock provenance review',()=>{
 const changed=bookings.map(r=>r[0]==='BOOK-1'?[...r.slice(0,4),'19/10/2026']:r);
 const result=R.audit({core_rows:core,web_ready_rows:web,booking_rows:changed,as_of_date:'2026-10-12'});
 assert.equal(result.status,'READ_ONLY_AUDIT_WITH_INTEGRITY_CONFLICTS');
 assert.equal(result.counts.booking_date_conflicts,1);
 assert.equal(result.integrity.booking_date_conflicts[0].event_id,'EVT-BOOKED');
 assert.equal(result.safety.pricing_write_authorized,false);
});
test('public rows without resolvable date and duplicated IDs never yield clean acceptance',()=>{
 const unknown=[...web,['EVT-NODATE','Date unknown','n/a','Bangkok','official','','0','0','open','show']];
 const result=R.audit({core_rows:core,web_ready_rows:unknown,booking_rows:bookings,as_of_date:'2026-10-12'});
 assert.equal(result.status,'READ_ONLY_AUDIT_WITH_INTEGRITY_CONFLICTS');
 assert.equal(result.counts.public_unresolved_event_dates,1);
 const duplicates=R.audit({core_rows:core,web_ready_rows:[...web,web[1]],booking_rows:bookings,as_of_date:'2026-10-12'});
 assert.equal(duplicates.status,'READ_ONLY_AUDIT_WITH_INTEGRITY_CONFLICTS');
 assert.equal(duplicates.counts.web_duplicate_ids,1);
});

test('current owner-approved branded temporary images remain explicit official-poster HOLD',()=>{
 const temp=R.TEMP_BRAND_POSTER_URL;
 const rows=web.map(row=>row[0]==='EVT-SHOW'?[...row.slice(0,4),temp,...row.slice(5)]:row);
 const result=R.audit({core_rows:core,web_ready_rows:rows,booking_rows:bookings,as_of_date:'2026-10-12'});
 assert.equal(result.status,'READ_ONLY_AUDIT_WITH_TEMPORARY_POSTERS');
 assert.equal(result.counts.public_missing_canonical_posters,0);
 assert.equal(result.counts.public_temporary_brand_posters,1);
 assert.equal(result.counts.public_awaiting_official_posters,1);
 assert.equal(result.public_temporary_brand_posters[0].event_id,'EVT-SHOW');
 assert.equal(result.safety.production_writes,0);
});
test('temporary brand artwork recognizer does not misclassify official poster or spoof hostname',()=>{
 assert.equal(R.temporaryPoster(R.TEMP_BRAND_POSTER_URL),true);
 assert.equal(R.temporaryPoster(R.TEMP_BRAND_POSTER_URL+'?ref=temporary'),true);
 assert.equal(R.temporaryPoster('https://attacker.invalid/assets/kk-brand-hero-final-20260920.png'),false);
 assert.equal(R.temporaryPoster('https://example.org/real-official-event.jpg'),false);
});

test('a publicly displayed SOURCE_DATE_UNVERIFIED Core event emits integrity HOLD',()=>{
 const healthCore=core.map((row,i)=>i===0?
  [...row,'event_note','data_health']:
  [...row,'',row[0]==='EVT-HIDDEN'?'SOURCE_DATE_UNVERIFIED':'OK']);
 const hidden=R.audit({core_rows:healthCore,web_ready_rows:web,booking_rows:bookings,as_of_date:'2026-10-12'});
 assert.equal(hidden.counts.public_unverified_source_dates,0);
 const publicRows=web.map(row=>row[0]==='EVT-HIDDEN'?[...row.slice(0,9),'show']:row);
 const displayed=R.audit({core_rows:healthCore,web_ready_rows:publicRows,booking_rows:bookings,as_of_date:'2026-10-12'});
 assert.equal(displayed.status,'READ_ONLY_AUDIT_WITH_INTEGRITY_CONFLICTS');
 assert.equal(displayed.counts.public_unverified_source_dates,1);
 assert.equal(displayed.integrity.public_unverified_source_dates[0].event_id,'EVT-HIDDEN');
 assert.equal(displayed.safety.auto_unhide,false);
});

test('Google Sheets integer date serial is treated as a real booking date, never ignored',()=>{
 assert.equal(R.isoDate('46318'),'2026-10-23');
 assert.equal(R.isoDate(46318),'2026-10-23');
 assert.equal(R.isoDate('46318.0'),'2026-10-23');
 assert.equal(R.isoDate('46326'),'2026-10-31');
 assert.equal(R.isoDate('2026-10-23'),'2026-10-23');
 assert.equal(R.isoDate('23/10/2026'),'2026-10-23');
 assert.equal(R.isoDate('123'),'');
 const b=[...bookings,['BOOK-SERIAL','','confirmed','EVT-BOOKED','46313']];
 const result=R.audit({core_rows:core,web_ready_rows:web,booking_rows:b,as_of_date:'2026-10-12'});
 assert.equal(result.counts.booking_date_conflicts,0);
 const wrong=[...bookings,['BOOK-SERIAL','','confirmed','EVT-BOOKED','46318']];
 const mismatch=R.audit({core_rows:core,web_ready_rows:web,booking_rows:wrong,as_of_date:'2026-10-12'});
 assert.equal(mismatch.counts.booking_date_conflicts,1);
 assert.equal(mismatch.status,'READ_ONLY_AUDIT_WITH_INTEGRITY_CONFLICTS');
});
test('nonbooked public cards on an active booking date are flagged without changing visibility or prices',()=>{
 const withWaitlist=[...web,['EVT-WAITLIST','Another event','18/10/2026','Bangkok','official','','0','0','full','show_full']];
 const r=R.audit({core_rows:core,web_ready_rows:withWaitlist,booking_rows:bookings,as_of_date:'2026-10-12'});
 assert.equal(r.counts.public_other_events_on_booked_date,2);
 assert.equal(r.counts.public_other_events_on_booked_date_with_stock,0);
 const soldOut=r.public_other_events_on_booked_date.find(e=>e.event_id==='EVT-WAITLIST');
 assert.equal(soldOut.classification,'REVIEW_BOOKED_DATE_NONBOOKED_EVENT_WAITLIST_ONLY');
 assert.equal(soldOut.available_phone_count,0);
 assert.equal(r.safety.auto_unhide,false);
 assert.equal(r.safety.production_writes,0);
 assert.equal(r.safety.price_writes,0);
});

test('booked-day nonbooked event with rentable stock is an integrity conflict, not a normal waitlist',()=>{
 const changed=web.map(row=>row[0]==='EVT-SHOW'?[...row.slice(0,6),'1','0','open','show']:row);
 const r=R.audit({core_rows:core,web_ready_rows:changed,booking_rows:bookings,as_of_date:'2026-10-12'});
 assert.equal(r.status,'READ_ONLY_AUDIT_WITH_INTEGRITY_CONFLICTS');
 assert.equal(r.counts.public_other_events_on_booked_date_with_stock,1);
 assert.equal(r.integrity.booked_date_other_event_rentable_exposure_ids[0],'EVT-SHOW');
 assert.equal(r.safety.auto_unhide,false);
 assert.equal(r.safety.production_writes,0);
 assert.equal(r.safety.price_writes,0);
 const baseline=R.audit({core_rows:core,web_ready_rows:web,booking_rows:bookings,as_of_date:'2026-10-12'});
 assert.equal(baseline.counts.public_other_events_on_booked_date,1);
 assert.equal(baseline.counts.public_other_events_on_booked_date_with_stock,0);
 assert.equal(baseline.integrity.booked_date_other_event_rentable_exposure_ids.length,0);
});

test('historical completed bookings without handover-return-upload evidence report gaps, never retroactively change Actual',()=>{
 const h=['booking_id','booking_status','event_id','event_date','payment_status','amount_received','return_status','file_transfer_status','drive_link'];
 const b=[
  h,
  ['B-COMPLETE','completed','EVT-SHOW','18/10/2026','paid','1,090','','',''],
  ['B-PROVEN','completed','EVT-SHOW','18/10/2026','paid','790','returned','uploaded','https://drive.google.com/drive/folders/abc'],
  ['B-QUOTE','confirmed','EVT-SHOW','18/10/2026','unpaid','890','','',''],
  ['B-CANCEL','cancelled','EVT-SHOW','18/10/2026','paid','590','','','']
 ];
 const r=R.audit({core_rows:core,web_ready_rows:web,booking_rows:b,as_of_date:'2026-10-12'});
 const l=r.booking_lifecycle_evidence;
 assert.equal(l.completed_total,2);
 assert.equal(l.completed_missing_proof,1);
 assert.equal(l.gaps[0].booking_id,'B-COMPLETE');
 assert.equal(l.gaps[0].missing_evidence.includes('FILE_UPLOAD_NOT_VERIFIED'),true);
 assert.equal(l.gaps[0].missing_evidence.includes('GOOGLE_DRIVE_LINK_MISSING_OR_UNVERIFIED'),true);
 assert.equal(l.confirmed_unpaid_amount_ambiguous,1);
 assert.equal(l.cancelled_paid_review,1);
 assert.equal(l.status,'EVIDENCE_GAPS_REVIEW_REQUIRED');
 assert.equal(l.safety.auto_complete,false);
 assert.equal(l.safety.production_writes,0);
 assert.equal(l.safety.actual_revenue_status_rule,'completed_only');
});
test('missing lifecycle columns never yields a clean evidence certificate',()=>{
 const r=R.audit({core_rows:core,web_ready_rows:web,booking_rows:bookings,as_of_date:'2026-10-12'});
 assert.equal(r.booking_lifecycle_evidence.status,'NOT_VERIFIABLE_SCHEMA');
 assert.equal(r.booking_lifecycle_evidence.completed_missing_proof,null);
 assert.equal(r.booking_lifecycle_evidence.missing_columns.includes('drive_link'),true);
});
