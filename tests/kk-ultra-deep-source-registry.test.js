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


test('October second-pass discovery forces calendar and indie-fansign source receipts',()=>{
 const required=['open-label-daouoffroad','indie-idol-labels-fansigns',
  'popradar-tpop-small-idol','eveduler-date-calendar','nekoneko-idol-calendars','natgan-blgl-artist-events'];
 const registry=R.allSources();
 for(const id of required)assert.ok(registry.some(x=>x.source_id===id&&x.required),id);
 const receipts=registry.filter(x=>!required.includes(x.source_id)).map(x=>({source_id:x.source_id,executed:true,status:'NO_EVIDENCE'}));
 const proof=R.buildUniverseProof(receipts);
 assert.equal(proof.complete,false);
 for(const id of required)assert.ok(proof.missing_required_sources.includes(id),id);
});
test('indie idol, added show and non-ticketed mall recovery appear in October query plan',()=>{
 const Q=require('../server/kk-monthly-deep-scan-query-plan.js');
 const q=Q.build({month:'2026-10'});
 assert.ok(q.gap_tasks.some(x=>x.source_tier==='FAN_EVENT'&&/MINDY Sugar N Spice SNS LE7EL/.test([x.query,...x.query_variants].join(' '))));
 assert.ok(q.gap_tasks.some(x=>x.source_tier==='ANNOUNCEMENT_CHANGE'&&/DaouOffroad Halloween Fan Party NEW ROUND ADDED/.test([x.query,...x.query_variants].join(' '))));
 assert.ok(q.gap_tasks.some(x=>x.source_tier==='MALL_COMMUNITY'&&/NAMP XOXO Siam Center POP-ป่ะห์/.test([x.query,...x.query_variants].join(' '))));
 assert.equal(q.production_writes,0);
});
test('Learning Agent V7 prioritizes indie fansigns and added show without changing booking/scoring policy',()=>{
 const Learning=require('../server/kk-ultra-deep-v2-learning-agent.js');
 const result=Learning.learn({missed_events:[
  {miss_class:'INDIE_IDOL_ALBUM_FANSIGN_GAP',query_terms:['MINDY fansign'],source:'PopRadar'},
  {miss_class:'ADDED_SHOW_DATE_SIBLING_GAP',query_terms:['DaouOffroad Oct31'],source:'ThaiTicketMajor'}
 ]});
 assert.ok(result.adaptive.mandatory_expansion.includes('ADDED_SHOW_DATE_SIBLING_RECEIPTS'));
 assert.ok(result.adaptive.mandatory_expansion.includes('ALBUM_FANSIGN'));
 assert.ok(result.adaptive.query_terms.some(x=>x.includes('new round added original show date')));
 assert.equal(result.scoring_learning.internal_outcomes_affect_external_score,false);
 assert.equal(result.authority.production_writes,0);
});


test('strict live source proof rejects boolean-only fake receipts and wrong-month reuse',()=>{
 const fake=R.allSources().map(x=>({source_id:x.source_id,status:'NO_EVIDENCE',executed:true}));
 assert.equal(R.buildUniverseProof(fake).complete,true,'legacy test contract remains compatible');
 const live=R.buildUniverseProof(fake,{strict_live:true,month:'2026-10'});
 assert.equal(live.complete,false);
 assert.equal(live.passed_required_source_count,0);
 assert.equal(live.strict_live,true);
 assert.equal(live.month,'2026-10');
});
test('strict live source proof requires source identity month query and successful provider attempt',()=>{
 const receipts=R.allSources().map(x=>({
  source_id:x.source_id,task_source_id:x.source_id,month:'2026-10',
  planned_query:x.label+' October 2026 Bangkok',
  status:'NO_EVIDENCE',executed:true,provider:'SEARXNG',
  candidate_count:0,
  attempts:[{provider:'SEARXNG',status:'NO_EVIDENCE',query:x.label+' October 2026 Bangkok'}]
 }));
 assert.equal(R.buildUniverseProof(receipts,{strict_live:true,month:'2026-10'}).complete,true);
 const wrongMonth=receipts.map(x=>({...x,month:'2026-09'}));
 assert.equal(R.buildUniverseProof(wrongMonth,{strict_live:true,month:'2026-10'}).complete,false);
 const corrupt=receipts.map(x=>({...x}));
 corrupt[0]={...corrupt[0],attempts:[{provider:'EXA',status:'PROVIDER_ERROR',query:corrupt[0].planned_query}]};
 const invalid=R.buildUniverseProof(corrupt,{strict_live:true,month:'2026-10'});
 assert.equal(invalid.complete,false);
 assert.ok(invalid.missing_required_sources.includes(corrupt[0].source_id));
});
test('strict live evidence-found receipts require actual candidate count, not status flag alone',()=>{
 const receipts=R.allSources().map(x=>({
  source_id:x.source_id,task_source_id:x.source_id,month:'2026-10',planned_query:'October '+x.label,
  executed:true,provider:'BING_RSS',status:'NO_EVIDENCE',candidate_count:0,
  attempts:[{provider:'BING_RSS',status:'NO_EVIDENCE',query:'October '+x.label}]
 }));
 receipts[0]={...receipts[0],status:'EVIDENCE_FOUND',candidate_count:0,
  attempts:[{provider:'BING_RSS',status:'EVIDENCE_FOUND',query:receipts[0].planned_query}]};
 assert.equal(R.buildUniverseProof(receipts,{strict_live:true,month:'2026-10'}).complete,false);
 receipts[0].candidate_count=1;
 assert.equal(R.buildUniverseProof(receipts,{strict_live:true,month:'2026-10'}).complete,true);
});


test('strict live source receipt rejects successful unrelated query from a bound provider',()=>{
 const rows=R.allSources().map(x=>({
  source_id:x.source_id,task_source_id:x.source_id,
  month:'2026-10',planned_query:x.label+' Bangkok October 2026',
  query_variants:[x.label+' Thai idol October 2026'],
  provider:'BING_RSS',status:'NO_EVIDENCE',executed:true,candidate_count:0,
  attempts:[{provider:'BING_RSS',status:'NO_EVIDENCE',query:x.label+' Bangkok October 2026'}]
 }));
 const valid=R.buildUniverseProof(rows,{strict_live:true,month:'2026-10'});
 assert.equal(valid.complete,true);
 const forged=rows.map(r=>({...r}));
 forged[0]={...forged[0],attempts:[{provider:'BING_RSS',status:'NO_EVIDENCE',query:'completely unrelated weather forecast'}]};
 const check=R.buildUniverseProof(forged,{strict_live:true,month:'2026-10'});
 assert.equal(check.complete,false);
 assert.ok(check.missing_required_sources.includes(forged[0].source_id));
 forged[0].attempts=[{provider:'BING_RSS',status:'NO_EVIDENCE',query:forged[0].query_variants[0]}];
 assert.equal(R.buildUniverseProof(forged,{strict_live:true,month:'2026-10'}).complete,true);
});
