'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Runner=require('../server/kk-ultra-deep-runtime-runner.js');
const KnownMiss=require('../server/kk-ultra-deep-known-miss-regression.js');

test('runtime runner fails closed when no unknown-URL search provider is bound',async()=>{
 const out=await Runner.runMonthlyUltraDeep({month:'2026-10',location:'Bangkok Thailand'},{publicWebOptions:{searxng_endpoint:'',ddg_enabled:false,bing_enabled:false}});
 assert.equal(out.status,'HOLD_FOR_COVERAGE');
 assert.equal(out.full,false);
 assert.ok(out.blockers.includes('UNKNOWN_URL_SEARCH_NOT_BOUND'));
 assert.equal(out.production_writes,0);
});

test('runtime runner can prove FULL only from executed provider evidence',async()=>{
 const byCase=new Map(KnownMiss.CORPUS.map(c=>['knownmiss:'+c.case_id,c]));
 const search=async task=>{
   if(byCase.has(task.source_id)){
     const c=byCase.get(task.source_id);
     return [{title:c.title,event_date:c.event_date,source_url:'https://proof.example/'+task.source_id}];
   }
   return [{title:'Shared Reference Event',event_date:'2026-10-20',source_url:'https://proof.example/'+(task.source_id||'generic')}];
 };
 const out=await Runner.runMonthlyUltraDeep({month:'2026-10',location:'Bangkok Thailand'},{providers:{SEARXNG:search},publicWebOptions:{searxng_endpoint:'',ddg_enabled:false}});
 assert.equal(out.status,'READY_FOR_VERIFIER');
 assert.equal(out.full,true);
 assert.equal(out.provider_binding.unknown_url_search_bound,true);
 assert.equal(out.source_universe.complete,true);
 assert.equal(out.reconciliation.reconciliation_gap_count,0);
 assert.equal(out.known_miss_regression.complete,true);
 assert.equal(out.production_writes,0);
 assert.equal(out.verifier_required,true);
});


test('runtime known-miss probe can recover through an alias-only query without weakening FULL gates',async()=>{
 const target=KnownMiss.CORPUS.find(c=>c.case_id==='remaster-20261010');
 const byCase=new Map(KnownMiss.CORPUS.map(c=>['knownmiss:'+c.case_id,c]));
 const seenTargetQueries=[];
 const search=async task=>{
   const c=byCase.get(task.source_id);
   if(c){
     if(c.case_id===target.case_id){
       seenTargetQueries.push(task.query);
       if(task.query==='remaster concert Bangkok Thailand'){
         return [{title:'REMASTER CONCERT',event_date:c.event_date,source_url:'https://proof.example/remaster-alias'}];
       }
       return [];
     }
     return [{title:c.title,event_date:c.event_date,source_url:'https://proof.example/'+task.source_id}];
   }
   return [{title:'Shared Reference Event',event_date:'2026-10-20',source_url:'https://proof.example/'+(task.source_id||'generic')}];
 };
 const out=await Runner.runMonthlyUltraDeep(
   {month:'2026-10',location:'Bangkok Thailand'},
   {providers:{SEARXNG:search},publicWebOptions:{searxng_endpoint:'',ddg_enabled:false,bing_enabled:false}}
 );
 assert.equal(out.status,'READY_FOR_VERIFIER');
 assert.equal(out.full,true);
 assert.equal(out.source_universe.complete,true);
 assert.equal(out.reconciliation.reconciliation_gap_count,0);
 assert.equal(out.known_miss_regression.complete,true);
 assert.equal(out.known_miss_regression.deterministic,true);
 assert.ok(seenTargetQueries.includes('REMASTER CONCERT Bangkok Thailand'));
 assert.ok(seenTargetQueries.includes('remaster concert Bangkok Thailand'));
 assert.equal(out.production_writes,0);
});

test('known-miss plan keeps one task per case and does not concatenate every alias into one over-constrained query',()=>{
 const plan=Runner.buildKnownMissPlan();
 assert.equal(plan.version,'KK_ULTRA_DEEP_KNOWN_MISS_PROBE_V2');
 assert.equal(plan.gap_tasks.length,KnownMiss.CORPUS.length);
 const remaster=plan.gap_tasks.find(x=>x.source_id==='knownmiss:remaster-20261010');
 assert.equal(remaster.query,'REMASTER CONCERT Bangkok Thailand');
 assert.deepEqual(remaster.query_variants,['remaster concert Bangkok Thailand']);
 assert.ok(!remaster.query.includes('2026-10-10'));
});


test('runtime executes provider health before broad discovery and live known-miss probes after the sweep',async()=>{
 const calls=[];
 const search=async task=>{
   calls.push(task.source_id||'no-source-id');
   const c=KnownMiss.CORPUS.find(x=>'knownmiss:'+x.case_id===task.source_id);
   if(c) return [{title:c.title,event_date:c.event_date,source_url:'https://proof.example/'+task.source_id}];
   return [{title:'Shared Reference Event',event_date:'2026-10-20',source_url:'https://proof.example/'+(task.source_id||'generic')}];
 };
 const out=await Runner.runMonthlyUltraDeep(
   {month:'2026-10',location:'Bangkok Thailand'},
   {providers:{SEARXNG:search},publicWebOptions:{searxng_endpoint:'',ddg_enabled:false,bing_enabled:false}}
 );
 assert.equal(out.full,true);
 assert.ok(calls[0].startsWith('provider-health-pre-'));
 const firstKnown=calls.findIndex(x=>x.startsWith('knownmiss:'));
 const firstDiscovery=calls.findIndex(x=>!x.startsWith('provider-health-')&&!x.startsWith('knownmiss:')&&!x.startsWith('reference-'));
 assert.ok(firstDiscovery>=0);
 assert.ok(firstKnown>firstDiscovery);
 assert.equal(out.live_provider_health.complete,true);
});

test('runtime known-miss gate accepts a governed hit from the main discovery sweep',async()=>{
 const target=KnownMiss.CORPUS.find(c=>c.case_id==='bai-lu-meet-love-20261025');
 let emittedTarget=false;
 const classifications=KnownMiss.CORPUS
   .filter(c=>c.case_id!==target.case_id)
   .map(c=>({case_id:c.case_id,executed:true,status:'SOURCE_UNAVAILABLE'}));
 const search=async task=>{
   if(String(task.source_id||'').startsWith('knownmiss:')) return [];
   if(String(task.source_id||'').startsWith('reference-')) return [];
   if(!emittedTarget){
     emittedTarget=true;
     return [{title:'WeSpark official #bailu Bai Lu WeSpark Exclusive Overseas Fanmeeting',event_date:target.event_date,source_url:'https://proof.example/bailu-live'}];
   }
   return [];
 };
 const out=await Runner.runMonthlyUltraDeep(
   {month:'2026-10',location:'Bangkok Thailand',known_miss_classifications:classifications},
   {providers:{SEARXNG:search},publicWebOptions:{searxng_endpoint:'',ddg_enabled:false,bing_enabled:false}}
 );
 assert.equal(out.known_miss_regression.complete,true);
 assert.equal(out.known_miss_regression.deterministic,true);
 const recovered=out.known_miss_live_probe.results.find(x=>x.case_id===target.case_id);
 assert.equal(recovered.proof,'DISCOVERED');
 assert.equal(recovered.matched_source_url,'https://proof.example/bailu-live');
 assert.equal(out.full,true);
 assert.equal(out.production_writes,0);
});


test('known-miss plan prioritizes evidence-grounded search queries before generic alias queries',()=>{
 const plan=Runner.buildKnownMissPlan();
 const scoop=plan.gap_tasks.find(x=>x.source_id==='knownmiss:scoopify-james-su-20261024');
 const tle=plan.gap_tasks.find(x=>x.source_id==='knownmiss:tle-firstone-20261022');
 const fort=plan.gap_tasks.find(x=>x.source_id==='knownmiss:fortreasure-20261129');
 assert.equal(scoop.query,'SCOOPIFYYogurtAndJamesSu SummerVibeTH');
 assert.equal(tle.query,'EVERPINKxTleFirstone');
 assert.equal(fort.query,'FORTREASURE site:eventpop.me');
 assert.ok(scoop.query_variants.includes('SCOOPIFY YOGURT & YOU WITH JAMES SU Bangkok Thailand'));
 assert.ok(tle.query_variants.includes('A TOUCH OF LOVE WITH TLE-FIRSTONE Bangkok Thailand'));
 assert.ok(fort.query_variants.includes('FORTREASURE BEYOND THE HORIZON CONCERT Bangkok Thailand'));
});


test('runtime fails closed when a provider is bound but health canaries return no evidence',async()=>{
 const empty=async()=>[];
 const out=await Runner.runMonthlyUltraDeep(
   {month:'2026-10',location:'Bangkok Thailand'},
   {providers:{SEARXNG:empty},publicWebOptions:{searxng_endpoint:'',ddg_enabled:false,bing_enabled:false}}
 );
 assert.equal(out.provider_binding.unknown_url_search_bound,true);
 assert.equal(out.known_miss_regression.complete,true);
 assert.equal(out.live_provider_health.complete,false);
 assert.equal(out.full,false);
 assert.ok(out.blockers.includes('LIVE_UNKNOWN_URL_PROVIDER_HEALTH_FAILED'));
 assert.equal(out.production_writes,0);
});

test('live known-miss diagnostic may be incomplete while deterministic regression and live provider health keep FULL honest',async()=>{
 const search=async task=>{
   if(String(task.source_id||'').startsWith('knownmiss:'))return [];
   return [{title:'Shared Live Event',event_date:'2026-10-20',source_url:'https://proof.example/shared-live'}];
 };
 const out=await Runner.runMonthlyUltraDeep(
   {month:'2026-10',location:'Bangkok Thailand'},
   {providers:{SEARXNG:search},publicWebOptions:{searxng_endpoint:'',ddg_enabled:false,bing_enabled:false}}
 );
 assert.equal(out.live_provider_health.complete,true);
 assert.equal(out.source_universe.complete,true);
 assert.equal(out.reconciliation.reconciliation_gap_count,0);
 assert.equal(out.known_miss_regression.complete,true);
 assert.equal(out.known_miss_regression.deterministic,true);
 assert.equal(out.known_miss_live_probe.complete,false);
 assert.equal(out.known_miss_live_probe.diagnostic_only,true);
 assert.equal(out.full,true);
 assert.equal(out.status,'READY_FOR_VERIFIER');
 assert.equal(out.production_writes,0);
});

test('provider health requires evidence before and after the broad sweep',()=>{
 const ok={results:[{status:'EVIDENCE_FOUND',attempts:[{provider:'SEARXNG',status:'EVIDENCE_FOUND'}]}]};
 const empty={results:[{status:'GAP_UNRESOLVED',attempts:[{provider:'SEARXNG',status:'NO_EVIDENCE'}]}]};
 assert.equal(Runner.providerHealthState(ok,ok).complete,true);
 assert.equal(Runner.providerHealthState(ok,empty).complete,false);
 assert.equal(Runner.providerHealthState(empty,ok).complete,false);
});
