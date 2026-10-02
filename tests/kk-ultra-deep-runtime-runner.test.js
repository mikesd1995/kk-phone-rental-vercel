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
   return [{title:'Shared Reference Concert Bangkok',event_date:'2026-10-20',source_url:'https://proof.example/'+(task.source_id||'generic')}];
 };
 const out=await Runner.runMonthlyUltraDeep({month:'2026-10',location:'Bangkok Thailand'},{providers:{SEARXNG:search},publicWebOptions:{searxng_endpoint:'',ddg_enabled:false,bing_enabled:false}});
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
   return [{title:'Shared Reference Concert Bangkok',event_date:'2026-10-20',source_url:'https://proof.example/'+(task.source_id||'generic')}];
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
   return [{title:'Shared Reference Concert Bangkok',event_date:'2026-10-20',source_url:'https://proof.example/'+(task.source_id||'generic')}];
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
 const targetCandidate={title:'WeSpark official #bailu Bai Lu WeSpark Exclusive Overseas Fanmeeting',event_date:target.event_date,source_url:'https://proof.example/bailu-live'};
 const search=async task=>{
   if(String(task.source_id||'').startsWith('knownmiss:')) return [];
   if(String(task.source_id||'').startsWith('reference-')) return [targetCandidate];
   if(!emittedTarget){
     emittedTarget=true;
     return [targetCandidate];
   }
   return [];
 };
 const out=await Runner.runMonthlyUltraDeep(
   {month:'2026-10',location:'Bangkok Thailand',known_miss_classifications:classifications},
   {providers:{SEARXNG:search},publicWebOptions:{searxng_endpoint:'',ddg_enabled:false,bing_enabled:false}}
 );
 assert.equal(out.known_miss_regression.complete,true);
 assert.equal(out.known_miss_live_recall.complete,true);
 const recovered=out.known_miss_live_recall.results.find(x=>x.case_id===target.case_id);
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

test('reference sweep execution proof fails closed when all search providers error',async()=>{
 const fail=async()=>{const e=new Error('blocked');e.code='UPSTREAM_BLOCKED';throw e;};
 const classifications=KnownMiss.CORPUS.map(c=>({case_id:c.case_id,executed:true,status:'SOURCE_UNAVAILABLE'}));
 const out=await Runner.runMonthlyUltraDeep(
   {month:'2026-10',location:'Bangkok Thailand',known_miss_classifications:classifications},
   {providers:{SEARXNG:fail},publicWebOptions:{searxng_endpoint:'',ddg_enabled:false,bing_enabled:false}}
 );
 assert.equal(out.full,false);
 assert.equal(out.reference_sweep_proof.complete,false);
 assert.ok(out.blockers.includes('REFERENCE_SWEEP_INCOMPLETE'));
 assert.equal(out.production_writes,0);
});

test('deterministic historical regression remains complete even when live recall is partial',async()=>{
 const search=async task=>{
   if(String(task.source_id||'').startsWith('knownmiss:')) return [];
   return [{title:'Shared Reference Concert Bangkok',event_date:'2026-10-20',source_url:'https://proof.example/shared'}];
 };
 const out=await Runner.runMonthlyUltraDeep(
   {month:'2026-10',location:'Bangkok Thailand'},
   {providers:{SEARXNG:search},publicWebOptions:{searxng_endpoint:'',ddg_enabled:false,bing_enabled:false}}
 );
 assert.equal(out.known_miss_regression.complete,true);
 assert.ok(out.known_miss_live_recall.passed<out.known_miss_live_recall.case_count);
 assert.equal(out.production_writes,0);
});

test('empty current-month discovery blocks FULL even when provider calls execute',async()=>{
 const search=async task=>{
   if(String(task.source_id||'').startsWith('knownmiss:')){
     const c=KnownMiss.CORPUS.find(x=>'knownmiss:'+x.case_id===task.source_id);
     return c?[{title:c.title,event_date:c.event_date,source_url:'https://proof.example/'+task.source_id}]:[];
   }
   if(String(task.source_id||'').startsWith('reference-')) return [{title:'External Event',event_date:'2026-10-20',source_url:'https://proof.example/reference'}];
   return [];
 };
 const out=await Runner.runMonthlyUltraDeep(
   {month:'2026-10',location:'Bangkok Thailand'},
   {providers:{SEARXNG:search},publicWebOptions:{searxng_endpoint:'',ddg_enabled:false,bing_enabled:false}}
 );
 assert.equal(out.discovery_proof.has_evidence,false);
 assert.ok(out.blockers.includes('DISCOVERY_EVIDENCE_EMPTY'));
 assert.equal(out.full,false);
});

test('provider preflight rejects bound functions that produce no live search evidence',async()=>{
 const p={DDG_HTML:async()=>[],BING_HTML:async()=>[]};const r=await Runner.providerPreflight(p,{month:'2026-10'});assert.equal(r.status,'NO_LIVE_SEARCH_EVIDENCE');assert.deepEqual(r.usable,[]);
});
test('provider preflight accepts only provider with real HTTPS evidence',async()=>{
 const p={DDG_HTML:async()=>[{title:'October Concert',source_url:'https://example.com/event'}]};const r=await Runner.providerPreflight(p,{month:'2026-10'});assert.equal(r.status,'READY');assert.deepEqual(r.usable,['DDG_HTML']);
});

test('reference sweep retains exact month queries and adds bounded broad fallbacks',()=>{
 const p=Runner.buildReferencePlan({month:'2026-10',location:'Bangkok Thailand'});
 assert.equal(p.gap_tasks.length,4);
 assert.ok(p.gap_tasks.every(t=>t.query.includes('October 2026')));
 assert.ok(p.gap_tasks[0].query_variants.includes('Bangkok concert'));
 assert.ok(p.gap_tasks[1].query_variants.includes('Bangkok fanmeeting'));
 assert.ok(p.gap_tasks[2].query_variants.includes('Bangkok lucky fan artist'));
 assert.ok(p.gap_tasks[3].query_variants.includes('Bangkok concert calendar'));
 assert.ok(p.gap_tasks.every(t=>t.providers.includes('DDG_HTML')&&t.providers.includes('BING_HTML')));
});

test('reference scope rejects wrong month, foreign-city and non-rental noise while keeping event pages',()=>{
  assert.deepEqual(
    Runner.referenceScopeDecision({title:'The Weeknd Concert Hong Kong',event_date:'2026-10-31',source_url:'https://www.livenation.hk/event/x'},{month:'2026-10'}).eligible,
    false
  );
  assert.equal(
    Runner.referenceScopeDecision({title:'Boss & Noeul 2nd Fansign',event_date:'2026-12-26',source_url:'https://www.eventpop.me/e/174010/x'},{month:'2026-10'}).reason,
    'OUTSIDE_TARGET_MONTH'
  );
  assert.equal(
    Runner.referenceScopeDecision({title:'Anime Zero Codes (October 2026)',event_date:'2026-10-02',source_url:'https://example.com/codes'},{month:'2026-10'}).reason,
    'NON_RENTAL_EVENT_NOISE'
  );
  assert.equal(
    Runner.referenceScopeDecision({title:'Vivation Breathwork Bangkok October 2026',event_date:'2026-10-04',source_url:'https://example.com/breathwork'},{month:'2026-10'}).eligible,
    false
  );
  assert.equal(
    Runner.referenceScopeDecision({title:'ATLAS : RISING UP',event_date:'2026-10-18',source_url:'https://www.eventpop.me/e/999999/atlas-rising-up'},{month:'2026-10'}).eligible,
    true
  );
});

test('scoped reference evidence preserves explicit exclusion reasons',()=>{
  const rows=Runner.scopeReferenceCandidates([
    {title:'Bangkok Fanmeeting',event_date:'2026-10-20',source_url:'https://example.com/bangkok-fanmeeting'},
    {title:'Pets Universe Codes October 2026',event_date:'2026-10-02',source_url:'https://example.com/codes'}
  ],{month:'2026-10'});
  assert.equal(rows[0].eligible_for_discovery,true);
  assert.equal(rows[0].reference_scope_reason,'ELIGIBLE_REFERENCE');
  assert.equal(rows[1].eligible_for_discovery,false);
  assert.equal(rows[1].reference_scope_reason,'NON_RENTAL_EVENT_NOISE');
});

