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

test('iQIYI official Fan Zone and ICONSIAM routes are mandatory and cannot pass without an attempted receipt',()=>{
 const sources=R.allSources();
 const platform=sources.find(x=>x.source_id==='iqiyi-thailand-platform');
 const venue=sources.find(x=>x.source_id==='iconsiam-hall');
 assert.equal(platform.required,true);
 assert.equal(platform.direct_url,'https://x.com/iQIYI_Thailand');
 assert.ok(platform.search_terms.includes('#iQIYIiJOYTH2027'));
 assert.equal(venue.direct_url,'https://www.iconsiamhall.com/en/event-calendar/event-list');
 const p=R.buildUniversePlan({month:'2026-11'});
 const task=p.tasks.find(x=>x.source_id==='iqiyi-thailand-platform');
 assert.ok(task.query.includes('November 2026'));
 assert.ok(task.query_variants.some(q=>q.includes('#iQIYIiJOYTH2027')));
 assert.equal(task.direct_url,platform.direct_url);
 const receipts=sources.filter(x=>x.source_id!=='iqiyi-thailand-platform').map(x=>({source_id:x.source_id,status:'NO_EVIDENCE',executed:true}));
 const missing=R.buildUniverseProof(receipts);
 assert.equal(missing.complete,false);
 assert.ok(missing.missing_required_sources.includes('iqiyi-thailand-platform'));
 const recovered=R.buildUniverseProof([...receipts,{source_id:'iqiyi-thailand-platform',status:'EVIDENCE_FOUND',executed:true}]);
 assert.equal(recovered.complete,true);
});
