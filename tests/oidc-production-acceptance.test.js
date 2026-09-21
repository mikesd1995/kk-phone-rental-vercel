'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Tool=require('../scripts/accept-oidc-production');

const SOURCE='dpl_source';
const SHA='a'.repeat(40);

function response(status,body){
  return {
    ok:status>=200 && status<300,
    status,
    async json(){return body;}
  };
}

function readiness(flag){
  return {
    ok:true,
    data:{
      external_scanner_enabled:false,
      runtime_ledger_oidc_probe_enabled:flag,
      scanner_execution_capable:false,
      business_writes_capable:false
    }
  };
}

test('parseArgs accepts exact source deployment and sha',()=>{
  assert.deepEqual(
    Tool.parseArgs(['--source-deployment',SOURCE,'--expected-sha',SHA,'--dry-run']),
    {sourceDeploymentId:SOURCE,expectedCommitSha:SHA,dryRun:true}
  );
});

test('redact removes token and secret shaped keys recursively',()=>{
  assert.deepEqual(
    Tool.redact({token:'abc',nested:{authorization:'x',ok:true},apiKey:'y'}),
    {token:'[REDACTED]',nested:{authorization:'[REDACTED]',ok:true},apiKey:'[REDACTED]'}
  );
});

test('validateReadiness requires Scanner and business writes to remain off',()=>{
  Tool.validateReadiness(readiness(false).data,false);
  assert.throws(
    ()=>Tool.validateReadiness({...readiness(false).data,external_scanner_enabled:true},false),
    /EXTERNAL_SCANNER_MUST_REMAIN_OFF/
  );
  assert.throws(
    ()=>Tool.validateReadiness({...readiness(false).data,business_writes_capable:true},false),
    /BUSINESS_WRITES_MUST_REMAIN_OFF/
  );
});

test('validateProbe accepts only authenticated bounded read-only zero-write result',()=>{
  const safe=Tool.validateProbe({
    status:200,
    body:{
      ok:true,
      data:{
        runtime_ledger_oidc_probe_enabled:true,
        external_scanner_enabled:false,
        scanner_execution_capable:false,
        business_writes_capable:false
      },
      runtime_ledger_oidc_probe:{
        ok:true,
        authenticated:true,
        row_count:0,
        read_only:true,
        bounded_limit:1,
        business_writes:0
      }
    }
  });
  assert.equal(safe.row_count,0);
  assert.equal(safe.business_writes,0);
  assert.throws(()=>Tool.validateProbe({
    status:200,
    body:{
      ok:true,
      data:{
        runtime_ledger_oidc_probe_enabled:true,
        external_scanner_enabled:false,
        scanner_execution_capable:false,
        business_writes_capable:false
      },
      runtime_ledger_oidc_probe:{
        ok:true,
        authenticated:true,
        row_count:0,
        read_only:true,
        bounded_limit:1,
        business_writes:1
      }
    }
  }),/OIDC_PROBE_BUSINESS_WRITES_NONZERO/);
});

test('dry-run performs no env mutation or redeploy',async()=>{
  const calls=[];
  const transport={
    mode:'TEST',
    async request(method,path,body){
      calls.push({method,path,body});
      if(method==='GET' && path.includes('/v13/deployments/')){
        return {readyState:'READY',meta:{githubCommitSha:SHA}};
      }
      throw new Error('unexpected mutation');
    }
  };
  const fetchImpl=async url=>{
    assert.equal(url,Tool.PRODUCTION_URL+'/api/kk-scanner-dispatch');
    return response(200,readiness(false));
  };
  const evidence=await Tool.runAcceptance({
    transport,
    fetchImpl,
    sourceDeploymentId:SOURCE,
    expectedCommitSha:SHA,
    dryRun:true
  });
  assert.equal(evidence.result,'DRY_RUN_PASS');
  assert.equal(evidence.mutations.length,0);
  assert.equal(calls.length,1);
  assert.equal(calls[0].method,'GET');
});

test('full success enables only probe gate, probes once, then restores false',async()=>{
  const calls=[];
  let depCounter=0;
  const transport={
    mode:'TEST',
    async request(method,path,body){
      calls.push({method,path,body});
      if(method==='GET' && path.includes('/v13/deployments/')){
        return {readyState:'READY',meta:{githubCommitSha:SHA}};
      }
      if(method==='POST' && path.includes('/env?')){
        return {created:{key:Tool.FLAG_KEY}};
      }
      if(method==='POST' && path.startsWith('/v13/deployments?')){
        depCounter+=1;
        return {id:'dpl_new_'+depCounter};
      }
      throw new Error('unexpected');
    }
  };
  let readinessCount=0;
  let probeCount=0;
  const fetchImpl=async url=>{
    if(url.endsWith('?probe=ledger-oidc')){
      probeCount+=1;
      return response(200,{
        ok:true,
        data:{
          runtime_ledger_oidc_probe_enabled:true,
          external_scanner_enabled:false,
          scanner_execution_capable:false,
          business_writes_capable:false
        },
        runtime_ledger_oidc_probe:{
          ok:true,
          authenticated:true,
          row_count:0,
          read_only:true,
          bounded_limit:1,
          business_writes:0
        }
      });
    }
    readinessCount+=1;
    const flag=readinessCount===1?false:(readinessCount===2?true:false);
    return response(200,readiness(flag));
  };
  const evidence=await Tool.runAcceptance({
    transport,
    fetchImpl,
    sourceDeploymentId:SOURCE,
    expectedCommitSha:SHA,
    sleepImpl:async()=>{}
  });
  assert.equal(evidence.result,'PASS_AND_ROLLED_BACK');
  assert.equal(evidence.probe.authenticated,true);
  assert.equal(evidence.probe.business_writes,0);
  assert.equal(evidence.rollback.ok,true);
  assert.equal(probeCount,1);

  const envCalls=calls.filter(c=>c.method==='POST' && c.path.includes('/env?'));
  assert.equal(envCalls.length,2);
  assert.equal(envCalls[0].body[0].key,Tool.FLAG_KEY);
  assert.equal(envCalls[0].body[0].value,'true');
  assert.equal(envCalls[1].body[0].value,'false');
  assert.equal(envCalls.every(c=>c.body.length===1),true);
});

test('probe failure still restores flag=false and redeploys source',async()=>{
  const calls=[];
  let depCounter=0;
  const transport={
    mode:'TEST',
    async request(method,path,body){
      calls.push({method,path,body});
      if(method==='GET' && path.includes('/v13/deployments/')){
        return {readyState:'READY',meta:{githubCommitSha:SHA}};
      }
      if(method==='POST' && path.includes('/env?')) return {ok:true};
      if(method==='POST' && path.startsWith('/v13/deployments?')){
        depCounter+=1;
        return {id:'dpl_new_'+depCounter};
      }
      throw new Error('unexpected');
    }
  };
  let readinessCount=0;
  const fetchImpl=async url=>{
    if(url.endsWith('?probe=ledger-oidc')){
      return response(503,{
        ok:false,
        runtime_ledger_oidc_probe:{
          attempted:true,
          ok:false,
          error_code:'OIDC_VERIFY_FAILED',
          read_only:true,
          bounded_limit:1,
          business_writes:0
        }
      });
    }
    readinessCount+=1;
    const flag=readinessCount===1?false:(readinessCount===2?true:false);
    return response(200,readiness(flag));
  };

  await assert.rejects(
    Tool.runAcceptance({
      transport,
      fetchImpl,
      sourceDeploymentId:SOURCE,
      expectedCommitSha:SHA,
      sleepImpl:async()=>{}
    }),
    /OIDC_PROBE_HTTP_NOT_200/
  );

  const envCalls=calls.filter(c=>c.method==='POST' && c.path.includes('/env?'));
  assert.equal(envCalls.length,2);
  assert.equal(envCalls[0].body[0].value,'true');
  assert.equal(envCalls[1].body[0].value,'false');
  const redeployCalls=calls.filter(c=>c.method==='POST' && c.path.startsWith('/v13/deployments?'));
  assert.equal(redeployCalls.length,2);
  assert.equal(redeployCalls.every(c=>c.body.deploymentId===SOURCE),true);
});

test('source SHA mismatch stops before all mutations',async()=>{
  let mutated=false;
  const transport={
    mode:'TEST',
    async request(method,path){
      if(method==='GET') return {readyState:'READY',meta:{githubCommitSha:'b'.repeat(40)}};
      mutated=true;
      return {};
    }
  };
  await assert.rejects(
    Tool.runAcceptance({
      transport,
      fetchImpl:async()=>response(200,readiness(false)),
      sourceDeploymentId:SOURCE,
      expectedCommitSha:SHA
    }),
    /SOURCE_DEPLOYMENT_SHA_MISMATCH/
  );
  assert.equal(mutated,false);
});

test('http transport does not expose token in request URL or response evidence',async()=>{
  const seen=[];
  const t=Tool.httpTransport({
    token:'top-secret-token',
    fetchImpl:async(url,opts)=>{
      seen.push({url,opts});
      return response(200,{id:'ok'});
    }
  });
  const out=await t.request('GET','/v13/deployments/test?teamId=x');
  assert.equal(out.id,'ok');
  assert.doesNotMatch(seen[0].url,/top-secret-token/);
  assert.equal(seen[0].opts.headers.Authorization,'Bearer top-secret-token');
});


test('parseArgs accepts explicit rollback-only mode',()=>{
  assert.deepEqual(
    Tool.parseArgs(['--source-deployment',SOURCE,'--expected-sha',SHA,'--rollback-only']),
    {sourceDeploymentId:SOURCE,expectedCommitSha:SHA,rollbackOnly:true}
  );
});

test('rollback-only is a zero-mutation no-op when production flag is already false',async()=>{
  const calls=[];
  const transport={
    mode:'TEST',
    async request(method,path,body){
      calls.push({method,path,body});
      if(method==='GET' && path.includes('/v13/deployments/')){
        return {readyState:'READY',meta:{githubCommitSha:SHA}};
      }
      throw new Error('unexpected mutation');
    }
  };
  const evidence=await Tool.runRollback({
    transport,
    fetchImpl:async url=>{
      assert.equal(url,Tool.PRODUCTION_URL+'/api/kk-scanner-dispatch');
      return response(200,readiness(false));
    },
    sourceDeploymentId:SOURCE,
    expectedCommitSha:SHA,
    sleepImpl:async()=>{}
  });
  assert.equal(evidence.result,'ROLLBACK_ALREADY_SAFE');
  assert.equal(evidence.rollback.ok,true);
  assert.equal(evidence.rollback.oidc_probe_enabled,false);
  assert.equal(evidence.mutations.length,0);
  assert.equal(calls.filter(c=>c.method==='POST').length,0);
});

test('rollback-only restores a true probe flag using the exact source deployment',async()=>{
  const calls=[];
  const transport={
    mode:'TEST',
    async request(method,path,body){
      calls.push({method,path,body});
      if(method==='GET' && path.includes('/v13/deployments/')){
        return {readyState:'READY',meta:{githubCommitSha:SHA}};
      }
      if(method==='POST' && path.includes('/env?')) return {ok:true};
      if(method==='POST' && path.startsWith('/v13/deployments?')) return {id:'dpl_rollback'};
      throw new Error('unexpected');
    }
  };
  let reads=0;
  const evidence=await Tool.runRollback({
    transport,
    fetchImpl:async url=>{
      assert.equal(url,Tool.PRODUCTION_URL+'/api/kk-scanner-dispatch');
      reads+=1;
      return response(200,readiness(reads===1));
    },
    sourceDeploymentId:SOURCE,
    expectedCommitSha:SHA,
    sleepImpl:async()=>{}
  });
  assert.equal(evidence.result,'ROLLBACK_PASS');
  assert.equal(evidence.rollback.ok,true);
  assert.equal(evidence.rollback.oidc_probe_enabled,false);
  const envCalls=calls.filter(c=>c.method==='POST' && c.path.includes('/env?'));
  assert.equal(envCalls.length,1);
  assert.equal(envCalls[0].body.length,1);
  assert.equal(envCalls[0].body[0].key,Tool.FLAG_KEY);
  assert.equal(envCalls[0].body[0].value,'false');
  const deployCalls=calls.filter(c=>c.method==='POST' && c.path.startsWith('/v13/deployments?'));
  assert.equal(deployCalls.length,1);
  assert.equal(deployCalls[0].body.deploymentId,SOURCE);
});

test('rollback-only rejects stale source SHA before any mutation',async()=>{
  let mutated=false;
  const transport={
    mode:'TEST',
    async request(method){
      if(method==='GET') return {readyState:'READY',meta:{githubCommitSha:'b'.repeat(40)}};
      mutated=true;
      return {};
    }
  };
  await assert.rejects(
    Tool.runRollback({
      transport,
      fetchImpl:async()=>response(200,readiness(true)),
      sourceDeploymentId:SOURCE,
      expectedCommitSha:SHA,
      sleepImpl:async()=>{}
    }),
    /SOURCE_DEPLOYMENT_SHA_MISMATCH/
  );
  assert.equal(mutated,false);
});
