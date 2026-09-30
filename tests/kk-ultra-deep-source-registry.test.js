'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const R=require('../server/kk-ultra-deep-source-registry.js');

function goodReceipts(){
 return R.allSources().map(x=>{
   const health=(x.seed_urls||[]).length>0||(x.feed_urls||[]).length>0;
   return {source_id:x.source_id,proof_mode:health?'SOURCE_HEALTH':'DISCOVERY_EXECUTION',status:health?'HEALTH_OK':'EXECUTED_NO_MATCH',executed:true};
 });
}

test('source registry covers all eight required Ultra Deep tiers',()=>{
 const tiers=Object.keys(R.REGISTRY);
 assert.deepEqual(tiers,['OFFICIAL','TICKETING','VENUE','ARTIST_AGENCY','BRAND_SPONSOR','SOCIAL','COMPETITOR','PUBLIC_CALENDAR']);
 const plan=R.buildUniversePlan({month:'2026-10',location:'Bangkok Thailand'});
 assert.ok(plan.tasks.length>=20);
 assert.ok(plan.tasks.some(x=>x.source_id==='eventpop'&&x.health_only===true&&x.seed_urls.length>0));
 assert.ok(plan.tasks.some(x=>x.source_id==='zipevent'&&x.health_only===true));
 assert.ok(plan.tasks.some(x=>x.source_id==='iconsiam-hall'&&x.health_only===false));
 assert.ok(plan.tasks.some(x=>x.source_id==='watsons-campaigns'&&x.health_only===true));
 assert.equal(plan.production_writes,0);
});

test('source universe proof fails closed when required source health is not proven',()=>{
 const receipts=goodReceipts();
 const row=receipts.find(x=>x.source_id==='eventpop');
 row.executed=false;row.status='HEALTH_FAILED';
 const proof=R.buildUniverseProof(receipts);
 assert.equal(proof.execution_complete,false);
 assert.ok(proof.missing_required_sources.includes('eventpop'));
 assert.equal(proof.by_tier.TICKETING.complete,false);
});

test('source universe execution proof accepts explicit no-match only for executed discovery rows',()=>{
 const receipts=goodReceipts();
 const proof=R.buildUniverseProof(receipts);
 assert.equal(proof.execution_complete,true);
 assert.equal(proof.passed_required_source_count,proof.required_source_count);
 assert.equal(proof.executed_required_source_count,proof.required_source_count);
});
