'use strict';

const MonthlyPlan=require('./kk-monthly-deep-scan-query-plan.js');
const ProviderExecutor=require('./kk-ultra-deep-provider-executor.js');
const PublicWeb=require('./kk-ultra-deep-public-web-adapters.js');
const SourceRegistry=require('./kk-ultra-deep-source-registry.js');
const Reconciliation=require('./kk-ultra-deep-reconciliation.js');
const KnownMiss=require('./kk-ultra-deep-known-miss-regression.js');

const VERSION='KK_ULTRA_DEEP_RUNTIME_RUNNER_V3';
const UNKNOWN_SEARCH_PROVIDERS=new Set(['DDG_HTML','BING_HTML','SEARXNG','DDGS_TRAFILATURA','CRAWL4AI','EXA']);
const HEALTH_PROVIDERS=new Set(['OFFICIAL_DIRECT','RSS_OR_PUBLIC_FEED']);

function text(v){return String(v==null?'':v).trim();}
function upper(v){return text(v).toUpperCase();}
function attemptExecuted(attempt={}){
  return UNKNOWN_SEARCH_PROVIDERS.has(upper(attempt.provider)) &&
    ['EVIDENCE_FOUND','NO_EVIDENCE'].includes(upper(attempt.status));
}
function healthAttemptPassed(attempt={}){
  return HEALTH_PROVIDERS.has(upper(attempt.provider))&&upper(attempt.status)==='EVIDENCE_FOUND';
}
function flattenCandidates(execution={},options={}){
  const out=[];const seen=new Set();
  const includeHealth=options.include_health===true;
  for(const result of Array.isArray(execution.results)?execution.results:[]){
    if(result.health_only===true&&!includeHealth)continue;
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
    const healthOnly=task.health_only===true;
    if(healthOnly){
      const passed=attempts.some(healthAttemptPassed);
      receipts.push({
        source_id:task.source_id,
        source_tier:task.source_tier,
        proof_mode:'SOURCE_HEALTH',
        executed:passed,
        status:passed?'HEALTH_OK':'HEALTH_FAILED',
        provider:(attempts.find(healthAttemptPassed)||{}).provider||null
      });
      continue;
    }
    const executed=attempts.some(attemptExecuted);
    receipts.push({
      source_id:task.source_id,
      source_tier:task.source_tier,
      proof_mode:'DISCOVERY_EXECUTION',
      executed,
      status:executed?(result.status==='EVIDENCE_FOUND'?'EVIDENCE_FOUND':'EXECUTED_NO_MATCH'):'NOT_EXECUTED',
      provider:result.provider||null
    });
  }
  return receipts;
}
function buildTierEvidenceProof(execution={}){
  const required=Object.keys(SourceRegistry.REGISTRY);
  const counts=Object.fromEntries(required.map(t=>[t,0]));
  for(const r of Array.isArray(execution.results)?execution.results:[]){
    if(r.health_only===true||r.status!=='EVIDENCE_FOUND')continue;
    const tier=upper(r.source_tier);
    if(Object.hasOwn(counts,tier))counts[tier]++;
  }
  const missing=required.filter(t=>counts[t]<1);
  return {
    complete:missing.length===0,
    required_tiers:required,
    evidence_count_by_tier:counts,
    missing_evidence_tiers:missing
  };
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
    version:'KK_ULTRA_DEEP_REFERENCE_SWEEP_V2',
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
    version:'KK_ULTRA_DEEP_KNOWN_MISS_PROBE_V2',
    gap_tasks:KnownMiss.CORPUS.map(c=>{
      const seeds=Array.isArray(c.seed_urls)?c.seed_urls:[];
      return {
        source_tier:'SOCIAL',
        source_id:'knownmiss:'+c.case_id,
        query:[c.title,...(Array.isArray(c.aliases)?c.aliases:[]),c.event_date,'Bangkok Thailand'].filter(Boolean).join(' '),
        seed_urls:seeds,
        providers:seeds.length
          ? ['OFFICIAL_DIRECT','DDG_HTML','BING_HTML','SEARXNG','DDGS_TRAFILATURA','CRAWL4AI','EXA']
          : ['DDG_HTML','BING_HTML','SEARXNG','DDGS_TRAFILATURA','CRAWL4AI','EXA'],
        evidence_required:true
      };
    }),
    production_writes:0
  };
}
function buildReferenceExecutionProof(execution={},referenceCandidates=[]){
  const results=Array.isArray(execution.results)?execution.results:[];
  const executed=results.filter(r=>(r.attempts||[]).some(attemptExecuted)).length;
  return {
    complete:results.length>0&&executed===results.length&&referenceCandidates.length>0,
    task_count:results.length,
    executed_task_count:executed,
    reference_candidate_count:referenceCandidates.length,
    empty:referenceCandidates.length===0
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
      const p=upper(a.provider)||'UNKNOWN';
      const s=upper(a.status)||'UNKNOWN';
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
  const tierEvidence=buildTierEvidenceProof(execution);
  const candidates=flattenCandidates(execution);

  const referencePlan=buildReferencePlan({month:plan.range.month,location:plan.location});
  const referenceExecution=await ProviderExecutor.executeGapPlan(referencePlan,{providers});
  const referenceCandidates=flattenCandidates(referenceExecution);
  const referenceProof=buildReferenceExecutionProof(referenceExecution,referenceCandidates);
  const reconciliation=Reconciliation.reconcileCandidateSets(candidates,referenceCandidates,{require_reference:true});

  const knownMissPlan=buildKnownMissPlan();
  const knownMissExecution=await ProviderExecutor.executeGapPlan(knownMissPlan,{providers});
  const knownMissCandidates=flattenCandidates(knownMissExecution,{include_health:true});
  const knownMiss=KnownMiss.evaluate(knownMissCandidates,input.known_miss_classifications||[]);

  const complete=binding.unknown_url_search_bound &&
    universe.execution_complete &&
    tierEvidence.complete &&
    referenceProof.complete &&
    reconciliation.complete &&
    knownMiss.complete;
  const blockers=[
    ...(!binding.unknown_url_search_bound?['UNKNOWN_URL_SEARCH_NOT_BOUND']:[]),
    ...(!universe.execution_complete?['SOURCE_UNIVERSE_EXECUTION_INCOMPLETE']:[]),
    ...(!tierEvidence.complete?['SOURCE_TIER_EVIDENCE_INCOMPLETE']:[]),
    ...(!referenceProof.complete?['REFERENCE_SWEEP_EMPTY_OR_UNHEALTHY']:[]),
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
    source_tier_evidence:tierEvidence,
    reference_proof:referenceProof,
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
  VERSION,UNKNOWN_SEARCH_PROVIDERS,HEALTH_PROVIDERS,attemptExecuted,healthAttemptPassed,
  flattenCandidates,sourceUniverseReceipts,buildTierEvidenceProof,buildReferencePlan,
  buildKnownMissPlan,buildReferenceExecutionProof,summarizeExecution,providerBindingState,
  runMonthlyUltraDeep
};
