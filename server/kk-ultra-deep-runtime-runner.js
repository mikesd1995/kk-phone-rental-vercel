'use strict';

const MonthlyPlan=require('./kk-monthly-deep-scan-query-plan.js');
const ProviderExecutor=require('./kk-ultra-deep-provider-executor.js');
const PublicWeb=require('./kk-ultra-deep-public-web-adapters.js');
const SourceRegistry=require('./kk-ultra-deep-source-registry.js');
const Reconciliation=require('./kk-ultra-deep-reconciliation.js');
const KnownMiss=require('./kk-ultra-deep-known-miss-regression.js');

const VERSION='KK_ULTRA_DEEP_RUNTIME_RUNNER_V13';
const UNKNOWN_SEARCH_PROVIDERS=new Set(['LIVENATION_PUBLIC','BING_RSS','DDG_HTML','BING_HTML','SEARXNG','DDGS_TRAFILATURA','CRAWL4AI','EXA']);

function text(v){return String(v==null?'':v).trim();}
function attemptExecuted(attempt={}){
  return UNKNOWN_SEARCH_PROVIDERS.has(text(attempt.provider).toUpperCase()) &&
    ['EVIDENCE_FOUND','NO_EVIDENCE'].includes(text(attempt.status).toUpperCase());
}
function candidateDate(v){return text(v&&v.event_date).slice(0,10);}
function filterExcludedDates(rows=[],plan={}){const excluded=new Set((plan.excluded_dates||[]).map(text));return {eligible:(rows||[]).filter(x=>!excluded.has(candidateDate(x))),excluded:(rows||[]).filter(x=>excluded.has(candidateDate(x)))};}
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
      providers:['LIVENATION_PUBLIC','BING_RSS','DDG_HTML','BING_HTML','SEARXNG','DDGS_TRAFILATURA','CRAWL4AI','EXA'],
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
        providers:['LIVENATION_PUBLIC','BING_RSS','DDG_HTML','BING_HTML','SEARXNG','DDGS_TRAFILATURA','CRAWL4AI','EXA'],
        evidence_required:true
      };
    }),
    production_writes:0
  };
}

const REFERENCE_EVENT_RE=/(concert|fan\s*-?\s*meet|fanmeet|fancon|fansign|showcase|festival|world\s+tour|live\s+in|award|premiere|birthday|คอนเสิร์ต|แฟนมีต|แฟนคอน|แฟนไซน์|โชว์เคส|เฟสติวัล|งานแฟน|อีเวนต์ศิลปิน)/i;
const REFERENCE_NOISE_RE=/(\bcodes?\b|breathwork|masterclass|workshop|webinar|anniversary memories album|เกม|รหัสเกม)/i;
const REFERENCE_FOREIGN_RE=/(hong\s+kong|singapore|kuala\s+lumpur|manila|jakarta|taipei|tokyo|osaka|seoul|ho\s+chi\s+minh|hanoi)/i;

function trustedEventPath(value){
 try{
  const u=new URL(text(value));
  const host=u.hostname.toLowerCase();
  const path=u.pathname.toLowerCase();
  if(host.endsWith('eventpop.me')) return /^\/e\//.test(path);
  if(host.endsWith('thaiticketmajor.com')) return /^\/(concert|performance|event)\//.test(path);
  if(host.endsWith('ticketmelon.com')) return path.split('/').filter(Boolean).length>=2;
  if(host.endsWith('livenationtero.co.th')) return /^\/show\//.test(path)||/^\/[^/]*event\//.test(path)||path.includes('/event/');
  if(host.endsWith('songkick.com')) return path.includes('/concerts/');
  return false;
 }catch(_){return false;}
}

function referenceScopeDecision(row={},context={}){
 const title=text(row.title||row.event_name);
 const eventDate=text(row.event_date);
 const month=text(context.month);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return {eligible:false,reason:'NO_STRUCTURED_DATE'};
 if(month&&!eventDate.startsWith(month+'-')) return {eligible:false,reason:'OUTSIDE_TARGET_MONTH'};
 if(REFERENCE_NOISE_RE.test(title)) return {eligible:false,reason:'NON_RENTAL_EVENT_NOISE'};
 if(/^\s*home\s*(?:[-|:–—]\s*.*)?$/i.test(title)) return {eligible:false,reason:'GENERIC_REFERENCE_PAGE'};
 try{
  const u=new URL(text(row.source_url));
  const host=u.hostname.toLowerCase();
  const path=(u.pathname||'/').toLowerCase();
  if(host.endsWith('eventpop.me')&&/^\/g(?:\/|$)/.test(path)) return {eligible:false,reason:'GENERIC_REFERENCE_PAGE'};
  if(/\/(search|category|categories)(?:\/|$)/.test(path)) return {eligible:false,reason:'GENERIC_REFERENCE_PAGE'};
 }catch(_){}
 try{
  const u=new URL(text(row.source_url));
  const path=(u.pathname||'/').replace(/\/+$/,'')||'/';
  if(path==='/'&&!trustedEventPath(row.source_url)) return {eligible:false,reason:'GENERIC_REFERENCE_PAGE'};
 }catch(_){}
 if(REFERENCE_FOREIGN_RE.test(title)||/\.hk$/i.test((()=>{try{return new URL(text(row.source_url)).hostname}catch(_){return''}})())) return {eligible:false,reason:'OUTSIDE_BANGKOK_SCOPE'};
 if(!REFERENCE_EVENT_RE.test(title)&&!trustedEventPath(row.source_url)) return {eligible:false,reason:'EVENT_IDENTITY_NOT_STRONG_ENOUGH'};
 return {eligible:true,reason:'ELIGIBLE_REFERENCE'};
}

function scopeReferenceCandidates(rows=[],context={}){
 return (Array.isArray(rows)?rows:[]).map(row=>{
  const decision=referenceScopeDecision(row,context);
  return {...row,eligible_for_discovery:decision.eligible,reference_scope_reason:decision.reason};
 });
}

function alignKnownMissReferences(discovered=[],references=[]){
 const rows=Array.isArray(discovered)?discovered:[];
 return (Array.isArray(references)?references:[]).map(row=>{
  if(row&&row.eligible_for_discovery===false) return row;
  const caseRow=KnownMiss.CORPUS.find(c=>KnownMiss.sameCase(row,c));
  if(!caseRow) return row;
  const matched=rows.find(c=>KnownMiss.sameCase(c,caseRow));
  if(!matched) return row;
  return {...row,title:text(matched.title)||row.title,canonical_known_miss_case:caseRow.case_id,canonical_reference_title:text(row.title||row.event_name)||null};
 });
}

function recoverEligibleReferenceCandidates(discovered=[],references=[]){
 const out=[...(Array.isArray(discovered)?discovered:[])];
 const titleDate=new Set(out.filter(Reconciliation.hasComparableEventIdentity).map(Reconciliation.reconcileKey));
 const sourceDate=new Set(out.map(Reconciliation.sourceDateKey).filter(Boolean));
 let recovered=0;
 for(const row of Array.isArray(references)?references:[]){
  if(!row||row.eligible_for_discovery===false||!Reconciliation.hasComparableEventIdentity(row))continue;
  const rk=Reconciliation.reconcileKey(row),sk=Reconciliation.sourceDateKey(row);
  if(titleDate.has(rk)||(sk&&sourceDate.has(sk)))continue;
  const next={...row,candidate_origin:'INDEPENDENT_REFERENCE_RECOVERY',verifier_required:true,authoritative:false};
  out.push(next);titleDate.add(rk);if(sk)sourceDate.add(sk);recovered++;
 }
 return {candidates:out,recovered_count:recovered};
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

// Only project fixed contract fields. Provider payloads, URLs, queries and raw
// errors must never reach the machine diagnostic response.
function diagnosticReceipts(plan={},execution={}){
 const tasks=Array.isArray(plan.gap_tasks)?plan.gap_tasks:[];
 return tasks.map((task,index)=>{
  const result=(execution.results||[])[index]||{};
  const attempts=(result.attempts||[]).map(a=>({
   provider:ProviderExecutor.ALLOWED_PROVIDERS.has(a.provider)?a.provider:'UNKNOWN',
   status:['NOT_BOUND','EVIDENCE_FOUND','NO_EVIDENCE','PROVIDER_ERROR'].includes(a.status)?a.status:'UNKNOWN',
   count:Number.isFinite(a.count)?a.count:0
  }));
  return {task_index:index,source_id:task.source_id||null,source_tier:task.source_tier,
   query_variant_count:ProviderExecutor.queryVariants(task).length,
   executed:(result.attempts||[]).some(attemptExecuted),candidate_count:(result.candidates||[]).length,attempts};
 });
}

async function runOperationalDiscovery(input={},options={}){
  const publicProviders=PublicWeb.createProviders(options.publicWebOptions||{});
  const providers=Object.assign({},publicProviders,options.providers||{});
  const plan=MonthlyPlan.buildOperational(input);
  const execution=await ProviderExecutor.executeGapPlan(plan,{providers,concurrency:Math.min(4,ProviderExecutor.MAX_CONCURRENCY)});
  const rawCandidates=flattenCandidates(execution);
  const dateFilter=filterExcludedDates(rawCandidates,plan);
  const candidates=dateFilter.eligible;
  const proof=executionProof(execution);
  proof.candidate_count=candidates.length;
  proof.has_evidence=candidates.length>0;
  const minimumExecuted=Math.min(3,proof.task_count);
  const operationalReady=proof.has_evidence&&proof.executed_count>=minimumExecuted;
  const blockers=[
    ...(!proof.has_evidence?['OPERATIONAL_DISCOVERY_EMPTY']:[]),
    ...(proof.executed_count<minimumExecuted?['OPERATIONAL_PROVIDER_EVIDENCE_INSUFFICIENT']:[])
  ];
  return {
    version:VERSION,
    mode:'SMART_OPERATIONAL',
    status:operationalReady?'READY_FOR_VERIFIER':'HOLD_FOR_OPERATIONAL_DISCOVERY',
    operational_ready:operationalReady,
    audit_required:true,
    audit_blocking:false,
    month:plan.range.month,
    location:plan.location,
    discovery_proof:proof,
    candidate_count:candidates.length,
    booking_date_excluded_count:dateFilter.excluded.length,
    excluded_dates:plan.excluded_dates||[],
    candidates,
    task_count:proof.task_count,
    executed_task_count:proof.executed_count,
    execution_summary:summarizeExecution(execution),
    blockers,
    authoritative:false,
    verifier_required:true,
    production_writes:0,
    final_truth_mutation:false
  };
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
  const referencePlan=buildReferencePlan({month:plan.range.month,location:plan.location});
  // Main discovery and the independent reference sweep are read-only and independent after
  // the known-miss probe. Run them concurrently and use the executor's bounded max concurrency
  // so production READ_ONLY stays inside the serverless duration without dropping coverage.
  const [execution,referenceExecution]=await Promise.all([
    ProviderExecutor.executeGapPlan(plan,{providers,concurrency:ProviderExecutor.MAX_CONCURRENCY}),
    ProviderExecutor.executeGapPlan(referencePlan,{providers,concurrency:ProviderExecutor.MAX_CONCURRENCY})
  ]);
  const receipts=sourceUniverseReceipts(plan,execution);
  const universe=SourceRegistry.buildUniverseProof(receipts);
  const rawCandidates=flattenCandidates(execution);
  const dateFilter=filterExcludedDates(rawCandidates,plan);
  const candidates=dateFilter.eligible;
  const discoveryProof=executionProof(execution);
  discoveryProof.candidate_count=candidates.length;
  discoveryProof.has_evidence=candidates.length>0;
  discoveryProof.complete=discoveryProof.complete && discoveryProof.has_evidence;

  const referenceCandidates=flattenCandidates(referenceExecution);
  const scopedReferenceCandidates=scopeReferenceCandidates(referenceCandidates,{month:plan.range.month,location:plan.location});
  const referenceProof=executionProof(referenceExecution);
  referenceProof.candidate_count=referenceCandidates.length;
  referenceProof.has_evidence=referenceCandidates.length>0;
  referenceProof.complete=referenceProof.complete && referenceProof.has_evidence;
  const alignedReferenceCandidates=alignKnownMissReferences(candidates,scopedReferenceCandidates);
  const recovered= recoverEligibleReferenceCandidates(candidates,alignedReferenceCandidates);
  const verifierCandidates=recovered.candidates;
  const reconciliation=Reconciliation.reconcileCandidateSets(verifierCandidates,alignedReferenceCandidates);

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
  const diagnostic={
    schema:'KK_ULTRA_DEEP_DISCOVERY_DIAGNOSTIC_V1',full:complete,blockers,
    gates:Object.fromEntries(Object.entries({provider_bound:binding.unknown_url_search_bound,live_search:liveSearchProven,
      source_universe:universe.complete,discovery:discoveryProof.complete,reference:referenceProof.complete,
      reconciliation:reconciliation.complete,known_miss_regression:knownMiss.complete}).map(([gate,observed])=>[gate,{expected:true,observed}])),
    counts:{required_sources:universe.required_source_count,passed_sources:universe.passed_required_source_count,
      discovery_tasks:discoveryProof.task_count,discovery_executed:discoveryProof.executed_count,discovery_candidates:candidates.length,
      reference_tasks:referenceProof.task_count,reference_executed:referenceProof.executed_count,reference_candidates:referenceCandidates.length,
      reference_recovered:recovered.recovered_count,reconciliation_gaps:reconciliation.reconciliation_gap_count,
      known_miss_live_passed:knownMissLive.passed,known_miss_live_total:knownMissLive.case_count},
    missing_required_sources:universe.missing_required_sources,source_tiers:universe.by_tier,
    known_miss_live:{complete:knownMissLive.complete,missing_cases:knownMissLive.missing_cases},
    receipts:{discovery:diagnosticReceipts(plan,execution),reference:diagnosticReceipts(referencePlan,referenceExecution),
      known_miss:diagnosticReceipts(knownMissPlan,knownMissExecution),preflight:diagnosticReceipts({gap_tasks:[{source_tier:'PUBLIC_CALENDAR'}]},{results:[preflight.result]})},
    production_writes:0
  };
  return {
    version:VERSION,
    status:complete?'READY_FOR_VERIFIER':'HOLD_FOR_COVERAGE',
    full:complete,
    blockers,
    diagnostic,
    month:plan.range.month,
    location:plan.location,
    provider_binding:{...binding,live_search_proven:liveSearchProven},
    source_universe:universe,
    discovery_proof:discoveryProof,
    reference_sweep_proof:referenceProof,
    reconciliation,
    known_miss_regression:knownMiss,
    known_miss_live_recall:knownMissLive,
    candidate_count:verifierCandidates.length,
    discovery_candidate_count:candidates.length,
    booking_date_excluded_count:dateFilter.excluded.length,
    excluded_dates:plan.excluded_dates||[],
    reference_recovered_candidate_count:recovered.recovered_count,
    candidates:verifierCandidates,
    reference_candidate_count:referenceCandidates.length,
    eligible_reference_candidate_count:alignedReferenceCandidates.filter(row=>row.eligible_for_discovery!==false).length,
    canonical_reference_alignment_count:alignedReferenceCandidates.filter(row=>row.canonical_known_miss_case).length,
    reference_scope_exclusions:scopedReferenceCandidates.filter(row=>row.eligible_for_discovery===false).reduce((acc,row)=>{const k=row.reference_scope_reason||'EXCLUDED';acc[k]=(acc[k]||0)+1;return acc;},{}),
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
  VERSION,UNKNOWN_SEARCH_PROVIDERS,attemptExecuted,executionProof,candidateDate,filterExcludedDates,flattenCandidates,sourceUniverseReceipts,
  buildReferencePlan,buildKnownMissPlan,referenceScopeDecision,scopeReferenceCandidates,alignKnownMissReferences,recoverEligibleReferenceCandidates,summarizeExecution,providerPreflight,providerBindingState,runOperationalDiscovery,runMonthlyUltraDeep
};
