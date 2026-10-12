'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Runner=require('../server/kk-ultra-deep-runtime-runner.js');
const KnownMiss=require('../server/kk-ultra-deep-known-miss-regression.js');

test('runtime runner fails closed when no unknown-URL search provider is bound',async()=>{
 const out=await Runner.runMonthlyUltraDeep({month:'2026-10',location:'Bangkok Thailand'},{use_only_injected_providers:true,publicWebOptions:{searxng_endpoint:'',ddg_enabled:false,bing_enabled:false}});
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
 const out=await Runner.runMonthlyUltraDeep({month:'2026-10',location:'Bangkok Thailand'},{providers:{SEARXNG:search},use_only_injected_providers:true,publicWebOptions:{searxng_endpoint:'',ddg_enabled:false,bing_enabled:false}});
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
   {providers:{SEARXNG:search},use_only_injected_providers:true,publicWebOptions:{searxng_endpoint:'',ddg_enabled:false,bing_enabled:false}}
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
 assert.equal(plan.version,'KK_ULTRA_DEEP_KNOWN_MISS_PROBE_V3_MONTH_SCOPED');
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
   {providers:{SEARXNG:search},use_only_injected_providers:true,publicWebOptions:{searxng_endpoint:'',ddg_enabled:false,bing_enabled:false}}
 );
 assert.equal(out.full,true);
 assert.ok(calls[0].startsWith('knownmiss:'));
 const firstNonKnown=calls.findIndex(x=>!x.startsWith('knownmiss:'));
 assert.ok(firstNonKnown>=KnownMiss.CORPUS.filter(c=>c.event_date.startsWith('2026-10')||(c.discovery_months||[]).includes('2026-10')).length);
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
   {providers:{SEARXNG:search},use_only_injected_providers:true,publicWebOptions:{searxng_endpoint:'',ddg_enabled:false,bing_enabled:false}}
 );
 assert.equal(out.known_miss_regression.complete,true);
 assert.equal(out.known_miss_live_recall.complete,false);
 const recovered=out.known_miss_live_recall.results.find(x=>x.case_id===target.case_id);
 assert.equal(recovered.proof,'DISCOVERED');
 assert.equal(recovered.matched_source_url,'https://proof.example/bailu-live');
 assert.equal(out.full,false);
 assert.ok(out.blockers.includes('KNOWN_MISS_LIVE_RECALL_INCOMPLETE'));
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
   {providers:{SEARXNG:fail},use_only_injected_providers:true,publicWebOptions:{searxng_endpoint:'',ddg_enabled:false,bing_enabled:false}}
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
   {providers:{SEARXNG:search},use_only_injected_providers:true,publicWebOptions:{searxng_endpoint:'',ddg_enabled:false,bing_enabled:false}}
 );
 assert.equal(out.known_miss_regression.complete,true);
 assert.ok(out.known_miss_live_recall.passed<out.known_miss_live_recall.case_count);
 assert.equal(out.full,false);
 assert.ok(out.blockers.includes('KNOWN_MISS_LIVE_RECALL_INCOMPLETE'));
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
   {providers:{SEARXNG:search},use_only_injected_providers:true,publicWebOptions:{searxng_endpoint:'',ddg_enabled:false,bing_enabled:false}}
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
 assert.equal(p.gap_tasks.length,5);
 assert.ok(p.gap_tasks.every(t=>t.query.includes('October 2026')));
 assert.ok(p.gap_tasks[0].query_variants.includes('Bangkok concert'));
 assert.ok(p.gap_tasks[1].query_variants.includes('Bangkok fanmeeting'));
 assert.ok(p.gap_tasks[2].query_variants.includes('Bangkok lucky fan artist'));
 assert.ok(p.gap_tasks[3].query_variants.includes('Bangkok concert calendar'));
 assert.ok(p.gap_tasks[4].query_variants.some(q=>/performance schedule|ตารางงานศิลปิน/i.test(q)));
 assert.equal(p.gap_tasks[4].source_tier,'BRAND_SPONSOR');
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

test('reference scope accepts current Live Nation Tero /show/ canonical event URLs',()=>{
  const out=Runner.referenceScopeDecision({
    title:'Young K Solo Tour <YOUNGEST> in BANGKOK',
    event_date:'2026-10-10',
    source_url:'https://www.livenationtero.co.th/show/1688334/young-k-solo-tour-youngest-in-bangkok/bangkok/2026-10-10/en'
  },{month:'2026-10',location:'Bangkok Thailand'});
  assert.equal(out.eligible,true);
  assert.equal(out.reason,'ELIGIBLE_REFERENCE');
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



test('reference scope rejects generic Bangkok festival homepage even when a date was inferred',()=>{
  const out=Runner.referenceScopeDecision({
    title:'Home - Bangkok Festivals',
    event_date:'2026-10-05',
    source_url:'https://bangkokfestivals.example/'
  },{month:'2026-10',location:'Bangkok Thailand'});
  assert.equal(out.eligible,false);
  assert.equal(out.reason,'GENERIC_REFERENCE_PAGE');
});

test('reference scope rejects root homepage without an event-specific path',()=>{
  const out=Runner.referenceScopeDecision({
    title:'Bangkok Concert Festival',
    event_date:'2026-10-18',
    source_url:'https://example.com/'
  },{month:'2026-10',location:'Bangkok Thailand'});
  assert.equal(out.eligible,false);
  assert.equal(out.reason,'GENERIC_REFERENCE_PAGE');
});


test('reference scope rejects Eventpop group listing as generic reference page',()=>{
  const out=Runner.referenceScopeDecision({
    title:'Fan Meeting - Eventpop',
    event_date:'2026-10-04',
    source_url:'https://www.eventpop.me/g/fan-meeting'
  },{month:'2026-10',location:'Bangkok Thailand'});
  assert.equal(out.eligible,false);
  assert.equal(out.reason,'GENERIC_REFERENCE_PAGE');
});

test('known-miss canonical alignment reconciles Bai Lu same-date aliases without broad fuzzy matching',()=>{
  const discovered=[{
    title:'WeSpark_ official | 48H COUNTDOWN for MEET&LOVE BAILU SPECIAL BANGKOK',
    event_date:'2026-10-25',
    source_url:'https://www.instagram.com/p/DdyDifwAdOz/'
  }];
  const refs=Runner.scopeReferenceCandidates([{
    title:'blue on X: "#bailu’s 林深时见鹿 personal fan meeting in bangkok"',
    event_date:'2026-10-25',
    source_url:'https://x.com/bailuniverse/status/2101539750658412546'
  }],{month:'2026-10',location:'Bangkok Thailand'});
  const aligned=Runner.alignKnownMissReferences(discovered,refs);
  assert.equal(aligned[0].canonical_known_miss_case,'bai-lu-meet-love-20261025');
  assert.equal(aligned[0].title,discovered[0].title);
  const out=require('../server/kk-ultra-deep-reconciliation.js').reconcileCandidateSets(discovered,aligned);
  assert.equal(out.complete,true);
  assert.equal(out.reconciliation_gap_count,0);
});


test('eligible structured reference missing from discovery is recovered only into verifier candidate pool',()=>{
 const discovered=[{title:'The Weeknd Tue 13 Oct 2026',event_date:'2026-10-13',source_url:'https://example.com/weeknd-13'}];
 const refs=[{title:'The Weeknd Sun 11 Oct 2026',event_date:'2026-10-11',source_url:'https://example.com/weeknd-11',eligible_for_discovery:true}];
 const out=Runner.recoverEligibleReferenceCandidates(discovered,refs);
 assert.equal(out.recovered_count,1);assert.equal(out.candidates.length,2);
 assert.equal(out.candidates[1].candidate_origin,'INDEPENDENT_REFERENCE_RECOVERY');
 assert.equal(out.candidates[1].verifier_required,true);assert.equal(out.candidates[1].authoritative,false);
});

test('ineligible reference is never recovered into verifier candidate pool',()=>{
 const out=Runner.recoverEligibleReferenceCandidates([],[{title:'Generic Event',event_date:'2026-10-11',source_url:'https://example.com/x',eligible_for_discovery:false}]);
 assert.equal(out.recovered_count,0);assert.equal(out.candidates.length,0);
});

test('failed FULL gates expose bounded source/task/provider receipts without provider payloads',async()=>{
 const out=await Runner.runMonthlyUltraDeep({month:'2026-10',location:'Bangkok Metropolitan Region Thailand'}, {
  use_only_injected_providers:true,publicWebOptions:{ddg_enabled:false,bing_enabled:false,searxng_endpoint:''},
  providers:{EXA:async()=>{throw Object.assign(new Error('secret-provider-payload'),{code:'sensitive-token'});}}
 });
 assert.equal(out.full,false);
 assert.ok(out.diagnostic);
 assert.equal(out.diagnostic.gates.source_universe.expected,true);
 assert.equal(out.diagnostic.gates.source_universe.observed,false);
 assert.equal(out.diagnostic.gates.discovery.observed,false);
 assert.ok(out.diagnostic.receipts.discovery.length>20);
 assert.ok(out.diagnostic.receipts.discovery.some(r=>r.source_id==='eventpop'));
 assert.ok(out.diagnostic.receipts.discovery.every(r=>r.attempts.some(a=>a.provider==='EXA'&&a.status==='PROVIDER_ERROR')));
 assert.equal(JSON.stringify(out.diagnostic).includes('sensitive-token'),false);
 assert.equal(JSON.stringify(out.diagnostic).includes('secret-provider-payload'),false);
 assert.equal(out.diagnostic.production_writes,0);
});

test('operational discovery can proceed without exhaustive audit gates',async()=>{
 const search=async task=>task.source_tier==='OFFICIAL'
   ? [{title:'Bangkok Fanmeeting',event_date:'2026-10-20',source_url:'https://proof.example/fanmeeting'}]
   : [];
 const out=await Runner.runOperationalDiscovery(
   {month:'2026-10',location:'Bangkok Metropolitan Region Thailand'},
   {providers:{SEARXNG:search},use_only_injected_providers:true,publicWebOptions:{searxng_endpoint:'',ddg_enabled:false,bing_enabled:false}}
 );
 assert.equal(out.mode,'SMART_OPERATIONAL');
 assert.equal(out.status,'READY_FOR_VERIFIER');
 assert.equal(out.operational_ready,true);
 assert.equal(out.audit_required,true);
 assert.equal(out.audit_blocking,false);
 assert.ok(out.candidate_count>0);
 assert.equal(out.production_writes,0);
});


test('source-universe receipts are month-bound and attributable to executed provider query',()=>{
 const Registry=require('../server/kk-ultra-deep-source-registry.js');
 const task={source_id:'eventpop',source_tier:'TICKETING',query:'Eventpop October 2026 Bangkok'};
 const plan={range:{month:'2026-10'},gap_tasks:[task]};
 const exec={results:[{status:'EVIDENCE_FOUND',provider:'SEARXNG',
  candidates:[{title:'Bangkok event',event_date:'2026-10-20',source_url:'https://example.com/event'}],
  attempts:[{provider:'EXA',status:'PROVIDER_ERROR',query:task.query},
    {provider:'SEARXNG',status:'EVIDENCE_FOUND',count:1,query:task.query}]
 }]};
 const receipts=Runner.sourceUniverseReceipts(plan,exec);
 assert.equal(receipts.length,1);
 assert.equal(receipts[0].month,'2026-10');
 assert.equal(receipts[0].task_source_id,'eventpop');
 assert.equal(receipts[0].provider,'SEARXNG');
 assert.equal(receipts[0].candidate_count,1);
 assert.equal(receipts[0].attempts.length,1,'provider errors are excluded from execution receipts');
 const live=Registry.buildUniverseProof(receipts,{strict_live:true,month:'2026-10'});
 assert.equal(live.sources.find(x=>x.source_id==='eventpop').pass,true);
 assert.equal(live.complete,false,'other required source receipts still absent');
});
test('source-universe receipts do not count failed queries or unsupported search provider as execution',()=>{
 const plan={range:{month:'2026-10'},gap_tasks:[{source_id:'eventpop',query:'eventpop October 2026'}]};
 const exec={results:[{status:'GAP_UNRESOLVED',provider:null,attempts:[
  {provider:'EXA',status:'PROVIDER_ERROR',query:'eventpop October 2026'},
  {provider:'FAKE_PROVIDER',status:'NO_EVIDENCE',query:'eventpop October 2026'}]}]};
 const receipt=Runner.sourceUniverseReceipts(plan,exec)[0];
 assert.equal(receipt.executed,false);
 assert.equal(receipt.status,'NOT_BOUND');
 assert.equal(receipt.candidate_count,0);
});


test('runner preserves explicit fallback query as authorized live receipt without granting arbitrary queries',()=>{
 const Registry=require('../server/kk-ultra-deep-source-registry.js');
 const task={source_id:'eventpop',source_tier:'TICKETING',
  query:'eventpop Bangkok 2026-10',query_variants:['eventpop ไทย ตุลาคม 2569']};
 const execution={results:[{status:'GAP_UNRESOLVED',provider:null,candidates:[],
  attempts:[{provider:'BING_RSS',status:'NO_EVIDENCE',query:task.query_variants[0]}]}]};
 const receipt=Runner.sourceUniverseReceipts({range:{month:'2026-10'},gap_tasks:[task]},execution)[0];
 assert.deepEqual(receipt.query_variants,task.query_variants);
 assert.equal(receipt.executed,true);
 assert.equal(receipt.status,'NO_EVIDENCE');
 const proof=Registry.buildUniverseProof([receipt],{strict_live:true,month:'2026-10'});
 assert.equal(proof.sources.find(x=>x.source_id==='eventpop').pass,true);
 receipt.attempts=[{provider:'BING_RSS',status:'NO_EVIDENCE',query:'not part of source task'}];
 assert.equal(Registry.buildUniverseProof([receipt],{strict_live:true,month:'2026-10'}).sources.find(x=>x.source_id==='eventpop').pass,false);
});


test('partially executed provider query after time budget is never accepted as FULL source coverage',()=>{
 const Registry=require('../server/kk-ultra-deep-source-registry.js');
 const task={source_id:'eventpop',source_tier:'TICKETING',query:'eventpop Bangkok October 2026',
  query_variants:['eventpop Thai fansign October 2026']};
 const plan={range:{month:'2026-10'},gap_tasks:[task]};
 const execution={results:[{status:'TIME_BUDGET_EXCEEDED',provider:null,candidates:[],
  attempts:[{provider:'BING_RSS',status:'NO_EVIDENCE',query:task.query}]}]};
 const receipt=Runner.sourceUniverseReceipts(plan,execution)[0];
 assert.equal(receipt.executed,false);
 assert.equal(receipt.status,'TIME_BUDGET_EXCEEDED');
 const proof=Registry.buildUniverseProof([receipt],{strict_live:true,month:'2026-10'});
 assert.equal(proof.sources.find(x=>x.source_id==='eventpop').pass,false);
 assert.ok(proof.missing_required_sources.includes('eventpop'));
 const observed=Runner.executionProof(execution);
 assert.equal(observed.complete,false);
 assert.equal(observed.executed_count,0);
});


test('FULL state is impossible when any phase, including preflight, hits shared timeout',()=>{
 const fs=require('node:fs');
 const source=fs.readFileSync(require.resolve('../server/kk-ultra-deep-runtime-runner.js'),'utf8');
 assert.match(source,/const budgetExhausted=\[knownMissExecution,execution,referenceExecution\]\.some\(/);
 assert.match(source,/\|\|preflight\.result\.status==='TIME_BUDGET_EXCEEDED'/);
 assert.match(source,/const complete=!budgetExhausted && binding\.unknown_url_search_bound/);
 assert.match(source,/\.\.\.\(budgetExhausted\?\['INCOMPLETE_TIME_BUDGET'\]:\[\]\)/);
});

test('November known-miss phase scans November only, including booked Nov28 as evidence not a publish instruction',()=>{
 const nov=Runner.buildKnownMissPlan('2026-11');
 const oct=Runner.buildKnownMissPlan('2026-10');
 assert.equal(nov.month,'2026-11');
 assert.ok(nov.gap_tasks.length>0);
 assert.ok(nov.gap_tasks.length<KnownMiss.CORPUS.length);
 for(const task of nov.gap_tasks){
  const id=task.source_id.replace('knownmiss:','');
  const c=KnownMiss.CORPUS.find(x=>x.case_id===id);
  assert.ok(c);
  assert.ok(c.event_date.startsWith('2026-11')||(c.discovery_months||[]).includes('2026-11'));
 }
 assert.ok(nov.gap_tasks.some(x=>x.source_id==='knownmiss:lolli-bevertonliew-20261128'));
 assert.ok(!nov.gap_tasks.some(x=>x.source_id==='knownmiss:beautybuffet-liptok-auausave-20261009'));
 assert.ok(oct.gap_tasks.some(x=>x.source_id==='knownmiss:beautybuffet-liptok-auausave-20261009'));
 assert.ok(!oct.gap_tasks.some(x=>x.source_id==='knownmiss:lolli-jamessu-20261127'));
 assert.equal(nov.production_writes,0);
});
