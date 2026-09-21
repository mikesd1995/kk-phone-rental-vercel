'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const Oidc=require('./accept-oidc-production');

const TEAM_ID=Oidc.TEAM_ID;
const PROJECT_ID=Oidc.PROJECT_ID;
const PROJECT_NAME=Oidc.PROJECT_NAME;
const PRODUCTION_URL=Oidc.PRODUCTION_URL;
const LEDGER_PROJECT_REF='zehlsagzrpromtfqqflt';
const LEDGER_URL=`https://${LEDGER_PROJECT_REF}.supabase.co`;
const DISPATCH_URL=`${PRODUCTION_URL}/api/kk-scanner-dispatch`;
const WORKER_PREFIX='kk-scanner-clock-accept';
const COMMENT_PREFIX='KK_ZERO_COST_WITNESS_ACCEPTANCE';
const WRANGLER_CONFIG='cloudflare/wrangler.witness-acceptance.jsonc';

const ENV_SPECS=[
  {key:'KK_RUNTIME_LEDGER_ENABLED',value:'true',type:'plain'},
  {key:'KK_RUNTIME_LEDGER_PROJECT_REF',value:LEDGER_PROJECT_REF,type:'plain'},
  {key:'SUPABASE_URL',value:LEDGER_URL,type:'plain'},
  {key:'SUPABASE_SECRET_KEY',secret:'SUPABASE_SECRET_KEY',type:'encrypted'},
  {key:'KK_EXTERNAL_SCANNER_MODE',value:'witness',type:'plain'},
  {key:'KK_EXTERNAL_SCANNER_SECRET',secret:'KK_EXTERNAL_SCANNER_SECRET',type:'encrypted'},
  {key:'KK_EXTERNAL_SCANNER_ENABLED',value:'false',type:'plain'}
];

function text(v){return String(v==null?'':v).trim();}

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
  if(value&&typeof value==='object'){
    const out={};
    for(const [k,v] of Object.entries(value)){
      if(/secret|token|authorization|apikey|api_key|value/i.test(k) && !['error_code'].includes(k)){
        out[k]='[REDACTED]';
      }else{
        out[k]=redact(v);
      }
    }
    return out;
  }
  return value;
}

function parseArgs(argv){
  const out={stateFile:'witness-config-state.json'};
  for(let i=0;i<argv.length;i++){
    const arg=argv[i];
    if(arg==='--source-deployment') out.sourceDeploymentId=text(argv[++i]);
    else if(arg==='--expected-sha') out.expectedCommitSha=text(argv[++i]);
    else if(arg==='--run-id') out.runId=text(argv[++i]);
    else if(arg==='--state-file') out.stateFile=text(argv[++i]);
    else if(arg==='--dry-run') out.dryRun=true;
    else if(arg==='--rollback-only') out.rollbackOnly=true;
    else if(arg==='--help') out.help=true;
    else throw Object.assign(new Error('UNKNOWN_ARGUMENT'),{code:'UNKNOWN_ARGUMENT',argument:arg});
  }
  return out;
}

function acceptanceTag(runId,sha){
  const rid=text(runId);
  const expected=text(sha);
  assert(/^[0-9]+$/.test(rid),'RUN_ID_REQUIRED');
  assert(/^[0-9a-f]{40}$/i.test(expected),'EXPECTED_SHA_REQUIRED');
  return `${COMMENT_PREFIX}:${rid}:${expected}`;
}

function workerName(runId,sha){
  const rid=text(runId);
  const expected=text(sha);
  assert(/^[0-9]+$/.test(rid),'RUN_ID_REQUIRED');
  assert(/^[0-9a-f]{40}$/i.test(expected),'EXPECTED_SHA_REQUIRED');
  const name=`${WORKER_PREFIX}-${rid}-${expected.slice(0,8)}`.toLowerCase();
  assert(/^[a-z0-9-]{1,63}$/.test(name),'WORKER_NAME_INVALID');
  return name;
}

function productionTarget(env={}){
  const target=Array.isArray(env.target)?env.target:[env.target];
  return target.map(x=>text(x).toLowerCase()).includes('production');
}

function targetKeys(){
  return new Set(ENV_SPECS.map(x=>x.key));
}

function httpTransport({token=process.env.VERCEL_TOKEN,fetchImpl=global.fetch}={}){
  const bearer=text(token);
  if(!bearer||typeof fetchImpl!=='function') return null;
  return {
    mode:'VERCEL_TOKEN',
    async request(method,apiPath,body){
      const res=await fetchImpl(`https://api.vercel.com${apiPath}`,{
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

function cloudflareTransport({
  token=process.env.CLOUDFLARE_API_TOKEN,
  accountId=process.env.CLOUDFLARE_ACCOUNT_ID,
  fetchImpl=global.fetch
}={}){
  const bearer=text(token);
  const account=text(accountId);
  if(!bearer||!account||typeof fetchImpl!=='function') return null;
  return {
    mode:'CLOUDFLARE_API_TOKEN',
    accountId:account,
    async request(method,apiPath,body,{allow404=false}={}){
      const res=await fetchImpl(`https://api.cloudflare.com/client/v4${apiPath}`,{
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
      if(allow404&&res.status===404) return {not_found:true,status:404};
      if(!res.ok || (parsed&&parsed.success===false)){
        const err=new Error(`CLOUDFLARE_API_HTTP_${res.status}`);
        err.code=`CLOUDFLARE_API_HTTP_${res.status}`;
        err.status=res.status;
        err.body=redact(parsed);
        throw err;
      }
      return parsed;
    }
  };
}

function wranglerRunner({
  spawn=spawnSync,
  env=process.env,
  configPath=WRANGLER_CONFIG
}={}){
  function run(args,{input}={}){
    const result=spawn('npx',['--yes','wrangler@4',...args],{
      encoding:'utf8',
      input,
      env:{...env},
      stdio:['pipe','pipe','pipe']
    });
    if(result.status!==0){
      const err=new Error('WRANGLER_COMMAND_FAILED');
      err.code='WRANGLER_COMMAND_FAILED';
      err.exit_status=result.status;
      err.stderr=text(result.stderr).slice(0,1200);
      throw err;
    }
    return {stdout:text(result.stdout),stderr:text(result.stderr)};
  }
  return {
    deploy(name){
      return run(['deploy','--config',configPath,'--name',name]);
    },
    putSecret(name,secret){
      assert(text(secret),'CLOUDFLARE_SHARED_SECRET_REQUIRED');
      return run(['secret','put','KK_SCANNER_SHARED_SECRET','--config',configPath,'--name',name],{
        input:String(secret)+'\n'
      });
    }
  };
}

function readState(file){
  const f=text(file);
  if(!f||!fs.existsSync(f)) return null;
  return safeJson(fs.readFileSync(f,'utf8'));
}

function writeState(file,state){
  const f=text(file);
  if(!f) return;
  fs.writeFileSync(f,JSON.stringify(redact(state),null,2)+'\n');
}

async function getDeployment(transport,id){
  return transport.request('GET',`/v13/deployments/${encodeURIComponent(id)}?teamId=${encodeURIComponent(TEAM_ID)}`);
}

function deploymentState(body){
  return text(body&&body.readyState||body&&body.state).toUpperCase();
}

async function listProjectEnvs(transport){
  const body=await transport.request(
    'GET',
    `/v10/projects/${encodeURIComponent(PROJECT_ID)}/env?teamId=${encodeURIComponent(TEAM_ID)}`
  );
  const envs=Array.isArray(body&&body.envs)?body.envs:[];
  return envs;
}

function relevantProductionEnvs(envs){
  const keys=targetKeys();
  return (Array.isArray(envs)?envs:[]).filter(e=>keys.has(text(e.key))&&productionTarget(e));
}

function assertTargetEnvKeysAbsent(envs){
  const existing=relevantProductionEnvs(envs);
  if(existing.length){
    const err=new Error('WITNESS_TARGET_ENV_KEYS_ALREADY_PRESENT');
    err.code='WITNESS_TARGET_ENV_KEYS_ALREADY_PRESENT';
    err.keys=existing.map(e=>text(e.key)).filter(Boolean).sort();
    throw err;
  }
}

function envValue(spec,env=process.env){
  if(spec.secret){
    const value=text(env[spec.secret]);
    assert(value,`${spec.secret}_MISSING`);
    return value;
  }
  return spec.value;
}

function extractCreatedEnv(body,key){
  const candidates=[];
  if(body&&body.created) candidates.push(body.created);
  if(Array.isArray(body&&body.created)) candidates.push(...body.created);
  if(body&&body.id) candidates.push(body);
  const flat=candidates.flat().filter(Boolean);
  const found=flat.find(x=>text(x.key)===key)||flat[0];
  const id=text(found&&found.id);
  assert(id,'VERCEL_CREATED_ENV_ID_MISSING');
  return {id,key};
}

async function createAcceptanceEnv(transport,spec,tag,env=process.env){
  const body={
    key:spec.key,
    value:envValue(spec,env),
    type:spec.type,
    target:['production'],
    comment:tag
  };
  const response=await transport.request(
    'POST',
    `/v10/projects/${encodeURIComponent(PROJECT_ID)}/env?teamId=${encodeURIComponent(TEAM_ID)}`,
    body
  );
  return extractCreatedEnv(response,spec.key);
}

async function deleteEnvById(transport,id){
  return transport.request(
    'DELETE',
    `/v9/projects/${encodeURIComponent(PROJECT_ID)}/env/${encodeURIComponent(id)}?teamId=${encodeURIComponent(TEAM_ID)}`
  );
}

async function findTaggedAcceptanceEnvs(transport,tag){
  const envs=await listProjectEnvs(transport);
  const keys=targetKeys();
  return envs.filter(e=>
    keys.has(text(e.key)) &&
    productionTarget(e) &&
    text(e.comment)===tag
  ).map(e=>({id:text(e.id),key:text(e.key)})).filter(e=>e.id);
}

async function redeploy(transport,sourceDeploymentId){
  const created=await transport.request(
    'POST',
    `/v13/deployments?forceNew=1&teamId=${encodeURIComponent(TEAM_ID)}`,
    {name:PROJECT_NAME,deploymentId:sourceDeploymentId,target:'production'}
  );
  const id=text(created&&created.id||created&&created.uid);
  assert(id,'REDEPLOYMENT_ID_MISSING');
  return id;
}

async function waitDeployment(transport,id,{attempts=60,delayMs=5000,sleepImpl=ms=>new Promise(r=>setTimeout(r,ms))}={}){
  for(let i=0;i<attempts;i++){
    const d=await getDeployment(transport,id);
    const state=deploymentState(d);
    if(state==='READY') return d;
    if(['ERROR','CANCELED','CANCELLED'].includes(state)){
      throw Object.assign(new Error(`DEPLOYMENT_TERMINAL_${state}`),{code:`DEPLOYMENT_TERMINAL_${state}`});
    }
    await sleepImpl(delayMs);
  }
  throw Object.assign(new Error('DEPLOYMENT_READY_TIMEOUT'),{code:'DEPLOYMENT_READY_TIMEOUT'});
}

async function promoteBaseline(transport,sourceDeploymentId){
  return transport.request(
    'POST',
    `/v10/projects/${encodeURIComponent(PROJECT_ID)}/promote/${encodeURIComponent(sourceDeploymentId)}?teamId=${encodeURIComponent(TEAM_ID)}`,
    {}
  );
}

async function readReadiness(fetchImpl=global.fetch){
  assert(typeof fetchImpl==='function','FETCH_UNAVAILABLE');
  const res=await fetchImpl(`${PRODUCTION_URL}/api/kk-scanner-dispatch`,{
    method:'GET',
    headers:{Accept:'application/json','Cache-Control':'no-cache'}
  });
  const body=await res.json().catch(()=>null);
  assert(res.ok&&body&&body.ok===true,'PRODUCTION_READINESS_FAILED');
  return body.data||{};
}

function validateBaseline(data){
  assert(data.external_scanner_enabled===false,'BASELINE_EXTERNAL_SCANNER_NOT_OFF');
  assert(data.runtime_ledger_oidc_probe_enabled===false,'BASELINE_OIDC_PROBE_NOT_OFF');
  assert(data.scanner_execution_capable===false,'BASELINE_SCANNER_EXECUTION_NOT_OFF');
  assert(data.business_writes_capable===false,'BASELINE_BUSINESS_WRITES_NOT_OFF');
  return true;
}

function validateConfigured(data){
  assert(data.external_scanner_enabled===false,'CONFIG_EXTERNAL_SCANNER_MUST_REMAIN_OFF');
  assert(text(data.mode).toLowerCase()==='witness','CONFIG_MODE_NOT_WITNESS');
  assert(data.hmac_secret_configured===true,'CONFIG_HMAC_NOT_CONFIGURED');
  assert(data.runtime_ledger_enabled===true,'CONFIG_LEDGER_NOT_ENABLED');
  assert(data.runtime_ledger_configured===true,'CONFIG_LEDGER_NOT_CONFIGURED');
  assert(data.supabase_project_ref_configured===true,'CONFIG_LEDGER_REF_NOT_CONFIGURED');
  assert(data.supabase_url_project_ref_resolved===true,'CONFIG_LEDGER_URL_REF_NOT_RESOLVED');
  assert(data.supabase_project_binding_matches===true,'CONFIG_LEDGER_BINDING_MISMATCH');
  assert(data.ready_for_witness===false,'CONFIG_READY_FOR_WITNESS_MUST_REMAIN_FALSE');
  assert(data.scanner_execution_capable===false,'CONFIG_SCANNER_EXECUTION_MUST_REMAIN_OFF');
  assert(data.business_writes_capable===false,'CONFIG_BUSINESS_WRITES_MUST_REMAIN_OFF');
  return true;
}

async function waitReadiness(fetchImpl,validator,{attempts=30,delayMs=3000,sleepImpl=ms=>new Promise(r=>setTimeout(r,ms))}={}){
  let last=null;
  for(let i=0;i<attempts;i++){
    try{
      last=await readReadiness(fetchImpl);
      validator(last);
      return last;
    }catch(err){
      if(i===attempts-1) throw err;
      await sleepImpl(delayMs);
    }
  }
  return last;
}

async function readLedgerProbe(fetchImpl=global.fetch){
  const res=await fetchImpl(`${PRODUCTION_URL}/api/kk-scanner-dispatch?probe=ledger`,{
    method:'GET',
    headers:{Accept:'application/json','Cache-Control':'no-cache'}
  });
  const body=await res.json().catch(()=>null);
  assert(res.ok&&body&&body.ok===true,'LEDGER_PROBE_HTTP_NOT_200');
  const p=body.runtime_ledger_probe||{};
  assert(p.attempted===true,'LEDGER_PROBE_NOT_ATTEMPTED');
  assert(p.ok===true,'LEDGER_PROBE_NOT_OK');
  assert(p.read_only===true,'LEDGER_PROBE_NOT_READ_ONLY');
  assert(Number(p.bounded_limit)===1,'LEDGER_PROBE_LIMIT_INVALID');
  assert(Number(p.business_writes)===0,'LEDGER_PROBE_BUSINESS_WRITES_NONZERO');
  assert(Number(p.row_count)===0,'LEDGER_PROBE_EXPECTATIONS_NOT_ZERO');
  return {
    attempted:true,
    ok:true,
    row_count:0,
    read_only:true,
    bounded_limit:1,
    business_writes:0
  };
}

function cfWorkerPath(cf,name){
  return `/accounts/${encodeURIComponent(cf.accountId)}/workers/scripts/${encodeURIComponent(name)}`;
}

async function cloudflareWorkerExists(cf,name){
  const result=await cf.request('GET',cfWorkerPath(cf,name),undefined,{allow404:true});
  return !(result&&result.not_found);
}

async function deleteCloudflareWorker(cf,name){
  const result=await cf.request('DELETE',cfWorkerPath(cf,name),undefined,{allow404:true});
  return !(result&&result.not_found);
}

async function requireCloudflareWorkerAbsent(cf,name){
  const exists=await cloudflareWorkerExists(cf,name);
  assert(!exists,'ACCEPTANCE_WORKER_ALREADY_EXISTS');
}

async function requireCloudflareWorkerPresent(cf,name){
  const exists=await cloudflareWorkerExists(cf,name);
  assert(exists,'ACCEPTANCE_WORKER_NOT_PRESENT');
}

async function rollbackAcceptance({
  vercel,
  cloudflare,
  fetchImpl=global.fetch,
  sourceDeploymentId,
  expectedCommitSha,
  runId,
  stateFile='witness-config-state.json',
  sleepImpl
}={}){
  assert(vercel,'VERCEL_AUTH_REQUIRED');
  assert(cloudflare,'CLOUDFLARE_AUTH_REQUIRED');
  assert(text(sourceDeploymentId),'SOURCE_DEPLOYMENT_REQUIRED');
  assert(/^[0-9a-f]{40}$/i.test(text(expectedCommitSha)),'EXPECTED_SHA_REQUIRED');

  const tag=acceptanceTag(runId,expectedCommitSha);
  const name=workerName(runId,expectedCommitSha);
  const state=readState(stateFile)||{};
  const evidence={
    schema:'KK_ZERO_COST_WITNESS_CONFIG_ROLLBACK_V1',
    source_deployment_id:text(sourceDeploymentId),
    expected_commit_sha:text(expectedCommitSha),
    run_id:text(runId),
    worker_name:name,
    mutations:[],
    result:'NOT_RUN'
  };

  const source=await getDeployment(vercel,sourceDeploymentId);
  assert(deploymentState(source)==='READY','SOURCE_DEPLOYMENT_NOT_READY');
  assert(text(source.meta&&source.meta.githubCommitSha)===text(expectedCommitSha),'SOURCE_DEPLOYMENT_SHA_MISMATCH');

  // Safety first: restore the exact pre-acceptance production artifact without a rebuild.
  await promoteBaseline(vercel,sourceDeploymentId);
  evidence.mutations.push('PROMOTE_EXACT_BASELINE_SOURCE');

  let workerDeleted=false;
  try{
    workerDeleted=await deleteCloudflareWorker(cloudflare,name);
    if(workerDeleted) evidence.mutations.push('DELETE_ACCEPTANCE_CLOUDFLARE_WORKER');
  }catch(err){
    evidence.cloudflare_delete_error=text(err&&err.code)||'CLOUDFLARE_DELETE_FAILED';
    throw Object.assign(new Error('WITNESS_CONFIG_ROLLBACK_CLOUDFLARE_DELETE_FAILED'),{
      code:'WITNESS_CONFIG_ROLLBACK_CLOUDFLARE_DELETE_FAILED',
      evidence
    });
  }

  const ids=[];
  if(Array.isArray(state.created_envs)){
    for(const item of state.created_envs){
      if(text(item&&item.id)) ids.push({id:text(item.id),key:text(item.key)});
    }
  }
  const tagged=await findTaggedAcceptanceEnvs(vercel,tag);
  for(const item of tagged){
    if(!ids.some(x=>x.id===item.id)) ids.push(item);
  }

  for(const item of ids){
    try{
      await deleteEnvById(vercel,item.id);
      evidence.mutations.push(`DELETE_ENV_${item.key||'UNKNOWN'}`);
    }catch(err){
      if(text(err&&err.code)!=='VERCEL_API_HTTP_404') throw err;
    }
  }

  const restored=await waitReadiness(fetchImpl,validateBaseline,{sleepImpl});
  const remaining=await findTaggedAcceptanceEnvs(vercel,tag);
  assert(remaining.length===0,'ROLLBACK_TAGGED_ENV_REMAINS');
  assert(!(await cloudflareWorkerExists(cloudflare,name)),'ROLLBACK_WORKER_REMAINS');

  evidence.rollback={
    ok:true,
    worker_absent:true,
    tagged_env_count:0,
    external_scanner_enabled:restored.external_scanner_enabled,
    oidc_probe_enabled:restored.runtime_ledger_oidc_probe_enabled,
    scanner_execution_capable:restored.scanner_execution_capable,
    business_writes_capable:restored.business_writes_capable
  };
  evidence.result=(ids.length===0&&!workerDeleted)
    ?'WITNESS_CONFIG_ROLLBACK_ALREADY_SAFE'
    :'WITNESS_CONFIG_ROLLBACK_PASS';
  writeState(stateFile,{...state,rollback_complete:true,rollback_result:evidence.result});
  return evidence;
}

async function runAcceptance({
  vercel,
  cloudflare,
  wrangler,
  fetchImpl=global.fetch,
  env=process.env,
  sourceDeploymentId,
  expectedCommitSha,
  runId,
  stateFile='witness-config-state.json',
  dryRun=false,
  sleepImpl
}={}){
  assert(vercel,'VERCEL_AUTH_REQUIRED');
  assert(cloudflare,'CLOUDFLARE_AUTH_REQUIRED');
  assert(wrangler,'WRANGLER_RUNNER_REQUIRED');
  assert(text(sourceDeploymentId),'SOURCE_DEPLOYMENT_REQUIRED');
  assert(/^[0-9a-f]{40}$/i.test(text(expectedCommitSha)),'EXPECTED_SHA_REQUIRED');

  for(const spec of ENV_SPECS){
    if(spec.secret) assert(text(env[spec.secret]),`${spec.secret}_MISSING`);
  }
  assert(text(env.CLOUDFLARE_API_TOKEN),'CLOUDFLARE_API_TOKEN_MISSING');
  assert(text(env.CLOUDFLARE_ACCOUNT_ID),'CLOUDFLARE_ACCOUNT_ID_MISSING');

  const tag=acceptanceTag(runId,expectedCommitSha);
  const name=workerName(runId,expectedCommitSha);
  const evidence={
    schema:'KK_ZERO_COST_WITNESS_CONFIG_ACCEPTANCE_V1',
    source_deployment_id:text(sourceDeploymentId),
    expected_commit_sha:text(expectedCommitSha),
    run_id:text(runId),
    worker_name:name,
    dry_run:!!dryRun,
    mutations:[],
    result:'NOT_RUN'
  };

  const source=await getDeployment(vercel,sourceDeploymentId);
  assert(deploymentState(source)==='READY','SOURCE_DEPLOYMENT_NOT_READY');
  assert(text(source.meta&&source.meta.githubCommitSha)===text(expectedCommitSha),'SOURCE_DEPLOYMENT_SHA_MISMATCH');

  const baseline=await readReadiness(fetchImpl);
  validateBaseline(baseline);
  const currentEnvs=await listProjectEnvs(vercel);
  assertTargetEnvKeysAbsent(currentEnvs);
  await requireCloudflareWorkerAbsent(cloudflare,name);

  evidence.preflight={
    source_state:'READY',
    source_sha:text(source.meta&&source.meta.githubCommitSha),
    target_env_keys_absent:true,
    acceptance_worker_absent:true,
    external_scanner_enabled:false,
    scanner_execution_capable:false,
    business_writes_capable:false
  };

  if(dryRun){
    evidence.result='WITNESS_CONFIG_DRY_RUN_PASS';
    return evidence;
  }

  const state={
    schema:'KK_ZERO_COST_WITNESS_CONFIG_STATE_V1',
    source_deployment_id:text(sourceDeploymentId),
    expected_commit_sha:text(expectedCommitSha),
    run_id:text(runId),
    tag,
    worker_name:name,
    created_envs:[],
    config_deployment_id:'',
    worker_deployed:false,
    rollback_complete:false
  };
  writeState(stateFile,state);

  let acceptanceError=null;
  try{
    for(const spec of ENV_SPECS){
      const created=await createAcceptanceEnv(vercel,spec,tag,env);
      state.created_envs.push(created);
      writeState(stateFile,state);
      evidence.mutations.push(`CREATE_ENV_${spec.key}`);
    }

    const configDeploymentId=await redeploy(vercel,sourceDeploymentId);
    state.config_deployment_id=configDeploymentId;
    writeState(stateFile,state);
    evidence.config_deployment_id=configDeploymentId;
    evidence.mutations.push('REDEPLOY_EXACT_SOURCE_WITH_WITNESS_CONFIG_DISABLED');
    await waitDeployment(vercel,configDeploymentId,{sleepImpl});

    const configured=await waitReadiness(fetchImpl,validateConfigured,{sleepImpl});
    evidence.configured_readiness={
      external_scanner_enabled:configured.external_scanner_enabled,
      mode:configured.mode,
      hmac_secret_configured:configured.hmac_secret_configured,
      runtime_ledger_enabled:configured.runtime_ledger_enabled,
      runtime_ledger_configured:configured.runtime_ledger_configured,
      project_binding_matches:configured.supabase_project_binding_matches,
      ready_for_witness:configured.ready_for_witness,
      scanner_execution_capable:configured.scanner_execution_capable,
      business_writes_capable:configured.business_writes_capable
    };

    evidence.ledger_probe=await readLedgerProbe(fetchImpl);

    wrangler.deploy(name);
    state.worker_deployed=true;
    writeState(stateFile,state);
    evidence.mutations.push('DEPLOY_ACCEPTANCE_CLOUDFLARE_WORKER');
    await requireCloudflareWorkerPresent(cloudflare,name);

    wrangler.putSecret(name,env.KK_EXTERNAL_SCANNER_SECRET);
    evidence.mutations.push('SET_ACCEPTANCE_WORKER_HMAC_SECRET');

    const afterWorker=await readReadiness(fetchImpl);
    validateConfigured(afterWorker);
    const afterWorkerProbe=await readLedgerProbe(fetchImpl);
    evidence.post_worker={
      external_scanner_enabled:afterWorker.external_scanner_enabled,
      ready_for_witness:afterWorker.ready_for_witness,
      scanner_execution_capable:afterWorker.scanner_execution_capable,
      business_writes_capable:afterWorker.business_writes_capable,
      ledger_row_count:afterWorkerProbe.row_count
    };
    evidence.result='CONFIG_PROBE_PASS';
  }catch(err){
    acceptanceError=err;
    evidence.error_code=text(err&&err.code)||'WITNESS_CONFIG_ACCEPTANCE_FAILED';
  }

  let rollback;
  try{
    rollback=await rollbackAcceptance({
      vercel,
      cloudflare,
      fetchImpl,
      sourceDeploymentId,
      expectedCommitSha,
      runId,
      stateFile,
      sleepImpl
    });
    evidence.rollback=rollback.rollback;
  }catch(err){
    const wrapped=new Error('WITNESS_CONFIG_ACCEPTANCE_ROLLBACK_FAILED');
    wrapped.code='WITNESS_CONFIG_ACCEPTANCE_ROLLBACK_FAILED';
    wrapped.evidence={...evidence,rollback_error:text(err&&err.code)||'ROLLBACK_FAILED'};
    throw wrapped;
  }

  if(acceptanceError){
    acceptanceError.evidence=evidence;
    throw acceptanceError;
  }

  assert(evidence.result==='CONFIG_PROBE_PASS','WITNESS_CONFIG_PROBE_NOT_PASS');
  assert(evidence.rollback&&evidence.rollback.ok===true,'WITNESS_CONFIG_ROLLBACK_NOT_OK');
  evidence.result='WITNESS_CONFIG_APPLY_AND_ROLLED_BACK_PASS';
  return evidence;
}

function help(){
  return `Usage:
  node scripts/accept-witness-config-zero-cost.js \\
    --source-deployment <dpl_...> \\
    --expected-sha <40-char-main-sha> \\
    --run-id <github-run-id> [--dry-run|--rollback-only]

Required runtime secrets:
  VERCEL_TOKEN
  SUPABASE_SECRET_KEY
  KK_EXTERNAL_SCANNER_SECRET
  CLOUDFLARE_API_TOKEN
  CLOUDFLARE_ACCOUNT_ID

The acceptance keeps KK_EXTERNAL_SCANNER_ENABLED=false at all times.
It proves only zero-cost configuration apply/readback/rollback. It earns zero witness streak.
`;
}

async function main(){
  const args=parseArgs(process.argv.slice(2));
  if(args.help){
    process.stdout.write(help());
    return;
  }
  const vercel=httpTransport();
  const cloudflare=cloudflareTransport();
  assert(vercel,'VERCEL_AUTH_REQUIRED');
  assert(cloudflare,'CLOUDFLARE_AUTH_REQUIRED');

  const common={
    vercel,
    cloudflare,
    fetchImpl:global.fetch,
    sourceDeploymentId:args.sourceDeploymentId,
    expectedCommitSha:args.expectedCommitSha,
    runId:args.runId,
    stateFile:args.stateFile
  };

  const evidence=args.rollbackOnly
    ? await rollbackAcceptance(common)
    : await runAcceptance({
        ...common,
        wrangler:wranglerRunner(),
        env:process.env,
        dryRun:args.dryRun
      });

  process.stdout.write(JSON.stringify(redact(evidence),null,2)+'\n');
}

if(require.main===module){
  main().catch(err=>{
    process.stderr.write(JSON.stringify({
      ok:false,
      error_code:text(err&&err.code)||'WITNESS_CONFIG_ACCEPTANCE_FAILED',
      evidence:redact(err&&err.evidence||null)
    },null,2)+'\n');
    process.exit(1);
  });
}

module.exports={
  TEAM_ID,
  PROJECT_ID,
  PROJECT_NAME,
  PRODUCTION_URL,
  LEDGER_PROJECT_REF,
  LEDGER_URL,
  DISPATCH_URL,
  ENV_SPECS,
  COMMENT_PREFIX,
  WRANGLER_CONFIG,
  parseArgs,
  acceptanceTag,
  workerName,
  productionTarget,
  relevantProductionEnvs,
  assertTargetEnvKeysAbsent,
  validateBaseline,
  validateConfigured,
  httpTransport,
  cloudflareTransport,
  wranglerRunner,
  listProjectEnvs,
  findTaggedAcceptanceEnvs,
  readLedgerProbe,
  runAcceptance,
  rollbackAcceptance
};
