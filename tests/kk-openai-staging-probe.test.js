'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Probe=require('../server/kk-openai-staging-probe.js');

function fakeReq({method='POST',url='/api/kk-intelligence-health?mode=openai-staging',body='{}'}={}){
  const chunks=[Buffer.from(body)];
  return {method,url,headers:{},async *[Symbol.asyncIterator](){for(const chunk of chunks) yield chunk;}};
}
function fakeRes(){return {statusCode:0,body:''};}
function writer(res,status,body){res.statusCode=status;res.body=JSON.stringify(body||{});}
function saveEnv(names){const out={};for(const name of names) out[name]=process.env[name];return out;}
function restoreEnv(snapshot){for(const [name,value] of Object.entries(snapshot)){if(value===undefined) delete process.env[name];else process.env[name]=value;}}
const ENV_NAMES=['VERCEL_ENV','VERCEL_GIT_COMMIT_REF','VERCEL_GIT_COMMIT_SHA','KK_OPENAI_PLATFORM_ENABLED','KK_ALLOW_PAID_EXTERNAL_AI','KK_OPENAI_ALLOW_CUSTOMER_DATA','OPENAI_API_KEY'];

test('OpenAI staging mode is explicit',()=>{
  assert.equal(Probe.requested({url:'/api/kk-intelligence-health'}),false);
  assert.equal(Probe.requested({url:'/api/kk-intelligence-health?mode=project-memory'}),false);
  assert.equal(Probe.requested({url:'/api/kk-intelligence-health?mode=openai-staging'}),true);
});

test('zero-cost staging probe is Preview-only and zero-write',async()=>{
  const old=saveEnv(ENV_NAMES);
  process.env.VERCEL_ENV='production';
  process.env.VERCEL_GIT_COMMIT_REF='main';
  try{
    const res=fakeRes();
    await Probe.handle(fakeReq({body:JSON.stringify({confirm:'RUN_OPENAI_STAGING_PROBE'})}),res,{json:writer});
    const body=JSON.parse(res.body);
    assert.equal(res.statusCode,404);
    assert.equal(body.status,'PREVIEW_ONLY');
    assert.equal(body.production_writes,0);
  }finally{restoreEnv(old);}
});

test('zero-cost staging probe is POST-only',async()=>{
  const old=saveEnv(ENV_NAMES);
  process.env.VERCEL_ENV='preview';
  process.env.VERCEL_GIT_COMMIT_REF='feat/openai-platform-agent-layer-v1';
  try{
    const res=fakeRes();
    await Probe.handle(fakeReq({method:'GET'}),res,{json:writer});
    assert.equal(res.statusCode,405);
    assert.equal(JSON.parse(res.body).status,'METHOD_NOT_ALLOWED');
  }finally{restoreEnv(old);}
});

test('zero-cost staging probe requires explicit confirmation',async()=>{
  const old=saveEnv(ENV_NAMES);
  process.env.VERCEL_ENV='preview';
  process.env.VERCEL_GIT_COMMIT_REF='feat/openai-platform-agent-layer-v1';
  try{
    const res=fakeRes();
    await Probe.handle(fakeReq(),res,{json:writer});
    assert.equal(res.statusCode,400);
    assert.equal(JSON.parse(res.body).status,'CONFIRMATION_REQUIRED');
  }finally{restoreEnv(old);}
});

test('zero-cost staging probe proves stale OpenAI enable flag cannot trigger paid provider',async()=>{
  const old=saveEnv(ENV_NAMES);
  process.env.VERCEL_ENV='preview';
  process.env.VERCEL_GIT_COMMIT_REF='feat/openai-platform-agent-layer-v1';
  process.env.VERCEL_GIT_COMMIT_SHA='0123456789012345678901234567890123456789';
  process.env.KK_OPENAI_PLATFORM_ENABLED='true';
  delete process.env.KK_ALLOW_PAID_EXTERNAL_AI;
  delete process.env.KK_OPENAI_ALLOW_CUSTOMER_DATA;
  process.env.OPENAI_API_KEY='sk-proj-testfixture1234567890';
  try{
    const res=fakeRes();
    await Probe.handle(fakeReq({body:JSON.stringify({confirm:'RUN_OPENAI_STAGING_PROBE'})}),res,{json:writer});
    const body=JSON.parse(res.body);
    assert.equal(res.statusCode,200);
    assert.equal(body.ok,true);
    assert.equal(body.status,'ZERO_COST_POLICY_ACTIVE');
    assert.equal(body.platform_requested,true);
    assert.equal(body.platform_enabled,false);
    assert.equal(body.paid_external_ai_allowed,false);
    assert.equal(body.zero_cost_mode,true);
    assert.equal(body.provider_requests,0);
    assert.equal(body.storefront.ai_status,'DISABLED_ZERO_COST_POLICY');
    assert.equal(body.discovery.ai_status,'DISABLED_ZERO_COST_POLICY');
    assert.equal(body.production_writes,0);
  }finally{restoreEnv(old);}
});

test('zero-cost staging probe fails closed if paid external AI waiver is present',async()=>{
  const old=saveEnv(ENV_NAMES);
  process.env.VERCEL_ENV='preview';
  process.env.VERCEL_GIT_COMMIT_REF='feat/openai-platform-agent-layer-v1';
  process.env.KK_OPENAI_PLATFORM_ENABLED='true';
  process.env.KK_ALLOW_PAID_EXTERNAL_AI='true';
  delete process.env.KK_OPENAI_ALLOW_CUSTOMER_DATA;
  process.env.OPENAI_API_KEY='sk-proj-testfixture1234567890';
  try{
    const res=fakeRes();
    await Probe.handle(fakeReq({body:JSON.stringify({confirm:'RUN_OPENAI_STAGING_PROBE'})}),res,{json:writer});
    const body=JSON.parse(res.body);
    assert.equal(res.statusCode,409);
    assert.equal(body.status,'PAID_EXTERNAL_AI_FORBIDDEN_BY_ZERO_COST_POLICY');
    assert.equal(body.production_writes,0);
  }finally{restoreEnv(old);}
});

test('zero-cost staging probe keeps customer-data AI disabled',async()=>{
  const old=saveEnv(ENV_NAMES);
  process.env.VERCEL_ENV='preview';
  process.env.VERCEL_GIT_COMMIT_REF='feat/openai-platform-agent-layer-v1';
  process.env.KK_OPENAI_PLATFORM_ENABLED='true';
  delete process.env.KK_ALLOW_PAID_EXTERNAL_AI;
  process.env.KK_OPENAI_ALLOW_CUSTOMER_DATA='true';
  try{
    const res=fakeRes();
    await Probe.handle(fakeReq({body:JSON.stringify({confirm:'RUN_OPENAI_STAGING_PROBE'})}),res,{json:writer});
    const body=JSON.parse(res.body);
    assert.equal(res.statusCode,409);
    assert.equal(body.status,'CUSTOMER_DATA_GATE_MUST_STAY_DISABLED');
    assert.equal(body.production_writes,0);
  }finally{restoreEnv(old);}
});

test('safeAi strips model result to non-secret diagnostics',()=>{
  const out=Probe.safeAi({result:{status:'BLOCKED_OPENAI_PROVIDER',production_writes:0,ai_review:{status:'BLOCKED_OPENAI_PROVIDER',model:'gpt-test',blocker:'OPENAI_HTTP_ERROR',http_status:401,provider_error_type:'invalid_request_error',provider_error_code:'invalid_api_key',request_id:'req_fixture',secret:'must-not-escape'}}});
  assert.deepEqual(out,{status:'BLOCKED_OPENAI_PROVIDER',ai_status:'BLOCKED_OPENAI_PROVIDER',model:'gpt-test',blocker:'OPENAI_HTTP_ERROR',http_status:401,provider_error_type:'invalid_request_error',provider_error_code:'invalid_api_key',request_id:'req_fixture',production_writes:0});
  assert.equal(JSON.stringify(out).includes('must-not-escape'),false);
});
