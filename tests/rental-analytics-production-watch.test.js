'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');

const Watch=require('../scripts/watch-rental-analytics-production');

function deployment({id='dpl_x',state='READY',sha='a'.repeat(40),ref='main',created=1,target='production'}={}){
  return {
    id,
    state,
    target,
    created,
    meta:{githubCommitSha:sha,githubCommitRef:ref}
  };
}

test('selectProduction keeps latest attempt separate from currently serving READY Production',()=>{
  const oldReady=deployment({id:'dpl_ready',state:'READY',created:10});
  const newerError=deployment({id:'dpl_error',state:'ERROR',created:20});
  const selected=Watch.selectProduction([oldReady,newerError]);
  assert.equal(selected.latest_attempt.id,'dpl_error');
  assert.equal(selected.serving.id,'dpl_ready');
});

test('build-rate-limit is a waiting state and does not imply code failure',()=>{
  const serving=deployment({sha:'b'.repeat(40)});
  const result=Watch.classifyState({
    serving,
    latestAttempt:serving,
    productionContainsFix:false,
    vercelStatusState:'failure',
    vercelStatusUrl:'https://vercel.com/example?upgradeToPro=build-rate-limit'
  });
  assert.equal(result.state,'BLOCKED_BUILD_RATE_LIMIT');
  assert.equal(result.severity,'waiting');
});

test('old Production without rate limit remains waiting for fix deployment',()=>{
  const serving=deployment({sha:'b'.repeat(40)});
  const result=Watch.classifyState({
    serving,
    latestAttempt:serving,
    productionContainsFix:false,
    vercelStatusState:'success',
    vercelStatusUrl:'https://vercel.com/example'
  });
  assert.equal(result.state,'WAITING_FOR_FIX_DEPLOYMENT');
});

test('v6 route shape plus healthy auth gate accepts Production wiring',()=>{
  const serving=deployment();
  const result=Watch.classifyState({
    serving,
    latestAttempt:serving,
    productionContainsFix:true,
    probe:{
      analytics_head_status:401,
      admin_auth_status:200,
      admin_auth_authenticated:false
    }
  });
  assert.equal(result.state,'ROUTE_WIRING_ACCEPTED');
  assert.equal(result.severity,'ok');
});

test('legacy 405 route shape is classified as route-shadow regression',()=>{
  const serving=deployment();
  const result=Watch.classifyState({
    serving,
    latestAttempt:serving,
    productionContainsFix:true,
    probe:{
      analytics_head_status:405,
      admin_auth_status:200,
      admin_auth_authenticated:false
    }
  });
  assert.equal(result.state,'ROUTE_SHADOW_REGRESSION');
  assert.equal(result.severity,'error');
});

test('unexpected analytics auth status fails closed',()=>{
  const serving=deployment();
  const result=Watch.classifyState({
    serving,
    latestAttempt:serving,
    productionContainsFix:true,
    probe:{
      analytics_head_status:200,
      admin_auth_status:200,
      admin_auth_authenticated:false
    }
  });
  assert.equal(result.state,'ROUTE_WIRING_UNEXPECTED');
  assert.equal(result.severity,'error');
});

test('report fingerprint ignores checked_at but changes with material state',()=>{
  const base={
    schema:Watch.SCHEMA,
    checked_at:'2026-09-22T00:00:00Z',
    state:'BLOCKED_BUILD_RATE_LIMIT',
    severity:'waiting',
    current_main_sha:'a'.repeat(40),
    production_matches_current_main:false,
    production_contains_fix:false,
    serving_production:{id:'dpl_1',state:'READY',sha:'b'.repeat(40)},
    latest_production_attempt:{id:'dpl_1',state:'READY',sha:'b'.repeat(40)},
    vercel_commit_status:{state:'failure',target_url:'x/build-rate-limit'},
    probe:null,
    safety:{production_writes:0,business_writes:0}
  };
  const later={...base,checked_at:'2026-09-22T01:00:00Z'};
  assert.equal(Watch.fingerprint(base),Watch.fingerprint(later));
  assert.notEqual(Watch.fingerprint(base),Watch.fingerprint({...later,state:'ROUTE_WIRING_ACCEPTED'}));
});

test('read-only transport rejects non-GET methods',async()=>{
  const transport=Watch.httpTransport({
    token:'test-token',
    fetchImpl:async()=>({ok:true,json:async()=>({})})
  });
  await assert.rejects(()=>transport.request('POST','/v1/test'),/READ_ONLY_TRANSPORT_REJECTED_NON_GET/);
});
