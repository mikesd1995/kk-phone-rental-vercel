'use strict';

const OIDC_LEDGER_PROJECT_REF='zehlsagzrpromtfqqflt';
const OIDC_LEDGER_FUNCTION='kk-runtime-ledger-oidc-probe';
const OIDC_BRIDGE_TIMEOUT_MS=4000;

function text(value){
  return String(value==null?'':value).trim();
}

function endpoint(){
  return `https://${OIDC_LEDGER_PROJECT_REF}.supabase.co/functions/v1/${OIDC_LEDGER_FUNCTION}`;
}

function oidcToken(env=process.env){
  return text(env.VERCEL_OIDC_TOKEN);
}

async function parseJsonSafe(response){
  try{return await response.json();}catch(_err){return null;}
}

async function probe({
  env=process.env,
  fetchImpl=global.fetch
}={}){
  const token=oidcToken(env);
  if(!token){
    return {
      attempted:false,
      ok:false,
      error_code:'VERCEL_OIDC_TOKEN_MISSING',
      read_only:true,
      bounded_limit:1,
      business_writes:0
    };
  }
  if(typeof fetchImpl!=='function'){
    return {
      attempted:false,
      ok:false,
      error_code:'OIDC_BRIDGE_FETCH_UNAVAILABLE',
      read_only:true,
      bounded_limit:1,
      business_writes:0
    };
  }

  let response;
  try{
    response=await fetchImpl(endpoint(),{
      method:'POST',
      headers:{
        Authorization:`Bearer ${token}`,
        'Content-Type':'application/json',
        Accept:'application/json'
      },
      body:JSON.stringify({probe:'runtime-ledger',version:'v1'}),
      signal:AbortSignal.timeout(OIDC_BRIDGE_TIMEOUT_MS)
    });
  }catch(_err){
    return {
      attempted:true,
      ok:false,
      error_code:'OIDC_BRIDGE_TRANSPORT_FAILED',
      read_only:true,
      bounded_limit:1,
      business_writes:0
    };
  }

  const body=await parseJsonSafe(response);
  if(!response.ok || !body || typeof body!=='object'){
    return {
      attempted:true,
      ok:false,
      error_code:text(body&&body.error_code)||'OIDC_BRIDGE_REMOTE_FAILED',
      remote_status:Number.isInteger(response.status)?response.status:null,
      read_only:true,
      bounded_limit:1,
      business_writes:0
    };
  }

  return {
    attempted:true,
    ok:body.ok===true && body.authenticated===true && body.read_only===true &&
      body.bounded_limit===1 && body.business_writes===0,
    authenticated:body.authenticated===true,
    row_count:Number.isInteger(body.row_count)?body.row_count:0,
    read_only:true,
    bounded_limit:1,
    business_writes:0
  };
}

module.exports={
  OIDC_LEDGER_PROJECT_REF,
  OIDC_LEDGER_FUNCTION,
  OIDC_BRIDGE_TIMEOUT_MS,
  endpoint,
  oidcToken,
  probe
};
