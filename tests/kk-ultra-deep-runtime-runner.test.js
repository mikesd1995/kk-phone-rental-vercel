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


test('runtime executes known-miss probes before the broad monthly sweep',async()=>{
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
 assert.ok(calls[0].startsWith('knownmiss:'));
 const firstNonKnown=calls.findIndex(x=>!x.startsWith('knownmiss:'));
 assert.ok(firstNonKnown>=KnownMiss.CORPUS.length);
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
 const recovered=out.known_miss_regression.results.find(x=>x.case_id===target.case_id);
 assert.equal(recovered.proof,'DISCOVERED');
 assert.equal(recovered.matched_source_url,'https://proof.example/bailu-live');
 assert.equal(out.full,true);
 assert.equal(out.production_writes,0);
});
