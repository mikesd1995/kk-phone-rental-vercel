'use strict';

const OIDC_LEDGER_PROJECT_REF='zehlsagzrpromtfqqflt';
const OIDC_LEDGER_FUNCTION='kk-runtime-ledger-oidc-probe';
const OIDC_BRIDGE_TIMEOUT_MS=4000;
const PROJECT_MEMORY_MAX_ROWS=80;

function text(value){ return String(value==null?'':value).trim(); }
function endpoint(){ return `https://${OIDC_LEDGER_PROJECT_REF}.supabase.co/functions/v1/${OIDC_LEDGER_FUNCTION}`; }

async function officialVercelOidcToken(){
  let oidc;
  try{ oidc=require('@vercel/functions/oidc'); }catch(_err){ return ''; }
  if(!oidc || typeof oidc.getVercelOidcToken!=='function') return '';
  try{ return text(await oidc.getVercelOidcToken()); }catch(_err){ return ''; }
}

async function resolveOidcToken({getTokenImpl=officialVercelOidcToken}={}){
  if(typeof getTokenImpl!=='function') return '';
  try{ return text(await getTokenImpl()); }catch(_err){ return ''; }
}

async function parseJsonSafe(response){ try{return await response.json();}catch(_err){return null;} }

async function request(body,{fetchImpl=global.fetch,getTokenImpl=officialVercelOidcToken}={}){
  const token=await resolveOidcToken({getTokenImpl});
  if(!token) return {attempted:false,ok:false,error_code:'VERCEL_OIDC_TOKEN_MISSING',remote_status:null};
  if(typeof fetchImpl!=='function') return {attempted:false,ok:false,error_code:'OIDC_BRIDGE_FETCH_UNAVAILABLE',remote_status:null};
  let response;
  try{
    response=await fetchImpl(endpoint(),{
      method:'POST',
      headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',Accept:'application/json'},
      body:JSON.stringify(body),
      signal:AbortSignal.timeout(OIDC_BRIDGE_TIMEOUT_MS)
    });
  }catch(err){
    return {attempted:true,ok:false,error_code:String(err&&err.name)==='TimeoutError'?'OIDC_BRIDGE_TIMEOUT':'OIDC_BRIDGE_TRANSPORT_FAILED',remote_status:null};
  }
  const parsed=await parseJsonSafe(response);
  if(!response.ok || !parsed || typeof parsed!=='object'){
    return {attempted:true,ok:false,error_code:text(parsed&&parsed.error_code)||'OIDC_BRIDGE_REMOTE_FAILED',remote_status:Number.isInteger(response.status)?response.status:null};
  }
  return {attempted:true,ok:true,remote_status:Number.isInteger(response.status)?response.status:null,body:parsed};
}

async function probe(options={}){
  const remote=await request({probe:'runtime-ledger',version:'v1'},options);
  if(!remote.ok){
    return {...remote,read_only:true,bounded_limit:1,business_writes:0};
  }
  const body=remote.body||{};
  return {
    attempted:true,
    ok:body.ok===true && body.authenticated===true && body.read_only===true && body.bounded_limit===1 && body.business_writes===0,
    authenticated:body.authenticated===true,
    row_count:Number.isInteger(body.row_count)?body.row_count:0,
    read_only:true,
    bounded_limit:1,
    business_writes:0
  };
}

function normalizeDomains(value){
  return [...new Set((Array.isArray(value)?value:[]).map(v=>text(v).toLowerCase()).filter(v=>/^[a-z0-9_:-]{2,80}$/.test(v)))].slice(0,12);
}

async function readProjectMemory({domains=[],limit=80,fetchImpl=global.fetch,getTokenImpl=officialVercelOidcToken}={}){
  const safeLimit=Math.max(1,Math.min(Number(limit)||80,PROJECT_MEMORY_MAX_ROWS));
  const remote=await request({probe:'project-memory',version:'v1',domains:normalizeDomains(domains),limit:safeLimit},{fetchImpl,getTokenImpl});
  if(!remote.ok) return {...remote,read_only:true,bounded_limit:safeLimit,business_writes:0,rows:[]};
  const body=remote.body||{};
  const rows=Array.isArray(body.rows)?body.rows:[];
  const valid=body.ok===true && body.authenticated===true && body.read_only===true && body.business_writes===0 &&
    Number(body.bounded_limit)===safeLimit && rows.length<=safeLimit;
  return {
    attempted:true,
    ok:valid,
    authenticated:body.authenticated===true,
    rows:valid?rows:[],
    read_only:true,
    bounded_limit:safeLimit,
    business_writes:0,
    error_code:valid?'':'PROJECT_MEMORY_OIDC_RESPONSE_INVALID'
  };
}


async function writeAgentInvocation({row,fetchImpl=global.fetch,getTokenImpl=officialVercelOidcToken}={}){
  const remote=await request({probe:'agent-invocation-write',version:'v1',row},{fetchImpl,getTokenImpl});
  if(!remote.ok)return {...remote,read_only:false,audit_writes:0,business_writes:0};
  const body=remote.body||{};
  const valid=body.ok===true&&body.authenticated===true&&body.read_only===false&&body.business_writes===0&&
    String(body.invocation_id||'')===String(row&&row.invocation_id||'')&&[0,1].includes(Number(body.audit_writes));
  return {
    attempted:true,ok:valid,authenticated:body.authenticated===true,
    inserted:valid&&body.inserted===true,idempotent_duplicate:valid&&body.inserted!==true,
    invocation_id:valid?String(body.invocation_id||''):'',
    read_only:false,audit_writes:valid?Number(body.audit_writes):0,business_writes:0,
    error_code:valid?'':'AGENT_INVOCATION_OIDC_RESPONSE_INVALID'
  };
}

async function readAgentInvocations({limit=20,fetchImpl=global.fetch,getTokenImpl=officialVercelOidcToken}={}){
  const safeLimit=Math.max(1,Math.min(Number(limit)||20,100));
  const remote=await request({probe:'agent-invocation-read',version:'v1',limit:safeLimit},{fetchImpl,getTokenImpl});
  if(!remote.ok)return {...remote,read_only:true,bounded_limit:safeLimit,business_writes:0,rows:[]};
  const body=remote.body||{},rows=Array.isArray(body.rows)?body.rows:[];
  const valid=body.ok===true&&body.authenticated===true&&body.read_only===true&&body.business_writes===0&&Number(body.bounded_limit)===safeLimit&&rows.length<=safeLimit;
  return {attempted:true,ok:valid,authenticated:body.authenticated===true,rows:valid?rows:[],read_only:true,bounded_limit:safeLimit,business_writes:0,error_code:valid?'':'AGENT_INVOCATION_OIDC_READ_INVALID'};
}

module.exports={
  OIDC_LEDGER_PROJECT_REF,OIDC_LEDGER_FUNCTION,OIDC_BRIDGE_TIMEOUT_MS,PROJECT_MEMORY_MAX_ROWS,
  endpoint,officialVercelOidcToken,resolveOidcToken,request,probe,normalizeDomains,readProjectMemory,
  writeAgentInvocation,readAgentInvocations
};
