'use strict';

const VERSION='KK_ULTRA_DEEP_PROVIDER_EXECUTOR_V2';
const ALLOWED_PROVIDERS=new Set(['OFFICIAL_DIRECT','RSS_OR_PUBLIC_FEED','DDG_HTML','BING_HTML','SEARXNG','DDGS_TRAFILATURA','CRAWL4AI','EXA']);
const MAX_RESULTS=25;
function text(v){return String(v==null?'':v).trim();}
function upper(v){return text(v).toUpperCase();}
function https(v){try{const u=new URL(text(v));return u.protocol==='https:'?u.toString():'';}catch(_){return '';}}
function normalizeCandidate(row={},fallback={}){
  return {
    candidate_id:text(row.candidate_id),
    title:text(row.title)||null,
    event_date:text(row.event_date)||null,
    event_time:text(row.event_time)||null,
    venue:text(row.venue)||null,
    artist:Array.isArray(row.artist)?row.artist.map(text).filter(Boolean).slice(0,20):(text(row.artist)?[text(row.artist)]:[]),
    source_url:https(row.source_url||fallback.source_url)||null,
    confidence:Number.isFinite(Number(row.confidence))?Number(row.confidence):null,
    evidence_text:text(row.evidence_text).slice(0,4000)||null
  };
}
async function executeGapTask(task={},options={}){
  const providers=(Array.isArray(task.providers)?task.providers:[]).map(upper).filter(p=>ALLOWED_PROVIDERS.has(p));
  const attempts=[];
  for(const provider of providers){
    const fn=options.providers&&options.providers[provider];
    if(typeof fn!=='function'){attempts.push({provider,status:'NOT_BOUND'});continue;}
    try{
      const raw=await fn({...task,provider});
      const rows=Array.isArray(raw)?raw:(Array.isArray(raw&&raw.candidates)?raw.candidates:[]);
      const candidates=rows.slice(0,MAX_RESULTS).map(r=>normalizeCandidate(r,task)).filter(r=>r.source_url);
      attempts.push({provider,status:candidates.length?'EVIDENCE_FOUND':'NO_EVIDENCE',count:candidates.length});
      if(candidates.length){
        return {version:VERSION,status:'EVIDENCE_FOUND',provider,source_id:text(task.source_id)||null,source_tier:upper(task.source_tier),health_only:task.health_only===true,proof_mode:text(task.proof_mode)||null,candidates,attempts,authoritative:false,verifier_required:true,production_writes:0};
      }
    }catch(error){attempts.push({provider,status:'PROVIDER_ERROR',error_class:text(error&&(error.code||error.name))||'ERROR'});}
  }
  return {version:VERSION,status:'GAP_UNRESOLVED',provider:null,source_id:text(task.source_id)||null,source_tier:upper(task.source_tier),health_only:task.health_only===true,proof_mode:text(task.proof_mode)||null,candidates:[],attempts,authoritative:false,verifier_required:true,production_writes:0};
}
async function executeGapPlan(plan={},options={}){
  const tasks=Array.isArray(plan.gap_tasks)?plan.gap_tasks:[];
  const results=[];
  for(const task of tasks) results.push(await executeGapTask(task,options));
  return {version:VERSION,status:results.every(r=>r.status==='EVIDENCE_FOUND')?'GAPS_RESOLVED':'GAPS_REMAIN',results,authoritative:false,verifier_required:true,production_writes:0};
}
module.exports={VERSION,ALLOWED_PROVIDERS,MAX_RESULTS,normalizeCandidate,executeGapTask,executeGapPlan};
