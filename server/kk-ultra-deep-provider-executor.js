'use strict';

const VERSION='KK_ULTRA_DEEP_PROVIDER_EXECUTOR_V6';
const ALLOWED_PROVIDERS=new Set(['OFFICIAL_DIRECT','RSS_OR_PUBLIC_FEED','LIVENATION_PUBLIC','BING_RSS','DDG_HTML','BING_HTML','SEARXNG','DDGS_TRAFILATURA','CRAWL4AI','EXA']);
const MAX_RESULTS=25;
const DEFAULT_CONCURRENCY=4;
const MAX_CONCURRENCY=8;
function text(v){return String(v==null?'':v).trim();}
function upper(v){return text(v).toUpperCase();}
function https(v){try{const u=new URL(text(v));return u.protocol==='https:'?u.toString():'';}catch(_){return '';}}
function queryVariants(task={}){
  const raw=[task.query,...(Array.isArray(task.query_variants)?task.query_variants:[])];
  const seen=new Set();const out=[];
  for(const value of raw){
    const q=text(value);if(!q||seen.has(q))continue;
    seen.add(q);out.push(q);
  }
  return out.length?out:[null];
}
function normalizeCandidate(row={},fallback={}){
  return {
    candidate_id:text(row.candidate_id),
    title:text(row.title)||null,
    event_date:text(row.event_date)||null,
    event_time:text(row.event_time)||null,
    venue:text(row.venue)||null,
    artist:Array.isArray(row.artist)?row.artist.map(text).filter(Boolean).slice(0,20):(text(row.artist)?[text(row.artist)]:[]),
    source_url:https(row.source_url||fallback.source_url)||null,
    confidence:Number.isFinite(Number(row.confidence))?Number(row.confidence):null
  };
}
function taskConcurrency(options={}){
  const raw=Number(options.concurrency||process.env.KK_ULTRA_DEEP_TASK_CONCURRENCY||DEFAULT_CONCURRENCY);
  if(!Number.isFinite(raw)) return DEFAULT_CONCURRENCY;
  return Math.max(1,Math.min(Math.floor(raw),MAX_CONCURRENCY));
}
function timeBudgetExpired(options={}){
 const deadline=Number(options.deadline_ms||0);
 return deadline>0&&Number.isFinite(deadline)&&Date.now()>=deadline;
}
async function executeGapTask(task={},options={}){
  const providers=(Array.isArray(task.providers)?task.providers:[]).map(upper).filter(p=>ALLOWED_PROVIDERS.has(p));
  const attempts=[];
  for(const provider of providers){
    if(timeBudgetExpired(options)){
      attempts.push({provider,status:'TIME_BUDGET_EXHAUSTED'});
      break;
    }
    const fn=options.providers&&options.providers[provider];
    if(typeof fn!=='function'){attempts.push({provider,status:'NOT_BOUND'});continue;}
    for(const query of queryVariants(task)){
      if(timeBudgetExpired(options)){
        attempts.push({provider,status:'TIME_BUDGET_EXHAUSTED'});
        break;
      }
      const callTask=query===null?{...task,provider}:{...task,provider,query};
      try{
        const raw=await fn(callTask);
        const rows=Array.isArray(raw)?raw:(Array.isArray(raw&&raw.candidates)?raw.candidates:[]);
        const candidates=rows.slice(0,MAX_RESULTS).map(r=>normalizeCandidate(r,callTask)).filter(r=>r.source_url);
        attempts.push({provider,status:candidates.length?'EVIDENCE_FOUND':'NO_EVIDENCE',count:candidates.length,query});
        if(candidates.length){
          return {version:VERSION,status:'EVIDENCE_FOUND',provider,source_tier:upper(task.source_tier),candidates,attempts,authoritative:false,verifier_required:true,production_writes:0};
        }
      }catch(error){attempts.push({provider,status:'PROVIDER_ERROR',error_class:text(error&&(error.code||error.name))||'ERROR',query});}
    }
  }
  return {version:VERSION,status:'GAP_UNRESOLVED',provider:null,source_tier:upper(task.source_tier),candidates:[],attempts,time_budget_exhausted:attempts.some(x=>x.status==='TIME_BUDGET_EXHAUSTED'),authoritative:false,verifier_required:true,production_writes:0};
}
async function executeGapPlan(plan={},options={}){
  const tasks=Array.isArray(plan.gap_tasks)?plan.gap_tasks:[];
  const results=new Array(tasks.length);
  let nextIndex=0;
  const workerCount=Math.min(taskConcurrency(options),tasks.length||1);
  async function worker(){
    while(true){
      const index=nextIndex++;
      if(index>=tasks.length) return;
      results[index]=await executeGapTask(tasks[index],options);
    }
  }
  await Promise.all(Array.from({length:workerCount},()=>worker()));
  return {version:VERSION,status:results.every(r=>r.status==='EVIDENCE_FOUND')?'GAPS_RESOLVED':'GAPS_REMAIN',results,time_budget_exhausted:results.some(r=>r.time_budget_exhausted),authoritative:false,verifier_required:true,production_writes:0};
}
module.exports={VERSION,ALLOWED_PROVIDERS,MAX_RESULTS,DEFAULT_CONCURRENCY,MAX_CONCURRENCY,queryVariants,normalizeCandidate,taskConcurrency,timeBudgetExpired,executeGapTask,executeGapPlan};
