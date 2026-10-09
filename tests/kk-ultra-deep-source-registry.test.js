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


test('October brand-campaign source expansion makes secondary artist calendars explicit but not authoritative',()=>{
 const required=['lingorm-artist-schedule-discovery','teeteepor-artist-schedule-discovery','her-hyness-lucky-fan-artist','cathy-doll-artist-event','nars-thailand-artist-event'];
 const entries=R.allSources();
 for(const id of required) assert.ok(entries.some(x=>x.source_id===id&&x.required===true),id);
 const tasks=R.buildUniversePlan({month:'2026-10'}).tasks;
 for(const id of required) assert.ok(tasks.some(x=>x.source_id===id),id);
 const receipt=R.allSources().filter(x=>!required.includes(x.source_id)).map(x=>({source_id:x.source_id,executed:true,status:'NO_EVIDENCE'}));
 const proof=R.buildUniverseProof(receipt);
 assert.equal(proof.complete,false);
 for(const id of required) assert.ok(proof.missing_required_sources.includes(id),id);
});
test('monthly October query plan includes public artist schedules and exact branded lucky-fan pivots',()=>{
 const Q=require('../server/kk-monthly-deep-scan-query-plan.js');
 const plan=Q.build({month:'2026-10'});
 assert.equal(plan.production_writes,0);
 assert.equal(plan.verifier_required,true);
 assert.ok(plan.gap_tasks.some(t=>t.source_tier==='PRESS_BRAND' && /HER HYNESS Lingling Cathy Doll Orm NARS TeeTeePor/.test([t.query,...t.query_variants].join(' '))));
 assert.ok(plan.gap_tasks.some(t=>t.source_tier==='VISUAL_SCHEDULE' && /LingOrm official source vs fan schedule/.test([t.query,...t.query_variants].join(' '))));
});
