'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Q=require('../server/kk-monthly-deep-scan-query-plan.js');
const Prod=require('../server/kk-ultra-deep-production-runtime.js');
const Adapter=require('../server/kk-ultra-deep-v2-runtime-adapter.js');

const months=['2026-10','2026-11','2026-12'];
test('monthly deep scan searches ticketed crossover, BL/GL premiere and artist OST across all three months',()=>{
 for(const month of months){
  const p=Q.build({month});
  assert.equal(p.range.month,month);
  assert.ok(p.required_tiers.includes('FAN_EVENT'));
  const fan=p.gap_tasks.filter(t=>t.source_tier==='FAN_EVENT');
  assert.ok(fan.some(t=>/crossover concert/.test(t.query)));
  assert.ok(fan.some(t=>/grand premiere series screening OST/.test(t.query)));
  assert.ok(fan.some(t=>/ครอสโอเวอร์/.test(t.query)));
  assert.equal(p.production_writes,0);
  assert.equal(p.verifier_required,true);
 }
});
test('Smart Operational searches Eventpop crossover and TTM premiere with bounded month-aware variants',()=>{
 for(const month of months){
  const p=Q.buildOperational({month});
  const tk=p.gap_tasks.find(t=>t.source_tier==='TICKETING');
  const fe=p.gap_tasks.find(t=>t.source_tier==='FAN_EVENT');
  const ar=p.gap_tasks.find(t=>t.source_tier==='ARTIST_AGENCY');
  assert.ok(tk.query_variants.some(q=>q.includes('site:eventpop.me/e')&&q.includes('crossover')));
  assert.ok(tk.query_variants.some(q=>q.includes('site:thaiticketmajor.com')&&q.includes('premiere')));
  assert.ok(fe.query_variants.some(q=>q.includes('BL GL grand premiere')));
  assert.ok(ar.query_variants.some(q=>q.includes('GMMTV CHANGE2561')));
  for(const t of [tk,fe,ar]){
   assert.equal(t.query_variants.length,3);
   assert.deepEqual(t.date_window,{start:month+'-01',end:Q.monthRange({month}).end_date});
   assert.ok(t.providers.includes('OFFICIAL_DIRECT'));
  }
  assert.equal(p.audit_required,true);
  assert.equal(p.authoritative,false);
  assert.equal(p.production_writes,0);
 }
});
test('27 Dec BossNoeul crossover does not coalesce into 26 Dec BossNoeul fansign',()=>{
 const existing=[{event_id:'EVT-20261226-BOSS-NOEUL-GOLDEN-MOMENT',
  event_name:'Boss & Noeul 2nd Fansign : Our Golden Moment',
  event_date:'2026-12-26',venue:'ICONSIAM HALL'}];
 const crossover={title:'BOSSNOEUL CROSSOVER CONCERT [ THE FINAL CHAPTER ]',event_date:'2026-12-27',venue:'ICONSIAM HALL'};
 assert.equal(Prod.matchExisting(crossover,existing).match,null);
 assert.equal(Adapter.matchForV2(crossover,existing).match,null);
 assert.equal(Prod.matchExisting({title:existing[0].event_name,event_date:'2026-12-26',venue:'ICONSIAM HALL'},existing).match.event.event_id,existing[0].event_id);
});
test('valid Dec27 Eventpop event still cannot enter create plan without external demand, poster and prices',()=>{
 const snapshot={assets:[{asset_type:'phone',status:'available'},{asset_type:'phone',status:'available'}],
  bookings:[],events:[{event_id:'EVT-20261226-BOSS-NOEUL-GOLDEN-MOMENT',
  event_name:'Boss & Noeul 2nd Fansign : Our Golden Moment',event_date:'2026-12-26',venue:'ICONSIAM HALL'}],
  web_ready:[],web_packages:[],visibility_locks:[]};
 const plan=Adapter.buildReadOnlyPlan({month:'2026-12',snapshot,candidates:[{
  event_key:'eventpop-177073-20261227',title:'BOSSNOEUL CROSSOVER CONCERT [ THE FINAL CHAPTER ]',
  event_date:'2026-12-27',venue:'ICONSIAM HALL',
  source_url:'https://www.eventpop.me/e/177073/bossnoeul-crossover-concert'
 }]});
 assert.equal(plan.selected_count,0);
 assert.equal(plan.excluded_count,1);
 assert.equal(plan.excluded[0].decision,'VERIFY_MORE');
 assert.equal(plan.production_writes,0);
 assert.equal(plan.plan.planned_mutation_count,0);
});
