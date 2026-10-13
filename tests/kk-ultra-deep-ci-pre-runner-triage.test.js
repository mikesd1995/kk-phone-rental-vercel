'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Triage=require('../scripts/kk-ultra-deep-ci-pre-runner-triage.js');
const run={id:38404082846,head_sha:'9df5d802cff1d30c616fd20dcaaa90376f4fcda8',
  name:'Ultra Deep V2 Acceptance',status:'completed',conclusion:'failure'};
const job={id:115318973550,conclusion:'failure',steps:null};
const zero={billable:{UBUNTU:{total_ms:0,jobs:1,
  job_runs:[{job_id:115318973550,duration_ms:0}]}},run_duration_ms:4000};
test('failed job with zero billed ms and no visible steps is inconclusive about runner root cause',()=>{
 const x=Triage.classify(run,[job],zero);
 assert.equal(x.classification,'FAILED_WITHOUT_VISIBLE_STEPS');
 assert.equal(x.recorded_job_runtime_ms,0);
 assert.equal(x.run_duration_ms,4000);
 assert.equal(x.root_cause_confirmed,false);
 assert.equal(x.runner_execution_confirmed,false);
 assert.match(x.diagnostic_certainty,/ROOT_CAUSE_NOT_PROVEN/);
 assert.equal(x.production_writes,0);
 assert.equal(x.github_actions_reruns,0);
 assert.ok(x.possible_causes_not_proven.includes('ACCOUNT_BILLING_OR_USAGE'));
});
test('job with executed steps is NOT misclassified as pre-runner failure',()=>{
 const data={...job,steps:[{name:'Set up job',conclusion:'success'},
  {name:'npm run check',conclusion:'failure'}]};
 const timing={billable:{UBUNTU:{job_runs:[{duration_ms:22000}]}}};
 const x=Triage.classify(run,[data],timing);
 assert.equal(x.classification,'EXECUTED_TEST_OR_RUNNER_STEP_FAILURE');
 assert.equal(x.runner_execution_confirmed,true);
});
test('missing jobs/timing remains inconclusive rather than inventing a root cause',()=>{
 const x=Triage.classify(run,[],{});
 assert.equal(x.classification,'EVIDENCE_INCOMPLETE');
 assert.equal(x.recorded_job_runtime_ms,null);
 assert.equal(x.root_cause_confirmed,false);
});
test('a successful job with real execution can be recorded but never authorizes release',()=>{
 const x=Triage.classify({...run,conclusion:'success'},[
  {...job,conclusion:'success',steps:[{name:'Set up job',conclusion:'success'}]}],
  {billable:{UBUNTU:{job_runs:[{duration_ms:3000}]}}});
 assert.equal(x.classification,'RECORDED_RUN_SUCCESS');
 assert.equal(x.production_writes,0);
});
test('only exact repository, numeric unique run IDs and read-only flags are accepted',()=>{
 assert.deepEqual(Triage.parseArgs(['--repo','mikesd1995/kk-phone-rental-vercel',
  '--runs','38404082846,38404082934']),
 {repo:'mikesd1995/kk-phone-rental-vercel',runs:['38404082846','38404082934']});
 assert.throws(()=>Triage.parseArgs(['--repo','localhost','--runs','38404082846']),/CI_TRIAGE_REPO_INVALID/);
 assert.throws(()=>Triage.parseArgs(['--repo','mikesd1995/kk-phone-rental-vercel',
  '--runs','38404082846,38404082846']),/CI_TRIAGE_RUNS_INVALID/);
 assert.throws(()=>Triage.parseArgs(['--rerun','38404082846']),/CI_TRIAGE_OPTION_NOT_SUPPORTED/);
});
test('HTTP read wrapper only issues GET, and does not reveal Authorization header in results',async()=>{
 let used;
 const fake=async(url,opts)=>{used={url,opts};return{ok:true,json:async()=>({id:38404082846})}};
 const value=await Triage.requestJson('https://api.github.com/test',{fetchImpl:fake,token:'CANARY'});
 assert.equal(value.id,38404082846);
 assert.equal(used.opts.method,'GET');
 assert.equal(used.opts.redirect,'error');
 assert.equal(used.opts.headers.Authorization,'Bearer CANARY');
});
test('inspectOne merges three independent GitHub read receipts without a mutation',async()=>{
 const endpoint='https://api.github.com/repos/mikesd1995/kk-phone-rental-vercel/actions/runs/38404082846';
 const fake=async(url,opts)=>({ok:true,json:async()=>{
  if(url===endpoint)return run;
  if(url===endpoint+'/jobs?per_page=100')return{total_count:1,jobs:[job]};
  if(url===endpoint+'/timing')return zero;
  throw Error('UNEXPECTED_URL '+url);
 }});
 const x=await Triage.inspectOne('mikesd1995/kk-phone-rental-vercel','38404082846',{fetchImpl:fake});
 assert.equal(x.classification,'FAILED_WITHOUT_VISIBLE_STEPS');
 assert.equal(x.job_count,1);
 assert.equal(x.visible_step_count,0);
});
test('pagination ambiguity fails closed',async()=>{
 const endpoint='https://api.github.com/repos/mikesd1995/kk-phone-rental-vercel/actions/runs/38404082846';
 const fake=async(url)=>({ok:true,json:async()=>{
  if(url===endpoint)return run;
  if(url.endsWith('/jobs?per_page=100'))return{total_count:101,jobs:[job]};
  return zero;
 }});
 await assert.rejects(()=>Triage.inspectOne('mikesd1995/kk-phone-rental-vercel',
  '38404082846',{fetchImpl:fake}),/GITHUB_JOBS_PAGE_INCOMPLETE/);
});

test('zero billable milliseconds cannot negate recorded successful Node checkout steps',()=>{
 const x=Triage.classify({...run,conclusion:'success'},[
  {...job,conclusion:'success',steps:[
   {name:'Set up job',conclusion:'success'},
   {name:'Run npm run test:ultradeep:recall',conclusion:'success'}
  ]}],zero);
 assert.equal(x.recorded_job_runtime_ms,0);
 assert.equal(x.classification,'RECORDED_RUN_SUCCESS');
 assert.equal(x.runner_execution_confirmed,true);
 assert.equal(x.root_cause_confirmed,false);
});
test('GitHub read-only helper never sends bearer tokens to external host',async()=>{
 await assert.rejects(()=>Triage.requestJson('https://evil.example/log',{
  fetchImpl:async()=>{throw Error('SHOULD_NOT_FETCH')},token:'CANARY'
 }),/GITHUB_API_ORIGIN_REQUIRED/);
});
