'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

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

test('workflow grants read access to commit statuses and uses a shell-safe summary writer',()=>{
  const workflow=fs.readFileSync('.github/workflows/rental-analytics-production-watch.yml','utf8');
  assert.match(workflow,/\n\s*statuses:\s*read\s*\n/);
  assert.match(workflow,/\n\s*pull-requests:\s*write\s*\n/);
  assert.doesNotMatch(workflow,/node\s+-\s+<<['"]?NODE['"]?\s+>>\s+["']?\$GITHUB_STEP_SUMMARY/);
  assert.match(workflow,/node\s+-e\s+['"]/);
  assert.match(workflow,/kk-rental-analytics-production-watch-fingerprint:/);
  assert.match(workflow,/legacyFingerprint=.*State fingerprint:/);
});

function headers(values={}) {
  const normalized=Object.fromEntries(Object.entries(values).map(([k,v])=>[k.toLowerCase(),v]));
  return {get(name){return normalized[String(name||'').toLowerCase()]||null;}};
}

test('runtime self-audit accepts healthy storefront, live feeds, and hardened Admin gate',async()=>{
  const responses=[
    {status:200,headers:headers(),text:async()=>'<html></html>'},
    {status:200,headers:headers({'cache-control':'no-store, max-age=0, must-revalidate','x-kk-sheet-source':'public-gviz-fallback'}),text:async()=>'event_id,event_name,poster_image_url,action_for_web\nEVT-1,Event,https://example.test/p.jpg,show'},
    {status:200,headers:headers({'cache-control':'no-store, max-age=0, must-revalidate','x-kk-sheet-source':'public-gviz-fallback'}),text:async()=>'package_id,event_id,available_count\nPKG-1,EVT-1,2'},
    {status:200,headers:headers({'cache-control':'no-store, max-age=0','x-frame-options':'DENY','x-robots-tag':'noindex, nofollow','content-security-policy':"default-src 'none'; frame-ancestors 'none'; form-action 'self'"}),text:async()=>'<html></html>'}
  ];
  const audit=await Watch.runtimeSelfAudit(async()=>responses.shift());
  assert.equal(audit.status,'PASS');
  assert.deepEqual(audit.failed_checks,[]);
  assert.equal(audit.production_writes,0);
  assert.equal(audit.business_writes,0);
});

test('runtime self-audit fails closed on cached public feed or leaked internal token',async()=>{
  const responses=[
    {status:200,headers:headers(),text:async()=>'<html></html>'},
    {status:200,headers:headers({'cache-control':'s-maxage=15','x-kk-sheet-source':'public-gviz-fallback'}),text:async()=>'event_id,event_name,poster_image_url,action_for_web\nEVT-1,Event,,show'},
    {status:200,headers:headers({'cache-control':'no-store','x-kk-sheet-source':'public-gviz-fallback'}),text:async()=>'package_id,event_id,available_count\nPKG-1,EVT-1,2,OWNER_PRICE_ADJUST_2026-09-28'},
    {status:200,headers:headers({'cache-control':'no-store','x-frame-options':'DENY','x-robots-tag':'noindex','content-security-policy':"frame-ancestors 'none'; form-action 'self'"}),text:async()=>''}
  ];
  const audit=await Watch.runtimeSelfAudit(async()=>responses.shift());
  assert.equal(audit.status,'FAIL');
  assert.ok(audit.failed_checks.includes('EVENT_FEED_NO_STORE'));
  assert.ok(audit.failed_checks.includes('PACKAGE_FEED_INTERNAL_TEXT_CLEAN'));
});

test('classification waits instead of accepting an older READY deployment as current main',()=>{
  const oldReady=deployment({sha:'b'.repeat(40),state:'READY'});
  const building=deployment({sha:'a'.repeat(40),state:'BUILDING',created:2});
  const result=Watch.classifyState({
    serving:oldReady,
    latestAttempt:building,
    mainAttempt:building,
    productionMatchesCurrentMain:false,
    productionContainsFix:true,
    runtimeAudit:null,
    probe:null
  });
  assert.equal(result.state,'CURRENT_MAIN_DEPLOYMENT_PENDING');
  assert.equal(result.severity,'waiting');
});

test('runtime audit failure blocks acceptance of current main',()=>{
  const serving=deployment();
  const result=Watch.classifyState({
    serving,
    latestAttempt:serving,
    mainAttempt:serving,
    productionMatchesCurrentMain:true,
    productionContainsFix:true,
    runtimeAudit:{status:'FAIL',failed_checks:['EVENT_FEED_NO_STORE']},
    probe:{analytics_head_status:401,admin_auth_status:200,admin_auth_authenticated:false}
  });
  assert.equal(result.state,'PRODUCTION_RUNTIME_AUDIT_FAILED');
  assert.equal(result.severity,'error');
});

test('cross-feed integrity parses quoted CSV and rejects duplicate identities and orphan packages',()=>{
  const goodEvents='event_id,event_name\nEVT-1,"A, Bangkok"\nEVT-2,B';
  const goodPkgs='package_id,event_id,available_count\r\nPKG-1,EVT-1,2\r\nPKG-2,EVT-2,1';
  assert.equal(Watch.crossFeedIntegrity(goodEvents,goodPkgs).ok,true);

  const badEvents='event_id,event_name\nEVT-1,A\nEVT-1,A duplicate';
  const badPkgs='package_id,event_id,available_count\nPKG-1,EVT-1,2\nPKG-1,EVT-MISSING,1';
  const bad=Watch.crossFeedIntegrity(badEvents,badPkgs);
  assert.equal(bad.ok,false);
  assert.deepEqual(bad.duplicate_event_ids,['EVT-1']);
  assert.deepEqual(bad.duplicate_package_ids,['PKG-1']);
  assert.deepEqual(bad.orphan_package_ids,['PKG-1']);
});

test('cross-feed integrity strips UTF-8 BOM and preserves embedded newlines inside quoted cells',()=>{
  const events='\uFEFFevent_id,event_name\nEVT-1,"Artist\nFan Event"';
  const packages='package_id,event_id,available_count\nPKG-1,EVT-1,2';
  const result=Watch.crossFeedIntegrity(events,packages);
  assert.equal(result.ok,true);
  assert.equal(result.event_count,1);
  assert.equal(result.package_count,1);
});

