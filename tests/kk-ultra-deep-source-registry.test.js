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

test('M Card / The Mall fan-zone and lighting sources are mandatory, not generic mall-category coverage',()=>{
 const plan=R.buildUniversePlan({month:'2026-11',location:'Bangkok Thailand'});
 const ids=['mcard-the-mall-artist-events','the-mall-lifestore-plaza-artist-activations'];
 for(const id of ids){
  const source=plan.tasks.find(t=>t.source_id===id);
  assert.ok(source,id);
  assert.equal(source.required,true);
  assert.equal(source.domain,'mcardmall.com');
  const queries=[source.query,...source.query_variants].join(' | ');
  assert.match(queries,/Christmas Tree Lighting Ceremony/i);
  assert.match(queries,/พิธีเปิดไฟต้นคริสต์มาส/);
  assert.match(queries,/fan zone/i);
 }
 const receipts=R.allSources().map(x=>({source_id:x.source_id,status:'NO_EVIDENCE',executed:true}));
 receipts.find(x=>x.source_id==='mcard-the-mall-artist-events').executed=false;
 receipts.find(x=>x.source_id==='mcard-the-mall-artist-events').status='NOT_BOUND';
 const proof=R.buildUniverseProof(receipts);
 assert.equal(proof.complete,false);
 assert.equal(proof.by_tier.BRAND_SPONSOR.complete,false);
 assert.ok(proof.missing_required_sources.includes('mcard-the-mall-artist-events'));
});

test('December cross-month fan events require named M Card, Mediheal, TTM and creative-calendar source receipts',()=>{
 const plan=R.buildUniversePlan({month:'2026-12',location:'Bangkok Thailand'});
 const ids=['mcard-future-event-spend-winner-cycle','mediheal-th-artist-lucky-fans','ttm-recent-asia-artist-fancon','illust-fusion-official-events'];
 for(const id of ids){
  const row=plan.tasks.find(r=>r.source_id===id);
  assert.ok(row,id);
  assert.equal(row.required,true,id);
  assert.equal(row.evidence_required,true,id);
  const queries=[row.query,...row.query_variants].join(' | ');
  assert.match(queries,/December 2026|ธันวาคม 257?0|ธันวาคม 2569/i,id);
 }
 assert.match([plan.tasks.find(r=>r.source_id==='mcard-future-event-spend-winner-cycle').query,...plan.tasks.find(r=>r.source_id==='mcard-future-event-spend-winner-cycle').query_variants].join(' '),/top spender|สะสมยอด/i);
 assert.match([plan.tasks.find(r=>r.source_id==='illust-fusion-official-events').query,...plan.tasks.find(r=>r.source_id==='illust-fusion-official-events').query_variants].join(' '),/WINTER/i);
 const receipts=R.allSources().map(x=>({source_id:x.source_id,status:'NO_EVIDENCE',executed:true}));
 for(const id of ids){
  const receipt=receipts.find(r=>r.source_id===id);
  receipt.executed=false;
  receipt.status='NOT_BOUND';
 }
 const proof=R.buildUniverseProof(receipts);
 assert.equal(proof.complete,false);
 for(const id of ids)assert.ok(proof.missing_required_sources.includes(id),id);
 for(const tier of ['BRAND_SPONSOR','TICKETING','PUBLIC_CALENDAR'])assert.equal(proof.by_tier[tier].complete,false,tier);
});
