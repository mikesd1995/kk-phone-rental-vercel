'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Probe=require('../server/kk-openai-staging-probe.js');

function fakeReq({
  method='POST',
  url='/api/kk-intelligence-health?mode=openai-staging',
  headers={},
  body='{}'
}={}){
  const chunks=[Buffer.from(body)];
  return {
    method,
    url,
    headers,
    async *[Symbol.asyncIterator](){
      for(const chunk of chunks) yield chunk;
    }
  };
}

function fakeRes(){
  return {statusCode:0,body:''};
}

function writer(res,status,body){
  res.statusCode=status;
  res.body=JSON.stringify(body||{});
}

function saveEnv(names){
  const out={};
  for(const name of names) out[name]=process.env[name];
  return out;
}

function restoreEnv(snapshot){
  for(const [name,value] of Object.entries(snapshot)){
    if(value===undefined) delete process.env[name];
    else process.env[name]=value;
  }
}

test('OpenAI staging mode is explicit and leaves normal intelligence-health routes alone',()=>{
  assert.equal(Probe.requested({url:'/api/kk-intelligence-health'}),false);
  assert.equal(Probe.requested({url:'/api/kk-intelligence-health?mode=project-memory'}),false);
  assert.equal(Probe.requested({url:'/api/kk-intelligence-health?mode=openai-staging'}),true);
});

test('OpenAI staging probe is preview-only and zero-write',async()=>{
  const old=saveEnv(['VERCEL_ENV','VERCEL_GIT_COMMIT_REF']);
  process.env.VERCEL_ENV='production';
  process.env.VERCEL_GIT_COMMIT_REF='main';
  try{
    const res=fakeRes();
    await Probe.handle(fakeReq({
      headers:{'x-vercel-protection-bypass':'fixture'},
      body:JSON.stringify({confirm:'RUN_OPENAI_STAGING_PROBE'})
    }),res,{json:writer});
    const body=JSON.parse(res.body);
    assert.equal(res.statusCode,404);
    assert.equal(body.status,'PREVIEW_ONLY');
    assert.equal(body.production_writes,0);
  }finally{
    restoreEnv(old);
  }
});

test('OpenAI staging POST probe requires Vercel protected automation evidence',async()=>{
  const old=saveEnv(['VERCEL_ENV','VERCEL_GIT_COMMIT_REF']);
  process.env.VERCEL_ENV='preview';
  process.env.VERCEL_GIT_COMMIT_REF='feat/openai-platform-agent-layer-v1';
  try{
    const res=fakeRes();
    await Probe.handle(fakeReq({
      body:JSON.stringify({confirm:'RUN_OPENAI_STAGING_PROBE'})
    }),res,{json:writer});
    const body=JSON.parse(res.body);
    assert.equal(res.statusCode,403);
    assert.equal(body.status,'PROTECTED_AUTOMATION_REQUIRED');
    assert.equal(body.production_writes,0);
  }finally{
    restoreEnv(old);
  }
});

test('authenticated protected Preview GET probe accepts explicit query confirmation without a body',async()=>{
  const old=saveEnv([
    'VERCEL_ENV',
    'VERCEL_GIT_COMMIT_REF',
    'KK_OPENAI_PLATFORM_ENABLED',
    'OPENAI_API_KEY'
  ]);
  process.env.VERCEL_ENV='preview';
  process.env.VERCEL_GIT_COMMIT_REF='feat/openai-platform-agent-layer-v1';
  process.env.KK_OPENAI_PLATFORM_ENABLED='false';
  process.env.OPENAI_API_KEY='sk-proj-testfixture1234567890';
  try{
    const res=fakeRes();
    await Probe.handle(fakeReq({
      method:'GET',
      url:'/api/kk-intelligence-health?mode=openai-staging&confirm=RUN_OPENAI_STAGING_PROBE'
    }),res,{json:writer});
    const body=JSON.parse(res.body);
    assert.equal(res.statusCode,503);
    assert.equal(body.status,'OPENAI_PLATFORM_DISABLED');
    assert.equal(body.production_writes,0);
  }finally{
    restoreEnv(old);
  }
});

test('Preview GET probe still requires explicit confirmation',async()=>{
  const old=saveEnv(['VERCEL_ENV','VERCEL_GIT_COMMIT_REF']);
  process.env.VERCEL_ENV='preview';
  process.env.VERCEL_GIT_COMMIT_REF='feat/openai-platform-agent-layer-v1';
  try{
    const res=fakeRes();
    await Probe.handle(fakeReq({
      method:'GET',
      url:'/api/kk-intelligence-health?mode=openai-staging'
    }),res,{json:writer});
    const body=JSON.parse(res.body);
    assert.equal(res.statusCode,400);
    assert.equal(body.status,'CONFIRMATION_REQUIRED');
    assert.equal(body.production_writes,0);
  }finally{
    restoreEnv(old);
  }
});

test('safeAi strips model result to non-secret diagnostics',()=>{
  const out=Probe.safeAi({
    result:{
      status:'BLOCKED_OPENAI_PROVIDER',
      production_writes:0,
      ai_review:{
        status:'BLOCKED_OPENAI_PROVIDER',
        model:'gpt-test',
        blocker:'OPENAI_HTTP_ERROR',
        http_status:401,
        provider_error_type:'invalid_request_error',
        provider_error_code:'invalid_api_key',
        request_id:'req_fixture',
        secret:'must-not-escape'
      }
    }
  });
  assert.deepEqual(out,{
    status:'BLOCKED_OPENAI_PROVIDER',
    ai_status:'BLOCKED_OPENAI_PROVIDER',
    model:'gpt-test',
    blocker:'OPENAI_HTTP_ERROR',
    http_status:401,
    provider_error_type:'invalid_request_error',
    provider_error_code:'invalid_api_key',
    request_id:'req_fixture',
    production_writes:0
  });
  assert.equal(JSON.stringify(out).includes('must-not-escape'),false);
});
