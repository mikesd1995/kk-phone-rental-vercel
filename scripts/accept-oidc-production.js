'use strict';

const {spawnSync}=require('node:child_process');

const TEAM_ID='team_uaeOdVIjXMSW690ZM2wPuJyt';
const PROJECT_ID='prj_snbAmpya7YGmOuMbv1o8T16ouxl6';
const PROJECT_NAME='kk-phone-rental-vercel';
const PRODUCTION_URL='https://kk-phone-rental.vercel.app';
const FLAG_KEY='KK_RUNTIME_LEDGER_OIDC_PROBE_ENABLED';

function text(v){return String(v==null?'':v).trim();}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}

function assert(condition,code){
  if(!condition){
    const err=new Error(code);
    err.code=code;
    throw err;
  }
}

function safeJson(value){
  if(value==null) return {};
  if(typeof value==='object') return value;
  try{return JSON.parse(String(value));}catch(_err){return {};}
}

function redact(value){
  if(Array.isArray(value)) return value.map(redact);
  if(value && typeof value==='object'){
    const out={};
    for(const [k,v] of Object.entries(value)){
      if(/token|secret|authorization|key/i.test(k)) out[k]='[REDACTED]';
      else out[k]=redact(v);
    }
    return out;
  }
  return value;
}

function parseArgs(argv){
  const out={};
  for(let i=0;i<argv.length;i++){
    const arg=argv[i];
    if(arg==='--source-deployment') out.sourceDeploymentId=text(argv[++i]);
    else if(arg==='--expected-sha') out.expectedCommitSha=text(argv[++i]);
    else if(arg==='--dry-run') out.dryRun=true;
    else if(arg==='--help') out.help=true;
    else throw Object.assign(new Error('UNKNOWN_ARGUMENT'),{code:'UNKNOWN_ARGUMENT',argument:arg});
  }
  return out;
}

function httpTransport({token=process.env.VERCEL_TOKEN,fetchImpl=global.fetch}={}){
  const bearer=text(token);
  if(!bearer || typeof fetchImpl!=='function') return null;
  return {
    mode:'VERCEL_TOKEN',
    async request(method,path,body){
      const res=await fetchImpl(`https://api.vercel.com${path}`,{
        method,
        headers:{
          Authorization:`Bearer ${bearer}`,
          'Content-Type':'application/json',
          Accept:'application/json'
        },
        body:body===undefined?undefined:JSON.stringify(body)
      });
      let parsed={};
      try{parsed=await res.json();}catch(_err){}
      if(!res.ok){
        const err=new Error(`VERCEL_API_HTTP_${res.status}`);
        err.code=`VERCEL_API_HTTP_${res.status}`;
        err.status=res.status;
        err.body=redact(parsed);
        throw err;
      }
      return parsed;
    }
  };
}

function cliTransport({spawn=spawnSync}={}){
  const who=spawn('vercel',['whoami'],{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  if(who.status!==0) return null;
  return {
    mode:'VERCEL_CLI_SESSION',
    async request(method,path,body){
      const args=['api',method,path];
      if(body!==undefined) args.push('--body',JSON.stringify(body));
      const result=spawn('vercel',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
      if(result.status!==0){
        const err=new Error('VERCEL_CLI_API_FAILED');
        err.code='VERCEL_CLI_API_FAILED';
        err.stderr=text(result.stderr).slice(0,500);
        throw err;
      }
      const parsed=safeJson(result.stdout);
      assert(Object.keys(parsed).length>0,'VERCEL_CLI_RESPONSE_INVALID');
      return parsed;
    }
  };
}

function chooseTransport(options={}){
  return httpTransport(options) || cliTransport(options);
}

async function readReadiness(fetchImpl=global.fetch){
  assert(typeof fetchImpl==='function','FETCH_UNAVAILABLE');
  const res=await fetchImpl(`${PRODUCTION_URL}/api/kk-scanner-dispatch`,{
    method:'GET',
    headers:{Accept:'application/json','Cache-Control':'no-cache'}
  });
  const body=await res.json().catch(()=>null);
  assert(res.ok && body && body.ok===true,'PRODUCTION_READINESS_FAILED');
  return body.data||{};
}

async function readProbe(fetchImpl=global.fetch){
  const res=await fetchImpl(`${PRODUCTION_URL}/api/kk-scanner-dispatch?probe=ledger-oidc`,{
    method:'GET',
    headers:{Accept:'application/json','Cache-Control':'no-cache'}
  });
  const body=await res.json().catch(()=>null);
  return {status:res.status,body};
}

function validateReadiness(data,expectedFlag){
  assert(data.external_scanner_enabled===false,'EXTERNAL_SCANNER_MUST_REMAIN_OFF');
  assert(data.scanner_execution_capable===false,'SCANNER_EXECUTION_MUST_REMAIN_OFF');
  assert(data.business_writes_capable===false,'BUSINESS_WRITES_MUST_REMAIN_OFF');
  assert(data.runtime_ledger_oidc_probe_enabled===expectedFlag,'OIDC_FLAG_READBACK_MISMATCH');
}

function validateProbe(probe){
  assert(probe.status===200,'OIDC_PROBE_HTTP_NOT_200');
  const body=probe.body||{};
  const p=body.runtime_ledger_oidc_probe||{};
  assert(body.ok===true,'OIDC_PROBE_TOPLEVEL_NOT_OK');
  assert(body.data && body.data.runtime_ledger_oidc_probe_enabled===true,'OIDC_PROBE_FLAG_NOT_TRUE');
  assert(body.data.external_scanner_enabled===false,'OIDC_PROBE_EXTERNAL_SCANNER_ENABLED');
  assert(body.data.scanner_execution_capable===false,'OIDC_PROBE_SCANNER_EXECUTION_CAPABLE');
  assert(body.data.business_writes_capable===false,'OIDC_PROBE_BUSINESS_WRITES_CAPABLE');
  assert(p.ok===true,'OIDC_PROBE_REMOTE_NOT_OK');
  assert(p.authenticated===true,'OIDC_PROBE_NOT_AUTHENTICATED');
  assert(p.read_only===true,'OIDC_PROBE_NOT_READ_ONLY');
  assert(p.bounded_limit===1,'OIDC_PROBE_LIMIT_INVALID');
  assert(p.business_writes===0,'OIDC_PROBE_BUSINESS_WRITES_NONZERO');
  assert(Number.isInteger(p.row_count) && p.row_count>=0,'OIDC_PROBE_ROW_COUNT_INVALID');
  return {
    authenticated:true,
    read_only:true,
    bounded_limit:1,
    business_writes:0,
    row_count:p.row_count
  };
}

async function getDeployment(transport,id){
  return transport.request('GET',`/v13/deployments/${encodeURIComponent(id)}?teamId=${encodeURIComponent(TEAM_ID)}`);
}

function deploymentState(body){
  return text(body.readyState||body.state).toUpperCase();
}

async function waitDeployment(transport,id,{attempts=60,delayMs=5000,sleepImpl=sleep}={}){
  for(let i=0;i<attempts;i++){
    const d=await getDeployment(transport,id);
    const state=deploymentState(d);
    if(state==='READY') return d;
    if(['ERROR','CANCELED','CANCELLED'].includes(state)){
      const err=new Error(`DEPLOYMENT_TERMINAL_${state}`);
      err.code=`DEPLOYMENT_TERMINAL_${state}`;
      throw err;
    }
    await sleepImpl(delayMs);
  }
  throw Object.assign(new Error('DEPLOYMENT_READY_TIMEOUT'),{code:'DEPLOYMENT_READY_TIMEOUT'});
}

async function setFlag(transport,value){
  const body=[{
    key:FLAG_KEY,
    value:value?'true':'false',
    type:'plain',
    target:['production'],
    comment:'Bounded KK control-plane OIDC acceptance'
  }];
  return transport.request(
    'POST',
    `/v10/projects/${PROJECT_ID}/env?upsert=true&teamId=${encodeURIComponent(TEAM_ID)}`,
    body
  );
}

async function redeploy(transport,sourceDeploymentId){
  const created=await transport.request(
    'POST',
    `/v13/deployments?forceNew=1&teamId=${encodeURIComponent(TEAM_ID)}`,
    {
      name:PROJECT_NAME,
      deploymentId:sourceDeploymentId,
      target:'production'
    }
  );
  const id=text(created.id||created.uid);
  assert(id,'REDEPLOYMENT_ID_MISSING');
  return id;
}

async function waitReadinessFlag(fetchImpl,expected,{attempts=30,delayMs=4000,sleepImpl=sleep}={}){
  let last=null;
  for(let i=0;i<attempts;i++){
    try{
      last=await readReadiness(fetchImpl);
      validateReadiness(last,expected);
      return last;
    }catch(err){
      if(i===attempts-1) throw err;
      await sleepImpl(delayMs);
    }
  }
  return last;
}

async function runAcceptance({
  transport,
  fetchImpl=global.fetch,
  sourceDeploymentId,
  expectedCommitSha,
  dryRun=false,
  sleepImpl=sleep,
  logger=()=>{}
}={}){
  assert(transport && typeof transport.request==='function','VERCEL_AUTH_REQUIRED');
  assert(text(sourceDeploymentId),'SOURCE_DEPLOYMENT_REQUIRED');
  assert(/^[0-9a-f]{40}$/i.test(text(expectedCommitSha)),'EXPECTED_SHA_REQUIRED');

  const evidence={
    schema:'KK_OIDC_PRODUCTION_ACCEPTANCE_V1',
    project_id:PROJECT_ID,
    team_id:TEAM_ID,
    source_deployment_id:text(sourceDeploymentId),
    expected_commit_sha:text(expectedCommitSha),
    transport_mode:text(transport.mode)||'CUSTOM',
    dry_run:!!dryRun,
    mutations:[],
    probe:null,
    rollback:null,
    result:'NOT_RUN'
  };

  const source=await getDeployment(transport,sourceDeploymentId);
  const sourceState=deploymentState(source);
  const sourceSha=text(source.meta && source.meta.githubCommitSha);
  assert(sourceState==='READY','SOURCE_DEPLOYMENT_NOT_READY');
  assert(sourceSha===expectedCommitSha,'SOURCE_DEPLOYMENT_SHA_MISMATCH');

  const baseline=await readReadiness(fetchImpl);
  validateReadiness(baseline,false);

  evidence.preflight={
    source_state:sourceState,
    source_sha:sourceSha,
    external_scanner_enabled:false,
    oidc_probe_enabled:false,
    scanner_execution_capable:false,
    business_writes_capable:false
  };

  if(dryRun){
    evidence.result='DRY_RUN_PASS';
    return evidence;
  }

  let flagMayBeTrue=false;
  try{
    await setFlag(transport,true);
    flagMayBeTrue=true;
    evidence.mutations.push('OIDC_PROBE_FLAG_TRUE');

    const enabledDeploymentId=await redeploy(transport,sourceDeploymentId);
    evidence.enabled_deployment_id=enabledDeploymentId;
    evidence.mutations.push('PRODUCTION_REDEPLOY_WITH_FLAG_TRUE');
    await waitDeployment(transport,enabledDeploymentId,{sleepImpl});
    await waitReadinessFlag(fetchImpl,true,{sleepImpl});

    const probe=await readProbe(fetchImpl);
    evidence.probe=validateProbe(probe);
    evidence.result='PROBE_PASS';
    logger('OIDC_PROBE_PASS');
  } finally {
    let rollbackError=null;
    try{
      if(flagMayBeTrue){
        await setFlag(transport,false);
        evidence.mutations.push('OIDC_PROBE_FLAG_FALSE');
        const rollbackDeploymentId=await redeploy(transport,sourceDeploymentId);
        evidence.rollback_deployment_id=rollbackDeploymentId;
        evidence.mutations.push('PRODUCTION_REDEPLOY_WITH_FLAG_FALSE');
        await waitDeployment(transport,rollbackDeploymentId,{sleepImpl});
        const restored=await waitReadinessFlag(fetchImpl,false,{sleepImpl});
        evidence.rollback={
          ok:true,
          external_scanner_enabled:restored.external_scanner_enabled,
          oidc_probe_enabled:restored.runtime_ledger_oidc_probe_enabled,
          scanner_execution_capable:restored.scanner_execution_capable,
          business_writes_capable:restored.business_writes_capable
        };
      }else{
        evidence.rollback={ok:true,not_required:true};
      }
    }catch(err){
      rollbackError=err;
      evidence.rollback={ok:false,error_code:text(err&&err.code)||'ROLLBACK_FAILED'};
    }
    if(rollbackError){
      const err=new Error('OIDC_ACCEPTANCE_ROLLBACK_FAILED');
      err.code='OIDC_ACCEPTANCE_ROLLBACK_FAILED';
      err.evidence=evidence;
      throw err;
    }
  }

  if(evidence.result==='PROBE_PASS'){
    evidence.result='PASS_AND_ROLLED_BACK';
  }
  return evidence;
}

function help(){
  return `Usage:
  node scripts/accept-oidc-production.js \\
    --source-deployment <dpl_...> \\
    --expected-sha <40-char-main-sha> [--dry-run]

Authentication:
  1) VERCEL_TOKEN environment variable, OR
  2) an already-authenticated Vercel CLI session (vercel login).

The script changes only ${FLAG_KEY}, redeploys the exact source deployment,
runs one read-only OIDC probe, then restores the flag to false and redeploys
the exact source again. Scanner execution and business writes must remain false.
`;
}

async function main(){
  const args=parseArgs(process.argv.slice(2));
  if(args.help){
    process.stdout.write(help());
    return;
  }
  const transport=chooseTransport();
  assert(transport,'VERCEL_AUTH_REQUIRED');
  const evidence=await runAcceptance({
    transport,
    sourceDeploymentId:args.sourceDeploymentId,
    expectedCommitSha:args.expectedCommitSha,
    dryRun:args.dryRun,
    logger:msg=>process.stderr.write(`${msg}\n`)
  });
  process.stdout.write(JSON.stringify(redact(evidence),null,2)+'\n');
}

if(require.main===module){
  main().catch(err=>{
    const out={
      ok:false,
      error_code:text(err&&err.code)||'OIDC_ACCEPTANCE_FAILED',
      evidence:redact(err&&err.evidence||null)
    };
    process.stderr.write(JSON.stringify(out,null,2)+'\n');
    process.exit(1);
  });
}

module.exports={
  TEAM_ID,
  PROJECT_ID,
  PROJECT_NAME,
  PRODUCTION_URL,
  FLAG_KEY,
  parseArgs,
  redact,
  httpTransport,
  cliTransport,
  chooseTransport,
  validateReadiness,
  validateProbe,
  deploymentState,
  waitDeployment,
  waitReadinessFlag,
  runAcceptance
};
