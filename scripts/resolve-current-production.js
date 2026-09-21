'use strict';

const Acceptance=require('./accept-oidc-production');

const TEAM_ID=Acceptance.TEAM_ID;
const PROJECT_ID=Acceptance.PROJECT_ID;

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
    if(arg==='--expected-sha') out.expectedCommitSha=text(argv[++i]);
    else if(arg==='--help') out.help=true;
    else throw Object.assign(new Error('UNKNOWN_ARGUMENT'),{code:'UNKNOWN_ARGUMENT',argument:arg});
  }
  return out;
}

function deploymentState(d={}){
  return text(d.readyState||d.state).toUpperCase();
}

function deploymentCreated(d={}){
  const raw=d.createdAt!=null?d.createdAt:d.created;
  const n=Number(raw);
  return Number.isFinite(n)?n:0;
}

function deploymentSha(d={}){
  return text(d.meta&&d.meta.githubCommitSha);
}

function deploymentRef(d={}){
  return text(d.meta&&d.meta.githubCommitRef);
}

function isProduction(d={}){
  const target=text(d.target).toLowerCase();
  return !target || target==='production';
}

function resolveExactCurrentProduction(deployments,expectedCommitSha){
  const expected=text(expectedCommitSha);
  assert(/^[0-9a-f]{40}$/i.test(expected),'EXPECTED_SHA_REQUIRED');
  assert(Array.isArray(deployments),'DEPLOYMENT_LIST_INVALID');

  const matches=deployments
    .filter(d=>
      deploymentState(d)==='READY' &&
      deploymentSha(d)===expected &&
      deploymentRef(d)==='main' &&
      isProduction(d)
    )
    .sort((a,b)=>deploymentCreated(b)-deploymentCreated(a));

  assert(matches.length>0,'EXACT_CURRENT_MAIN_PRODUCTION_NOT_FOUND');
  const chosen=matches[0];
  const id=text(chosen.id||chosen.uid);
  assert(/^dpl_[A-Za-z0-9]+$/.test(id),'DEPLOYMENT_ID_INVALID');

  return {
    schema:'KK_EXACT_CURRENT_MAIN_PRODUCTION_V1',
    deployment_id:id,
    expected_commit_sha:expected,
    deployment_sha:deploymentSha(chosen),
    deployment_ref:deploymentRef(chosen),
    deployment_state:deploymentState(chosen),
    deployment_target:text(chosen.target)||'production',
    deployment_created:deploymentCreated(chosen),
    candidate_count:matches.length
  };
}

async function listDeployments(transport){
  assert(transport&&typeof transport.request==='function','VERCEL_AUTH_REQUIRED');
  const qs=new URLSearchParams({
    projectId:PROJECT_ID,
    target:'production',
    limit:'100',
    teamId:TEAM_ID
  });
  const body=await transport.request('GET',`/v13/deployments?${qs.toString()}`);
  const deployments=Array.isArray(body&&body.deployments)?body.deployments:[];
  assert(deployments.length>0,'DEPLOYMENT_LIST_EMPTY');
  return deployments;
}

async function resolveFromVercel({transport,expectedCommitSha}={}){
  const deployments=await listDeployments(transport);
  return resolveExactCurrentProduction(deployments,expectedCommitSha);
}

function help(){
  return `Usage:
  node scripts/resolve-current-production.js --expected-sha <40-char-main-sha>

Requires VERCEL_TOKEN. Returns only secret-safe deployment identity metadata.
It never mutates Vercel state.
`;
}

async function main(){
  const args=parseArgs(process.argv.slice(2));
  if(args.help){
    process.stdout.write(help());
    return;
  }
  assert(/^[0-9a-f]{40}$/i.test(text(args.expectedCommitSha)),'EXPECTED_SHA_REQUIRED');
  const transport=Acceptance.httpTransport();
  assert(transport,'VERCEL_AUTH_REQUIRED');
  const result=await resolveFromVercel({
    transport,
    expectedCommitSha:args.expectedCommitSha
  });
  process.stdout.write(JSON.stringify(result,null,2)+'\n');
}

if(require.main===module){
  main().catch(err=>{
    process.stderr.write(JSON.stringify({
      ok:false,
      error_code:text(err&&err.code)||'CURRENT_PRODUCTION_RESOLUTION_FAILED'
    },null,2)+'\n');
    process.exit(1);
  });
}

module.exports={
  parseArgs,
  deploymentState,
  deploymentCreated,
  deploymentSha,
  deploymentRef,
  isProduction,
  resolveExactCurrentProduction,
  listDeployments,
  resolveFromVercel
};
