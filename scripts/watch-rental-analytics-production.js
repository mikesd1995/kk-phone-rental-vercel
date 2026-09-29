'use strict';

const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');

const TEAM_ID='team_uaeOdVIjXMSW690ZM2wPuJyt';
const PROJECT_ID='prj_snbAmpya7YGmOuMbv1o8T16ouxl6';
const PRODUCTION_URL='https://kk-phone-rental.vercel.app';
const RENTAL_ANALYTICS_FIX_SHA='061da369297dbce1042cc4822edf9f93956e3776';
const SCHEMA='KK_RENTAL_ANALYTICS_PRODUCTION_WATCH_V2';
const DEFAULT_WAIT_MS=0;
const DEFAULT_POLL_MS=10000;

function text(v){return String(v==null?'':v).trim();}
function assert(condition,code){
  if(!condition){
    const err=new Error(code);
    err.code=code;
    throw err;
  }
}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}

function parseArgs(argv){
  const out={};
  for(let i=0;i<argv.length;i++){
    const arg=argv[i];
    if(arg==='--current-main-sha') out.currentMainSha=text(argv[++i]);
    else if(arg==='--vercel-status-state') out.vercelStatusState=text(argv[++i]);
    else if(arg==='--vercel-status-url') out.vercelStatusUrl=text(argv[++i]);
    else if(arg==='--wait-for-current-main-ms') out.waitForCurrentMainMs=Math.max(0,Number(argv[++i]||0)||0);
    else if(arg==='--poll-ms') out.pollMs=Math.max(1000,Number(argv[++i]||DEFAULT_POLL_MS)||DEFAULT_POLL_MS);
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
        headers:{Authorization:`Bearer ${bearer}`,Accept:'application/json'}
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

function exactMainAttempt(deployments,currentMainSha){
  const sha=text(currentMainSha);
  return (Array.isArray(deployments)?deployments:[])
    .filter(d=>isProduction(d)&&deploymentRef(d)==='main'&&deploymentSha(d)===sha)
    .sort((a,b)=>deploymentCreated(b)-deploymentCreated(a))[0]||null;
}

async function waitForCurrentMainProduction(transport,currentMainSha,{waitMs=DEFAULT_WAIT_MS,pollMs=DEFAULT_POLL_MS,sleepFn=sleep}={}){
  const deadline=Date.now()+Math.max(0,Number(waitMs)||0);
  let deployments=[];
  let selected={latest_attempt:null,serving:null};
  let mainAttempt=null;
  do{
    deployments=await listDeployments(transport);
    selected=selectProduction(deployments);
    mainAttempt=exactMainAttempt(deployments,currentMainSha);
    if(selected.serving && deploymentSha(selected.serving)===text(currentMainSha)) break;
    if(mainAttempt && ['ERROR','CANCELED'].includes(deploymentState(mainAttempt))) break;
    if(Date.now()>=deadline) break;
    await sleepFn(Math.min(Math.max(1000,Number(pollMs)||DEFAULT_POLL_MS),Math.max(0,deadline-Date.now())));
  }while(Date.now()<=deadline);
  return {deployments,selected,mainAttempt};
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
    method:'HEAD',redirect:'manual',headers:{'Cache-Control':'no-cache'}
  });
  const auth=await fetchImpl(`${PRODUCTION_URL}/api/kk-admin-auth`,{
    method:'GET',redirect:'manual',headers:{Accept:'application/json','Cache-Control':'no-cache'}
  });
  let authBody=null;
  try{authBody=await auth.json();}catch(_err){}
  return {
    analytics_head_status:analytics.status,
    admin_auth_status:auth.status,
    admin_auth_authenticated:authBody&&typeof authBody.authenticated==='boolean'?authBody.authenticated:null
  };
}

function headerValue(response,name){
  try{return text(response&&response.headers&&response.headers.get&&response.headers.get(name));}
  catch(_err){return '';}
}

function cacheIsLiveNoStore(value){
  const v=text(value).toLowerCase();
  return v.includes('no-store')&&!v.includes('s-maxage')&&!v.includes('stale-while-revalidate');
}

function csvHeader(textValue){
  return textValue==null?'':String(textValue).replace(/^\uFEFF/,'').split(/\r?\n/)[0];
}

function containsInternalPublicToken(value){
  return /OWNER_PRICE_ADJUST_|PROVISIONAL_|EXACT_EVENT_COMPETITOR_|WEEKDAY_FALLBACK_|WEEKDAY_FANDOM_TIER_|INTERNAL_ONLY|MANUAL_CUTOVER|PASS_200/i.test(String(value||''));
}

async function runtimeSelfAudit(fetchImpl=global.fetch){
  assert(typeof fetchImpl==='function','FETCH_UNAVAILABLE');
  const checks=[];
  const failures=[];
  const warnings=[];
  const add=(id,pass,detail)=>{
    checks.push({id,pass:!!pass,detail:text(detail)});
    if(!pass) failures.push(id);
  };

  try{
    const root=await fetchImpl(`${PRODUCTION_URL}/`,{method:'GET',redirect:'manual',headers:{'Cache-Control':'no-cache'}});
    add('STOREFRONT_HTTP_200',root.status===200,`status=${root.status}`);

    const eventRes=await fetchImpl(`${PRODUCTION_URL}/api/kk-data?sheet=08_Web_Ready&range=A4%3AK`,{
      method:'GET',redirect:'manual',headers:{Accept:'text/csv','Cache-Control':'no-cache'}
    });
    const eventText=await eventRes.text();
    const eventCache=headerValue(eventRes,'cache-control');
    const eventSource=headerValue(eventRes,'x-kk-sheet-source');
    const eventHead=csvHeader(eventText).toLowerCase();
    add('EVENT_FEED_HTTP_200',eventRes.status===200,`status=${eventRes.status}`);
    add('EVENT_FEED_SCHEMA',eventHead.includes('event_id')&&eventHead.includes('poster_image_url')&&eventHead.includes('action_for_web'),'required public event columns');
    add('EVENT_FEED_NO_STORE',cacheIsLiveNoStore(eventCache),eventCache||'missing');
    add('EVENT_FEED_INTERNAL_TEXT_CLEAN',!containsInternalPublicToken(eventText),'customer-facing feed contains no known operational tokens');
    add('EVENT_FEED_READER_SOURCE',[
      'public-gviz-fallback','public-gviz-fallback-after-private-error','private-service-account'
    ].includes(eventSource),eventSource||'missing');
    if(eventSource==='public-gviz-fallback-after-private-error') warnings.push('PRIVATE_READER_EVENT_FALLBACK_AFTER_ERROR');

    const pkgRes=await fetchImpl(`${PRODUCTION_URL}/api/kk-data?sheet=09_Web_Packages&range=A4%3AN`,{
      method:'GET',redirect:'manual',headers:{Accept:'text/csv','Cache-Control':'no-cache'}
    });
    const pkgText=await pkgRes.text();
    const pkgCache=headerValue(pkgRes,'cache-control');
    const pkgSource=headerValue(pkgRes,'x-kk-sheet-source');
    const pkgHead=csvHeader(pkgText).toLowerCase();
    add('PACKAGE_FEED_HTTP_200',pkgRes.status===200,`status=${pkgRes.status}`);
    add('PACKAGE_FEED_SCHEMA',pkgHead.includes('package_id')&&pkgHead.includes('event_id')&&pkgHead.includes('available_count'),'required public package columns');
    add('PACKAGE_FEED_NO_STORE',cacheIsLiveNoStore(pkgCache),pkgCache||'missing');
    add('PACKAGE_FEED_INTERNAL_TEXT_CLEAN',!containsInternalPublicToken(pkgText),'customer-facing feed contains no known operational tokens');
    add('PACKAGE_FEED_READER_SOURCE',[
      'public-gviz-fallback','public-gviz-fallback-after-private-error','private-service-account'
    ].includes(pkgSource),pkgSource||'missing');
    if(pkgSource==='public-gviz-fallback-after-private-error') warnings.push('PRIVATE_READER_PACKAGE_FALLBACK_AFTER_ERROR');

    const admin=await fetchImpl(`${PRODUCTION_URL}/admin`,{method:'GET',redirect:'manual',headers:{'Cache-Control':'no-cache'}});
    const adminCache=headerValue(admin,'cache-control');
    const frame=headerValue(admin,'x-frame-options').toUpperCase();
    const robots=headerValue(admin,'x-robots-tag').toLowerCase();
    const csp=headerValue(admin,'content-security-policy').toLowerCase();
    add('ADMIN_GATE_HTTP_200',admin.status===200,`status=${admin.status}`);
    add('ADMIN_GATE_NO_STORE',adminCache.toLowerCase().includes('no-store'),adminCache||'missing');
    add('ADMIN_GATE_FRAME_DENY',frame==='DENY',frame||'missing');
    add('ADMIN_GATE_NOINDEX',robots.includes('noindex'),robots||'missing');
    add('ADMIN_GATE_CSP',csp.includes("frame-ancestors 'none'")&&csp.includes("form-action 'self'"),csp?'required directives present':'missing');

    return {
      status:failures.length?'FAIL':warnings.length?'WARN':'PASS',
      checks,
      failed_checks:failures,
      warnings,
      sheet_sources:{events:eventSource||'unknown',packages:pkgSource||'unknown'},
      production_writes:0,
      business_writes:0
    };
  }catch(error){
    return {
      status:'FAIL',
      checks,
      failed_checks:[...failures,'RUNTIME_PROBE_EXCEPTION'],
      warnings,
      error_code:text(error&&error.code)||text(error&&error.name)||'RUNTIME_PROBE_EXCEPTION',
      sheet_sources:{events:'unknown',packages:'unknown'},
      production_writes:0,
      business_writes:0
    };
  }
}

function isBuildRateLimited(state,url){
  return text(state).toLowerCase()==='failure' && /build-rate-limit/i.test(text(url));
}

function classifyState({
  serving,
  latestAttempt,
  mainAttempt,
  productionMatchesCurrentMain,
  productionContainsFix,
  vercelStatusState,
  vercelStatusUrl,
  probe,
  runtimeAudit
}={}){
  if(!serving){
    return {state:'NO_READY_PRODUCTION',severity:'error',reason:'No READY Production deployment could be resolved'};
  }

  if(!productionMatchesCurrentMain){
    const mainState=deploymentState(mainAttempt||{});
    if(['ERROR','CANCELED'].includes(mainState)){
      return {state:'CURRENT_MAIN_DEPLOYMENT_FAILED',severity:'error',reason:`Current main Production attempt is ${mainState}`};
    }
    if(isBuildRateLimited(vercelStatusState,vercelStatusUrl)){
      return {state:'BLOCKED_BUILD_RATE_LIMIT',severity:'waiting',reason:'GitHub/Vercel status reports build-rate-limit; no deployment mutation was attempted'};
    }
    return {state:'CURRENT_MAIN_DEPLOYMENT_PENDING',severity:'waiting',reason:`Serving Production is not current main; current-main attempt is ${mainState||'not-visible'}`};
  }

  if(runtimeAudit&&runtimeAudit.status==='FAIL'){
    return {state:'PRODUCTION_RUNTIME_AUDIT_FAILED',severity:'error',reason:`Runtime self-audit failed: ${runtimeAudit.failed_checks.join(', ')}`};
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
    if(runtimeAudit&&runtimeAudit.status==='WARN'){
      return {state:'PRODUCTION_RUNTIME_AUDIT_WARNING',severity:'warning',reason:`Core runtime checks pass with warnings: ${runtimeAudit.warnings.join(', ')}`};
    }
    return {state:'ROUTE_WIRING_ACCEPTED',severity:'ok',reason:'Current main is serving; runtime self-audit and v6 route-shape probes are accepted'};
  }

  if(productionContainsFix===null){
    return {state:'PRODUCTION_LINEAGE_UNKNOWN',severity:'warning',reason:'Could not prove whether the serving Production SHA contains the fix'};
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
    current_main_attempt:report.current_main_attempt,
    vercel_commit_status:report.vercel_commit_status,
    probe:report.probe,
    runtime_self_audit:report.runtime_self_audit,
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
  containsFixFn=gitContainsFix,
  waitForCurrentMainMs=DEFAULT_WAIT_MS,
  pollMs=DEFAULT_POLL_MS,
  sleepFn=sleep
}={}){
  assert(/^[0-9a-f]{40}$/i.test(text(currentMainSha)),'CURRENT_MAIN_SHA_REQUIRED');
  const waited=await waitForCurrentMainProduction(transport,currentMainSha,{
    waitMs:waitForCurrentMainMs,pollMs,sleepFn
  });
  const selected=waited.selected;
  const serving=safeDeployment(selected.serving);
  const latestAttempt=safeDeployment(selected.latest_attempt);
  const mainAttempt=safeDeployment(waited.mainAttempt);
  const productionMatchesCurrentMain=!!(serving&&serving.sha===text(currentMainSha));

  const productionContainsFix=serving
    ? containsFixFn(RENTAL_ANALYTICS_FIX_SHA,serving.sha)
    : false;

  let runtimeAudit=null;
  let probe=null;
  if(productionMatchesCurrentMain){
    runtimeAudit=await runtimeSelfAudit(fetchImpl);
    if(productionContainsFix===true) probe=await routeProbe(fetchImpl);
  }

  const classification=classifyState({
    serving:selected.serving,
    latestAttempt:selected.latest_attempt,
    mainAttempt:waited.mainAttempt,
    productionMatchesCurrentMain,
    productionContainsFix,
    vercelStatusState,
    vercelStatusUrl,
    probe,
    runtimeAudit
  });

  const report={
    schema:SCHEMA,
    checked_at:new Date().toISOString(),
    state:classification.state,
    severity:classification.severity,
    reason:classification.reason,
    current_main_sha:text(currentMainSha),
    fix_sha:RENTAL_ANALYTICS_FIX_SHA,
    production_matches_current_main:productionMatchesCurrentMain,
    production_contains_fix:productionContainsFix,
    serving_production:serving,
    latest_production_attempt:latestAttempt,
    current_main_attempt:mainAttempt,
    vercel_commit_status:{
      state:text(vercelStatusState)||'unknown',
      target_url:text(vercelStatusUrl)||''
    },
    probe,
    runtime_self_audit:runtimeAudit,
    safety:{
      vercel_api_methods:['GET'],
      production_http_methods:productionMatchesCurrentMain?['GET','HEAD']:[],
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
    [--vercel-status-url <url>] \\
    [--wait-for-current-main-ms <milliseconds>] \\
    [--poll-ms <milliseconds>]

Requires VERCEL_TOKEN. This watcher is read-only. It resolves the exact current-main
Production deployment, optionally waits for it, then runs safe storefront/public-feed/Admin
runtime probes. It never logs in, never uses the Admin PIN, never writes business data,
and never creates/redeploys a Vercel deployment.
`;
}

async function main(){
  const args=parseArgs(process.argv.slice(2));
  if(args.help){process.stdout.write(help());return;}
  const report=await run({
    currentMainSha:args.currentMainSha,
    vercelStatusState:args.vercelStatusState,
    vercelStatusUrl:args.vercelStatusUrl,
    waitForCurrentMainMs:args.waitForCurrentMainMs,
    pollMs:args.pollMs
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
  TEAM_ID,PROJECT_ID,PRODUCTION_URL,RENTAL_ANALYTICS_FIX_SHA,SCHEMA,
  parseArgs,httpTransport,deploymentState,deploymentCreated,deploymentSha,deploymentRef,deploymentId,
  isProduction,safeDeployment,selectProduction,listDeployments,exactMainAttempt,waitForCurrentMainProduction,
  gitContainsFix,routeProbe,headerValue,cacheIsLiveNoStore,csvHeader,containsInternalPublicToken,
  runtimeSelfAudit,isBuildRateLimited,classifyState,fingerprintPayload,fingerprint,run
};
