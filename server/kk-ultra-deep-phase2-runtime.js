'use strict';

const crypto=require('node:crypto');
const Verifier=require('./kk-ultra-deep-candidate-verifier.js');
const PublicWeb=require('./kk-ultra-deep-public-web-adapters.js');
const Reconciliation=require('./kk-ultra-deep-reconciliation.js');
const Controller=require('./kk-ultra-deep-phase2-controller.js');
const PhaseArtifact=require('./kk-ultra-deep-phase-artifact.js');

const VERSION='KK_ULTRA_DEEP_PHASE2_RUNTIME_V2';
const DEFAULT_MAX_ROUNDS=3;
const DEFAULT_CONCURRENCY=4;
const HARD_REJECT_BLOCKERS=new Set([
  'GENERIC_OR_MISSING_TITLE',
  'AGGREGATED_SEARCH_RESULT_TITLE',
  'EVENT_TITLE_TOO_LONG',
  'OUTSIDE_TARGET_MONTH',
  'HTTPS_SOURCE_REQUIRED',
  'EVENT_DATE_REQUIRED'
]);

function text(v){return String(v==null?'':v).trim();}
function https(v){try{const u=new URL(text(v));return u.protocol==='https:'?u.toString():'';}catch(_){return '';}}
function sha(value){return crypto.createHash('sha256').update(String(value)).digest('hex');}
function uniq(values=[]){return [...new Set((Array.isArray(values)?values:[]).map(text).filter(Boolean))];}
function sourceRank(url=''){
 const h=Verifier.host(url);
 let score=0;
 if(Verifier.TRUSTED_EVENT_HOSTS.has(h))score+=100;
 if(Verifier.eventSpecificUrl(url))score+=40;
 if(!Verifier.SOCIAL_OR_SEARCH_HOST.test(h))score+=20;
 if(/livenationtero/.test(h))score+=20;
 if(/thaiticketmajor|eventpop|ticketmelon|allticket/.test(h))score+=15;
 return score;
}
function rawKey(row={},index=0){
 const comparable=Reconciliation.hasComparableEventIdentity(row);
 if(comparable)return Reconciliation.reconcileKey(row);
 return ['raw',index,text(row.title||row.event_name),text(row.event_date),text(row.source_url)].join('|');
}
function freezeCandidatePool(rows=[]){
 const groups=new Map();
 (Array.isArray(rows)?rows:[]).forEach((row,index)=>{
  const key=rawKey(row,index);
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push({...row});
 });
 const pool=[];
 for(const [key,group] of groups){
  const sorted=[...group].sort((a,b)=>sourceRank(b.source_url)-sourceRank(a.source_url)||text(a.source_url).localeCompare(text(b.source_url)));
  const best=sorted[0]||{};
  const source_urls=uniq(sorted.map(x=>https(x.source_url)));
  const aliases=uniq(sorted.map(x=>text(x.title||x.event_name)));
  const candidate_id='P2-'+sha(key).slice(0,18);
  pool.push({
    ...best,
    candidate_id,
    title:text(best.title||best.event_name)||null,
    event_date:text(best.event_date)||null,
    source_url:source_urls[0]||null,
    source_urls,
    aliases,
    phase2_pool_key:key
  });
 }
 pool.sort((a,b)=>text(a.event_date).localeCompare(text(b.event_date))||text(a.title).localeCompare(text(b.title)));
 const fingerprint=sha(JSON.stringify(pool.map(x=>({candidate_id:x.candidate_id,key:x.phase2_pool_key,source_urls:x.source_urls}))));
 return {pool,fingerprint,expected_candidate_ids:pool.map(x=>x.candidate_id)};
}
function hardReject(blockers=[]){
 const reasons=uniq(blockers);
 return reasons.length>0&&reasons.every(x=>HARD_REJECT_BLOCKERS.has(x));
}
function evidenceUrlList(candidate={},attempts=[]){
 return uniq([...(candidate.source_urls||[]),...attempts.map(x=>x&&x.source_url)]);
}
function mapVerification(candidate={},attempts=[]){
 const statusChange=attempts.find(x=>x&&(['CANCELLED','POSTPONED','RESCHEDULED'].includes(text(x.event_status).toUpperCase())||x.status==='STATUS_CHANGED'));
 if(statusChange){
  return {
    candidate_id:candidate.candidate_id,title:candidate.title,event_date:candidate.event_date,
    disposition:'STATUS_CHANGED',
    reason:text(statusChange.status_change&&statusChange.status_change.change_type)||text(statusChange.event_status)||'OFFICIAL_STATUS_CHANGED',
    evidence:evidenceUrlList(candidate,attempts),
    status_change:statusChange.status_change||null,
    verifier_attempts:attempts
  };
 }
 const verified=attempts.find(x=>x&&x.verified===true);
 if(verified){
  return {
    candidate_id:candidate.candidate_id,title:candidate.title,event_date:candidate.event_date,
    disposition:'VERIFIED',
    reason:'AUTHORITATIVE_EVENT_IDENTITY_CONFIRMED',
    evidence:evidenceUrlList(candidate,[verified]),
    verified_candidate:verified.candidate,
    verifier_evidence:verified.evidence||null,
    verifier_attempts:attempts
  };
 }
 const blockers=uniq(attempts.flatMap(x=>x&&Array.isArray(x.blockers)?x.blockers:[]));
 if(hardReject(blockers)){
  return {
    candidate_id:candidate.candidate_id,title:candidate.title,event_date:candidate.event_date,
    disposition:'REJECT_WITH_REASON',
    reason:blockers.join(',')||'INVALID_CANDIDATE',
    evidence:evidenceUrlList(candidate,attempts),
    verifier_attempts:attempts
  };
 }
 return {
   candidate_id:candidate.candidate_id,title:candidate.title,event_date:candidate.event_date,
   disposition:'VERIFY_REQUIRED',
   reason:blockers.join(',')||'OFFICIAL_SOURCE_GAP',
   evidence:evidenceUrlList(candidate,attempts).length?evidenceUrlList(candidate,attempts):['NO_AUTHORITATIVE_EVIDENCE_YET'],
   verifier_attempts:attempts
 };
}
async function mapLimit(items=[],limit=DEFAULT_CONCURRENCY,fn){
 const rows=Array.isArray(items)?items:[];const out=new Array(rows.length);let next=0;
 async function worker(){while(true){const i=next++;if(i>=rows.length)return;out[i]=await fn(rows[i],i);}}
 await Promise.all(Array.from({length:Math.min(Math.max(1,Number(limit)||1),rows.length||1)},()=>worker()));
 return out;
}
async function verifyKnownSources(candidate,context={},options={}){
 const urls=uniq(candidate.source_urls&&candidate.source_urls.length?candidate.source_urls:[candidate.source_url]);
 const attempts=[];
 for(const source_url of urls){
  const row={...candidate,source_url};
  const result=await Verifier.verifyCandidate(row,{...context,verification_scope:'PHASE2_IDENTITY_STATUS'},{fetchFn:options.fetchFn,timeout_ms:options.timeout_ms||10000});
  attempts.push({...result,source_url});
  if(result.verified===true||result.status==='STATUS_CHANGED')break;
 }
 return mapVerification(candidate,attempts);
}
function recoveryQueries(candidate={},controllerOut={}){
 const title=text(candidate.title);const date=text(candidate.event_date);const venue=text(candidate.venue);
 const artists=Array.isArray(candidate.artist)?candidate.artist.map(text).filter(Boolean):[];
 const learned=Array.isArray(controllerOut&&controllerOut.recovery_queries)?controllerOut.recovery_queries:[];
 const titleNorm=title.toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]+/g,' ').trim();
 const relevantLearned=learned.filter(q=>{
  const n=text(q).toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]+/g,' ').trim();
  return titleNorm&&n&&(n.includes(titleNorm)||titleNorm.includes(n));
 });
 return uniq([
  title+' '+date+' official',
  title+' '+date+' official ticket',
  title+' '+date+' official venue',
  title+' '+date+' Bangkok Thailand',
  ...artists.map(a=>a+' official '+title+' '+date),
  ...(venue?[venue+' '+title+' '+date]:[]),
  ...relevantLearned
 ]).slice(0,10);
}
function identityTokens(value=''){
 return text(value).toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]+/g,' ').split(/\s+/)
  .filter(x=>x&&x.length>1&&!['concert','live','tour','world','bangkok','thailand','official','event','festival','fan','meeting','fanmeeting','fancon','showcase','the','in','at','and','2026'].includes(x));
}
function identityCompatible(candidate={},verified={}){
 const expectedDate=text(candidate.event_date),observedDate=text(verified.event_date);
 if(expectedDate&&observedDate&&expectedDate!==observedDate)return false;
 const a=new Set(identityTokens(candidate.title||candidate.event_name));
 const b=new Set(identityTokens(verified.title||verified.event_name));
 if(!a.size||!b.size)return false;
 let hits=0;for(const token of a)if(b.has(token))hits++;
 const ratio=hits/Math.min(a.size,b.size);
 const as=[...a].join(' '),bs=[...b].join(' ');
 return ratio>=0.5||as.includes(bs)||bs.includes(as);
}
async function recoverOne(candidate={},prior={},controllerOut={},context={},options={}){
 const queries=recoveryQueries(candidate,controllerOut);
 const providers=Object.assign({},PublicWeb.createProviders({
   fetchFn:options.fetchFn,
   ddgs_trafilatura_enabled:true,
   ddgs_max_results:10,
   ddgs_timeout_ms:10000,
   timeout_ms:10000
 }),options.providers||{});
 const providerOrder=['LIVENATION_PUBLIC','DDGS_TRAFILATURA','BING_RSS','DDG_HTML','BING_HTML'];
 const seen=new Set(uniq(candidate.source_urls));
 const attempts=Array.isArray(prior.verifier_attempts)?[...prior.verifier_attempts]:[];
 const priorSearchAttempts=prior&&prior.recovery&&Array.isArray(prior.recovery.attempts)?prior.recovery.attempts:[];
 const terminalPairs=new Set(priorSearchAttempts.filter(a=>['NO_EVIDENCE','EVIDENCE_FOUND'].includes(text(a&&a.status).toUpperCase())).map(a=>text(a.provider)+'|'+text(a.query)));
 const searchAttempts=[];
 for(const provider of providerOrder){
  const fn=providers[provider];
  if(typeof fn!=='function'){searchAttempts.push({provider,status:'NOT_BOUND'});continue;}
  for(const query of queries){
   if(terminalPairs.has(provider+'|'+query))continue;
   let hits=[];
   try{
    const raw=await fn({query,date_window:{start:text(candidate.event_date),end:text(candidate.event_date)}});
    hits=Array.isArray(raw)?raw:(Array.isArray(raw&&raw.candidates)?raw.candidates:[]);
   }catch(error){
    searchAttempts.push({provider,status:'PROVIDER_ERROR',query,error_class:text(error&&(error.code||error.name))||'ERROR'});
    continue;
   }
   searchAttempts.push({provider,status:hits.length?'EVIDENCE_FOUND':'NO_EVIDENCE',query,count:hits.length});
   for(const hit of hits.slice(0,10)){
    const source_url=https(hit.source_url);if(!source_url||seen.has(source_url))continue;seen.add(source_url);
    const row={...candidate,source_url,title:text(hit.title)||candidate.title,event_date:text(hit.event_date)||candidate.event_date};
    const result=await Verifier.verifyCandidate(row,{...context,verification_scope:'PHASE2_IDENTITY_STATUS'},{fetchFn:options.fetchFn,timeout_ms:options.timeout_ms||10000});
    attempts.push({...result,source_url,recovery_provider:provider,recovery_query:query});
    if(result.verified===true&&identityCompatible(candidate,result.candidate||row)){
     const mapped=mapVerification({...candidate,source_urls:[...seen]},attempts);
     mapped.recovery={query_count:queries.length,queries,provider,status:'EVIDENCE_FOUND',attempts:searchAttempts};
     return mapped;
    }
    if(['CANCELLED','POSTPONED','RESCHEDULED'].includes(text(result.event_status).toUpperCase())&&identityCompatible(candidate,result.candidate||row)){
     const mapped=mapVerification({...candidate,source_urls:[...seen]},attempts);
     mapped.recovery={query_count:queries.length,queries,provider,status:'STATUS_CHANGED',attempts:searchAttempts};
     return mapped;
    }
   }
  }
 }
 const mapped=mapVerification({...candidate,source_urls:[...seen]},attempts);
 const combinedSearch=[...priorSearchAttempts,...searchAttempts];
 const terminalCombined=new Set(combinedSearch.filter(a=>['NO_EVIDENCE','EVIDENCE_FOUND'].includes(text(a&&a.status).toUpperCase())).map(a=>text(a.provider)+'|'+text(a.query)));
 const boundProviders=providerOrder.filter(provider=>typeof providers[provider]==='function');
 const expectedPairs=boundProviders.flatMap(provider=>queries.map(query=>provider+'|'+query));
 const exhausted=expectedPairs.length>0&&expectedPairs.every(pair=>terminalCombined.has(pair));
 mapped.recovery={query_count:queries.length,queries,provider:null,status:exhausted?'EVIDENCE_EXHAUSTED':'GAP_UNRESOLVED',attempts:combinedSearch,exhausted};
 return mapped;
}
function poolFromInput(input={}){
 if(input.phase1_artifact){
  const checked=PhaseArtifact.validateForPhase2(input.phase1_artifact);
  if(!checked.pass)return {valid:false,blockers:checked.blockers,pool:[],fingerprint:checked.fingerprint,expected_candidate_ids:checked.candidate_ids,source:'PHASE1_ARTIFACT'};
  return {
   valid:true,blockers:[],pool:input.phase1_artifact.candidates.map(x=>({...x})),
   fingerprint:input.phase1_artifact.fingerprint,
   expected_candidate_ids:[...input.phase1_artifact.candidate_ids],
   source:'PHASE1_ARTIFACT'
  };
 }
 const reconstructed=freezeCandidatePool(input.candidates||[]);
 return {...reconstructed,valid:true,blockers:[],source:'RECONSTRUCTED_COMPATIBILITY'};
}
async function run(input={},options={}){
 const month=text(input.month||input.phase1_artifact&&input.phase1_artifact.month);
 const location=text(input.location)||'Bangkok Thailand';
 const frozen=poolFromInput(input);
 if(!frozen.valid){
  return {version:VERSION,status:'PHASE2_HOLD',month,location,candidate_master_pool_frozen:false,pool_source:frozen.source,pool_fingerprint:frozen.fingerprint,candidate_count:0,expected_candidate_ids:frozen.expected_candidate_ids||[],results:[],rounds:[],gate:{blockers:frozen.blockers||[]},ready_for_phase3:false,next_action:'STOP_AND_REPORT_INVALID_PHASE1_ARTIFACT',production_writes:0,phase3_started:false};
 }
 const expected=frozen.pool.length;
 const maxRounds=Math.max(1,Math.min(5,Number(input.max_rounds||DEFAULT_MAX_ROUNDS)));
 const base={
  candidate_master_pool_frozen:true,
  expected_candidate_count:expected,
  expected_candidate_ids:frozen.expected_candidate_ids,
  production_writes:0
 };
 if(expected===0){
  const gate=Controller.next({...base,round:1,max_rounds:maxRounds,results:[]});
  return {version:VERSION,status:'PHASE2_HOLD',month,location,pool_fingerprint:frozen.fingerprint,candidate_count:0,rounds:[],gate,production_writes:0,phase3_started:false};
 }
 let results=await mapLimit(frozen.pool,Number(options.concurrency||DEFAULT_CONCURRENCY),candidate=>verifyKnownSources(candidate,{month,location},options));
 const rounds=[];
 let gate=null;
 for(let round=1;round<=maxRounds;round++){
  gate=Controller.next({...base,round,max_rounds:maxRounds,results});
  rounds.push({
    round,
    status:gate.status,
    blockers:gate.blockers||[],
    verified:results.filter(x=>x.disposition==='VERIFIED').length,
    status_changed:results.filter(x=>x.disposition==='STATUS_CHANGED').length,
    rejected:results.filter(x=>x.disposition==='REJECT_WITH_REASON').length,
    verify_required:results.filter(x=>x.disposition==='VERIFY_REQUIRED').length,
    learning_miss_classes:uniq((gate.learning_misses||[]).map(x=>x.miss_class)),
    mandatory_expansion:gate.mandatory_expansion||[]
  });
  if(gate.status==='PHASE2_ACCEPTED'||gate.status==='PHASE2_HOLD')break;
  const unresolvedIds=new Set(results.filter(x=>x.disposition==='VERIFY_REQUIRED').map(x=>x.candidate_id));
  if(!unresolvedIds.size)break;
  const byId=new Map(results.map(x=>[x.candidate_id,x]));
  const recovered=await mapLimit(frozen.pool.filter(x=>unresolvedIds.has(x.candidate_id)),Math.min(3,Number(options.concurrency||DEFAULT_CONCURRENCY)),candidate=>recoverOne(candidate,byId.get(candidate.candidate_id),gate,{month,location},options));
  for(const row of recovered)byId.set(row.candidate_id,row);
  results=frozen.expected_candidate_ids.map(id=>byId.get(id)).filter(Boolean);
  const unresolvedAfter=results.filter(x=>x.disposition==='VERIFY_REQUIRED');
  const noProgress=unresolvedAfter.length===unresolvedIds.size;
  const exhausted=noProgress&&unresolvedAfter.length>0&&unresolvedAfter.every(x=>x.recovery&&x.recovery.exhausted===true);
  if(exhausted){
   const terminalGate=Controller.next({...base,round:maxRounds,max_rounds:maxRounds,results});
   rounds.push({
    round:maxRounds,status:terminalGate.status,blockers:terminalGate.blockers||[],
    verified:results.filter(x=>x.disposition==='VERIFIED').length,
    status_changed:results.filter(x=>x.disposition==='STATUS_CHANGED').length,
    rejected:results.filter(x=>x.disposition==='REJECT_WITH_REASON').length,
    verify_required:unresolvedAfter.length,
    learning_miss_classes:uniq((terminalGate.learning_misses||[]).map(x=>x.miss_class)),
    mandatory_expansion:terminalGate.mandatory_expansion||[],
    recovery_exhausted:true
   });
   gate=terminalGate;
   break;
  }
 }
 const finalGate=Controller.next({...base,round:Math.min(maxRounds,rounds.length||1),max_rounds:maxRounds,results});
 const status=finalGate.status==='PHASE2_ACCEPTED'?'PHASE2_ACCEPTED':'PHASE2_HOLD';
 return {
  version:VERSION,
  status,
  month,location,
  candidate_master_pool_frozen:true,
  pool_source:frozen.source,
  pool_fingerprint:frozen.fingerprint,
  candidate_count:expected,
  expected_candidate_ids:frozen.expected_candidate_ids,
  candidates:frozen.pool,
  results,
  rounds,
  gate:finalGate,
  ready_for_phase3:status==='PHASE2_ACCEPTED',
  next_action:status==='PHASE2_ACCEPTED'?'STOP_AND_REPORT_READY_FOR_OWNER_PHASE3_APPROVAL':'STOP_AND_REPORT_UNRESOLVED_VERIFICATION',
  production_writes:0,
  phase3_started:false
 };
}

module.exports={VERSION,DEFAULT_MAX_ROUNDS,DEFAULT_CONCURRENCY,HARD_REJECT_BLOCKERS,text,https,sha,uniq,sourceRank,rawKey,freezeCandidatePool,poolFromInput,hardReject,evidenceUrlList,mapVerification,mapLimit,verifyKnownSources,recoveryQueries,identityTokens,identityCompatible,recoverOne,run};
