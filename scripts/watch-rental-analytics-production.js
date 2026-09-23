'use strict';

const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');

const TEAM_ID='team_uaeOdVIjXMSW690ZM2wPuJyt';
const PROJECT_ID='prj_snbAmpya7YGmOuMbv1o8T16ouxl6';
const PRODUCTION_URL='https://kk-phone-rental.vercel.app';
const RENTAL_ANALYTICS_FIX_SHA='061da369297dbce1042cc4822edf9f93956e3776';
const SCHEMA='KK_RENTAL_ANALYTICS_PRODUCTION_WATCH_V1';

function text(v){return String(v==null?'':v).trim();}
function assert(condition,code){
  if(!condition){
    const err=new Error(code);
    err.code=code;
    throw err;
  }
}

function parseArgs(argv){
  const out={};
  for(let i=0;i<argv.length;i++){
    const arg=argv[i];
    if(arg==='--current-main-sha') out.currentMainSha=text(argv[++i]);
    else if(arg==='--vercel-status-state') out.vercelStatusState=text(argv[++i]);
    else if(arg==='--vercel-status-url') out.vercelStatusUrl=text(argv[++i]);
    else if(arg==='--help') out.help=true;
    else throw Object.assign(new Error('UNKNOWN_ARGUMENT'),{code:'UNKNOWN_ARGUMENT',argument:arg});
  }
  return out;
}

function httpTransport({token=process.env.VERCEL_TOKEN,fetchImpl=global.fetch}={}){
  const bearer=text(token);
  if(!bearer || typeof fetchImpl!=='function') return null;
  return {
    async request(method,path){
      assert(method==='GET','READ_ONLY_TRANSPORT_REJECTED_NON_GET');
      const res=await fetchImpl(`https://api.vercel.com${path}`,{
        method:'GET',
        headers:{
          Authorization:`Bearer ${bearer}`,
          Accept:'application/json'
        }
      });
      let body={};
      try{body=await res.json();}catch(_err){}
      if(!res.ok){
        const err=new Error(`VERCEL_API_HTTP_${res.status}`);
        err.code=`VERCEL_API_HTTP_${res.status}`;
        throw err;
      }
      return body;
    }
  };
}

function deploymentState(d={}){return text(d.readyState||d.state).toUpperCase();}
function deploymentCreated(d={}){
  const n=Number(d.createdAt!=null?d.createdAt:d.created);
  return Number.isFinite(n)?n:0;
}
function deploymentSha(d={}){return text(d.meta&&d.meta.githubCommitSha);}
function deploymentRef(d={}){return text(d.meta&&d.meta.githubCommitRef);}
function deploymentId(d={}){return text(d.id||d.uid);}
function isProduction(d={}){
  const target=text(d.target).toLowerCase();
  return !target || target==='production';
}
function safeDeployment(d){
  if(!d) return null;
  return {
    id:deploymentId(d),
    state:deploymentState(d),
    sha:deploymentSha(d),
    ref:deploymentRef(d),
    created:deploymentCreated(d),
    target:text(d.target)||'production'
  };
}

function selectProduction(deployments){
  const list=(Array.isArray(deployments)?deployments:[])
    .filter(isProduction)
    .sort((a,b)=>deploymentCreated(b)-deploymentCreated(a));
  return {
    latest_attempt:list[0]||null,
    serving:list.find(d=>deploymentState(d)==='READY')||null
  };
}

async function listDeployments(transport){
  assert(transport&&typeof transport.request==='function','VERCEL_AUTH_REQUIRED');
  const qs=new URLSearchParams({
    projectId:PROJECT_ID,
    target:'production',
    limit:'50',
    teamId:TEAM_ID
  });
  const body=await transport.request('GET',`/v6/deployments?${qs.toString()}`);
  return Array.isArray(body&&body.deployments)?body.deployments:[];
}

function gitContainsFix(fixSha,candidateSha,{exec=execFileSync}={}){
  if(!/^[0-9a-f]{40}$/i.test(text(fixSha))||!/^[0-9a-f]{40}$/i.test(text(candidateSha))) return null;
  try{
    exec('git',['merge-base','--is-ancestor',fixSha,candidateSha],{stdio:'ignore'});
    return true;
  }catch(err){
    if(err&&err.status===1) return false;
    return null;
  }
}

async function routeProbe(fetchImpl=global.fetch){
  assert(typeof fetchImpl==='function','FETCH_UNAVAILABLE');
  const analytics=await fetchImpl(`${PRODUCTION_URL}/api/kk-rental-dashboard`,{
    method:'HEAD',
    redirect:'manual',
    headers:{'Cache-Control':'no-cache'}
  });
  const auth=await fetchImpl(`${PRODUCTION_URL}/api/kk-admin-auth`,{
    method:'GET',
    redirect:'manual',
    headers:{Accept:'application/json','Cache-Control':'no-cache'}
  });
  let authBody=null;
  try{authBody=await auth.json();}catch(_err){}
  return {
    analytics_head_status:analytics.status,
    admin_auth_status:auth.status,
    admin_auth_authenticated:authBody&&typeof authBody.authenticated==='boolean'?authBody.authenticated:null
  };
}

function isBuildRateLimited(state,url){
  return text(state).toLowerCase()==='failure' && /build-rate-limit/i.test(text(url));
}

function classifyState({
  serving,
  latestAttempt,
  productionContainsFix,
  vercelStatusState,
  vercelStatusUrl,
  probe
}={}){
  if(!serving){
    return {state:'NO_READY_PRODUCTION',severity:'error',reason:'No READY Production deployment could be resolved'};
  }

  if(productionContainsFix===true){
    if(!probe) return {state:'FIX_DEPLOYED_PROBE_PENDING',severity:'warning',reason:'Fix is in Production but route probe is unavailable'};
    if(probe.analytics_head_status===405){
      return {state:'ROUTE_SHADOW_REGRESSION',severity:'error',reason:'Rental Analytics public path behaves like the legacy physical handler'};
    }
    if(probe.analytics_head_status!==401){
      return {state:'ROUTE_WIRING_UNEXPECTED',severity:'error',reason:`Expected unauthenticated HEAD to reach v6 auth gate with 401, got ${probe.analytics_head_status}`};
    }
    if(probe.admin_auth_status!==200){
      return {state:'ADMIN_AUTH_ROUTE_UNHEALTHY',severity:'error',reason:`Admin auth health route returned ${probe.admin_auth_status}`};
    }
    return {state:'ROUTE_WIRING_ACCEPTED',severity:'ok',reason:'Production contains the fix and read-only route-shape probes match the v6 signed-session boundary'};
  }

  if(productionContainsFix===null){
    return {state:'PRODUCTION_LINEAGE_UNKNOWN',severity:'warning',reason:'Could not prove whether the serving Production SHA contains the fix'};
  }

  if(isBuildRateLimited(vercelStatusState,vercelStatusUrl)){
    return {state:'BLOCKED_BUILD_RATE_LIMIT',severity:'waiting',reason:'GitHub/Vercel status reports build-rate-limit; no deployment mutation was attempted'};
  }

  if(latestAttempt && deploymentState(latestAttempt)!=='READY'){
    return {state:'FIX_DEPLOYMENT_NOT_READY',severity:'waiting',reason:`Latest Production attempt is ${deploymentState(latestAttempt)||'UNKNOWN'}`};
  }

  return {state:'WAITING_FOR_FIX_DEPLOYMENT',severity:'waiting',reason:'Serving Production does not yet contain the Rental Analytics route-shadow fix'};
}

function fingerprintPayload(report){
  return {
    schema:report.schema,
    state:report.state,
    severity:report.severity,
    current_main_sha:report.current_main_sha,
    production_matches_current_main:report.production_matches_current_main,
    production_contains_fix:report.production_contains_fix,
    serving_production:report.serving_production,
    latest_production_attempt:report.latest_production_attempt,
    vercel_commit_status:report.vercel_commit_status,
    probe:report.probe,
    safety:report.safety
  };
}

function fingerprint(report){
  return crypto.createHash('sha256').update(JSON.stringify(fingerprintPayload(report))).digest('hex');
}

async function run({
  transport=httpTransport(),
  fetchImpl=global.fetch,
  currentMainSha,
  vercelStatusState='',
  vercelStatusUrl='',
  containsFixFn=gitContainsFix
}={}){
  assert(/^[0-9a-f]{40}$/i.test(text(currentMainSha)),'CURRENT_MAIN_SHA_REQUIRED');
  const deployments=await listDeployments(transport);
  const selected=selectProduction(deployments);
  const serving=safeDeployment(selected.serving);
  const latestAttempt=safeDeployment(selected.latest_attempt);

  const productionContainsFix=serving
    ? containsFixFn(RENTAL_ANALYTICS_FIX_SHA,serving.sha)
    : false;

  let probe=null;
  if(productionContainsFix===true){
    probe=await routeProbe(fetchImpl);
  }

  const classification=classifyState({
    serving:selected.serving,
    latestAttempt:selected.latest_attempt,
    productionContainsFix,
    vercelStatusState,
    vercelStatusUrl,
    probe
  });

  const report={
    schema:SCHEMA,
    checked_at:new Date().toISOString(),
    state:classification.state,
    severity:classification.severity,
    reason:classification.reason,
    current_main_sha:text(currentMainSha),
    fix_sha:RENTAL_ANALYTICS_FIX_SHA,
    production_matches_current_main:!!(serving&&serving.sha===text(currentMainSha)),
    production_contains_fix:productionContainsFix,
    serving_production:serving,
    latest_production_attempt:latestAttempt,
    vercel_commit_status:{
      state:text(vercelStatusState)||'unknown',
      target_url:text(vercelStatusUrl)||''
    },
    probe,
    safety:{
      vercel_api_methods:['GET'],
      production_http_methods:productionContainsFix===true?['HEAD','GET']:[],
      admin_pin_used:false,
      admin_session_secret_used:false,
      login_attempts:0,
      production_writes:0,
      business_writes:0
    }
  };
  report.state_fingerprint=fingerprint(report);
  return report;
}

function help(){
  return `Usage:
  node scripts/watch-rental-analytics-production.js \\
    --current-main-sha <40-char-sha> \\
    [--vercel-status-state <state>] \\
    [--vercel-status-url <url>]

Requires VERCEL_TOKEN. This watcher is read-only: Vercel GET requests plus
safe Production HEAD/GET probes. It never logs in, never uses the Admin PIN,
never writes business data, and never creates/redeploys a Vercel deployment.
`;
}

async function main(){
  const args=parseArgs(process.argv.slice(2));
  if(args.help){process.stdout.write(help());return;}
  const report=await run({
    currentMainSha:args.currentMainSha,
    vercelStatusState:args.vercelStatusState,
    vercelStatusUrl:args.vercelStatusUrl
  });
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
}

if(require.main===module){
  main().catch(err=>{
    process.stderr.write(JSON.stringify({
      ok:false,
      error_code:text(err&&err.code)||'RENTAL_ANALYTICS_PRODUCTION_WATCH_FAILED'
    },null,2)+'\n');
    process.exit(1);
  });
}

module.exports={
  TEAM_ID,
  PROJECT_ID,
  PRODUCTION_URL,
  RENTAL_ANALYTICS_FIX_SHA,
  SCHEMA,
  parseArgs,
  httpTransport,
  deploymentState,
  deploymentCreated,
  deploymentSha,
  deploymentRef,
  deploymentId,
  isProduction,
  safeDeployment,
  selectProduction,
  listDeployments,
  gitContainsFix,
  routeProbe,
  isBuildRateLimited,
  classifyState,
  fingerprintPayload,
  fingerprint,
  run
};
