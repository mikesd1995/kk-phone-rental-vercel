'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Audit=require('../scripts/audit-github-witness-scheduler');

function response(status, body){
  return {
    ok:status>=200 && status<300,
    status,
    async text(){ return body===undefined ? '' : JSON.stringify(body); },
  };
}

test('classify distinguishes inactive, active-no-run and active-with-runs',()=>{
  assert.equal(Audit.classify('disabled_manually',0),'WORKFLOW_NOT_ACTIVE');
  assert.equal(Audit.classify('active',0),'WORKFLOW_ACTIVE_BUT_NO_SCHEDULE_RUNS');
  assert.equal(Audit.classify('active',2),'SCHEDULE_RUNS_PRESENT');
});

test('audit is read-only and reports workflow state without granting witness credit',async()=>{
  const calls=[];
  const fetchImpl=async(url,opts)=>{
    calls.push({url,method:opts?.method||'GET',auth:opts?.headers?.Authorization});
    if(url.endsWith('/repos/mikesd1995/kk-phone-rental-vercel')){
      return response(200,{default_branch:'main'});
    }
    if(url.includes('/actions/workflows/kk-external-witness-clock.yml')){
      return response(200,{
        id:123,
        name:'KK External Witness Clock V2',
        path:'.github/workflows/kk-external-witness-clock.yml',
        state:'active',
        created_at:'2026-09-21T12:00:00Z',
        updated_at:'2026-09-21T15:00:00Z',
      });
    }
    if(url.includes('/actions/runs?event=schedule')){
      return response(200,{total_count:0,workflow_runs:[]});
    }
    return response(404,{});
  };

  const report=await Audit.audit({
    token:'masked-test-token',
    repository:'mikesd1995/kk-phone-rental-vercel',
    fetchImpl,
  });

  assert.equal(report.classification,'WORKFLOW_ACTIVE_BUT_NO_SCHEDULE_RUNS');
  assert.equal(report.default_branch,'main');
  assert.equal(report.workflow.state,'active');
  assert.equal(report.schedule_runs.total_count,0);
  assert.equal(report.authority.witness_credit_granted,false);
  assert.equal(report.authority.manual_dispatch_performed,false);
  assert.equal(report.authority.production_writes,0);
  assert.equal(report.authority.business_writes,0);
  assert.equal(calls.length,3);
  assert.ok(calls.every(c=>c.method==='GET'));
  assert.ok(calls.every(c=>c.auth==='Bearer masked-test-token'));
});

test('audit fails closed without token or valid repository',async()=>{
  await assert.rejects(()=>Audit.audit({token:'',repository:'mikesd1995/kk-phone-rental-vercel',fetchImpl:async()=>response(200,{})}),/GITHUB_TOKEN_MISSING/);
  await assert.rejects(()=>Audit.audit({token:'x',repository:'bad',fetchImpl:async()=>response(200,{})}),/GITHUB_REPOSITORY_INVALID/);
});

test('github API non-2xx is surfaced without mutation fallback',async()=>{
  const fetchImpl=async()=>response(403,{message:'forbidden'});
  await assert.rejects(
    ()=>Audit.audit({token:'x',repository:'mikesd1995/kk-phone-rental-vercel',fetchImpl}),
    /GITHUB_API_HTTP_403/
  );
});
