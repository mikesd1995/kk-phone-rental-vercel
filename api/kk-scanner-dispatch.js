'use strict';

const Runtime=require('../server/external-scanner-runtime');
const Ledger=require('../server/runtime-ledger');

function text(value){
  return String(value==null?'':value).trim();
}

function enabled(value){
  return ['1','true','yes','on'].includes(text(value).toLowerCase());
}

function json(res,status,body){
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.end(JSON.stringify(body));
}

function bodyObject(req){
  if(req.body && typeof req.body==='object' && !Buffer.isBuffer(req.body)) return req.body;
  if(typeof req.body==='string' && req.body.trim()) return JSON.parse(req.body);
  return {};
}

function queryValue(req,key){
  if(req && req.query && Object.prototype.hasOwnProperty.call(req.query,key)){
    const value=req.query[key];
    return Array.isArray(value)?text(value[0]):text(value);
  }
  try{
    const parsed=new URL(String(req&&req.url||'/'),'https://kk-local.invalid');
    return text(parsed.searchParams.get(key));
  }catch(_err){
    return '';
  }
}

function readinessSnapshot(env=process.env){
  const ledger=Ledger.configState(env);
  const externalScannerEnabled=enabled(env.KK_EXTERNAL_SCANNER_ENABLED);
  const mode=text(env.KK_EXTERNAL_SCANNER_MODE).toLowerCase()||'unset';
  const hmacSecretConfigured=!!text(env.KK_EXTERNAL_SCANNER_SECRET);
  return {
    phase:'EXTERNAL_SCANNER_WITNESS_V1',
    external_scanner_enabled:externalScannerEnabled,
    mode,
    hmac_secret_configured:hmacSecretConfigured,
    runtime_ledger_enabled:ledger.enabled,
    runtime_ledger_configured:ledger.configured,
    supabase_url_configured:ledger.url_configured,
    supabase_server_key_configured:ledger.server_key_configured,
    supabase_key_mode:ledger.key_mode,
    supabase_project_ref_configured:ledger.project_ref_configured,
    supabase_url_project_ref_resolved:ledger.url_project_ref_resolved,
    supabase_project_binding_matches:ledger.project_binding_matches,
    ready_for_witness:(
      externalScannerEnabled &&
      mode==='witness' &&
      hmacSecretConfigured &&
      ledger.configured
    ),
    scanner_execution_capable:false,
    business_writes_capable:false
  };
}

async function ledgerConnectivityProbe({
  env=process.env,
  listExpectations=Ledger.listExpectations
}={}){
  const ledger=Ledger.configState(env);
  if(!ledger.enabled){
    return {
      attempted:false,
      ok:false,
      error_code:'RUNTIME_LEDGER_DISABLED',
      read_only:true,
      bounded_limit:1,
      business_writes:0
    };
  }
  if(!ledger.configured){
    return {
      attempted:false,
      ok:false,
      error_code:'RUNTIME_LEDGER_NOT_CONFIGURED',
      read_only:true,
      bounded_limit:1,
      business_writes:0
    };
  }

  try{
    const result=await listExpectations({
      env,
      role:'SCANNER',
      mode:'WITNESS_ONLY',
      limit:1
    });
    return {
      attempted:true,
      ok:true,
      row_count:Array.isArray(result&&result.rows)?result.rows.length:0,
      read_only:true,
      bounded_limit:1,
      business_writes:0
    };
  }catch(err){
    return {
      attempted:true,
      ok:false,
      error_code:String(err&&err.code||'RUNTIME_LEDGER_PROBE_FAILED'),
      remote_status:Number.isInteger(err&&err.status)?err.status:null,
      read_only:true,
      bounded_limit:1,
      business_writes:0
    };
  }
}

module.exports=async function handler(req,res){
  if(req.method==='OPTIONS') return json(res,204,{});
  if(req.method==='GET'){
    const readiness=readinessSnapshot(process.env);
    if(queryValue(req,'probe').toLowerCase()!=='ledger'){
      return json(res,200,{ok:true,data:readiness});
    }
    const probe=await ledgerConnectivityProbe({env:process.env});
    return json(res,probe.ok?200:503,{
      ok:probe.ok,
      data:readiness,
      runtime_ledger_probe:probe
    });
  }
  if(req.method!=='POST') return json(res,405,{ok:false,error_code:'METHOD_NOT_ALLOWED'});

  const env=process.env;
  if(!enabled(env.KK_EXTERNAL_SCANNER_ENABLED)){
    return json(res,503,{ok:false,error_code:'EXTERNAL_SCANNER_DISABLED',business_writes:0});
  }
  if(text(env.KK_EXTERNAL_SCANNER_MODE).toLowerCase()!=='witness'){
    return json(res,503,{ok:false,error_code:'EXTERNAL_SCANNER_MODE_NOT_WITNESS',business_writes:0});
  }

  const secret=text(env.KK_EXTERNAL_SCANNER_SECRET);
  if(!secret){
    return json(res,503,{ok:false,error_code:'EXTERNAL_SCANNER_SECRET_MISSING',business_writes:0});
  }

  const ledger=Ledger.configState(env);
  if(!ledger.configured){
    return json(res,503,{
      ok:false,
      error_code:ledger.enabled?'RUNTIME_LEDGER_NOT_CONFIGURED':'RUNTIME_LEDGER_DISABLED',
      business_writes:0
    });
  }

  let input;
  try{
    input=bodyObject(req);
  }catch(_err){
    return json(res,400,{ok:false,error_code:'INVALID_JSON',business_writes:0});
  }

  let verified;
  try{
    verified=Runtime.verifyEnvelope({
      secret,
      signature:req.headers && req.headers['x-kk-scanner-signature'],
      envelope:input
    });
  }catch(err){
    return json(res,401,{
      ok:false,
      error_code:String(err&&err.code||'TRIGGER_REJECTED'),
      business_writes:0
    });
  }

  const row={
    occurrence_id:verified.envelope.occurrence_id,
    role:'SCANNER',
    scheduled_at:verified.envelope.scheduled_at,
    issued_at:verified.envelope.issued_at,
    source:verified.envelope.source,
    trigger_version:verified.envelope.version,
    nonce:verified.envelope.nonce,
    payload_hash:verified.payload_hash,
    status:'EXPECTED',
    mode:'WITNESS_ONLY'
  };

  try{
    const result=await Ledger.recordExpectation({env,row});
    return json(res,202,{
      ok:true,
      phase:'EXTERNAL_SCANNER_WITNESS_V1',
      occurrence_id:row.occurrence_id,
      ledger_inserted:result.inserted,
      idempotent_duplicate:result.idempotent_duplicate,
      scanner_execution_started:false,
      business_writes:0
    });
  }catch(err){
    return json(res,503,{
      ok:false,
      error_code:String(err&&err.code||'RUNTIME_LEDGER_WRITE_FAILED'),
      business_writes:0
    });
  }
};

module.exports._test={
  bodyObject,
  enabled,
  queryValue,
  readinessSnapshot,
  ledgerConnectivityProbe
};
