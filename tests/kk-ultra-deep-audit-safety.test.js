'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const P=require('../server/kk-monthly-deep-scan-query-plan.js');
const Registry=require('../server/kk-ultra-deep-source-registry.js');
const V2=require('../server/kk-ultra-deep-v2-runtime-adapter.js');
const baseSnap=()=>({assets:[{asset_type:'phone',status:'available'},{asset_type:'phone',status:'available'}],bookings:[],events:[],web_ready:[],web_packages:[],visibility_locks:[]});
const highDemand={event_key:'new',title:'New Live Concert',event_date:'2026-11-04',venue:'Hall A',competitor_rental_activity:100,social_engagement:100,ticket_demand:100,fandom_photo_intent:100,venue_capture_value:100,historical_market_rental:100};
test('new event with booking on the same date cannot be selected in V2 despite one device left',()=>{
 const s=baseSnap();s.bookings=[{event_date:'2026-11-04',booking_status:'confirmed',event_id:'other'}];
 const candidate={...highDemand,exact_event_verified:true,official_event_source_verified:true};
 const x=V2.normalizeCandidate(candidate,s);
 assert.equal(x.available_inventory,1);
 assert.equal(x.booking_day_blocked,true);
 assert.equal(x.rentability.decision,'SKIPPED_ACTIVE_BOOKING_DATE');
 const r=V2.buildReadOnlyPlan({month:'2026-11',snapshot:s,candidates:[candidate]});
 assert.equal(r.selected_count,0);
 assert.equal(r.plan.planned_mutation_count,0);
 assert.equal(r.production_writes,0);
});
test('cancelled booking is excluded from the owner day lock',()=>{
 const s=baseSnap();s.bookings=[{event_date:'2026-11-04',booking_status:'cancelled',event_id:'other'}];
 const x=V2.normalizeCandidate(highDemand,s);
 assert.equal(x.booking_day_blocked,false);
 assert.notEqual(x.rentability.decision,'SKIPPED_ACTIVE_BOOKING_DATE');
});
test('owner-hidden locked same-date historical event never gets reintroduced as new V2 sale',()=>{
 const s=baseSnap();
 s.visibility_locks=[{lock_state:'LOCKED',event_name:'New Live Concert',event_date:'2026-11-04',venue:'Hall A'}];
 const x=V2.normalizeCandidate(highDemand,s);
 assert.equal(x.history_lock_blocked,true);
 assert.equal(x.rentability.decision,'SKIPPED_OWNER_HISTORY');
 assert.equal(V2.buildReadOnlyPlan({month:'2026-11',snapshot:s,candidates:[highDemand]}).selected_count,0);
});
test('unverified original event and price proposal cannot become accepted new-create inputs',()=>{
 const s=baseSnap();
 const candidate={...highDemand,source_url:'https://eventpop.me/e/anything'};
 const commercial={candidates:[{event_key:'new',pricing:{proposal:{proposal_available:true,proposed_reference_price:890}},poster:{selected:{verified:true,image_url:'https://example.com/poster.jpg'}}}]};
 const out=V2.normalizeCandidate(candidate,s,commercial.candidates[0]);
 assert.equal(out.exact_event_verified,false);
 assert.equal(out.governed_fallback_price,null);
 const plan=V2.buildReadOnlyPlan({month:'2026-11',snapshot:s,candidates:[candidate],commercial});
 assert.equal(plan.plan.planned_mutation_count,0);
 assert.equal(plan.production_writes,0);
});
test('same artist/title on next day is not silent canonical date move',()=>{
 const existing=[{event_id:'E1',event_name:'New Live Concert',event_date:'2026-11-03',venue:'Hall A'}];
 assert.equal(V2.matchForV2({...highDemand},existing).match,null);
 const correct=V2.matchForV2({...highDemand,existing_event_id:'E1',date_change_verified:true},existing);
 assert.equal(correct.match.event.event_id,'E1');
 assert.equal(correct.match.reason,'VERIFIED_EXPLICIT_CANONICAL_DATE_CHANGE');
});
test('monthly task passes per-source official variants rather than silently dropping them',()=>{
 for(const month of ['2026-10','2026-11','2026-12']){
  const universe=Registry.buildUniversePlan({month});
  const plan=P.build({month});
  for(const id of ['dmd-music-single-showcase','domundi-artist-weekly-schedule','fan-organised-anniversary-gallery','howe-awards-official']){
   const expected=universe.tasks.find(x=>x.source_id===id);
   const actual=plan.gap_tasks.find(x=>x.source_id===id);
   assert.ok(expected&&actual,id);
   assert.deepEqual(actual.query_variants,expected.query_variants,id);
   assert.ok(actual.query_variants.length>=7,id);
  }
  assert.ok(plan.gap_tasks.every(x=>x.production_writes===undefined));
  assert.equal(plan.production_writes,0);
 }
});
test('public social handles use valid host-scoped site operators, never site host plus a path',()=>{
 const p=Registry.buildUniversePlan({month:'2026-10'});
 for(const id of ['dmd-music-single-showcase','domundi-artist-weekly-schedule','fan-organised-anniversary-gallery']){
  const x=p.tasks.find(t=>t.source_id===id);
  assert.ok(x.query.startsWith('site:x.com '),id+':'+x.query);
  assert.ok(!x.query.includes('site:x.com/'),id);
  assert.ok(/@[A-Za-z]+/.test(x.query),id);
 }
});
