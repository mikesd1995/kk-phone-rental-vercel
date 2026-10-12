'use strict';
// Production deployment retrigger 2026-10-05: no runtime behavior change.

const Runtime=require('../server/external-scanner-runtime');
const Ledger=require('../server/runtime-ledger');
const OidcBridge=require('../server/runtime-ledger-oidc-bridge');
const UltraDeepRuntime=require('../server/kk-ultra-deep-runtime-runner');
const UltraDeepDirect=require('../server/kk-ultra-deep-direct-zero-cost.js');
const WriteControl=require('../server/admin-write-control-oidc.js');
const OwnerNotifyTransport=require('../server/kk-make-owner-notify.js');

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
  try{
    const parsed=new URL(String(req&&req.url||'/'),'https://kk-local.invalid');
    const values=parsed.searchParams.getAll(key);
    if(values.length>1) return '';
    if(values.length===1) return text(values[0]);
  }catch(_err){}

  // Avoid Vercel's deprecated IncomingMessage.prototype query getter. A plain
  // own query object remains supported for unit/local callers only.
  try{
    const desc=req&&Object.getOwnPropertyDescriptor(req,'query');
    const query=desc&&Object.prototype.hasOwnProperty.call(desc,'value')?desc.value:null;
    if(query&&typeof query==='object'&&Object.prototype.hasOwnProperty.call(query,key)){
      const value=query[key];
      return Array.isArray(value)?text(value[0]):text(value);
    }
  }catch(_err){}
  return '';
}

function machineResultComplete(result={},commit=false){
 const status=text(result&&result.status);
 if(commit===true)return status==='COMPLETE';
 return status==='V2_READ_ONLY_READY' && Number(result&&result.production_writes||0)===0 &&
  text(result&&result.v2_read_only&&result.v2_read_only.status)==='READY';
}

function terminalErrorCode(result={}){
  const top=text(result&&result.blockers&&result.blockers[0]);
  if(top) return top;
  const diagnostic=result&&result.discovery&&result.discovery.diagnostic||{};
  const inner=text(diagnostic.blockers&&diagnostic.blockers[0]);
  if(inner==='UNKNOWN_URL_SEARCH_PREFLIGHT_FAILED'){
    const rows=diagnostic.receipts&&diagnostic.receipts.preflight;
    const attempts=Array.isArray(rows)&&rows[0]&&Array.isArray(rows[0].attempts)?rows[0].attempts:[];
    const summary=attempts.map(a=>[text(a.provider),text(a.status)].filter(Boolean).join('_')).filter(Boolean).join('__').toUpperCase().replace(/[^A-Z0-9_]/g,'_').slice(0,200);
    if(summary) return 'PREFLIGHT_'+summary;
  }
  return inner||text(result&&result.status)||'FULL_LOOP_NOT_COMPLETE';
}

function verifierDiagnostic(verifier={}){
  const counts={};
  const holds=Array.isArray(verifier&&verifier.holds)?verifier.holds:[];
  for(const hold of holds){
    for(const raw of Array.isArray(hold&&hold.blockers)?hold.blockers:[]){
      const key=text(raw).toUpperCase().replace(/[^A-Z0-9_]/g,'_').slice(0,96)||'UNKNOWN';
      counts[key]=(counts[key]||0)+1;
    }
  }
  const blocker_histogram=Object.fromEntries(Object.entries(counts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,16));
  return {
    status:text(verifier&&verifier.status)||null,
    input_count:Number(verifier&&verifier.input_count||0),
    fetched_count:Number(verifier&&verifier.fetched_count||0),
    verified_count:Number(verifier&&verifier.verified_count||0),
    hold_count:Number(verifier&&verifier.hold_count||0),
    blocker_histogram,
    privacy:'COUNTS_ONLY_NO_TITLE_URL_PAYLOAD',
    production_writes:0
  };
}

function readinessSnapshot(env=process.env){
  const ledger=Ledger.configState(env);
  const externalScannerEnabled=enabled(env.KK_EXTERNAL_SCANNER_ENABLED);
  const mode=text(env.KK_EXTERNAL_SCANNER_MODE).toLowerCase()||'unset';
  const hmacSecretConfigured=!!text(env.KK_EXTERNAL_SCANNER_SECRET);
  const oidcProbeEnabled=enabled(env.KK_RUNTIME_LEDGER_OIDC_PROBE_ENABLED);
  const executionEnabled=enabled(env.KK_EXTERNAL_SCANNER_EXECUTION_ENABLED);
  const searxngConfigured=/^https:\/\//i.test(text(env.KK_SEARXNG_ENDPOINT));
  const builtinUnknownUrlSearch=true;
  const unknownUrlSearchConfigured=builtinUnknownUrlSearch||searxngConfigured;
  const scannerExecutionCapable=externalScannerEnabled && mode==='execute-readonly' && executionEnabled && unknownUrlSearchConfigured;
  return {
    phase:'EXTERNAL_SCANNER_WITNESS_V1',
    machine_ingress_version:'KK_ULTRA_DEEP_MACHINE_V26',
    machine_ingress_auth:'SUPABASE_QUEUE_VERCEL_OIDC',
    external_scanner_enabled:externalScannerEnabled,
    mode,
    hmac_secret_configured:hmacSecretConfigured,
    runtime_ledger_oidc_probe_enabled:oidcProbeEnabled,
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
    execution_enabled:executionEnabled,
    builtin_unknown_url_search:true,
    unknown_url_search_configured:unknownUrlSearchConfigured,
    ready_for_execution:(scannerExecutionCapable && hmacSecretConfigured && ledger.configured),
    scanner_execution_capable:scannerExecutionCapable,
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
    const probeLedgerMode=text(env.KK_EXTERNAL_SCANNER_MODE).toLowerCase()==='execute-readonly'?'EXECUTE_READONLY':'WITNESS_ONLY';
    const result=await listExpectations({
      env,
      role:'SCANNER',
      mode:probeLedgerMode,
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
  // Reuse this existing Vercel Function to remain within the Hobby limit of 12.
  // Same auth/HMAC/feature flags from the isolated transport handler apply.
  if(queryValue(req,'owner_transport')==='v1') return OwnerNotifyTransport(req,res);
  if(req.method==='OPTIONS') return json(res,204,{});
  if(req.method==='GET'){
    const readiness=readinessSnapshot(process.env);
    const readonlyCommandId=queryValue(req,'readonly_command_id');
    if(readonlyCommandId){
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(readonlyCommandId)) return json(res,400,{ok:false,error_code:'COMMAND_ID_INVALID',business_writes:0});
      const claim=await WriteControl.call('commandClaim',{request_id:'ultra-deep-command:'+readonlyCommandId,command_id:readonlyCommandId});
      if(!(claim&&claim.ok&&claim.authenticated&&claim.command)) return json(res,409,{ok:false,error_code:text(claim&&claim.error_code)||'COMMAND_CLAIM_REJECTED',business_writes:0});
      if(claim.command.commit===true){
        await WriteControl.call('commandComplete',{request_id:'ultra-deep-command:'+readonlyCommandId,command_id:readonlyCommandId,status:'FAILED',production_writes:0,error_code:'GET_COMMIT_FORBIDDEN'}).catch(()=>null);
        return json(res,405,{ok:false,error_code:'GET_COMMIT_FORBIDDEN',business_writes:0});
      }
      const month=text(claim.command.month);
      try{
        const result=await UltraDeepDirect.run({month,location:'Bangkok Metropolitan Region Thailand'},{executeWrites:false,env:process.env,fetchImpl:global.fetch,correlation_id:'machine-readonly-'+readonlyCommandId});
        if(Number(result.production_writes||0)!==0) throw Object.assign(new Error('read-only invariant'),{code:'READ_ONLY_WRITE_INVARIANT_BROKEN'});
        const complete=machineResultComplete(result,false);
        await WriteControl.call('commandComplete',{request_id:'ultra-deep-command:'+readonlyCommandId,command_id:readonlyCommandId,status:complete?'COMPLETE':'FAILED',production_writes:0,error_code:complete?null:terminalErrorCode(result)});
        return json(res,complete?200:409,{ok:complete,phase:'ULTRA_DEEP_V2_READ_ONLY_GET',direct_runtime:UltraDeepDirect.VERSION,command_id:readonlyCommandId,month,mode:'READ_ONLY_ACCEPTANCE',status:result.status,blockers:result.blockers||[],discovery_diagnostic:result.discovery&&result.discovery.diagnostic||null,verifier_diagnostic:verifierDiagnostic(result.verifier||{}),preflight:result.preflight||null,production:result.production||null,business_writes:0});
      }catch(err){
        await WriteControl.call('commandComplete',{request_id:'ultra-deep-command:'+readonlyCommandId,command_id:readonlyCommandId,status:'FAILED',production_writes:0,error_code:text(err&&err.code)||'MACHINE_FULL_LOOP_FAILED'}).catch(()=>null);
        return json(res,500,{ok:false,phase:'ULTRA_DEEP_V2_READ_ONLY_GET',direct_runtime:UltraDeepDirect.VERSION,command_id:readonlyCommandId,error_code:text(err&&err.code)||'MACHINE_FULL_LOOP_FAILED',error:text(err&&err.message).slice(0,240),business_writes:0});
      }
    }
    const probeMode=queryValue(req,'probe').toLowerCase();
    if(!probeMode){
      return json(res,200,{ok:true,data:readiness});
    }
    if(probeMode==='ledger'){
      const probe=await ledgerConnectivityProbe({env:process.env});
      return json(res,probe.ok?200:503,{
        ok:probe.ok,
        data:readiness,
        runtime_ledger_probe:probe
      });
    }
    if(probeMode==='ledger-oidc'){
      if(!readiness.runtime_ledger_oidc_probe_enabled){
        const probe={
          attempted:false,
          ok:false,
          error_code:'OIDC_PROBE_DISABLED',
          read_only:true,
          bounded_limit:1,
          business_writes:0
        };
        return json(res,503,{
          ok:false,
          data:readiness,
          runtime_ledger_oidc_probe:probe
        });
      }
      const probe=await OidcBridge.probe({env:process.env});
      return json(res,probe.ok?200:503,{
        ok:probe.ok,
        data:readiness,
        runtime_ledger_oidc_probe:probe
      });
    }
    return json(res,400,{
      ok:false,
      error_code:'UNKNOWN_PROBE',
      data:readiness,
      business_writes:0
    });
  }
  if(req.method!=='POST') return json(res,405,{ok:false,error_code:'METHOD_NOT_ALLOWED'});

  let machineInput={};
  try{machineInput=bodyObject(req);}catch(_err){return json(res,400,{ok:false,error_code:'INVALID_JSON',business_writes:0});}
  if(text(machineInput.action)==='ultraDeepMachineRun'){
    const commandId=text(machineInput.command_id);
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(commandId)) return json(res,400,{ok:false,error_code:'COMMAND_ID_INVALID',business_writes:0});
    const claim=await WriteControl.call('commandClaim',{request_id:'ultra-deep-command:'+commandId,command_id:commandId});
    if(!(claim&&claim.ok&&claim.authenticated&&claim.command)) return json(res,409,{ok:false,error_code:text(claim&&claim.error_code)||'COMMAND_CLAIM_REJECTED',business_writes:0});
    const month=text(claim.command.month);
    const commit=claim.command.commit===true;
    try{
      const result=await UltraDeepDirect.run({month,location:'Bangkok Metropolitan Region Thailand'},{executeWrites:commit,env:process.env,fetchImpl:global.fetch,correlation_id:'machine-'+commandId});
      if(!commit&&Number(result.production_writes||0)!==0) throw Object.assign(new Error('read-only invariant'),{code:'READ_ONLY_WRITE_INVARIANT_BROKEN'});
      const complete=machineResultComplete(result,commit);
      await WriteControl.call('commandComplete',{request_id:'ultra-deep-command:'+commandId,command_id:commandId,status:complete?'COMPLETE':'FAILED',production_writes:Number(result.production_writes||0),error_code:complete?null:terminalErrorCode(result)});
      return json(res,complete?200:409,{ok:complete,phase:'ULTRA_DEEP_V2_MACHINE',direct_runtime:UltraDeepDirect.VERSION,command_id:commandId,month,mode:commit?'COMMIT':'READ_ONLY_ACCEPTANCE',status:result.status,blockers:result.blockers||[],discovery_diagnostic:result.discovery&&result.discovery.diagnostic||null,verifier_diagnostic:verifierDiagnostic(result.verifier||{}),preflight:result.preflight||null,production:result.production||null,business_writes:Number(result.production_writes||0)});
    }catch(err){
      await WriteControl.call('commandComplete',{request_id:'ultra-deep-command:'+commandId,command_id:commandId,status:'FAILED',production_writes:0,error_code:text(err&&err.code)||'MACHINE_FULL_LOOP_FAILED'}).catch(()=>null);
      return json(res,500,{ok:false,phase:'ULTRA_DEEP_V2_MACHINE',direct_runtime:UltraDeepDirect.VERSION,command_id:commandId,error_code:text(err&&err.code)||'MACHINE_FULL_LOOP_FAILED',error:text(err&&err.message).slice(0,240),business_writes:0});
    }
  }

  const env=process.env;
  if(!enabled(env.KK_EXTERNAL_SCANNER_ENABLED)){
    return json(res,503,{ok:false,error_code:'EXTERNAL_SCANNER_DISABLED',business_writes:0});
  }
  const scannerMode=text(env.KK_EXTERNAL_SCANNER_MODE).toLowerCase();
  if(!['witness','execute-readonly'].includes(scannerMode)){
    return json(res,503,{ok:false,error_code:'EXTERNAL_SCANNER_MODE_INVALID',business_writes:0});
  }
  if(scannerMode==='execute-readonly' && !enabled(env.KK_EXTERNAL_SCANNER_EXECUTION_ENABLED)){
    return json(res,503,{ok:false,error_code:'EXTERNAL_SCANNER_EXECUTION_DISABLED',business_writes:0});
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
    mode:scannerMode==='execute-readonly'?'EXECUTE_READONLY':'WITNESS_ONLY'
  };

  try{
    const result=await Ledger.recordExpectation({env,row});
    if(scannerMode==='witness'){
      return json(res,202,{
        ok:true,
        phase:'EXTERNAL_SCANNER_WITNESS_V1',
        occurrence_id:row.occurrence_id,
        ledger_inserted:result.inserted,
        idempotent_duplicate:result.idempotent_duplicate,
        scanner_execution_started:false,
        business_writes:0
      });
    }
    const scheduledDate=text(verified.envelope.scheduled_at).slice(0,10);
    const scan=await UltraDeepRuntime.runMonthlyUltraDeep({
      current_date:scheduledDate,
      location:'Bangkok Metropolitan Region Thailand'
    },{
      publicWebOptions:{searxng_endpoint:text(env.KK_SEARXNG_ENDPOINT)}
    });
    return json(res,scan.full?202:503,{
      ok:scan.full,
      phase:'EXTERNAL_SCANNER_EXECUTE_READONLY_V1',
      occurrence_id:row.occurrence_id,
      ledger_inserted:result.inserted,
      idempotent_duplicate:result.idempotent_duplicate,
      scanner_execution_started:true,
      scanner_status:scan.status,
      blockers:scan.blockers,
      month:scan.month,
      candidate_count:scan.candidate_count,
      source_universe_complete:scan.source_universe.complete,
      reconciliation_gap_count:scan.reconciliation.reconciliation_gap_count,
      known_miss_complete:scan.known_miss_regression.complete,
      verifier_required:true,
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
  verifierDiagnostic,
  readinessSnapshot,
  ledgerConnectivityProbe
};
