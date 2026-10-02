'use strict';

const OIDC=require('../server/kk-github-oidc.js');
const Runtime=require('../server/kk-ultra-deep-production-runtime.js');

const REPOSITORY='mikesd1995/kk-phone-rental-vercel';
const OWNER='mikesd1995';
const WORKFLOW_REF=REPOSITORY+'/.github/workflows/ultra-deep-full-loop.yml@';
const MAX_BODY=2*1024*1024;

function text(v){return String(v==null?'':v).trim();}
function reply(res,status,body){
 res.statusCode=status;
 res.setHeader('content-type','application/json; charset=utf-8');
 res.setHeader('cache-control','no-store');
 res.setHeader('x-content-type-options','nosniff');
 res.end(JSON.stringify(body));
}
function readBody(req){
 return new Promise((resolve,reject)=>{
  let raw='';
  req.on('data',chunk=>{raw+=chunk;if(raw.length>MAX_BODY){const e=new Error('REQUEST_TOO_LARGE');e.code='REQUEST_TOO_LARGE';reject(e);req.destroy();}});
  req.on('end',()=>resolve(raw));req.on('error',reject);
 });
}
function bearer(req){
 const h=text(req&&req.headers&&req.headers.authorization);
 return /^Bearer\s+/i.test(h)?h.replace(/^Bearer\s+/i,'').trim():'';
}
function safeSummary(result={}){
 const rows=result.orchestrator&&Array.isArray(result.orchestrator.rows)?result.orchestrator.rows:[];
 return {
  version:result.version,
  status:result.status,
  production_writes:Number(result.production_writes||0),
  blockers:result.blockers||[],
  counts:{
   total:rows.length,
   created_verified:rows.filter(x=>x.status==='CREATED_VERIFIED').length,
   updated_verified:rows.filter(x=>x.status==='UPDATED_VERIFIED').length,
   no_change:rows.filter(x=>x.status==='NO_CHANGE').length,
   update_ready:rows.filter(x=>x.status==='UPDATE_READY').length,
   promotion_ready:rows.filter(x=>x.status==='READY_FOR_GOVERNED_ADMIN_CREATE').length
  },
  dispositions:result.dispositions||[],
  acceptance:result.orchestrator&&result.orchestrator.acceptance||null,
  snapshot_source:result.snapshot_source,
  snapshot_generated_at:result.snapshot_generated_at
 };
}

module.exports=async function handler(req,res){
 if(req.method==='GET')return reply(res,200,{ok:true,service:'kk-ultra-deep-full-loop',runtime_version:Runtime.VERSION,oidc_version:OIDC.VERSION,commit_sha:text(process.env.VERCEL_GIT_COMMIT_SHA)||null,production_writes:0});
 if(req.method!=='POST')return reply(res,405,{ok:false,error_code:'METHOD_NOT_ALLOWED'});
 let input;
 try{input=JSON.parse(await readBody(req)||'{}');}
 catch(err){return reply(res,400,{ok:false,error_code:text(err&&err.code)||'INVALID_JSON'});}
 const token=bearer(req);
 if(!token)return reply(res,401,{ok:false,error_code:'OIDC_TOKEN_REQUIRED'});
 const runId=text(input.run_id),sha=text(input.head_sha),eventName=text(input.event_name);
 if(!/^\d+$/.test(runId)||!/^[0-9a-f]{40}$/.test(sha)||!['issue_comment','workflow_dispatch'].includes(eventName)){
  return reply(res,400,{ok:false,error_code:'FULL_LOOP_IDENTITY_INVALID'});
 }
 let auth;
 try{
  auth=await OIDC.verifyToken(token,{
   audience:OIDC.AUDIENCE,
   repository:REPOSITORY,
   owner:OWNER,
   ref:'refs/heads/main',
   workflow_ref:WORKFLOW_REF,
   run_id:runId,
   sha,
   actor:OWNER,
   event_name:eventName
  });
 }catch(err){
  return reply(res,403,{ok:false,error_code:text(err&&err.code)||'OIDC_REJECTED',blockers:err&&err.blockers||[]});
 }
 const handoff=input.handoff&&typeof input.handoff==='object'?input.handoff:null;
 if(!handoff||!handoff.verifier||!Array.isArray(handoff.verifier.verified_candidates)){
  return reply(res,400,{ok:false,error_code:'COMMERCIAL_HANDOFF_REQUIRED'});
 }
 if(text(handoff.month)!==text(input.month)){
  return reply(res,400,{ok:false,error_code:'MONTH_MISMATCH'});
 }
 let result;
 try{
  result=await Runtime.execute(handoff,{
   executeWrites:true,
   env:process.env,
   fetchImpl:global.fetch,
   correlation_id:'github-run-'+runId
  });
 }catch(err){
  return reply(res,500,{ok:false,error_code:text(err&&err.code)||'FULL_LOOP_EXECUTION_FAILED',error:text(err&&err.message).slice(0,300)});
 }
 return reply(res,200,{ok:true,auth:{verified:auth.verified,run_id:auth.claims.run_id,sha:auth.claims.sha},result:safeSummary(result)});
};

module.exports._test={REPOSITORY,OWNER,WORKFLOW_REF,MAX_BODY,text,bearer,safeSummary};
