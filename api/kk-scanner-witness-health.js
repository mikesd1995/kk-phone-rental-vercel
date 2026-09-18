'use strict';

const Ledger=require('../server/runtime-ledger');

function text(value){
  return String(value==null?'':value).trim();
}

function enabled(value){
  return ['1','true','yes','on'].includes(text(value).toLowerCase());
}

function snapshot(env=process.env){
  const ledger=Ledger.configState(env);
  const externalScannerEnabled=enabled(env.KK_EXTERNAL_SCANNER_ENABLED);
  const mode=text(env.KK_EXTERNAL_SCANNER_MODE).toLowerCase()||'unset';
  const hmacSecretConfigured=!!text(env.KK_EXTERNAL_SCANNER_SECRET);
  const readyForWitness=(
    externalScannerEnabled &&
    mode==='witness' &&
    hmacSecretConfigured &&
    ledger.configured
  );

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
    ready_for_witness:readyForWitness,
    scanner_execution_capable:false,
    business_writes_capable:false
  };
}

function json(res,status,body){
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.end(JSON.stringify(body));
}

module.exports=function handler(req,res){
  if(req.method==='OPTIONS') return json(res,204,{});
  if(req.method!=='GET') return json(res,405,{ok:false,error_code:'METHOD_NOT_ALLOWED'});
  return json(res,200,{ok:true,data:snapshot(process.env)});
};

module.exports._test={snapshot,enabled};
