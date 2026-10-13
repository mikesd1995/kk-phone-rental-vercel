'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const B=require('../server/kk-ultra-deep-backscan-miss-review.js');
const Learning=require('../server/kk-ultra-deep-v2-learning-agent.js');

function snapshot(){
 return {
  as_of:'2026-10-13T17:25:00+07:00',
  events:[
   {event_id:'EVT-20261026-ZATO-BASE-022-BLACKBEANS',event_name:'ZATO PRESENTS BASE 022 : Blackbeans SPECIAL SHOW',event_date:'26/10/2026',active_on_web:'FALSE'},
   {event_id:'EVT-20261030-SIAM-HALLOWEEN-2026',event_name:'SIAM HALLOWEEN 2026 — Flex 104.5 × PMCU',event_date:'30/10/2026',active_on_web:'TRUE'},
   {event_id:'EVT-20261024-LYKN-REFLEXION-CONCERT',event_name:'LYKN REFLEXION CONCERT',event_date:'24/10/2026',active_on_web:'TRUE'}
  ],
  web_ready:[
   {event_id:'EVT-20261026-ZATO-BASE-022-BLACKBEANS',action_for_web:'hide'},
   {event_id:'EVT-20261030-SIAM-HALLOWEEN-2026',action_for_web:'show'},
   {event_id:'EVT-20261024-LYKN-REFLEXION-CONCERT',action_for_web:'show'}
  ],
  tracker_candidates:[
   {'Event Name / Keyword':'Melody Of Life 17 — Day 16','Suspected Event Date':'16 Oct 2026 — noon onwards','Status':'HOLD'},
   {'Event Name / Keyword':'LenaMiu at EVEANDBOY The New Underground','Suspected Event Date':'2026-10-26','Status':'VERIFIED_HOLD'},
   {'Event Name / Keyword':'EVERPINK A Touch of Love with TleFirstOne','Suspected Event Date':'2026-10-22','Status':'VERIFIED_HOLD'}
  ],
  tracker_monthly:[
   {'ชื่องาน':'PERSONA LIVE TOUR 2026 — Resonance','วันที่งานจัด':'27 ต.ค. 2569','Status':'HOLD'},
   {'ชื่องาน':'Melody Of Life 17 — Day 16','วันที่งานจัด':'16 ต.ค. 2569','Status':'HOLD'}
  ],
  miss_learning:[],
  bookings:[{event_id:'EVT-20261024-LYKN-REFLEXION-CONCERT',booking_status:'confirmed',customer_name:'PRIVATE-NOT-IN-REPORT'}],
  visibility_locks:[{event_id:'EVT-20261026-ZATO-BASE-022-BLACKBEANS',lock_state:'LOCKED'}],
  owner_exclusive_dates:['17 ต.ค. 2569','18 ต.ค. 2569','23 ต.ค. 2569','31 ต.ค. 2569']
 };
}
function get(plan,id){const item=plan.cases.find(x=>x.case_id===id);assert.ok(item,id);return item;}

test('October backscan historical corpus has separate brand, venue, free-stage and ticketing cases',()=>{
 const ids=B.BACKSCAN_CASES.map(x=>x.case_id);
 assert.ok(ids.length>=12);
 assert.equal(new Set(ids).size,ids.length);
 for(const id of ['guerlain-blue-20261015','onitsuka-popup-20261015','kebdao-miu-20261019',
  'melody-life17-20261016','persona-bangkok-20261027','zato-blackbeans-20261026'])assert.ok(ids.includes(id));
 assert.equal(B.dateOf('27 ต.ค. 2569'),'2026-10-27');
 assert.equal(B.dateOf('16 Oct 2026 — noon onwards'),'2026-10-16');
 assert.equal(B.dateOf('2026-10-16T17:00:00+07:00'),'2026-10-16');
 assert.equal(B.dateOf('31 ก.พ. 2569'),'');
});
test('unverified brand appearance becomes proposed Miss review only, not learned or sellable',()=>{
 const s=snapshot(),out=B.review(s),g=get(out,'guerlain-blue-20261015');
 assert.equal(out.status,'STAGED_REVIEW_ONLY');
 assert.equal(g.disposition,'DISCOVERY_REVIEW_NOT_IN_TRACKER');
 assert.equal(g.core_count,0);assert.equal(g.candidate_count,0);
 const p=out.proposals.find(x=>x['Miss ID']===g.proposed_miss_id);
 assert.ok(p);assert.equal(p.Status,'PROPOSED_REVIEW_NOT_LEARNED');
 assert.equal(p['Root Cause'],'UNDETERMINED_AWAIT_SCANNER_AND_VERIFIER_RECEIPTS');
 assert.equal(p['Learned At'],'');
 assert.equal(g.training_eligible,false);
 assert.equal(out.authority.may_write_tracker,false);
 assert.equal(out.authority.may_publish,false);
 assert.equal(out.authority.production_writes,0);
});
test('same-day artist brand appearances remain distinct events; never dedup merely on the artist',()=>{
 const out=B.review(snapshot());
 const a=get(out,'guerlain-blue-20261015'),b=get(out,'onitsuka-popup-20261015');
 assert.notEqual(a.proposed_miss_id,b.proposed_miss_id);
 assert.equal(a.disposition,'DISCOVERY_REVIEW_NOT_IN_TRACKER');
 assert.equal(b.disposition,'HOLD_SOURCE_VENUE_CONFLICT');
 assert.equal(b.blocked_reason,'VENUE_PRIMARY_CONFLICT');
});
test('two contradictory KEB DAO venue claims fail closed',()=>{
 const out=B.review(snapshot()),p=get(out,'kebdao-miu-20261019');
 assert.equal(p.disposition,'HOLD_SOURCE_VENUE_CONFLICT');
 const proposal=out.proposals.find(x=>x['Miss ID']===p.proposed_miss_id);
 assert.equal(proposal.Venue,'CONFLICT_HOLD');
 assert.equal(proposal['Registry Action'],'REVIEW_ONLY_NO_AUTO_TRAIN');
});
test('ticketing PERSONA already in monthly Tracker: conversion gap not scanner discovery miss',()=>{
 const out=B.review(snapshot()),e=get(out,'persona-bangkok-20261027');
 assert.equal(e.disposition,'TRACKER_TO_CORE_REVIEW');
 assert.equal(e.monthly_count,1);assert.equal(e.candidate_count,0);
 const proposal=out.proposals.find(x=>x['Miss ID']===e.proposed_miss_id);
 assert.equal(proposal['Miss Reason'],'KNOWN_IN_TRACKER_NOT_IN_CORE');
 assert.equal(e.source_primary_verified,false,'an event/ticket URL is not photography authority');
});
test('Melody organizer stage playlist already known to Candidate and Monthly, no false discovery gap',()=>{
 const out=B.review(snapshot()),e=get(out,'melody-life17-20261016');
 assert.equal(e.disposition,'TRACKER_TO_CORE_REVIEW');
 assert.equal(e.monthly_count,1);assert.equal(e.candidate_count,1);
 assert.equal(e.may_create_core,false);
});
test('known Brand lucky-fan and LenaMiu Candidate leads stay verifier HOLD, never auto-publish',()=>{
 const out=B.review(snapshot());
 for(const id of ['everpink-tlefirstone-20261022','lenamiu-eveandboy-20261026']){
  const x=get(out,id);assert.equal(x.disposition,'TRACKER_TO_CORE_REVIEW');assert.equal(x.may_publish,false);
 }
});
test('hidden or owner locked Core events and already shown Core are not re-added to Miss Learning',()=>{
 const out=B.review(snapshot());
 const zato=get(out,'zato-blackbeans-20261026');
 assert.equal(zato.disposition,'EXISTING_CORE_OWNER_LOCKED');
 assert.equal(zato.proposal,false);
 const siam=get(out,'siam-halloween-20261030');
 assert.equal(siam.disposition,'EXISTING_CORE_ALREADY_PRESENT');
 assert.equal(siam.proposal,false);
});
test('booking day exclusivity blocks unrelated extra lead even when one physical phone remains',()=>{
 const s=snapshot();
 s.cases=[{case_id:'other-show-20261024',title:'A different show with one free phone',date:'2026-10-24',sources:['https://example.org/official']}];
 const out=B.review(s),e=get(out,'other-show-20261024');
 assert.equal(e.disposition,'REPORT_ONLY_PROTECTED_BOOKING_DAY');
 assert.equal(e.proposal,false);
 assert.ok(out.booked_dates.includes('2026-10-24'));
});
test('unresolved active booking event ID holds entire backscan rather than risk duplicate rental day',()=>{
 const s=snapshot();
 s.bookings.push({event_id:'BOOKING-EVENT-MISSING-FROM-CORE',booking_status:'confirmed'});
 const out=B.review(s);
 assert.ok(out.cases.every(x=>x.disposition==='HOLD_UNRESOLVED_BOOKINGS'));
 assert.equal(out.proposal_count,0);
});
test('historical date after the backscan cannot be re-opened',()=>{
 const s=snapshot();
 s.as_of='2026-10-15';
 const out=B.review(s),e=get(out,'weeknd-boat-party-20261014');
 assert.equal(e.disposition,'REPORT_ONLY_PAST_DATE');
 assert.equal(e.proposal,false);
});
test('same Miss ID in existing _Miss_Learning is idempotent and cannot stage another row',()=>{
 const s=snapshot();
 const c=B.BACKSCAN_CASES.find(x=>x.case_id==='guerlain-blue-20261015');
 s.miss_learning=[{'Miss ID':B.missId(c),'Event Name':c.title,'Event Date':c.date,Status:'PROPOSED_REVIEW_NOT_LEARNED'}];
 const out=B.review(s),e=get(out,c.case_id);
 assert.equal(e.prior_miss_count,1);
 assert.equal(e.proposal,false);
 assert.equal(out.proposals.some(x=>x['Miss ID']===B.missId(c)),false);
});
test('same artist on another event date is not a canonical Core hit; conflicting duplications HOLD',()=>{
 const s=snapshot();
 s.events.push({event_id:'EVT-OTHER',event_name:'PERSONA LIVE TOUR 2026 — Resonance',event_date:'26/10/2026'});
 const out=B.review(s);
 assert.equal(get(out,'persona-bangkok-20261027').core_count,0);
 s.events.push({event_id:'EVT-PERSONA-1',event_name:'PERSONA LIVE TOUR 2026 — Resonance',event_date:'27/10/2026'});
 s.events.push({event_id:'EVT-PERSONA-2',event_name:'PERSONA LIVE TOUR 2026 — Resonance',event_date:'27/10/2026'});
 assert.equal(get(B.review(s),'persona-bangkok-20261027').disposition,'HOLD_CORE_DUPLICATE_IDENTITY');
});
test('all required snapshot surfaces and a valid as-of date are mandatory',()=>{
 const s=snapshot();delete s.miss_learning;
 const p=B.review(s);assert.equal(p.status,'HOLD_INCOMPLETE_SNAPSHOT');
 assert.equal(p.proposal_count,0);assert.equal(p.authority.may_mark_learned,false);
 const invalid=snapshot();invalid.as_of='not-a-date';
 assert.equal(B.review(invalid).status,'HOLD_INCOMPLETE_SNAPSHOT');
});
test('read-only review leaves booking PII and original input unchanged',()=>{
 const s=snapshot(),before=JSON.stringify(s);
 const out=B.review(s);
 assert.equal(JSON.stringify(s),before);
 assert.equal(JSON.stringify(out).includes('PRIVATE-NOT-IN-REPORT'),false);
 assert.equal(out.authority.may_modify_booking,false);
 assert.equal(out.authority.may_modify_price,false);
});
test('Learning Agent receives review proposals without adapting source strategies or marking any real miss learned',()=>{
 const out=Learning.learn({backscan_review_snapshot:snapshot()});
 assert.equal(out.status,'BACKSCAN_REVIEW_PENDING');
 assert.equal(out.backscan_learning_accepted,false);
 assert.ok(out.backscan_miss_learning.proposal_count>=5);
 assert.equal(out.change_log.missed_events,0);
 assert.ok(out.change_log.backscan_review_proposals>0);
 assert.deepEqual(out.adaptive.query_terms,[]);
 assert.deepEqual(out.adaptive.miss_classes,[]);
 assert.equal(out.authority.may_mark_backscan_as_verified_miss,false);
 assert.equal(out.authority.production_writes,0);
});

test('local Backscan CLI is explicitly read-only: no write, deploy, publish or price flags',()=>{
 const CLI=require('../scripts/kk-ultra-deep-backscan-miss-review.js');
 assert.deepEqual(CLI.parseArgs(['--snapshot-json','./safe-oct-snapshot.json','--as-of','2026-10-13']),{
  'snapshot-json':'./safe-oct-snapshot.json','as-of':'2026-10-13'
 });
 for(const flag of ['--write','--deploy','--publish','--reprice','--commit'])
  assert.throws(()=>CLI.parseArgs(['--snapshot-json','data.json',flag,'true']),/READ_ONLY_FLAGS_ONLY/);
 assert.throws(()=>CLI.parseArgs([]),/SNAPSHOT_REQUIRED/);
});

test('case catalog cannot be mutated and empty/manual malformed case sets fail closed',()=>{
 const canonical=B.BACKSCAN_CASES[0].title;
 assert.equal(Object.isFrozen(B.BACKSCAN_CASES),true);
 assert.equal(Object.isFrozen(B.BACKSCAN_CASES[0]),true);
 assert.equal(Object.isFrozen(B.BACKSCAN_CASES[0].sources),true);
 assert.throws(()=>{B.BACKSCAN_CASES[0].title='TAMPERED';},TypeError);
 assert.equal(B.BACKSCAN_CASES[0].title,canonical);
 const empty=snapshot();empty.cases=[];
 assert.equal(B.review(empty).status,'HOLD_INCOMPLETE_SNAPSHOT');
 assert.equal(B.review(empty).proposal_count,0);
 const bad=snapshot();bad.cases=[null];
 assert.equal(B.review(bad).cases[0].disposition,'HOLD_INVALID_OR_DUPLICATE_CASE');
 assert.equal(B.review(bad).proposal_count,0);
});
