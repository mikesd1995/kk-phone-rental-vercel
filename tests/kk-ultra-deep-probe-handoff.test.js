'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Runner=require('../server/kk-ultra-deep-runtime-runner');
const KnownMiss=require('../server/kk-ultra-deep-known-miss-regression');
async function scan(probe,main=[]){
 return Runner.runMonthlyUltraDeep({month:'2026-10',location:'Bangkok Thailand'},{use_only_injected_providers:true,providers:{SEARXNG:async task=>String(task.source_id).startsWith('knownmiss:')?probe.filter(row=>KnownMiss.sameCase(row,KnownMiss.CORPUS.find(c=>'knownmiss:'+c.case_id===task.source_id))):main}});
}
const brand={title:'RYO Strong Roots, Bright Stars with TeeTee & Por',event_date:'2026-10-07',source_url:'https://example.org/ryo-announcement'};
test('probe-only sourced brand hit reaches verifier without requiring concert keywords',async()=>{
 const out=await scan([brand]);
 assert.equal(out.known_miss_live_recall.results.find(x=>x.case_id==='ryo-teeteepor-20261007').pass,true);
 assert.equal(out.candidates.length,1);
 assert.equal(out.candidates[0].candidate_origin,'KNOWN_MISS_PROBE_RECOVERY');
 assert.equal(out.candidates[0].authoritative,false);
 assert.equal(out.candidates[0].verifier_required,true);
 assert.equal(out.known_miss_recovered_candidate_count,1);
 assert.equal(out.full,false);
 assert.equal(out.production_writes,0);
});

test('unrelated or undated first-provider results do not suppress a usable probe fallback',async()=>{
 let fallbackCalls=0;
 const target='knownmiss:ryo-teeteepor-20261007';
 const out=await Runner.runMonthlyUltraDeep({month:'2026-10',location:'Bangkok Thailand'},{use_only_injected_providers:true,providers:{
  BING_RSS:async task=>task.source_id===target?[{title:'Generic entertainment page',event_date:'2026-08-08',source_url:'https://example.org/noise'},{...brand,event_date:null}]:[],
  SEARXNG:async task=>{if(task.source_id===target){fallbackCalls++;return [brand];}return [];}
 }});
 assert.ok(fallbackCalls>0);
 assert.ok(out.candidates.some(row=>row.source_url===brand.source_url));
 assert.ok(out.diagnostic.receipts.known_miss.length>0);
 assert.equal(out.production_writes,0);
});
test('probe handoff preserves exact cross-month event date and deduplicates main hit',async()=>{
 const future={title:'GELBOYS THE LAST PAINTING FANMEET',event_date:'2026-11-22',source_url:'https://example.org/gelboys'};
 const out=await scan([brand,future],[brand]);
 assert.equal(out.candidates.filter(x=>x.title===brand.title).length,1);
 assert.equal(out.candidates.find(x=>x.title===future.title).event_date,'2026-11-22');
 assert.equal(out.known_miss_recovered_candidate_count,1);
});
test('probe handoff excludes undated, wrong-date, foreign and unrelated out-of-month rows',async()=>{
 const out=await scan([{...brand,event_date:null},{...brand,event_date:'2026-11-07'},{...brand,title:brand.title+' Singapore'},
 {title:'Unrelated Concert',event_date:'2026-12-01',source_url:'https://example.org/unrelated'}]);
 assert.equal(out.candidates.length,0);
 assert.equal(out.known_miss_recovered_candidate_count,0);
});

test('foreign venue or host cannot bypass probe scope through generic keywords or cross-month exception',async()=>{
 const out=await scan([{...brand,title:brand.title+' concert',venue:'Singapore'},
  {title:'GELBOYS THE LAST PAINTING FANMEET',event_date:'2026-11-22',source_url:'https://example.hk/event'}]);
 assert.equal(out.candidates.length,0);
});
