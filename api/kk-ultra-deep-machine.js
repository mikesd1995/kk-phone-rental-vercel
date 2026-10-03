'use strict';

const UltraDeepDirect=require('../server/kk-ultra-deep-direct-zero-cost.js');
const WriteControl=require('../server/admin-write-control-oidc.js');

function text(v){return String(v==null?'':v).trim();}
function json(res,status,body){
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
  res.end(JSON.stringify(body));
}
function body(req){
  if(req.body&&typeof req.body==='object'&&!Buffer.isBuffer(req.body)) return req.body;
  if(typeof req.body==='string'&&req.body.trim()) return JSON.parse(req.body);
  return {};
}
module.exports=async function handler(req,res){
  if(req.method==='GET'){
    const control=await WriteControl.health();
    return json(res,control&&control.ok?200:503,{ok:!!(control&&control.ok),version:'KK_ULTRA_DEEP_MACHINE_INGRESS_V26',execution_path:'SUPABASE_AUTH_QUEUE_TO_VERCEL_OIDC',write_control:control,production_writes:0});
  }
  if(req.method!=='POST') return json(res,405,{ok:false,error_code:'METHOD_NOT_ALLOWED',production_writes:0});
  let input={}; try{input=body(req);}catch(_){return json(res,400,{ok:false,error_code:'INVALID_JSON',production_writes:0});}
  const commandId=text(input.command_id);
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(commandId)) return json(res,400,{ok:false,error_code:'COMMAND_ID_INVALID',production_writes:0});
  const claim=await WriteControl.call('commandClaim',{command_id:commandId});
  if(!(claim&&claim.ok&&claim.authenticated&&claim.command)) return json(res,409,{ok:false,error_code:text(claim&&claim.error_code)||'COMMAND_CLAIM_REJECTED',production_writes:0});
  const month=text(claim.command.month);
  const commit=claim.command.commit===true;
  let result;
  try{
    result=await UltraDeepDirect.run({month,location:'Bangkok Thailand'},{executeWrites:commit,env:process.env,fetchImpl:global.fetch,correlation_id:'machine-'+commandId});
    if(!commit&&Number(result.production_writes||0)!==0) throw Object.assign(new Error('read-only invariant'),{code:'READ_ONLY_WRITE_INVARIANT_BROKEN'});
    const complete=result.status==='COMPLETE';
    await WriteControl.call('commandComplete',{command_id:commandId,status:complete?'COMPLETE':'FAILED',production_writes:Number(result.production_writes||0),error_code:complete?null:(result.blockers&&result.blockers[0]||'FULL_LOOP_NOT_COMPLETE')});
    return json(res,complete?200:409,{ok:complete,version:'KK_ULTRA_DEEP_MACHINE_INGRESS_V26',command_id:commandId,month,mode:commit?'COMMIT':'READ_ONLY_ACCEPTANCE',status:result.status,production_writes:Number(result.production_writes||0),blockers:result.blockers||[],preflight:result.preflight||null,production:result.production||null});
  }catch(err){
    await WriteControl.call('commandComplete',{command_id:commandId,status:'FAILED',production_writes:0,error_code:text(err&&err.code)||'MACHINE_FULL_LOOP_FAILED'}).catch(()=>null);
    return json(res,500,{ok:false,version:'KK_ULTRA_DEEP_MACHINE_INGRESS_V26',command_id:commandId,error_code:text(err&&err.code)||'MACHINE_FULL_LOOP_FAILED',error:text(err&&err.message).slice(0,240),production_writes:0});
  }
};
