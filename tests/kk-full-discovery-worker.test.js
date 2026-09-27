'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Worker=require('../server/kk-full-discovery-worker.js');
const Watch=require('../server/discovery-source-watch-contract.js');
const NOW='2026-09-27T02:00:00.000Z';
function obs(id,url){return {observation_id:id,provider:'EXA',source_tier:'OFFICIAL',state:'NEW',source_url:url,observed_at:NOW,content_hash:Watch.sha256(id)}}
function result(candidate){return {authoritative:false,verifier_required:true,production_writes:0,final_truth_mutation:false,notification_sends:0,candidates:[candidate]}}
test('full worker normalizes, deduplicates and hands only to verifier',async()=>{
 const r=await Worker.runFullDiscovery({observations:[obs('a','https://a.example/events'),obs('b','https://b.example/events')],provider_results:[
  result({title:'Example Concert',event_date:'2026-10-10',venue:'Hall',artist:['A'],source_url:'https://a.example/event',confidence:.8}),
  result({title:' Example  Concert ',event_date:'2026-10-10',venue:'Hall',artist:['A'],source_url:'https://b.example/event',confidence:.9})
 ]},{sourceWatchOptions:{nowMs:Date.parse(NOW)}});
 assert.equal(r.status,'READY_FOR_VERIFIER');
 assert.equal(r.handoff.candidate_count,1);
 assert.equal(r.handoff.candidates[0].evidence.length,2);
 assert.equal(r.handoff.candidates[0].confidence,.9);
 assert.equal(r.production_writes,0);
 assert.equal(r.handoff.direct_business_write_allowed,false);
});
test('worker fail-closes without source observations',async()=>{
 const r=await Worker.runFullDiscovery({});
 assert.equal(r.status,'BLOCKED_NO_SOURCE_OBSERVATIONS');
 assert.equal(r.handoff,null);
});
test('worker does not fabricate candidates when provider fails',async()=>{
 const r=await Worker.runFullDiscovery({observations:[obs('a','https://a.example/events')]},{
  sourceWatchOptions:{nowMs:Date.parse(NOW)},
  discoverFn:async()=>{throw Object.assign(new Error('down'),{code:'UPSTREAM_DOWN'})}
 });
 assert.equal(r.status,'NO_NEW_CANDIDATES');
 assert.equal(r.handoff.candidate_count,0);
 assert.equal(r.production_writes,0);
});

function obsTier(id,tier,state='UNCHANGED'){
 const hash=Watch.sha256(id);
 return {observation_id:id,provider:'EXA',source_tier:tier,state,source_url:'https://'+id+'.example/events',observed_at:NOW,content_hash:hash,previous_content_hash:state==='UNCHANGED'?hash:null};
}

test('ultra deep scan fails closed when brand/social/calendar coverage is missing',async()=>{
 const r=await Worker.runFullDiscovery({scan_mode:'ULTRA_DEEP',observations:[obsTier('official','OFFICIAL')]},{sourceWatchOptions:{nowMs:Date.parse(NOW)}});
 assert.equal(r.status,'BLOCKED_INCOMPLETE_SOURCE_COVERAGE');
 assert.equal(r.handoff.handoff_state,'HOLD_FOR_COVERAGE');
 assert.ok(r.source_coverage.missing_source_tiers.includes('BRAND_SPONSOR'));
 assert.ok(r.source_coverage.missing_source_tiers.includes('SOCIAL'));
 assert.ok(r.source_coverage.missing_source_tiers.includes('PUBLIC_CALENDAR'));
 assert.equal(r.production_writes,0);
});

test('ultra deep regression keeps brand and mall fan activations discoverable',async()=>{
 const tiers=Worker.ULTRA_DEEP_REQUIRED_SOURCE_TIERS;
 const observations=tiers.map((tier,i)=>obsTier('src'+i,tier,i<3?'NEW':'UNCHANGED'));
 const provider_results=tiers.map((tier,i)=>i===0?result({title:'THE PINK AURA',event_date:'2026-09-28',venue:'centralwOrld',artist:['PP Krit'],source_url:'https://brand.example/pink-aura',confidence:.95}):i===1?result({title:'MINMIN x TeeTeePor - THE FROZEN CANDY LAND',event_date:'2026-09-30',venue:'Union Mall',artist:['TeeTee','Por'],source_url:'https://ticket.example/frozen-candy',confidence:.95}):i===2?result({title:'M Lifestore Sport Day After Match - TeeTee/Por',event_date:'2026-10-01',venue:'The Mall Lifestore',artist:['TeeTee','Por'],source_url:'https://venue.example/sport-day',confidence:.95}):result([]));
 const r=await Worker.runFullDiscovery({scan_mode:'ULTRA_DEEP',observations,provider_results},{sourceWatchOptions:{nowMs:Date.parse(NOW)}});
 assert.equal(r.status,'READY_FOR_VERIFIER');
 assert.equal(r.source_coverage.complete,true);
 assert.equal(r.source_coverage.coverage_percent,100);
 const titles=r.handoff.candidates.map(c=>c.title);
 assert.ok(titles.includes('THE PINK AURA'));
 assert.ok(titles.includes('MINMIN x TeeTeePor - THE FROZEN CANDY LAND'));
 assert.ok(titles.includes('M Lifestore Sport Day After Match - TeeTee/Por'));
 assert.equal(r.production_writes,0);
});
