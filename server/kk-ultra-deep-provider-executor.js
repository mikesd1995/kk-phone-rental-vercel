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
async function executeGapTask(task={},options={}){
  const providers=(Array.isArray(task.providers)?task.providers:[]).map(upper).filter(p=>ALLOWED_PROVIDERS.has(p));
  const attempts=[];
  const exhaust=task.stop_condition==='EXHAUST_BOUNDED_VARIANTS_AND_RECORD_RECEIPTS';
  const collected=[],seen=new Set();let firstProvider=null,dropped=0,uninspected=0;
  for(const provider of providers){
    const fn=options.providers&&options.providers[provider];
    if(typeof fn!=='function'){attempts.push({provider,status:'NOT_BOUND'});continue;}
    for(const query of queryVariants(task)){
      const callTask=query===null?{...task,provider}:{...task,provider,query};
      try{
        const raw=await fn(callTask);
        const rows=Array.isArray(raw)?raw:(Array.isArray(raw&&raw.candidates)?raw.candidates:[]);
        if(exhaust)uninspected+=Math.max(0,rows.length-MAX_RESULTS);
        const sourced=rows.slice(0,MAX_RESULTS).map(r=>normalizeCandidate(r,callTask)).filter(r=>r.source_url);
        const candidates=typeof options.acceptCandidate==='function'?sourced.filter(row=>options.acceptCandidate(row,callTask)===true):sourced;
        attempts.push({provider,status:candidates.length?'EVIDENCE_FOUND':'NO_EVIDENCE',count:candidates.length,query,
          ...(typeof options.acceptCandidate==='function'?{rejected_count:sourced.length-candidates.length}: {})});
        if(candidates.length){
          if(!exhaust)return {version:VERSION,status:'EVIDENCE_FOUND',provider,source_tier:upper(task.source_tier),candidates,attempts,authoritative:false,verifier_required:true,production_writes:0};
          if(!firstProvider)firstProvider=provider;
          for(const row of candidates){
            const key=JSON.stringify([row.candidate_id,row.title,row.event_date,row.event_time,row.venue,row.artist,row.source_url]);
            if(seen.has(key))continue;seen.add(key);
            if(collected.length<MAX_RESULTS)collected.push(row);else dropped++;
          }
        }
      }catch(error){attempts.push({provider,status:'PROVIDER_ERROR',error_class:text(error&&(error.code||error.name))||'ERROR',query});}
    }
  }
  if(exhaust)return {version:VERSION,status:collected.length?'EVIDENCE_FOUND':'GAP_UNRESOLVED',provider:firstProvider,source_tier:upper(task.source_tier),candidates:collected,attempts,candidate_truncated:dropped>0||uninspected>0,dropped_unique_candidate_count:dropped,dropped_uninspected_row_count:uninspected,authoritative:false,verifier_required:true,production_writes:0};
  return {version:VERSION,status:'GAP_UNRESOLVED',provider:null,source_tier:upper(task.source_tier),candidates:[],attempts,authoritative:false,verifier_required:true,production_writes:0};
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
  return {version:VERSION,status:results.every(r=>r.status==='EVIDENCE_FOUND')?'GAPS_RESOLVED':'GAPS_REMAIN',results,authoritative:false,verifier_required:true,production_writes:0};
}
module.exports={VERSION,ALLOWED_PROVIDERS,MAX_RESULTS,DEFAULT_CONCURRENCY,MAX_CONCURRENCY,queryVariants,normalizeCandidate,taskConcurrency,executeGapTask,executeGapPlan};
