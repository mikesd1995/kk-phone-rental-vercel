'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Tool=require('../scripts/accept-witness-config-zero-cost');

const SHA='a'.repeat(40);
const RUN='123456789';
const SOURCE='dpl_source';

function configuredReadiness(){
  return {
    external_scanner_enabled:false,
    runtime_ledger_oidc_probe_enabled:false,
    mode:'witness',
    hmac_secret_configured:true,
    runtime_ledger_enabled:true,
    runtime_ledger_configured:true,
    supabase_project_ref_configured:true,
    supabase_url_project_ref_resolved:true,
    supabase_project_binding_matches:true,
    ready_for_witness:false,
    scanner_execution_capable:false,
    business_writes_capable:false
  };
}

function baselineReadiness(){
  return {
    external_scanner_enabled:false,
    runtime_ledger_oidc_probe_enabled:false,
    mode:'unset',
    hmac_secret_configured:false,
    runtime_ledger_enabled:false,
    runtime_ledger_configured:false,
    scanner_execution_capable:false,
    business_writes_capable:false
  };
}

test('worker and acceptance tag are deterministic and bounded',()=>{
  assert.equal(
    Tool.acceptanceTag(RUN,SHA),
    'KK_ZERO_COST_WITNESS_ACCEPTANCE:'+RUN+':'+SHA
  );
  const name=Tool.workerName(RUN,SHA);
  assert.match(name,/^kk-scanner-clock-accept-/);
  assert.ok(name.length<=63);
});

test('production target filtering catches any pre-existing protected key',()=>{
  const envs=[
    {id:'1',key:'KK_EXTERNAL_SCANNER_ENABLED',target:['production']},
    {id:'2',key:'OTHER',target:['production']},
    {id:'3',key:'SUPABASE_SECRET_KEY',target:['preview']}
  ];
  assert.equal(Tool.relevantProductionEnvs(envs).length,1);
  assert.throws(()=>Tool.assertTargetEnvKeysAbsent(envs),/WITNESS_TARGET_ENV_KEYS_ALREADY_PRESENT/);
});

test('configured witness acceptance state requires external Scanner to remain disabled',()=>{
  Tool.validateConfigured(configuredReadiness());
  assert.throws(
    ()=>Tool.validateConfigured({...configuredReadiness(),external_scanner_enabled:true}),
    /CONFIG_EXTERNAL_SCANNER_MUST_REMAIN_OFF/
  );
  assert.throws(
    ()=>Tool.validateConfigured({...configuredReadiness(),ready_for_witness:true}),
    /CONFIG_READY_FOR_WITNESS_MUST_REMAIN_FALSE/
  );
  assert.throws(
    ()=>Tool.validateConfigured({...configuredReadiness(),business_writes_capable:true}),
    /CONFIG_BUSINESS_WRITES_MUST_REMAIN_OFF/
  );
});

test('baseline requires OIDC, Scanner execution and business writes all off',()=>{
  Tool.validateBaseline(baselineReadiness());
  assert.throws(
    ()=>Tool.validateBaseline({...baselineReadiness(),runtime_ledger_oidc_probe_enabled:true}),
    /BASELINE_OIDC_PROBE_NOT_OFF/
  );
});

test('dry run is zero mutation and refuses existing env keys',async()=>{
  const calls=[];
  const vercel={
    async request(method,p,body){
      calls.push({method,p,body});
      if(method==='GET'&&p.includes('/v13/deployments/')){
        return {readyState:'READY',meta:{githubCommitSha:SHA}};
      }
      if(method==='GET'&&p.includes('/env?')) return {envs:[]};
      throw new Error('unexpected mutation');
    }
  };
  const cloudflare={
    accountId:'acct',
    async request(method,p,body,opts){
      calls.push({method,p,body,opts});
      if(method==='GET') return {not_found:true,status:404};
      throw new Error('unexpected cloudflare mutation');
    }
  };
  const wrangler={
    deploy(){throw new Error('should not deploy');},
    putSecret(){throw new Error('should not put secret');}
  };
  const fetchImpl=async url=>({
    ok:true,
    status:200,
    async json(){return {ok:true,data:baselineReadiness()};}
  });
  const out=await Tool.runAcceptance({
    vercel,cloudflare,wrangler,fetchImpl,
    env:{
      SUPABASE_SECRET_KEY:'s',
      KK_EXTERNAL_SCANNER_SECRET:'h',
      CLOUDFLARE_API_TOKEN:'c',
      CLOUDFLARE_ACCOUNT_ID:'acct'
    },
    sourceDeploymentId:SOURCE,
    expectedCommitSha:SHA,
    runId:RUN,
    dryRun:true
  });
  assert.equal(out.result,'WITNESS_CONFIG_DRY_RUN_PASS');
  assert.equal(out.mutations.length,0);
  assert.equal(calls.some(c=>c.method==='POST'||c.method==='DELETE'),false);
});

test('static env spec can never enable the external Scanner',()=>{
  const spec=Tool.ENV_SPECS.find(x=>x.key==='KK_EXTERNAL_SCANNER_ENABLED');
  assert.ok(spec);
  assert.equal(spec.value,'false');
  assert.equal(
    Tool.ENV_SPECS.some(x=>x.key==='KK_EXTERNAL_SCANNER_ENABLED'&&x.value==='true'),
    false
  );
});
