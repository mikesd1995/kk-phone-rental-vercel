'use strict';

function text(value){
  return String(value==null?'':value).trim();
}

function bool(value){
  return ['1','true','yes','on'].includes(text(value).toLowerCase());
}

function resolveServerKey(env=process.env){
  const secretKey=text(env.SUPABASE_SECRET_KEY);
  if(secretKey) return {value:secretKey,mode:'secret'};
  const legacyServiceRoleKey=text(env.SUPABASE_SERVICE_ROLE_KEY);
  if(legacyServiceRoleKey) return {value:legacyServiceRoleKey,mode:'legacy_service_role'};
  return {value:'',mode:'none'};
}

function configState(env=process.env){
  const enabled=bool(env.KK_RUNTIME_LEDGER_ENABLED);
  const url=text(env.SUPABASE_URL).replace(/\/+$/,'');
  const serverKey=resolveServerKey(env);
  return {
    enabled,
    configured:enabled && !!url && !!serverKey.value,
    url_configured:!!url,
    server_key_configured:!!serverKey.value,
    key_mode:serverKey.mode,
    table:'kk_runtime_expectations'
  };
}

async function parseJsonSafe(response){
  try{
    return await response.json();
  }catch(_err){
    return null;
  }
}

async function recordExpectation({env=process.env,fetchImpl=global.fetch,row}){
  const cfg=configState(env);
  if(!cfg.enabled){
    throw Object.assign(new Error('runtime ledger is disabled'),{code:'RUNTIME_LEDGER_DISABLED'});
  }
  if(!cfg.configured){
    throw Object.assign(new Error('runtime ledger is not configured'),{code:'RUNTIME_LEDGER_NOT_CONFIGURED'});
  }
  if(typeof fetchImpl!=='function'){
    throw Object.assign(new Error('fetch implementation unavailable'),{code:'RUNTIME_LEDGER_FETCH_UNAVAILABLE'});
  }

  const serverKey=resolveServerKey(env).value;
  const endpoint=`${text(env.SUPABASE_URL).replace(/\/+$/,'')}/rest/v1/kk_runtime_expectations?on_conflict=occurrence_id`;
  const response=await fetchImpl(endpoint,{
    method:'POST',
    headers:{
      apikey:serverKey,
      Authorization:`Bearer ${serverKey}`,
      'Content-Type':'application/json',
      Prefer:'resolution=ignore-duplicates,return=representation'
    },
    body:JSON.stringify([row])
  });
  const body=await parseJsonSafe(response);
  if(!response.ok){
    const error=Object.assign(new Error('runtime ledger insert failed'),{
      code:'RUNTIME_LEDGER_WRITE_FAILED',
      status:response.status
    });
    if(body && typeof body==='object') error.remote_code=body.code||'';
    throw error;
  }
  const inserted=Array.isArray(body) && body.length>0;
  return {
    ok:true,
    inserted,
    idempotent_duplicate:!inserted,
    occurrence_id:row.occurrence_id
  };
}

module.exports={configState,recordExpectation,resolveServerKey};
