'use strict';

const PROJECT_REF='zehlsagzrpromtfqqflt';
const FUNCTION_SLUG='kk-project-memory-github-read';
const MAX_ROWS=80;
const TIMEOUT_MS=4000;

function text(v){return String(v==null?'':v).trim();}
function endpoint(){return `https://${PROJECT_REF}.supabase.co/functions/v1/${FUNCTION_SLUG}`;}
function normalizeDomains(value){
  return [...new Set((Array.isArray(value)?value:[]).map(v=>text(v).toLowerCase()).filter(v=>/^[a-z0-9_:-]{2,80}$/.test(v)))].slice(0,12);
}

async function officialGithubOidcToken({env=process.env,fetchImpl=global.fetch}={}){
  const requestUrl=text(env.ACTIONS_ID_TOKEN_REQUEST_URL);
  const requestToken=text(env.ACTIONS_ID_TOKEN_REQUEST_TOKEN);
  if(!requestUrl||!requestToken||typeof fetchImpl!=='function') return '';
  let u;
  try{
    u=new URL(requestUrl);
    u.searchParams.set('audience',endpoint());
  }catch(_){return '';}
  try{
    const r=await fetchImpl(u.toString(),{
      method:'GET',
      headers:{Authorization:`Bearer ${requestToken}`,Accept:'application/json'},
      signal:AbortSignal.timeout(TIMEOUT_MS)
    });
    if(!r.ok) return '';
    const body=await r.json();
    return text(body&&body.value);
  }catch(_){return '';}
}

async function readProjectMemory({env=process.env,domains=[],limit=80,fetchImpl=global.fetch,getTokenImpl}={}){
  const safeLimit=Math.max(1,Math.min(Number(limit)||80,MAX_ROWS));
  const token=typeof getTokenImpl==='function'
    ? text(await getTokenImpl())
    : await officialGithubOidcToken({env,fetchImpl});
  if(!token) return {attempted:false,ok:false,error_code:'GITHUB_OIDC_TOKEN_MISSING',rows:[],read_only:true,bounded_limit:safeLimit,business_writes:0};
  if(typeof fetchImpl!=='function') return {attempted:false,ok:false,error_code:'GITHUB_OIDC_FETCH_UNAVAILABLE',rows:[],read_only:true,bounded_limit:safeLimit,business_writes:0};
  let r;
  try{
    r=await fetchImpl(endpoint(),{
      method:'POST',
      headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',Accept:'application/json'},
      body:JSON.stringify({probe:'project-memory',version:'v1',domains:normalizeDomains(domains),limit:safeLimit}),
      signal:AbortSignal.timeout(TIMEOUT_MS)
    });
  }catch(err){
    return {attempted:true,ok:false,error_code:String(err&&err.name)==='TimeoutError'?'GITHUB_OIDC_MEMORY_TIMEOUT':'GITHUB_OIDC_MEMORY_TRANSPORT_FAILED',rows:[],read_only:true,bounded_limit:safeLimit,business_writes:0};
  }
  let body=null; try{body=await r.json();}catch(_){}
  if(!r.ok||!body||typeof body!=='object'){
    return {attempted:true,ok:false,error_code:text(body&&body.error_code)||'GITHUB_OIDC_MEMORY_REMOTE_FAILED',remote_status:r.status,rows:[],read_only:true,bounded_limit:safeLimit,business_writes:0};
  }
  const rows=Array.isArray(body.rows)?body.rows:[];
  const valid=body.ok===true&&body.authenticated===true&&body.read_only===true&&body.business_writes===0&&Number(body.bounded_limit)===safeLimit&&rows.length<=safeLimit;
  return {
    attempted:true,ok:valid,authenticated:body.authenticated===true,
    error_code:valid?'':'GITHUB_OIDC_MEMORY_RESPONSE_INVALID',
    rows:valid?rows:[],read_only:true,bounded_limit:safeLimit,business_writes:0
  };
}


async function writeAgentInvocation({env=process.env,row,fetchImpl=global.fetch,getTokenImpl}={}){
  const token=typeof getTokenImpl==='function'?text(await getTokenImpl()):await officialGithubOidcToken({env,fetchImpl});
  if(!token)return {attempted:false,ok:false,error_code:'GITHUB_OIDC_TOKEN_MISSING',read_only:false,audit_writes:0,business_writes:0};
  if(typeof fetchImpl!=='function')return {attempted:false,ok:false,error_code:'GITHUB_OIDC_FETCH_UNAVAILABLE',read_only:false,audit_writes:0,business_writes:0};
  let r;
  try{
    r=await fetchImpl(endpoint(),{
      method:'POST',
      headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',Accept:'application/json'},
      body:JSON.stringify({probe:'agent-invocation-write',version:'v1',row}),
      signal:AbortSignal.timeout(TIMEOUT_MS)
    });
  }catch(err){
    return {attempted:true,ok:false,error_code:String(err&&err.name)==='TimeoutError'?'GITHUB_OIDC_AGENT_LEDGER_TIMEOUT':'GITHUB_OIDC_AGENT_LEDGER_TRANSPORT_FAILED',read_only:false,audit_writes:0,business_writes:0};
  }
  let body=null;try{body=await r.json();}catch(_){}
  if(!r.ok||!body||typeof body!=='object')return {attempted:true,ok:false,error_code:text(body&&body.error_code)||'GITHUB_OIDC_AGENT_LEDGER_REMOTE_FAILED',remote_status:r.status,read_only:false,audit_writes:0,business_writes:0};
  const valid=body.ok===true&&body.authenticated===true&&body.read_only===false&&body.business_writes===0&&String(body.invocation_id||'')===text(row&&row.invocation_id)&&[0,1].includes(Number(body.audit_writes));
  return {attempted:true,ok:valid,authenticated:body.authenticated===true,inserted:valid&&body.inserted===true,idempotent_duplicate:valid&&body.inserted!==true,invocation_id:valid?text(body.invocation_id):'',read_only:false,audit_writes:valid?Number(body.audit_writes):0,business_writes:0,error_code:valid?'':'GITHUB_OIDC_AGENT_LEDGER_RESPONSE_INVALID'};
}

module.exports={PROJECT_REF,FUNCTION_SLUG,MAX_ROWS,TIMEOUT_MS,endpoint,normalizeDomains,officialGithubOidcToken,readProjectMemory,writeAgentInvocation};
