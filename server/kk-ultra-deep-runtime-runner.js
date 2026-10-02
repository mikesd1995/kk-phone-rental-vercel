'use strict';

const MonthlyPlan=require('./kk-monthly-deep-scan-query-plan.js');
const ProviderExecutor=require('./kk-ultra-deep-provider-executor.js');
const PublicWeb=require('./kk-ultra-deep-public-web-adapters.js');
const SourceRegistry=require('./kk-ultra-deep-source-registry.js');
const Reconciliation=require('./kk-ultra-deep-reconciliation.js');
const KnownMiss=require('./kk-ultra-deep-known-miss-regression.js');

const VERSION='KK_ULTRA_DEEP_RUNTIME_RUNNER_V5';
const UNKNOWN_SEARCH_PROVIDERS=new Set(['DDG_HTML','BING_HTML','SEARXNG','DDGS_TRAFILATURA','CRAWL4AI','EXA']);

function text(v){return String(v==null?'':v).trim();}
function attemptExecuted(attempt={}){
  return UNKNOWN_SEARCH_PROVIDERS.has(text(attempt.provider).toUpperCase()) &&
    ['EVIDENCE_FOUND','NO_EVIDENCE'].includes(text(attempt.status).toUpperCase());
}
function flattenCandidates(execution={}){
  const out=[];const seen=new Set();
  for(const result of Array.isArray(execution.results)?execution.results:[]){
    for(const c of Array.isArray(result.candidates)?result.candidates:[]){
      const k=Reconciliation.key(c)+'|'+text(c.source_url);
      if(seen.has(k))continue;seen.add(k);out.push(c);
    }
  }
  return out;
}
function executionProof(execution={}){
  const results=Array.isArray(execution.results)?execution.results:[];
  const rows=results.map((result,index)=>{
    const attempts=Array.isArray(result&&result.attempts)?result.attempts:[];
    const executed=attempts.some(attemptExecuted);
    return {index,executed,status:text(result&&result.status)||'MISSING'};
  });
  return {complete:rows.length>0&&rows.every(x=>x.executed),task_count:rows.length,executed_count:rows.filter(x=>x.executed).length,rows};
}
function sourceUniverseReceipts(plan={},execution={}){
  const tasks=Array.isArray(plan.gap_tasks)?plan.gap_tasks:[];
  const results=Array.isArray(execution.results)?execution.results:[];
  const receipts=[];
  for(let i=0;i<tasks.length;i++){
    const task=tasks[i];if(!task.source_id)continue;
    const result=results[i]||{};
    const attempts=Array.isArray(result.attempts)?result.attempts:[];
    const executed=attempts.some(attemptExecuted);
    receipts.push({
      source_id:task.source_id,
      executed,
      status:executed?(result.status==='EVIDENCE_FOUND'?'EVIDENCE_FOUND':'NO_EVIDENCE'):'NOT_BOUND',
      provider:result.provider||null
    });
  }
  return receipts;
}
function buildReferencePlan(input={}){
  const month=text(input.month);
  const labels=SourceRegistry.monthLabels(month);
  const location=text(input.location)||'Bangkok Thailand';
  // Reference sweep is independent from discovery, but uses the same bounded
  // exact-to-broad fallback principle. Search engines can return zero for long
  // month/location phrases even when shorter reference intents are healthy.
  const groups=[
    ['Bangkok '+labels.en+' concert',labels.en+' Bangkok concerts','คอนเสิร์ต กรุงเทพ '+labels.th,'Bangkok concert','Thailand concert'],
    ['Bangkok '+labels.en+' fan meeting',labels.en+' Bangkok fanmeeting fancon','แฟนมีต กรุงเทพ '+labels.th,'Bangkok fanmeeting','Bangkok fancon'],
    ['Bangkok '+labels.en+' lucky fan artist event','artist brand event Bangkok '+labels.en,'กิจกรรมศิลปิน ลัคกี้แฟน กรุงเทพ '+labels.th,'Bangkok lucky fan artist','Bangkok artist brand event'],
    ['Bangkok '+labels.en+' event calendar','Thailand '+labels.en+' concert calendar','ตารางคอนเสิร์ต กรุงเทพ '+labels.th,'Bangkok concert calendar','Thailand concert calendar']
  ];
  return {
    version:'KK_ULTRA_DEEP_REFERENCE_SWEEP_V2',
    gap_tasks:groups.map((queries,i)=>({
      source_tier:i===2?'BRAND_SPONSOR':'PUBLIC_CALENDAR',
      source_id:'reference-'+(i+1),
      query:queries[0],
      query_variants:queries.slice(1),
      providers:['DDG_HTML','BING_HTML','SEARXNG','DDGS_TRAFILATURA','CRAWL4AI','EXA'],
      evidence_required:true
    })),
    production_writes:0
  };
}
function buildKnownMissPlan(){
  return {
    version:'KK_ULTRA_DEEP_KNOWN_MISS_PROBE_V2',
    gap_tasks:KnownMiss.CORPUS.map(c=>{
      const phrases=[c.title,...(Array.isArray(c.aliases)?c.aliases:[])].map(text).filter(Boolean);
      const evidenceQueries=(Array.isArray(c.search_queries)?c.search_queries:[]).map(text).filter(Boolean);
      const queries=[...new Set([...evidenceQueries,...phrases.map(v=>v+' Bangkok Thailand')])];
      return {
        source_tier:'SOCIAL',
        source_id:'knownmiss:'+c.case_id,
        query:queries[0]||[c.title,c.event_date,'Bangkok Thailand'].filter(Boolean).join(' '),
        query_variants:queries.slice(1),
        providers:['DDG_HTML','BING_HTML','SEARXNG','DDGS_TRAFILATURA','CRAWL4AI','EXA'],
        evidence_required:true
      };
    }),
    production_writes:0
  };
}

function summarizeExecution(execution={}){
  const out={tasks:0,evidence_found:0,gap_unresolved:0,attempts:{},provider_errors:{},not_bound:{}};
  const results=Array.isArray(execution.results)?execution.results:[];
  out.tasks=results.length;
  for(const r of results){
    if(r.status==='EVIDENCE_FOUND')out.evidence_found++;
    else out.gap_unresolved++;
    for(const a of Array.isArray(r.attempts)?r.attempts:[]){
      const p=text(a.provider).toUpperCase()||'UNKNOWN';
      const s=text(a.status).toUpperCase()||'UNKNOWN';
      const key=p+':'+s;out.attempts[key]=(out.attempts[key]||0)+1;
      if(s==='PROVIDER_ERROR')out.provider_errors[p]=(out.provider_errors[p]||0)+1;
      if(s==='NOT_BOUND')out.not_bound[p]=(out.not_bound[p]||0)+1;
    }
  }
  return out;
}

async function providerPreflight(providers={},input={}){
 const probe={source_tier:'PUBLIC_CALENDAR',query:['Bangkok',text(input.month),'concert'].filter(Boolean).join(' '),providers:[...UNKNOWN_SEARCH_PROVIDERS],evidence_required:true};
 const result=await ProviderExecutor.executeGapTask(probe,{providers});
 const usable=new Set((result.attempts||[]).filter(a=>a.status==='EVIDENCE_FOUND').map(a=>text(a.provider).toUpperCase()));
 if(result.provider)usable.add(text(result.provider).toUpperCase());
 return {status:usable.size?'READY':'NO_LIVE_SEARCH_EVIDENCE',usable:[...usable],result};
}
function providerBindingState(providers={}){
  const bound=[...UNKNOWN_SEARCH_PROVIDERS].filter(p=>typeof providers[p]==='function');
  return {bound,unknown_url_search_bound:bound.length>0};
}

async function runMonthlyUltraDeep(input={},options={}){
  const publicProviders=PublicWeb.createProviders(options.publicWebOptions||{});
  const providers=Object.assign({},publicProviders,options.providers||{});
  const binding=providerBindingState(providers);
  // Execute the bounded historical probes first. Live HTML search providers may
  // soft-throttle after a large sweep; putting the small regression corpus first
  // prevents broad discovery traffic from starving the recall gate.
  const knownMissPlan=buildKnownMissPlan();
  const knownMissExecution=await ProviderExecutor.executeGapPlan(knownMissPlan,{providers});
  const knownMissCandidates=flattenCandidates(knownMissExecution);

  const plan=MonthlyPlan.build(input);
  const execution=await ProviderExecutor.executeGapPlan(plan,{providers});
  const receipts=sourceUniverseReceipts(plan,execution);
  const universe=SourceRegistry.buildUniverseProof(receipts);
  const candidates=flattenCandidates(execution);
  const discoveryProof=executionProof(execution);
  discoveryProof.candidate_count=candidates.length;
  discoveryProof.has_evidence=candidates.length>0;
  discoveryProof.complete=discoveryProof.complete && discoveryProof.has_evidence;

  const referencePlan=buildReferencePlan({month:plan.range.month,location:plan.location});
  const referenceExecution=await ProviderExecutor.executeGapPlan(referencePlan,{providers});
  const referenceCandidates=flattenCandidates(referenceExecution);
  const referenceProof=executionProof(referenceExecution);
  referenceProof.candidate_count=referenceCandidates.length;
  referenceProof.has_evidence=referenceCandidates.length>0;
  referenceProof.complete=referenceProof.complete && referenceProof.has_evidence;
  const reconciliation=Reconciliation.reconcileCandidateSets(candidates,referenceCandidates);

  // Preflight is intentionally evaluated only after the established evidence
  // sequence, so it can gate completion without changing known-miss/discovery/
  // reference ordering or hiding their diagnostics.
  const preflight=await providerPreflight(providers,input);
  binding.preflight=preflight;

  // A known miss is recovered if any governed live discovery path finds it.
  // Do not discard a valid main/reference sweep hit merely because the dedicated
  // probe endpoint returned no results.
  const knownMissEvidence=[...knownMissCandidates,...candidates,...referenceCandidates];
  const knownMissLive=KnownMiss.evaluate(knownMissEvidence,input.known_miss_classifications||[]);
  const knownMiss=KnownMiss.evaluateFixtureRegression();

  const liveSearchProven=preflight.status==='READY' || discoveryProof.has_evidence || referenceProof.has_evidence || knownMissCandidates.length>0;
  const complete=binding.unknown_url_search_bound && liveSearchProven && universe.complete && discoveryProof.complete && referenceProof.complete && reconciliation.complete && knownMiss.complete;
  const blockers=[
    ...(!binding.unknown_url_search_bound?['UNKNOWN_URL_SEARCH_NOT_BOUND']:[]),
    ...(binding.unknown_url_search_bound&&!liveSearchProven?['UNKNOWN_URL_SEARCH_PREFLIGHT_FAILED']:[]),
    ...(!universe.complete?['SOURCE_UNIVERSE_INCOMPLETE']:[]),
    ...(!discoveryProof.complete?['DISCOVERY_EVIDENCE_EMPTY']:[]),
    ...(!referenceProof.complete?['REFERENCE_SWEEP_INCOMPLETE']:[]),
    ...(!reconciliation.complete?['RECONCILIATION_GAPS_REMAIN']:[]),
    ...(!knownMiss.complete?['KNOWN_MISS_REGRESSION_INCOMPLETE']:[])
  ];
  return {
    version:VERSION,
    status:complete?'READY_FOR_VERIFIER':'HOLD_FOR_COVERAGE',
    full:complete,
    blockers,
    month:plan.range.month,
    location:plan.location,
    provider_binding:{...binding,live_search_proven:liveSearchProven},
    source_universe:universe,
    discovery_proof:discoveryProof,
    reference_sweep_proof:referenceProof,
    reconciliation,
    known_miss_regression:knownMiss,
    known_miss_live_recall:knownMissLive,
    candidate_count:candidates.length,
    candidates,
    reference_candidate_count:referenceCandidates.length,
    execution_summary:{
      discovery_status:execution.status,
      reference_status:referenceExecution.status,
      known_miss_status:knownMissExecution.status,
      discovery:summarizeExecution(execution),
      reference:summarizeExecution(referenceExecution),
      known_miss:summarizeExecution(knownMissExecution)
    },
    authoritative:false,
    verifier_required:true,
    production_writes:0,
    final_truth_mutation:false
  };
}

module.exports={
  VERSION,UNKNOWN_SEARCH_PROVIDERS,attemptExecuted,executionProof,flattenCandidates,sourceUniverseReceipts,
  buildReferencePlan,buildKnownMissPlan,summarizeExecution,providerPreflight,providerBindingState,runMonthlyUltraDeep
};
