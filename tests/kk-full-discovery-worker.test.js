'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Worker=require('../server/kk-full-discovery-worker.js');
const Watch=require('../server/discovery-source-watch-contract.js');
const Registry=require('../server/kk-ultra-deep-source-registry.js');
const KnownMiss=require('../server/kk-ultra-deep-known-miss-regression.js');

const NOW='2026-09-27T02:00:00.000Z';
function obs(id,url){return {observation_id:id,provider:'EXA',source_tier:'OFFICIAL',state:'NEW',source_url:url,observed_at:NOW,content_hash:Watch.sha256(id)}}
function result(candidate){return {authoritative:false,verifier_required:true,production_writes:0,final_truth_mutation:false,notification_sends:0,candidates:Array.isArray(candidate)?candidate:[candidate].filter(Boolean)}}
function obsTier(id,tier,state='UNCHANGED'){
 const hash=Watch.sha256(id);
 return {observation_id:id,provider:'EXA',source_tier:tier,state,source_url:'https://'+id+'.example/events',observed_at:NOW,content_hash:hash,previous_content_hash:state==='UNCHANGED'?hash:null};
}
function universeReceipts(month='2026-09'){
 return Registry.allSources().map(s=>({
  source_id:s.source_id,task_source_id:s.source_id,month,
  status:'NO_EVIDENCE',executed:true,provider:'BING_RSS',candidate_count:0,
  planned_query:s.label+' '+month+' Bangkok',
  attempts:[{provider:'BING_RSS',status:'NO_EVIDENCE',query:s.label+' '+month+' Bangkok'}]
 }));
}
function knownMissProbeCandidates(){
 return KnownMiss.CORPUS.map((c,i)=>({title:c.title,event_date:c.event_date,source_url:'https://known.example/'+i}));
}
function ultraEvidence(reference=[]){
 return {
   month:'2026-09',
   source_universe_receipts:universeReceipts(),
   reconciliation_reference_candidates:reference,
   known_miss_probe_candidates:knownMissProbeCandidates()
 };
}

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

test('ultra deep scan fails closed when brand/social/calendar coverage is missing',async()=>{
 const r=await Worker.runFullDiscovery({scan_mode:'ULTRA_DEEP',observations:[obsTier('official','OFFICIAL')],...ultraEvidence([])},{sourceWatchOptions:{nowMs:Date.parse(NOW)}});
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
 const candidates=[
  {title:'THE PINK AURA',event_date:'2026-09-28',venue:'centralwOrld',artist:['PP Krit'],source_url:'https://brand.example/pink-aura',confidence:.95},
  {title:'MINMIN x TeeTeePor - THE FROZEN CANDY LAND',event_date:'2026-09-30',venue:'Union Mall',artist:['TeeTee','Por'],source_url:'https://ticket.example/frozen-candy',confidence:.95},
  {title:'SPORT DAY AFTER MATCH with TEETEE-POR',event_date:'2026-10-01',venue:'The Mall Lifestore',artist:['TeeTee','Por'],source_url:'https://venue.example/sport-day',confidence:.95}
 ];
 const provider_results=tiers.map((tier,i)=>i<3?result(candidates[i]):result([]));
 const r=await Worker.runFullDiscovery({scan_mode:'ULTRA_DEEP',observations,provider_results,...ultraEvidence(candidates)},{sourceWatchOptions:{nowMs:Date.parse(NOW)}});
 assert.equal(r.status,'READY_FOR_VERIFIER');
 assert.equal(r.source_coverage.complete,true);
 assert.equal(r.source_coverage.coverage_percent,100);
 assert.equal(r.quality_evidence.complete,true);
 const titles=r.handoff.candidates.map(c=>c.title);
 assert.ok(titles.includes('THE PINK AURA'));
 assert.ok(titles.includes('MINMIN x TeeTeePor - THE FROZEN CANDY LAND'));
 assert.ok(titles.includes('SPORT DAY AFTER MATCH with TEETEE-POR'));
 assert.equal(r.production_writes,0);
});

test('ultra deep does not award coverage for a blocked source observation',async()=>{
 const tiers=Worker.ULTRA_DEEP_REQUIRED_SOURCE_TIERS;
 const observations=tiers.map((tier,i)=>obsTier('proof'+i,tier,i===0?'NEW':'UNCHANGED'));
 const provider_results=tiers.map((tier,i)=>i===0?null:result([]));
 const r=await Worker.runFullDiscovery({scan_mode:'ULTRA_DEEP',observations,provider_results,...ultraEvidence([])},{sourceWatchOptions:{nowMs:Date.parse(NOW)}});
 assert.equal(r.status,'BLOCKED_INCOMPLETE_SOURCE_COVERAGE');
 assert.equal(r.handoff.handoff_state,'HOLD_FOR_COVERAGE');
 assert.ok(r.source_coverage.missing_source_tiers.includes('OFFICIAL'));
 assert.equal(r.production_writes,0);
});

test('remaster regression survives official venue ticketing discovery',async()=>{
 const tiers=Worker.ULTRA_DEEP_REQUIRED_SOURCE_TIERS;
 const observations=tiers.map((tier,i)=>obsTier('remaster'+i,tier,i<3?'NEW':'UNCHANGED'));
 const candidate={title:'REMASTER CONCERT',event_date:'2026-10-10',venue:'PARAGON HALL',artist:['Various Artists'],source_url:'https://official.example/remaster',confidence:.98};
 const provider_results=tiers.map((tier,i)=>i<3?result({...candidate,source_url:['https://official.example/remaster','https://ticket.example/remaster','https://venue.example/remaster'][i]}):result([]));
 const r=await Worker.runFullDiscovery({scan_mode:'ULTRA_DEEP',observations,provider_results,...ultraEvidence([candidate])},{sourceWatchOptions:{nowMs:Date.parse(NOW)}});
 assert.equal(r.status,'READY_FOR_VERIFIER');
 assert.equal(r.source_coverage.complete,true);
 assert.equal(r.quality_evidence.complete,true);
 assert.ok(r.handoff.candidates.some(c=>c.title==='REMASTER CONCERT' && c.event_date==='2026-10-10'));
 assert.equal(r.production_writes,0);
});

test('ultra deep FULL exposes execution proof and machine-computed gates',async()=>{
 const tiers=Worker.ULTRA_DEEP_REQUIRED_SOURCE_TIERS;
 const observations=tiers.map((tier,i)=>obsTier('full-proof-'+i,tier,i===0?'NEW':'UNCHANGED'));
 const candidate={title:'Proof Event',event_date:'2026-10-10',venue:'Bangkok',artist:['Artist'],source_url:'https://proof.example/event',confidence:.9};
 const provider_results=tiers.map((tier,i)=>i===0?result(candidate):result([]));
 const r=await Worker.runFullDiscovery({scan_mode:'ULTRA_DEEP',observations,provider_results,...ultraEvidence([candidate])},{sourceWatchOptions:{nowMs:Date.parse(NOW)}});
 assert.equal(r.status,'READY_FOR_VERIFIER');
 assert.equal(r.source_coverage.coverage_percent,100);
 assert.equal(r.source_coverage.proof_complete,true);
 assert.equal(r.quality_evidence.source_universe_proof.complete,true);
 assert.equal(r.quality_evidence.reconciliation.reconciliation_gap_count,0);
 assert.equal(r.quality_evidence.known_miss_regression.complete,true);
 assert.equal(r.quality_evidence.complete,true);
 for(const tier of tiers){
   assert.ok(r.source_coverage.proof_by_source_tier[tier].length>=1);
 }
});

test('caller booleans cannot fake Ultra Deep FULL without machine evidence',async()=>{
 const tiers=Worker.ULTRA_DEEP_REQUIRED_SOURCE_TIERS;
 const observations=tiers.map((tier,i)=>obsTier('fake-'+i,tier,'UNCHANGED'));
 const provider_results=tiers.map(()=>result([]));
 const r=await Worker.runFullDiscovery({
   scan_mode:'ULTRA_DEEP',observations,provider_results,
   quality_gates:{source_universe_proof:true,reconciliation_gap_count:0,known_miss_regression:true}
 },{sourceWatchOptions:{nowMs:Date.parse(NOW)}});
 assert.equal(r.status,'BLOCKED_INCOMPLETE_SOURCE_COVERAGE');
 assert.equal(r.quality_evidence.complete,false);
 assert.ok(r.blockers.includes('SOURCE_UNIVERSE_PROOF_INCOMPLETE'));
 assert.ok(r.blockers.includes('KNOWN_MISS_REGRESSION_INCOMPLETE'));
});

test('universe execution gap blocks FULL even with 8 source classes',async()=>{
 const tiers=Worker.ULTRA_DEEP_REQUIRED_SOURCE_TIERS;
 const observations=tiers.map((tier,i)=>obsTier('universe-'+i,tier,'UNCHANGED'));
 const receipts=universeReceipts();
 receipts[0]={...receipts[0],executed:false,status:'NOT_BOUND'};
 const r=await Worker.runFullDiscovery({
   scan_mode:'ULTRA_DEEP',observations,provider_results:tiers.map(()=>result([])),
   source_universe_receipts:receipts,
   reconciliation_reference_candidates:[],
   known_miss_probe_candidates:knownMissProbeCandidates()
 },{sourceWatchOptions:{nowMs:Date.parse(NOW)}});
 assert.equal(r.status,'BLOCKED_INCOMPLETE_SOURCE_COVERAGE');
 assert.equal(r.quality_evidence.source_universe_proof.complete,false);
 assert.ok(r.blockers.includes('SOURCE_UNIVERSE_PROOF_INCOMPLETE'));
});

test('independent reconciliation gap blocks FULL',async()=>{
 const tiers=Worker.ULTRA_DEEP_REQUIRED_SOURCE_TIERS;
 const observations=tiers.map((tier,i)=>obsTier('recon-'+i,tier,'UNCHANGED'));
 const r=await Worker.runFullDiscovery({
   scan_mode:'ULTRA_DEEP',observations,provider_results:tiers.map(()=>result([])),
   source_universe_receipts:universeReceipts(),
   reconciliation_reference_candidates:[{reference_id:'outside-1',title:'Missed Event',event_date:'2026-10-22',eligible_for_discovery:true,source_url:'https://outside.example/event'}],
   known_miss_probe_candidates:knownMissProbeCandidates()
 },{sourceWatchOptions:{nowMs:Date.parse(NOW)}});
 assert.equal(r.status,'BLOCKED_INCOMPLETE_SOURCE_COVERAGE');
 assert.equal(r.quality_evidence.reconciliation.reconciliation_gap_count,1);
 assert.ok(r.blockers.includes('RECONCILIATION_GAPS_REMAIN'));
});

test('Ultra Deep full worker rejects synthetic executed=true rows even with complete tier coverage',async()=>{
 const tiers=Worker.ULTRA_DEEP_REQUIRED_SOURCE_TIERS;
 const observations=tiers.map((tier,i)=>obsTier('unproved-'+i,tier,'UNCHANGED'));
 const forged=Registry.allSources().map(s=>({source_id:s.source_id,status:'NO_EVIDENCE',executed:true}));
 const output=await Worker.runFullDiscovery({
  scan_mode:'ULTRA_DEEP',month:'2026-10',observations,
  provider_results:tiers.map(()=>result([])),
  source_universe_receipts:forged,
  known_miss_probe_candidates:knownMissProbeCandidates(),
  reconciliation_reference_candidates:[]
 },{sourceWatchOptions:{nowMs:Date.parse(NOW)}});
 assert.equal(output.status,'BLOCKED_INCOMPLETE_SOURCE_COVERAGE');
 assert.equal(output.quality_evidence.source_universe_proof.complete,false);
 assert.equal(output.quality_evidence.source_universe_proof.strict_live,true);
 assert.equal(output.production_writes,0);
});


test('Full Discovery Worker requires sourced month-scoped live known-miss proof',async()=>{
 const tiers=Worker.ULTRA_DEEP_REQUIRED_SOURCE_TIERS;
 const observations=tiers.map((tier,i)=>obsTier('strict-known-'+i,tier,'UNCHANGED'));
 const resultRows=tiers.map(()=>result([]));
 const fakeKnown=KnownMiss.CORPUS.map(x=>({title:x.title,event_date:x.event_date}));
 const output=await Worker.runFullDiscovery({
  scan_mode:'ULTRA_DEEP',month:'2026-09',observations,provider_results:resultRows,
  source_universe_receipts:universeReceipts('2026-09'),
  known_miss_probe_candidates:fakeKnown,
  known_miss_classifications:[{case_id:'pink-aura-20260928',executed:true,status:'SOURCE_UNAVAILABLE'}],
  reconciliation_reference_candidates:[]
 },{sourceWatchOptions:{nowMs:Date.parse(NOW)}});
 assert.equal(output.status,'BLOCKED_INCOMPLETE_SOURCE_COVERAGE');
 assert.equal(output.quality_evidence.source_universe_proof.complete,true);
 assert.equal(output.quality_evidence.known_miss_regression.complete,false);
 assert.equal(output.quality_evidence.known_miss_regression.strict_live,true);
 assert.ok(output.quality_evidence.known_miss_regression.missing_cases.includes('pink-aura-20260928'));
 assert.equal(output.production_writes,0);
});
test('Full Discovery Worker rejects wrong-month known-miss candidate even with source URL',async()=>{
 const tiers=Worker.ULTRA_DEEP_REQUIRED_SOURCE_TIERS;
 const observations=tiers.map((tier,i)=>obsTier('wrongmonth-'+i,tier,'UNCHANGED'));
 const bad=KnownMiss.CORPUS.filter(x=>x.event_date.startsWith('2026-09')).map(x=>({
  title:x.title,event_date:'2026-08-28',source_url:'https://example.com/old-announcement'
 }));
 const output=await Worker.runFullDiscovery({
  scan_mode:'ULTRA_DEEP',month:'2026-09',observations,provider_results:tiers.map(()=>result([])),
  source_universe_receipts:universeReceipts('2026-09'),
  known_miss_probe_candidates:bad,reconciliation_reference_candidates:[]
 },{sourceWatchOptions:{nowMs:Date.parse(NOW)}});
 assert.equal(output.quality_evidence.known_miss_regression.complete,false);
 assert.equal(output.status,'BLOCKED_INCOMPLETE_SOURCE_COVERAGE');
});
