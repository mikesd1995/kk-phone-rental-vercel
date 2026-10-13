'use strict';
// Read-only GitHub Actions incident classifier. This does NOT rerun a workflow,
// authorize a deployment, fetch private job logs, or enable paid billing.
const VERSION='KK_ULTRA_DEEP_CI_PRE_RUNNER_TRIAGE_V1';
const MAX_RUNS=10;
function text(v){return String(v==null?'':v).trim();}
function validRepo(repo){return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(text(repo));}
function validRun(value){return /^\d{7,16}$/.test(String(value));}
function parseArgs(argv=[]){
 let repo='',runs=[];
 for(let i=0;i<argv.length;i++){
  if(argv[i]==='--repo')repo=argv[++i];
  else if(argv[i]==='--runs')runs=String(argv[++i]||'').split(',').filter(Boolean);
  else throw Error('CI_TRIAGE_OPTION_NOT_SUPPORTED');
 }
 if(!validRepo(repo))throw Error('CI_TRIAGE_REPO_INVALID');
 if(!runs.length||runs.length>MAX_RUNS||!runs.every(validRun)||new Set(runs).size!==runs.length)
  throw Error('CI_TRIAGE_RUNS_INVALID');
 return {repo,runs};
}
function classify(run={},jobs=[],timing={}){
 const rows=Array.isArray(jobs)?jobs:[];
 const billable=timing.billable||{};
 const jobRuns=Object.values(billable).flatMap(x=>Array.isArray(x.job_runs)?x.job_runs:[]);
 const total=jobRuns.reduce((n,x)=>n+Number(x.duration_ms||0),0);
 const steps=rows.flatMap(x=>Array.isArray(x.steps)?x.steps:[]);
 const allMissingSteps=rows.length>0&&rows.every(x=>!Array.isArray(x.steps)||x.steps.length===0);
 const failed=run.status==='completed'&&run.conclusion==='failure';
 const dataComplete=rows.length>0&&jobRuns.length>0&&Number.isFinite(total);
 let classification='EVIDENCE_INCOMPLETE';
 if(run.status!=='completed')classification='RUN_NOT_TERMINAL';
 else if(dataComplete&&failed&&allMissingSteps&&total===0)
  classification='FAILED_BEFORE_RECORDED_RUNNER_EXECUTION';
 else if(dataComplete&&steps.length>0&&failed)
  classification='EXECUTED_TEST_OR_RUNNER_STEP_FAILURE';
 else if(run.conclusion==='success'&&dataComplete&&steps.length>0)
  classification='RECORDED_RUN_SUCCESS';
 return {
  version:VERSION,run_id:run.id||null,head_sha:text(run.head_sha)||null,
  workflow:text(run.name)||null,status:text(run.status),conclusion:text(run.conclusion),
  classification,diagnostic_certainty:classification==='FAILED_BEFORE_RECORDED_RUNNER_EXECUTION'?
    'ZERO_RECORDED_JOB_EXECUTION_TIME_NOT_ROOT_CAUSE':'EVIDENCE_ONLY',
  job_count:rows.length,job_ids:rows.map(x=>x.id).filter(Boolean),
  visible_step_count:steps.length,steps_missing:allMissingSteps,
  recorded_job_runtime_ms:jobRuns.length?total:null,
  run_duration_ms:Number.isFinite(Number(timing.run_duration_ms))?
    Number(timing.run_duration_ms):null,
  possible_causes_not_proven:classification==='FAILED_BEFORE_RECORDED_RUNNER_EXECUTION'?
    ['REPO_ACTIONS_POLICY','ACCOUNT_BILLING_OR_USAGE','RUNNER_PROVISIONING','GITHUB_SERVICE_RESTRICTION']:[],
  root_cause_confirmed:false,
  runner_execution_confirmed:steps.length>0&&total>0,
  production_writes:0,github_actions_reruns:0,paid_provider_calls:0
 };
}
async function requestJson(url,{fetchImpl=global.fetch,token=''}={}){
 // All URLs are assembled below from validated repo and numeric run IDs.
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
  if(token)headers.Authorization='Bearer '+token;
  const response=await fetchImpl(url,{method:'GET',headers,redirect:'error',signal:controller.signal});
  if(!response.ok)throw Error('GITHUB_READ_HTTP_'+response.status);
  return await response.json();
 }finally{clearTimeout(timeout);}
}
async function inspectOne(repo,id,opts={}){
 const base='https://api.github.com/repos/'+repo+'/actions/runs/'+id;
 const [run,jobPage,timing]=await Promise.all([
  requestJson(base,opts),
  requestJson(base+'/jobs?per_page=100',opts),
  requestJson(base+'/timing',opts)
 ]);
 if(Number(run.id)!==Number(id))throw Error('GITHUB_RUN_ID_MISMATCH');
 if(!Array.isArray(jobPage.jobs)||Number(jobPage.total_count)>jobPage.jobs.length)
  throw Error('GITHUB_JOBS_PAGE_INCOMPLETE');
 return classify(run,jobPage.jobs,timing);
}
async function main(argv=process.argv.slice(2),options={}){
 const {repo,runs}=parseArgs(argv);
 const opts={...options,token:options.token||process.env.GITHUB_TOKEN||process.env.GH_TOKEN||''};
 const results=[];
 for(const id of runs){
  try{results.push(await inspectOne(repo,id,opts));}
  catch(e){results.push({version:VERSION,run_id:id,status:'UNREADABLE',
   classification:'API_READ_FAILED',error_class:text(e&&e.message).slice(0,100),
   root_cause_confirmed:false,production_writes:0,github_actions_reruns:0,paid_provider_calls:0});}
 }
 const answer={version:VERSION,repo,results,
  all_runner_execution_confirmed:results.every(x=>x.runner_execution_confirmed===true),
  status:results.every(x=>x.classification==='RECORDED_RUN_SUCCESS')?'RECORDED_SUCCESS':'HOLD',
  production_writes:0,github_actions_reruns:0,paid_provider_calls:0};
 process.stdout.write(JSON.stringify(answer,null,2)+'\n');
 if(answer.status==='HOLD')process.exitCode=1;
 return answer;
}
if(require.main===module)main().catch(e=>{process.stderr.write(text(e.message)+'\n');process.exitCode=1});
module.exports={VERSION,MAX_RUNS,validRepo,validRun,parseArgs,classify,requestJson,inspectOne,main};
