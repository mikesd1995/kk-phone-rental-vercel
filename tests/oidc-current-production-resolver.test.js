'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Resolver=require('../scripts/resolve-current-production');

const SHA='a'.repeat(40);
const OLD='b'.repeat(40);

function dep(id,{
  sha=SHA,
  ref='main',
  state='READY',
  target='production',
  created=1
}={}){
  return {
    id,
    readyState:state,
    target,
    created,
    meta:{githubCommitSha:sha,githubCommitRef:ref}
  };
}

test('parseArgs accepts only exact expected SHA input',()=>{
  assert.deepEqual(
    Resolver.parseArgs(['--expected-sha',SHA]),
    {expectedCommitSha:SHA}
  );
  assert.throws(
    ()=>Resolver.parseArgs(['--source-deployment','dpl_x']),
    /UNKNOWN_ARGUMENT/
  );
});

test('resolver picks newest READY production deployment for exact main SHA',()=>{
  const out=Resolver.resolveExactCurrentProduction([
    dep('dpl_old',{created:10}),
    dep('dpl_new',{created:20}),
    dep('dpl_wrong_sha',{sha:OLD,created:30}),
    dep('dpl_preview',{target:'preview',created:40}),
    dep('dpl_error',{state:'ERROR',created:50})
  ],SHA);
  assert.equal(out.deployment_id,'dpl_new');
  assert.equal(out.deployment_sha,SHA);
  assert.equal(out.deployment_ref,'main');
  assert.equal(out.deployment_state,'READY');
  assert.equal(out.deployment_target,'production');
  assert.equal(out.candidate_count,2);
});

test('resolver rejects stale, non-main, or non-ready deployment sets',()=>{
  assert.throws(
    ()=>Resolver.resolveExactCurrentProduction([
      dep('dpl_stale',{sha:OLD}),
      dep('dpl_branch',{ref:'feature'}),
      dep('dpl_building',{state:'BUILDING'})
    ],SHA),
    /EXACT_CURRENT_MAIN_PRODUCTION_NOT_FOUND/
  );
});

test('resolver requires a canonical 40-char SHA',()=>{
  assert.throws(
    ()=>Resolver.resolveExactCurrentProduction([dep('dpl_x')],'abc'),
    /EXPECTED_SHA_REQUIRED/
  );
});

test('Vercel list resolution is GET-only and secret-safe',async()=>{
  const calls=[];
  const transport={
    async request(method,path,body){
      calls.push({method,path,body});
      return {deployments:[dep('dpl_exact',{created:99})]};
    }
  };
  const out=await Resolver.resolveFromVercel({transport,expectedCommitSha:SHA});
  assert.equal(out.deployment_id,'dpl_exact');
  assert.equal(calls.length,1);
  assert.equal(calls[0].method,'GET');
  assert.match(calls[0].path,/\/v13\/deployments\?/);
  assert.match(calls[0].path,/target=production/);
  assert.equal(calls[0].body,undefined);
});
