'use strict';

const MonthlyPlan=require('./kk-monthly-deep-scan-query-plan.js');
const ProviderExecutor=require('./kk-ultra-deep-provider-executor.js');
const PublicWeb=require('./kk-ultra-deep-public-web-adapters.js');
const SourceRegistry=require('./kk-ultra-deep-source-registry.js');
const Reconciliation=require('./kk-ultra-deep-reconciliation.js');
const KnownMiss=require('./kk-ultra-deep-known-miss-regression.js');

const VERSION='KK_ULTRA_DEEP_RUNTIME_RUNNER_V2';
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
  const location=text(input.location)||'Bangkok Thailand';
  const queries=[
    'concert fanmeeting fancon fansign '+month+' '+location,
    'lucky fan top spender artist event '+month+' '+location,
    'คอนเสิร์ต แฟนมีต แฟนไซน์ กิจกรรมศิลปิน '+month+' กรุงเทพ',
    'Bangkok event calendar artist '+month
  ];
  return {
    version:'KK_ULTRA_DEEP_REFERENCE_SWEEP_V1',
    gap_tasks:queries.map((query,i)=>({
      source_tier:i===1?'BRAND_SPONSOR':'PUBLIC_CALENDAR',
      source_id:'reference-'+(i+1),
      query,
      providers:['DDG_HTML','BING_HTML','SEARXNG','DDGS_TRAFILATURA','CRAWL4AI','EXA'],
      evidence_required:true
    })),
    production_writes:0
  };
}
function buildKnownMissPlan(){
  return {
    version:'KK_ULTRA_DEEP_KNOWN_MISS_PROBE_V1',
    gap_tasks:KnownMiss.CORPUS.map(c=>({
      source_tier:'SOCIAL',
      source_id:'knownmiss:'+c.case_id,
      query:[c.title,...(Array.isArray(c.aliases)?c.aliases:[]),c.event_date,'Bangkok Thailand'].filter(Boolean).join(' '),
      providers:['DDG_HTML','BING_HTML','SEARXNG','DDGS_TRAFILATURA','CRAWL4AI','EXA'],
      evidence_required:true
    })),
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

function providerBindingState(providers={}){
  const bound=[...UNKNOWN_SEARCH_PROVIDERS].filter(p=>typeof providers[p]==='function');
  return {bound,unknown_url_search_bound:bound.length>0};
}

async function runMonthlyUltraDeep(input={},options={}){
  const publicProviders=PublicWeb.createProviders(options.publicWebOptions||{});
  const providers=Object.assign({},publicProviders,options.providers||{});
  const binding=providerBindingState(providers);
  const plan=MonthlyPlan.build(input);
  const execution=await ProviderExecutor.executeGapPlan(plan,{providers});
  const receipts=sourceUniverseReceipts(plan,execution);
  const universe=SourceRegistry.buildUniverseProof(receipts);
  const candidates=flattenCandidates(execution);

  const referencePlan=buildReferencePlan({month:plan.range.month,location:plan.location});
  const referenceExecution=await ProviderExecutor.executeGapPlan(referencePlan,{providers});
  const referenceCandidates=flattenCandidates(referenceExecution);
  const reconciliation=Reconciliation.reconcileCandidateSets(candidates,referenceCandidates);

  const knownMissPlan=buildKnownMissPlan();
  const knownMissExecution=await ProviderExecutor.executeGapPlan(knownMissPlan,{providers});
  const knownMissCandidates=flattenCandidates(knownMissExecution);
  const knownMiss=KnownMiss.evaluate(knownMissCandidates,input.known_miss_classifications||[]);

  const complete=binding.unknown_url_search_bound && universe.complete && reconciliation.complete && knownMiss.complete;
  const blockers=[
    ...(!binding.unknown_url_search_bound?['UNKNOWN_URL_SEARCH_NOT_BOUND']:[]),
    ...(!universe.complete?['SOURCE_UNIVERSE_INCOMPLETE']:[]),
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
    provider_binding:binding,
    source_universe:universe,
    reconciliation,
    known_miss_regression:knownMiss,
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
  VERSION,UNKNOWN_SEARCH_PROVIDERS,attemptExecuted,flattenCandidates,sourceUniverseReceipts,
  buildReferencePlan,buildKnownMissPlan,summarizeExecution,providerBindingState,runMonthlyUltraDeep
};
