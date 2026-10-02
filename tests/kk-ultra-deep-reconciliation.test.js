'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const R=require('../server/kk-ultra-deep-reconciliation.js');

test('independent reference event missing from discovery is a reconciliation gap',()=>{
 const out=R.reconcileCandidateSets(
  [{title:'Found Event',event_date:'2026-10-01'}],
  [{reference_id:'r1',title:'Found Event',event_date:'2026-10-01'},{reference_id:'r2',title:'Missed Event',event_date:'2026-10-02'}]
 );
 assert.equal(out.reconciliation_gap_count,1);
 assert.equal(out.complete,false);
 assert.equal(out.missing_candidates[0].reference_id,'r2');
});

test('SOT classifier blocks tombstone resurrection and booked repricing',()=>{
 const candidates=[{candidate_id:'a',title:'Hidden Event',event_date:'2026-10-03'},{candidate_id:'b',title:'Booked Event',event_date:'2026-10-04'}];
 const out=R.classifyAgainstSot(candidates,{
   events:[
    {event_id:'E1',event_name:'Hidden Event',event_date:'03/10/2026',active_on_web:false},
    {event_id:'E2',event_name:'Booked Event',event_date:'04/10/2026',active_on_web:true}
   ],
   visibility_locks:[{event_id:'E1',locked:true}],
   bookings:[{event_id:'E2',booking_status:'confirmed'}]
 });
 assert.equal(out[0].classification,'TOMBSTONED');
 assert.equal(out[0].allow_auto_create,false);
 assert.equal(out[0].allow_auto_reprice,false);
 assert.equal(out[1].classification,'BOOKED');
 assert.equal(out[1].allow_auto_reprice,false);
});

test('reference search pages without a verified event date are evidence but not reconciliation gaps',()=>{
 const out=R.reconcileCandidateSets(
  [{title:'Found Event',event_date:'2026-10-01'}],
  [
   {reference_id:'r1',title:'Found Event',event_date:'2026-10-01'},
   {reference_id:'search-page',title:'Bangkok Concerts October 2026',event_date:null,source_url:'https://example.com/calendar'}
  ]
 );
 assert.equal(out.complete,true);
 assert.equal(out.reconciliation_gap_count,0);
 assert.equal(out.reference_count,1);
 assert.equal(out.raw_reference_count,2);
 assert.equal(out.unstructured_reference_count,1);
});

test('normalization collapses real whitespace so independently formatted titles reconcile',()=>{
 const out=R.reconcileCandidateSets(
  [{title:'Artist   Fan\nMeeting',event_date:'2026-10-25'}],
  [{reference_id:'r1',title:'Artist Fan Meeting',event_date:'2026-10-25'}]
 );
 assert.equal(out.complete,true);
 assert.equal(out.reconciliation_gap_count,0);
});

test('dated independent event remains a hard reconciliation gap',()=>{
 const out=R.reconcileCandidateSets(
  [{title:'Other Event',event_date:'2026-10-01'}],
  [{reference_id:'r2',title:'Missed Event',event_date:'2026-10-02'}]
 );
 assert.equal(out.complete,false);
 assert.equal(out.reconciliation_gap_count,1);
});

test('reconciliation fails closed when independent reference evidence has no structured event identity',()=>{
 const out=R.reconcileCandidateSets(
  [{title:'Found Event',event_date:'2026-10-01'}],
  [{reference_id:'calendar',title:'Bangkok concerts October 2026',event_date:null}]
 );
 assert.equal(out.complete,false);
 assert.equal(out.reconciliation_gap_count,0);
 assert.equal(out.reference_count,0);
 assert.equal(out.unstructured_reference_count,1);
});

test('ineligible structured reference cannot create a gap or satisfy independent-reference proof',()=>{
 const excludedOnly=R.reconcileCandidateSets(
  [{title:'Found Event',event_date:'2026-10-01'}],
  [{reference_id:'foreign',title:'Foreign Concert',event_date:'2026-10-01',eligible_for_discovery:false}]
 );
 assert.equal(excludedOnly.complete,false);
 assert.equal(excludedOnly.reconciliation_gap_count,0);
 assert.equal(excludedOnly.reference_count,0);
 assert.equal(excludedOnly.structured_reference_count,1);
 assert.equal(excludedOnly.excluded_reference_count,1);

 const mixed=R.reconcileCandidateSets(
  [{title:'Bangkok Fanmeeting',event_date:'2026-10-20'}],
  [
   {reference_id:'foreign',title:'Foreign Concert',event_date:'2026-10-01',eligible_for_discovery:false},
   {reference_id:'local',title:'Bangkok Fanmeeting',event_date:'2026-10-20',eligible_for_discovery:true}
  ]
 );
 assert.equal(mixed.complete,true);
 assert.equal(mixed.reference_count,1);
 assert.equal(mixed.excluded_reference_count,1);
});

test('multi-day event series canonicalization still requires the exact expanded date',()=>{
 const discovered13=[{
   title:'The Weeknd: After Hours Til Dawn Tour, Bangkok, Tue, 13 Oct 2026...',
   event_date:'2026-10-13'
 }];
 const reference12=[{
   reference_id:'weeknd-12',
   title:'The Weeknd: After Hours Til Dawn Tour, Bangkok, Mon, 12 Oct 2026...',
   event_date:'2026-10-12',
   eligible_for_discovery:true
 }];
 const stillMissing=R.reconcileCandidateSets(discovered13,reference12);
 assert.equal(stillMissing.reconciliation_gap_count,1);

 const expanded=[...discovered13,{
   title:'The Weeknd: After Hours Til Dawn Tour, Bangkok, Tue, 13 Oct 2026...',
   event_date:'2026-10-12'
 }];
 const matched=R.reconcileCandidateSets(expanded,reference12);
 assert.equal(matched.complete,true);
 assert.equal(matched.reconciliation_gap_count,0);
});

test('series title removes only date-location boilerplate for official search titles',()=>{
 assert.equal(
   R.eventSeriesTitle('The Weeknd: After Hours Til Dawn Tour, Bangkok, Tue, 13 Oct 2026...'),
   R.eventSeriesTitle('The Weeknd: After Hours Til Dawn Tour, Bangkok, Mon, 12 Oct 2026...')
 );
 assert.notEqual(
   R.eventSeriesTitle('The Weeknd: After Hours Til Dawn Tour'),
   R.eventSeriesTitle('Young K Solo Tour <YOUNGEST> in BANGKOK')
 );
});



test('same exact HTTPS source URL plus exact date reconciles search-title truncation',()=>{
 const discovered=[{title:'The Weeknd: After Hours Til Dawn Tour, Bangkok, Sun, 11 Oct 2026...',event_date:'2026-10-11',source_url:'https://www.livenationtero.co.th/en/event/the-weeknd-after-hours-til-dawn-tour-bangkok-tickets-edp1672772'}];
 const reference=[{title:'The Weeknd: After Hours Til Dawn Tour, Bangkok, Sun, 11 Oct ...',event_date:'2026-10-11',source_url:'https://www.livenationtero.co.th/en/event/the-weeknd-after-hours-til-dawn-tour-bangkok-tickets-edp1672772'}];
 const out=R.reconcileCandidateSets(discovered,reference);
 assert.equal(out.complete,true);assert.equal(out.reconciliation_gap_count,0);assert.equal(out.matched_count,1);
});

test('same source URL never reconciles a different exact date',()=>{
 const discovered=[{title:'Example Concert 11 Oct',event_date:'2026-10-11',source_url:'https://example.com/event/1'}];
 const reference=[{title:'Example Concert 12 Oct',event_date:'2026-10-12',source_url:'https://example.com/event/1'}];
 const out=R.reconcileCandidateSets(discovered,reference);
 assert.equal(out.complete,false);assert.equal(out.reconciliation_gap_count,1);
});
