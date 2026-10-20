'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Access=require('../server/kk-ultra-deep-event-type-access.js');
const Prod=require('../server/kk-ultra-deep-production-runtime.js');
const V2=require('../server/kk-ultra-deep-v2-runtime-adapter.js');
const Sources=require('../server/kk-ultra-deep-source-registry.js');
const Query=require('../server/kk-monthly-deep-scan-query-plan.js');
const snapshot=()=>({assets:[
 {asset_id:'PHONE-001',asset_type:'phone',status:'available'},
 {asset_id:'PHONE-002',asset_type:'phone',status:'available'}],
 bookings:[{booking_status:'confirmed',event_date:'2026-11-01'}, {booking_status:'confirmed',event_date:'2026-11-01'},
 {booking_status:'confirmed',event_date:'2026-10-31'},{booking_status:'confirmed',event_date:'2026-10-31'}],
 events:[],web_ready:[],web_packages:[],visibility_locks:[]});
const gallery={event_key:'AUAUSAVE-GALLERY-2026',title:'2nd Anniversary Journey of AuAuSave Gallery',
 event_date:'2026-11-02',venue:'Union Mall G Floor, Union Co-Event Space Zone B'};
const verifiedGallery={...gallery,in_person_activity_verified:true,official_event_source_verified:true,
 official_event_source_url:'https://example.com/verified-source-fixture',
 phone_recording_allowed_verified:true,external_lens_allowed_verified:true,
 official_camera_policy_verified:true,official_camera_policy_url:'https://example.com/camera-fixture',
 non_artist_rental_fit_verified:true,non_artist_rental_fit_source_url:'https://example.com/gallery-fixture'};
test('classifies FirstOne showcase; 8/7 in song title is never parsed as an event date',()=>{
 const c={title:'FirstOne 2nd Single "8/7" Showcase',event_date:'2026-10-19',venue:'Union Mall G'};
 assert.equal(Access.category(c),'SINGLE_SHOWCASE');
 assert.equal(Access.evaluate(c).decision,'VERIFY_EVENT_TYPE_ACCESS');
 assert.ok(Access.evaluate(c).missing.includes('phone_recording_rights'));
 const out=Prod.reconcileCandidates([c],snapshot());
 assert.equal(out.dispositions[0].status,'HOLD_EVENT_TYPE_ACCESS');
 assert.equal(out.dispositions[0].event_date,'2026-10-19');
 assert.equal(out.safe_candidates.length,0);
});
test('Scarlet Heart broadcast key visual is not its separate November 4 ticketed premiere',()=>{
 const broadcast={title:'Scarlet Heart Thailand',event_date:'2026-11-04',
  description:'ทุกวันพุธ-พฤหัสบดี 20:30 ดูทีวี ช่อง one31 ดูย้อนหลัง oneD'};
 const event={title:'Scarlet Heart Thailand The Grand Premiere',event_date:'2026-11-04',venue:'Union Hall'};
 assert.equal(Access.category(broadcast),'BROADCAST_ONLY');
 assert.equal(Access.evaluate(broadcast).decision,'NOT_OFFLINE_EVENT');
 assert.equal(Access.category(event),'OFFLINE_PREMIERE');
 assert.equal(Prod.matchExisting(broadcast,[]).match,null);
 const b=Prod.reconcileCandidates([broadcast,event],snapshot());
 assert.deepEqual(b.dispositions.map(x=>x.status),['SKIPPED_BROADCAST_ONLY','HOLD_EVENT_TYPE_ACCESS']);
 assert.equal(b.safe_candidates.length,0);
});
test('AuAuSave fan-created gallery with no proved artist appearance or rental fit stays hold',()=>{
 const a=Access.evaluate(gallery);
 assert.equal(a.category,'FAN_PROJECT_GALLERY');
 assert.ok(a.missing.includes('verified_onsite_artist_or_rental_fit'));
 assert.equal(a.access_clearance,false);
 assert.equal(Access.evaluate({...gallery,onsite_artist_presence_verified:true}).access_clearance,false);
 assert.equal(Access.evaluate(verifiedGallery).access_clearance,true);
 assert.equal(Access.evaluate(verifiedGallery).artist_presence_confirmed,false);
});
test('verified gallery two-day dates split: November 1 full NCT, November 2 allowed only into further pricing pipeline',()=>{
 const row={...verifiedGallery,event_dates:['2026-11-01','2026-11-02'],event_dates_verified:true};
 const z=Prod.reconcileCandidates([row],snapshot());
 assert.deepEqual(z.dispositions.map(x=>x.status),['SKIPPED_FULL_BOOKING_DATE','SAFE_NEW']);
 assert.deepEqual(z.safe_candidates.map(x=>x.event_date),['2026-11-02']);
 assert.equal(z.safe_candidates[0].event_key,'AUAUSAVE-GALLERY-2026-20261102');
 assert.equal(z.safe_candidates.length,1);
 const v=V2.buildReadOnlyPlan({month:'2026-11',snapshot:snapshot(),candidates:[{...verifiedGallery,event_date:'2026-11-02'}]});
 assert.equal(v.production_writes,0);
 assert.equal(v.selected_count,0);
});
test('unverified multi-day list cannot be automatically materialized even if one date is unbooked',()=>{
 const r=Prod.reconcileCandidates([{...gallery,event_dates:['2026-11-01','2026-11-02'],event_dates_verified:false}],snapshot());
 assert.equal(r.safe_candidates.length,0);
 assert.equal(r.dispositions[0].status,'HOLD_UNVERIFIED_MULTI_DAY_DATES');
 assert.deepEqual(Access.splitVerifiedDates({...gallery,event_dates:[],event_dates_verified:true}).map(x=>x.source_date_hold),[true]);
});
test('Khom Khlang mall activation is distinct from Flex/PMCU Siam Halloween and old Special Episode 5',()=>{
 const mall={title:'WeTV Star Hunter ข่มขลัง Siam Center Halloween 2569 Exhibition',
  venue:'Siam Center G Floor',event_date:'2026-10-29'};
 assert.equal(Access.category(mall),'MALL_ACTIVATION');
 assert.equal(Prod.matchExisting(mall,[
  {event_id:'PMCU',event_name:'SIAM HALLOWEEN 2026 — Flex 104.5 × PMCU',event_date:'2026-10-29',venue:'Siam Square'},
  {event_id:'OLD',event_name:'KHOM KHLANG Special Episode 5',event_date:'2026-10-05',venue:'Siam Center'}]).match,null);
 const r=Prod.reconcileCandidates([{...mall,event_dates:['2026-10-29','2026-10-30','2026-10-31','2026-11-01'],event_dates_verified:true}],snapshot());
 assert.deepEqual(r.dispositions.map(x=>x.status),['HOLD_EVENT_TYPE_ACCESS','HOLD_EVENT_TYPE_ACCESS','SKIPPED_FULL_BOOKING_DATE','SKIPPED_FULL_BOOKING_DATE']);
 assert.equal(r.safe_candidates.length,0);
});
test('ROAD TO THE GRIM LOVER is separate fansign needing first-party and camera evidence',()=>{
 const c={title:'ROAD TO THE GRIM LOVER FANSIGN',event_date:'2026-11-18',venue:'ICONSIAM Hall'};
 assert.equal(Access.category(c),'FANSIGN');
 assert.equal(Prod.reconcileCandidates([c],snapshot()).dispositions[0].status,'HOLD_EVENT_TYPE_ACCESS');
 assert.equal(Access.evaluate({...c,official_event_source_url:'http://localhost/untrusted',official_event_source_verified:true}).access_clearance,false);
});
test('owner booking-day exclusivity blocks unrelated offers even when one phone remains',()=>{
 const s=snapshot();s.bookings=[{event_date:'2026-11-02',booking_status:'confirmed'}];
 const z=Prod.reconcileCandidates([{...verifiedGallery,event_date:'2026-11-02'}],s);
 assert.equal(z.dispositions[0].status,'SKIPPED_ACTIVE_BOOKING_DATE');
 assert.equal(z.safe_candidates.length,0);
});
test('official source receipts are required for individual DMD Music/artist-schedule/gallery/mall coverage',()=>{
 const ids=['dmd-music-single-showcase','domundi-artist-weekly-schedule','fan-organised-anniversary-gallery',
 'siam-center-we-tv-ip-activations','star-hunter-series-activation'];
 for(const month of ['2026-10','2026-11','2026-12']){
  const p=Sources.buildUniversePlan({month});
  const smart=Query.buildOperational({month});
  for(const id of ids){
   const task=p.tasks.find(x=>x.source_id===id);
   assert.equal(task.required,true,id);
   assert.equal(task.query_variants.some(q=>/gallery|โชว์เคส|FirstOne|Halloween|ฮาโลวีน/.test(q)),true,id);
  }
  for(const tier of ['MUSIC_SHOWCASE','FAN_PROJECT_GALLERY','MALL_IP_ACTIVATION'])assert.ok(smart.gap_tasks.some(x=>x.source_tier===tier));
  assert.equal(smart.production_writes,0);
 }
 const receipts=Sources.allSources().filter(x=>x.source_id!=='dmd-music-single-showcase').map(x=>({source_id:x.source_id,status:'NO_EVIDENCE',executed:true}));
 const proof=Sources.buildUniverseProof(receipts);
 assert.equal(proof.complete,false);
 assert.ok(proof.missing_required_sources.includes('dmd-music-single-showcase'));
});


test('typed ingestion never advertises TV-only series or mistakes coded fan gallery and mall activation for a concert',()=>{
 assert.equal(Access.category({title:'Scarlet Heart Thailand',poster_kind:'SERIES_KEY_VISUAL'}),'BROADCAST_ONLY');
 assert.equal(Access.category({title:'Scarlet Heart Thailand',event_type:'TV_SERIES'}),'BROADCAST_ONLY');
 assert.equal(Access.category({title:'Scarlet Heart Thailand The Grand Premiere',event_type:'OFFLINE_PREMIERE'}),'OFFLINE_PREMIERE');
 assert.equal(Access.category({title:'Journey of AuAuSave',event_category:'FAN_PROJECT_GALLERY'}),'FAN_PROJECT_GALLERY');
 assert.equal(Access.category({title:'WeTV Khom Khlang',activity_type:'MALL_IP_ACTIVATION'}),'MALL_ACTIVATION');
 assert.equal(Access.category({title:'FirstOne 8/7',activity_type:'SINGLE_SHOWCASE'}),'SINGLE_SHOWCASE');
});

test('event dates require actual calendar days, not merely ISO-looking text',()=>{
 assert.equal(Access.validIsoDate('2026-02-31'),false);
 assert.equal(Access.validIsoDate('2026-11-31'),false);
 assert.equal(Access.validIsoDate('2026-11-02'),true);
 const row={...verifiedGallery,event_dates:['2026-11-01','2026-11-31'],event_dates_verified:true};
 const z=Prod.reconcileCandidates([row],snapshot());
 assert.equal(z.safe_candidates.length,0);
 assert.equal(z.dispositions[0].status,'HOLD_UNVERIFIED_MULTI_DAY_DATES');
});


test('verified two-day splits have unique deterministic event keys without inventing extra dates',()=>{
 const r=Access.splitVerifiedDates({...gallery,event_dates_verified:true,event_dates:['2026-11-01','2026-11-02','2026-11-02']});
 assert.equal(r.length,2);
 assert.deepEqual(r.map(x=>x.event_key),['AUAUSAVE-GALLERY-2026-20261101','AUAUSAVE-GALLERY-2026-20261102']);
 assert.deepEqual(r.map(x=>x.event_date),['2026-11-01','2026-11-02']);
});
