'use strict';

const MonthlyPlan=require('./kk-monthly-deep-scan-query-plan.js');
const ProviderExecutor=require('./kk-ultra-deep-provider-executor.js');
const PublicWeb=require('./kk-ultra-deep-public-web-adapters.js');
const SourceRegistry=require('./kk-ultra-deep-source-registry.js');
const Reconciliation=require('./kk-ultra-deep-reconciliation.js');
const KnownMiss=require('./kk-ultra-deep-known-miss-regression.js');

const VERSION='KK_ULTRA_DEEP_RUNTIME_RUNNER_V16';
const UNKNOWN_SEARCH_PROVIDERS=new Set(['LIVENATION_PUBLIC','BING_RSS','DDG_HTML','BING_HTML','SEARXNG','DDGS_TRAFILATURA','CRAWL4AI','EXA']);

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
    const timedOut=attempts.some(a=>a.status==='TIME_BUDGET_EXHAUSTED');
    receipts.push({
      source_id:task.source_id,
      executed,
      status:executed?(result.status==='EVIDENCE_FOUND'?'EVIDENCE_FOUND':'NO_EVIDENCE'):(timedOut?'TIME_BUDGET_EXHAUSTED':'NOT_BOUND'),
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
    ['Bangkok '+labels.en+' lucky fan artist event','artist brand event Bangkok '+labels.en,'กิจกรรมศิลปิน ลัคกี้แฟน กรุงเทพ '+labels.th,'Bangkok lucky fan artist','Bangkok artist brand event','purchase register redeem winner announcement artist Bangkok','ซื้อครบ สะสมยอด ลงทะเบียน ประกาศรายชื่อ ยืนยันสิทธิ์ ศิลปิน กรุงเทพ','private talk workshop polaroid one day trip artist brand Bangkok'],
    ['Bangkok '+labels.en+' event calendar','Thailand '+labels.en+' concert calendar','ตารางคอนเสิร์ต กรุงเทพ '+labels.th,'Bangkok concert calendar','Thailand concert calendar'],
    ['performance schedule artist mall Bangkok '+labels.en,'ตารางงานศิลปิน ห้าง แบรนด์ กรุงเทพ '+labels.th,'brand booth artist performance schedule Bangkok','artist monthly schedule brand campaign Bangkok']
  ];
  groups.push(['Bangkok artist brand pop-up appearance '+labels.en,'ศิลปิน ป๊อปอัพ ห้าง กรุงเทพ '+labels.th,'beauty skincare pop up artist centralwOrld Bangkok','brand pop-up meet artist fan support Bangkok']);
  return {
    version:'KK_ULTRA_DEEP_REFERENCE_SWEEP_V4',
    gap_tasks:groups.map((queries,i)=>({
      source_tier:[2,4,5].includes(i)?'BRAND_SPONSOR':'PUBLIC_CALENDAR',
      source_id:'reference-'+(i+1),
      query:queries[0],
      query_variants:queries.slice(1),
      providers:['LIVENATION_PUBLIC','BING_RSS','DDG_HTML','BING_HTML','SEARXNG','DDGS_TRAFILATURA','CRAWL4AI','EXA'],
      evidence_required:true
    })),
    production_writes:0
  };
}
function buildKnownMissPlan(input={}){
  const month=text(input.month);
  // Align probes with KnownMiss.evaluate(strict_live) scope, retaining
  // explicit cross-month discovery leads rather than searching all history.
  const scoped=/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)?
    KnownMiss.CORPUS.filter(c=>text(c.event_date).startsWith(month)||
      (Array.isArray(c.discovery_months)&&c.discovery_months.includes(month))):KnownMiss.CORPUS;
  return {
    version:'KK_ULTRA_DEEP_KNOWN_MISS_PROBE_V3',
    gap_tasks:scoped.map(c=>{
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
  if(host==='eventpop.me'||host.endsWith('.eventpop.me')) return /^\/e\//.test(path);
  if(host==='thaiticketmajor.com'||host.endsWith('.thaiticketmajor.com')) return /^\/(concert|performance|event)\//.test(path);
  if(host==='ticketmelon.com'||host.endsWith('.ticketmelon.com')) return path.split('/').filter(Boolean).length>=2;
  if(host==='livenationtero.co.th'||host.endsWith('.livenationtero.co.th')) return /^\/show\//.test(path)||/^\/[^/]*event\//.test(path)||path.includes('/event/');
  if(host==='songkick.com'||host.endsWith('.songkick.com')) return path.includes('/concerts/');
  return false;
 }catch(_){return false;}
}

function validReferenceDate(value){
 const v=text(value);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;
 const [y,m,d]=v.split('-').map(Number);
 const check=new Date(Date.UTC(y,m-1,d));
 return y>=2000&&y<=2100&&check.getUTCFullYear()===y&&
   check.getUTCMonth()===m-1&&check.getUTCDate()===d;
}
function usableReferenceDetailUrl(value){
 try{
  const u=new URL(text(value));
  if(u.protocol!=='https:'||!u.hostname||u.username||u.password)return false;
  const p=u.pathname.toLowerCase().replace(/\/+$/,'');
  if(!p||p==='/event'||p==='/events'||/^\/(?:search|category|categories|calendar|g)(?:\/|$)/.test(p))return false;
  return /[a-z0-9\u0e00-\u0e7f]{5,}/i.test(p);
 }catch(_){return false;}
}
function bangkokReferenceLocation(row={}){
 const hay=[row.title,row.event_name,row.venue,row.location].map(text).join(' ');
 return /\b(?:bangkok|nonthaburi|pathum thani|samut prakan|centralw[oO]rld|bitec|impact arena|thunder dome|siam paragon|one bangkok)\b|กรุงเทพ|นนทบุรี|ปทุมธานี|สมุทรปราการ|เซ็นทรัลเวิลด์|พารากอน|ไบเทค/i.test(hay);
}

function referenceScopeDecision(row={},context={}){
 const title=text(row.title||row.event_name);
 const eventDate=text(row.event_date);
 const month=text(context.month);
 const datePending=!eventDate;
 if(eventDate&&!validReferenceDate(eventDate))return {eligible:false,reason:'INVALID_STRUCTURED_DATE'};
 if(eventDate&&month&&!eventDate.startsWith(month+'-'))return {eligible:false,reason:'OUTSIDE_TARGET_MONTH'};
 if(REFERENCE_NOISE_RE.test(title)) return {eligible:false,reason:'NON_RENTAL_EVENT_NOISE'};
 if(/^\s*home\s*(?:[-|:–—]\s*.*)?$/i.test(title)) return {eligible:false,reason:'GENERIC_REFERENCE_PAGE'};
 try{
  const u=new URL(text(row.source_url));
  const host=u.hostname.toLowerCase();
  const path=(u.pathname||'/').toLowerCase();
  if((host==='eventpop.me'||host.endsWith('.eventpop.me'))&&/^\/g(?:\/|$)/.test(path)) return {eligible:false,reason:'GENERIC_REFERENCE_PAGE'};
  if(/\/(search|category|categories)(?:\/|$)/.test(path)) return {eligible:false,reason:'GENERIC_REFERENCE_PAGE'};
 }catch(_){}
 try{
  const u=new URL(text(row.source_url));
  const path=(u.pathname||'/').replace(/\/+$/,'')||'/';
  if(path==='/'&&!trustedEventPath(row.source_url)) return {eligible:false,reason:'GENERIC_REFERENCE_PAGE'};
 }catch(_){}
 if(REFERENCE_FOREIGN_RE.test([title,row.venue,row.location].map(text).join(' '))||/\.hk$/i.test((()=>{try{return new URL(text(row.source_url)).hostname}catch(_){return''}})())) return {eligible:false,reason:'OUTSIDE_BANGKOK_SCOPE'};
 // A brand pop-up with a named artist is a discovery lead, not a publish decision.
 // Generic retail promotions stay excluded. Explicit Bangkok location and event date
 // are required; the verifier still needs an independent primary-source receipt.
 const popupText=[title,row.event_name].map(text).join(' ');
 const namedArtists=[row.artists,row.artist].flat().map(text).filter(Boolean);
 const artistInTitle=/(?:\bwith\s+[a-z]{3,}|\bx\s+[a-z]{3,}|phutatchai|ภูธัชชัย|พุฒิชัย|ศิลปิน|artist appearance)/i.test(popupText);
 const explicitVenue=[title,row.venue,row.location].map(text).join(' ');
 const artistAppearancePopup=/(pop[ -]?up|ป๊อปอัพ|ป็อปอัพ)/i.test(popupText) &&
   (namedArtists.length>0||artistInTitle) &&
   /(bangkok|กรุงเทพ|centralworld|centralw[oO]rld|เซ็นทรัลเวิลด์)/i.test(explicitVenue);

 if(!REFERENCE_EVENT_RE.test(title)&&!trustedEventPath(row.source_url)&&!artistAppearancePopup) return {eligible:false,reason:'EVENT_IDENTITY_NOT_STRONG_ENOUGH'};
 if(datePending){
  // The scanner month is a search constraint, NOT proof of the event date.
  // Admit only an event-specific HTTPS URL and explicit Bangkok-area signal.
  // The source's JSON-LD Event.startDate, venue and owner policy still govern.
  if(!/^\d{4}-\d{2}$/.test(month))return {eligible:false,reason:'UNDATED_TARGET_MONTH_REQUIRED'};
  if(!usableReferenceDetailUrl(row.source_url))return {eligible:false,reason:'UNDATED_EVENT_DETAIL_HTTPS_REQUIRED'};
  if(!bangkokReferenceLocation(row))return {eligible:false,reason:'UNDATED_BANGKOK_LOCATION_REQUIRED'};
  return {eligible:true,reason:'SOURCE_DATE_PENDING_PRIMARY_VERIFIER'};
 }
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

function recoverEligibleReferenceCandidates(discovered=[],references=[],context={}){
 const out=[...(Array.isArray(discovered)?discovered:[])];
 const titleDate=new Set(out.filter(Reconciliation.hasComparableEventIdentity).map(Reconciliation.reconcileKey));
 const sourceDate=new Set(out.map(Reconciliation.sourceDateKey).filter(Boolean));
 const undatedKey=row=>[
  Reconciliation.canonicalSourceUrl(row),
  Reconciliation.eventSeriesTitle(row.title||row.event_name),
  text(row.venue||row.location).toLowerCase()
 ].join('|');
 const undatedSeen=new Set(out.filter(row=>!text(row.event_date)&&row.source_url).map(undatedKey));
 let recovered=0,undatedRecovered=0;
 for(const row of Array.isArray(references)?references:[]){
  if(!row||row.eligible_for_discovery===false)continue;
  const structured=Reconciliation.hasComparableEventIdentity(row);
  if(!structured){
   // Never grant undated recovery from an unscoped third-party caller.
   if(text(row.event_date)||row.eligible_for_discovery!==true||
     referenceScopeDecision(row,context).reason!=='SOURCE_DATE_PENDING_PRIMARY_VERIFIER')continue;
   const k=undatedKey(row);
   if(undatedSeen.has(k))continue;
   out.push({...row,event_date:null,candidate_origin:'INDEPENDENT_REFERENCE_RECOVERY',
    date_pending_verification:true,verifier_required:true,authoritative:false});
   undatedSeen.add(k);recovered++;undatedRecovered++;
   continue;
  }
  const rk=Reconciliation.reconcileKey(row),sk=Reconciliation.sourceDateKey(row);
  if(titleDate.has(rk)||(sk&&sourceDate.has(sk)))continue;
  const next={...row,candidate_origin:'INDEPENDENT_REFERENCE_RECOVERY',verifier_required:true,authoritative:false};
  out.push(next);titleDate.add(rk);if(sk)sourceDate.add(sk);recovered++;
 }
 return {candidates:out,recovered_count:recovered,undated_recovered_count:undatedRecovered};
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

async function providerPreflight(providers={},input={},options={}){
 const probe={source_tier:'PUBLIC_CALENDAR',query:['Bangkok',text(input.month),'concert'].filter(Boolean).join(' '),providers:[...UNKNOWN_SEARCH_PROVIDERS],evidence_required:true};
 const result=await ProviderExecutor.executeGapTask(probe,{providers,deadline_ms:options.deadline_ms});
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
   status:['NOT_BOUND','EVIDENCE_FOUND','NO_EVIDENCE','PROVIDER_ERROR','TIME_BUDGET_EXHAUSTED'].includes(a.status)?a.status:'UNKNOWN',
   count:Number.isFinite(a.count)?a.count:0
  }));
  return {task_index:index,source_id:task.source_id||null,source_tier:task.source_tier,
   query_variant_count:ProviderExecutor.queryVariants(task).length,
   executed:(result.attempts||[]).some(attemptExecuted),candidate_count:(result.candidates||[]).length,attempts};
 });
}

async function runOperationalDiscovery(input={},options={}){
  const publicProviders=options.use_only_injected_providers===true?{}:PublicWeb.createProviders(options.publicWebOptions||{});
  const providers=Object.assign({},publicProviders,options.providers||{});
  const plan=MonthlyPlan.buildOperational(input);
  const execution=await ProviderExecutor.executeGapPlan(plan,{providers,concurrency:Math.min(4,ProviderExecutor.MAX_CONCURRENCY)});
  const candidates=flattenCandidates(execution);
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
  const maxMs=Number(options.runtime_budget_ms||0);
  const deadline_ms=Number.isFinite(maxMs)&&maxMs>0?Date.now()+Math.floor(maxMs):undefined;
  const publicProviders=options.use_only_injected_providers===true?{}:PublicWeb.createProviders(options.publicWebOptions||{});
  const providers=Object.assign({},publicProviders,options.providers||{});
  const binding=providerBindingState(providers);
  // Execute the bounded historical probes first. Live HTML search providers may
  // soft-throttle after a large sweep; putting the small regression corpus first
  // prevents broad discovery traffic from starving the recall gate.
  const knownMissPlan=buildKnownMissPlan({month:input.month});
  const knownMissExecution=await ProviderExecutor.executeGapPlan(knownMissPlan,{providers,deadline_ms});
  const knownMissCandidates=flattenCandidates(knownMissExecution);

  const plan=MonthlyPlan.build(input);
  const referencePlan=buildReferencePlan({month:plan.range.month,location:plan.location});
  // Main discovery and the independent reference sweep are read-only and independent after
  // the known-miss probe. Run them concurrently and use the executor's bounded max concurrency
  // so production READ_ONLY stays inside the serverless duration without dropping coverage.
  const [execution,referenceExecution]=await Promise.all([
    ProviderExecutor.executeGapPlan(plan,{providers,concurrency:ProviderExecutor.MAX_CONCURRENCY,deadline_ms}),
    ProviderExecutor.executeGapPlan(referencePlan,{providers,concurrency:ProviderExecutor.MAX_CONCURRENCY,deadline_ms})
  ]);
  const receipts=sourceUniverseReceipts(plan,execution);
  const universe=SourceRegistry.buildUniverseProof(receipts);
  const candidates=flattenCandidates(execution);
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
  const recovered= recoverEligibleReferenceCandidates(candidates,alignedReferenceCandidates,{month:plan.range.month,location:plan.location});
  const verifierCandidates=recovered.candidates;
  const reconciliation=Reconciliation.reconcileCandidateSets(verifierCandidates,alignedReferenceCandidates);

  // Preflight is intentionally evaluated only after the established evidence
  // sequence, so it can gate completion without changing known-miss/discovery/
  // reference ordering or hiding their diagnostics.
  const preflight=await providerPreflight(providers,input,{deadline_ms});
  binding.preflight=preflight;

  // A known miss is recovered if any governed live discovery path finds it.
  // Do not discard a valid main/reference sweep hit merely because the dedicated
  // probe endpoint returned no results.
  const knownMissEvidence=[...knownMissCandidates,...candidates,...referenceCandidates];
  // Historical fixture tests the matcher only. FULL must use real month-scoped live hits.
  // Source-unavailable and unsourced synthetic classifications cannot certify coverage.
  const knownMissLive=KnownMiss.evaluate(knownMissEvidence,input.known_miss_classifications||[],{month:plan.range.month,strict_live:true});
  const knownMiss=KnownMiss.evaluateFixtureRegression();

  const liveSearchProven=preflight.status==='READY' || discoveryProof.has_evidence || referenceProof.has_evidence || knownMissCandidates.length>0;
  // A timed-out query variant is never evidence of complete source coverage.
  const budgetExhausted=[knownMissExecution,execution,referenceExecution].some(x=>x.time_budget_exhausted===true)||
    (preflight.result&&preflight.result.time_budget_exhausted===true);
  const complete=!budgetExhausted && binding.unknown_url_search_bound && liveSearchProven && universe.complete && discoveryProof.complete && referenceProof.complete && reconciliation.complete && knownMiss.complete && knownMissLive.complete;
  const blockers=[
    ...(budgetExhausted?['RUNTIME_BUDGET_EXHAUSTED']:[]),
    ...(!binding.unknown_url_search_bound?['UNKNOWN_URL_SEARCH_NOT_BOUND']:[]),
    ...(binding.unknown_url_search_bound&&!liveSearchProven?['UNKNOWN_URL_SEARCH_PREFLIGHT_FAILED']:[]),
    ...(!universe.complete?['SOURCE_UNIVERSE_INCOMPLETE']:[]),
    ...(!discoveryProof.complete?['DISCOVERY_EVIDENCE_EMPTY']:[]),
    ...(!referenceProof.complete?['REFERENCE_SWEEP_INCOMPLETE']:[]),
    ...(!reconciliation.complete?['RECONCILIATION_GAPS_REMAIN']:[]),
    ...(reconciliation.pending_source_date_count>0?['REFERENCE_SOURCE_DATE_VERIFICATION_PENDING']:[]),
    ...(!knownMiss.complete?['KNOWN_MISS_REGRESSION_INCOMPLETE']:[]),
    ...(!knownMissLive.complete?['KNOWN_MISS_LIVE_RECALL_INCOMPLETE']:[])
  ];
  const diagnostic={
    schema:'KK_ULTRA_DEEP_DISCOVERY_DIAGNOSTIC_V2',full:complete,blockers,budget_exhausted:budgetExhausted,
    gates:Object.fromEntries(Object.entries({provider_bound:binding.unknown_url_search_bound,live_search:liveSearchProven,
      source_universe:universe.complete,discovery:discoveryProof.complete,reference:referenceProof.complete,
      reconciliation:reconciliation.complete,known_miss_regression:knownMiss.complete,known_miss_live_recall:knownMissLive.complete}).map(([gate,observed])=>[gate,{expected:true,observed}])),
    counts:{required_sources:universe.required_source_count,passed_sources:universe.passed_required_source_count,
      discovery_tasks:discoveryProof.task_count,discovery_executed:discoveryProof.executed_count,discovery_candidates:candidates.length,
      reference_tasks:referenceProof.task_count,reference_executed:referenceProof.executed_count,reference_candidates:referenceCandidates.length,
      reference_recovered:recovered.recovered_count,reference_undated_recovered:recovered.undated_recovered_count,
      reference_pending_source_date:reconciliation.pending_source_date_count,reconciliation_gaps:reconciliation.reconciliation_gap_count,
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
    budget_exhausted:budgetExhausted,
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
    reference_recovered_candidate_count:recovered.recovered_count,
    reference_undated_recovered_count:recovered.undated_recovered_count,
    reference_pending_source_date_count:reconciliation.pending_source_date_count,
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
  VERSION,UNKNOWN_SEARCH_PROVIDERS,attemptExecuted,executionProof,flattenCandidates,sourceUniverseReceipts,
  buildReferencePlan,buildKnownMissPlan,referenceScopeDecision,scopeReferenceCandidates,alignKnownMissReferences,recoverEligibleReferenceCandidates,summarizeExecution,providerPreflight,providerBindingState,runOperationalDiscovery,runMonthlyUltraDeep
};
