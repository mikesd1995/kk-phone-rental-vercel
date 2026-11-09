'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const R=require('../server/kk-ultra-deep-source-registry.js');

test('source registry covers all eight required Ultra Deep tiers',()=>{
 const tiers=Object.keys(R.REGISTRY);
 assert.deepEqual(tiers,['OFFICIAL','TICKETING','VENUE','ARTIST_AGENCY','BRAND_SPONSOR','SOCIAL','COMPETITOR','PUBLIC_CALENDAR']);
 const plan=R.buildUniversePlan({month:'2026-10',location:'Bangkok Thailand'});
 assert.ok(plan.tasks.length>=20);
 assert.ok(plan.tasks.some(x=>x.source_id==='eventpop'));
 for(const id of ['kazz-market-activity','deehup-house-ticketing','looke-gelboys','labx-clinic-idol-private']) assert.equal(plan.tasks.some(x=>x.source_id===id&&x.required===true),true,id);
 assert.ok(plan.tasks.some(x=>x.source_id==='zipevent'));
 assert.ok(plan.tasks.some(x=>x.source_id==='iconsiam-hall'));
 assert.ok(plan.tasks.some(x=>x.source_id==='watsons-campaigns'));
 assert.ok(plan.tasks.some(x=>x.source_id==='beauty-personal-care-campaigns'));
 assert.ok(plan.tasks.some(x=>x.source_id==='retail-performance-schedules'));
 assert.ok(plan.tasks.some(x=>x.source_id==='purchase-register-redeem-campaigns'));
 assert.ok(plan.tasks.some(x=>x.source_id==='brand-private-experience-campaigns'));
 assert.ok(plan.tasks.every(x=>x.production_writes===undefined));
 assert.equal(plan.production_writes,0);
});

test('source universe proof fails closed when a required source was not executed',()=>{
 const receipts=R.allSources().map(x=>({source_id:x.source_id,status:'NO_EVIDENCE',executed:true}));
 receipts.find(x=>x.source_id==='eventpop').executed=false;
 receipts.find(x=>x.source_id==='eventpop').status='NOT_BOUND';
 const proof=R.buildUniverseProof(receipts);
 assert.equal(proof.complete,false);
 assert.ok(proof.missing_required_sources.includes('eventpop'));
 assert.equal(proof.by_tier.TICKETING.complete,false);
});

test('source universe proof passes only after every required source has an execution receipt',()=>{
 const receipts=R.allSources().map(x=>({source_id:x.source_id,status:'NO_EVIDENCE',executed:true}));
 const proof=R.buildUniverseProof(receipts);
 assert.equal(proof.complete,true);
 assert.equal(proof.passed_required_source_count,proof.required_source_count);
});

test('source universe emits natural-month query variants instead of ISO-only over-constraint',()=>{
 const plan=R.buildUniversePlan({month:'2026-10',location:'Bangkok Thailand'});
 const eventpop=plan.tasks.find(x=>x.source_id==='eventpop');
 assert.match(eventpop.query,/October 2026/);
 assert.ok(eventpop.query_variants.some(q=>/ตุลาคม 2569/.test(q)));
 assert.ok(eventpop.query_variants.length>=2);
});

test('radio free music festivals and mall public plaza sources are mandatory',()=>{
 const a=R.allSources();
 for(const id of ['flex1045-radio-promoter','pmcu-siam-square','siam-center-free-stage','cat-radio-free-festivals','xoxo-jmnk']){
  assert.ok(a.some(x=>x.source_id===id&&x.required===true),id);
 }
});

test('November 2026 must scan official M Card fan zone and Mall Bangkapi outdoor plaza separately',()=>{
 const plan=R.buildUniversePlan({month:'2026-11',location:'Bangkok Thailand'});
 assert.equal(plan.version,'KK_ULTRA_DEEP_SOURCE_REGISTRY_V9_MCARD');
 for(const [id,tier] of [
  ['mcardmall-artist-fan-zone','BRAND_SPONSOR'],
  ['the-mall-lifestore-outdoor-bangkapi','VENUE']
 ]){
  const task=plan.tasks.find(x=>x.source_id===id);
  assert.ok(task,'Missing required source '+id);
  assert.equal(task.required,true);
  assert.equal(task.source_tier,tier);
  assert.ok(task.query.includes('November 2026'));
  assert.ok(task.query_variants.some(q=>q.includes('พฤศจิกายน 2569')));
 }
 const official=plan.tasks.find(x=>x.source_id==='mcardmall-artist-fan-zone');
 assert.match(official.label,/M Card/);
 assert.match(official.label,/PROXIE/);
 assert.equal(plan.production_writes,0);
 assert.equal(plan.verifier_required,true);
});

test('M Card missing execution receipt forbids claiming full November source coverage',()=>{
 const missing=R.allSources().filter(s=>![
  'mcardmall-artist-fan-zone','the-mall-lifestore-outdoor-bangkapi'
 ].includes(s.source_id)).map(s=>({source_id:s.source_id,status:'NO_EVIDENCE',executed:true}));
 const proof=R.buildUniverseProof(missing);
 assert.equal(proof.complete,false);
 assert.ok(proof.missing_required_sources.includes('mcardmall-artist-fan-zone'));
 assert.ok(proof.missing_required_sources.includes('the-mall-lifestore-outdoor-bangkapi'));
 missing.push(
  {source_id:'mcardmall-artist-fan-zone',status:'EVIDENCE_FOUND',executed:true},
  {source_id:'the-mall-lifestore-outdoor-bangkapi',status:'NO_EVIDENCE',executed:true}
 );
 const complete=R.buildUniverseProof(missing);
 assert.equal(complete.complete,true);
 assert.equal(complete.production_writes,0);
});
