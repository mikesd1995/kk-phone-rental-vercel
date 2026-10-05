'use strict';

const UltraDeepDirect=require('../server/kk-ultra-deep-direct-zero-cost.js');

function text(v){return String(v==null?'':v).trim();}
function reply(res,status,body){
 res.statusCode=status;
 res.setHeader('Content-Type','application/json; charset=utf-8');
 res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, max-age=0');
 res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
 res.end(JSON.stringify(body||{}));
}
module.exports=async function handler(req,res){
 if(req.method!=='GET')return reply(res,405,{ok:false,error_code:'METHOD_NOT_ALLOWED',production_writes:0,phase3_started:false});
 if(text(process.env.VERCEL_ENV)!=='preview')return reply(res,404,{ok:false,error_code:'PREVIEW_ONLY',production_writes:0,phase3_started:false});
 if(text(process.env.VERCEL_GIT_COMMIT_REF)!=='fix/ultra-deep-learn-ryo-brand-social-miss'){
  return reply(res,403,{ok:false,error_code:'PHASE2_BRANCH_NOT_AUTHORIZED',production_writes:0,phase3_started:false});
 }
 let url;
 try{url=new URL(req.url||'','https://preview.invalid');}catch(_){return reply(res,400,{ok:false,error_code:'INVALID_URL',production_writes:0,phase3_started:false});}
 if(url.searchParams.get('confirm')!=='PHASE2_READ_ONLY')return reply(res,400,{ok:false,error_code:'PHASE2_READ_ONLY_CONFIRM_REQUIRED',production_writes:0,phase3_started:false});
 const month=text(url.searchParams.get('month')||'2026-10');
 if(!/^\d{4}-\d{2}$/.test(month))return reply(res,400,{ok:false,error_code:'PHASE2_MONTH_INVALID',production_writes:0,phase3_started:false});
 try{
  const result=await UltraDeepDirect.run({
   month,
   location:'Bangkok Metropolitan Region Thailand',
   phase:'PHASE2',
   max_rounds:3
  },{
   phase:'PHASE2',
   stopAfterPhase2:true,
   executeWrites:false,
   env:process.env,
   fetchImpl:global.fetch
  });
  if(Number(result.production_writes||0)!==0||result.phase3_started!==false){
   return reply(res,500,{ok:false,error_code:'PHASE2_READ_ONLY_INVARIANT_BROKEN',production_writes:Number(result.production_writes||0),phase3_started:result.phase3_started});
  }
  const phase2=result.phase2||{};
  const rows=Array.isArray(phase2.results)?phase2.results:[];
  const dispositions=rows.map(x=>({
   candidate_id:text(x.candidate_id),
   title:text(x.title),
   event_date:text(x.event_date),
   disposition:text(x.disposition),
   reason:text(x.reason),
   evidence:Array.isArray(x.evidence)?x.evidence.slice(0,5):[]
  }));
  const body={
   ok:result.status==='PHASE2_ACCEPTED'&&result.ready_for_phase3===true,
   service:'kk-ultra-deep-phase2-preview-readonly',
   runtime_version:UltraDeepDirect.VERSION,
   commit_sha:text(process.env.VERCEL_GIT_COMMIT_SHA)||null,
   branch:text(process.env.VERCEL_GIT_COMMIT_REF)||null,
   month,
   status:result.status,
   ready_for_phase3:result.ready_for_phase3===true,
   candidate_count:Number(phase2.candidate_count||result.phase1_artifact&&result.phase1_artifact.candidate_count||0),
   phase1_fingerprint:text(result.phase1_artifact&&result.phase1_artifact.fingerprint)||null,
   phase2_pool_fingerprint:text(phase2.pool_fingerprint)||null,
   rounds:phase2.rounds||[],
   counts:{
    verified:dispositions.filter(x=>x.disposition==='VERIFIED').length,
    status_changed:dispositions.filter(x=>x.disposition==='STATUS_CHANGED').length,
    rejected:dispositions.filter(x=>x.disposition==='REJECT_WITH_REASON').length,
    verify_required:dispositions.filter(x=>x.disposition==='VERIFY_REQUIRED').length
   },
   blockers:phase2.gate&&phase2.gate.blockers||result.blockers||[],
   dispositions,
   production_writes:0,
   phase3_started:false
  };
  return reply(res,body.ok?200:409,body);
 }catch(error){
  return reply(res,500,{ok:false,error_code:text(error&&error.code)||'PHASE2_PREVIEW_RUN_FAILED',error:text(error&&error.message).slice(0,400),production_writes:0,phase3_started:false});
 }
};
