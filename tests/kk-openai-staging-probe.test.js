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

test('OpenAI staging mode is explicit',()=>{
  assert.equal(Probe.requested({url:'/api/kk-intelligence-health'}),false);
  assert.equal(Probe.requested({url:'/api/kk-intelligence-health?mode=openai-staging'}),true);
});

test('OpenAI staging probe is Preview-only and zero-write',async()=>{
  const old=saveEnv(['VERCEL_ENV','VERCEL_GIT_COMMIT_REF']);
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

test('OpenAI staging probe is POST-only',async()=>{
  const old=saveEnv(['VERCEL_ENV','VERCEL_GIT_COMMIT_REF']);
  process.env.VERCEL_ENV='preview';
  process.env.VERCEL_GIT_COMMIT_REF='feat/openai-platform-agent-layer-v1';
  try{
    const res=fakeRes();
    await Probe.handle(fakeReq({method:'GET'}),res,{json:writer});
    assert.equal(res.statusCode,405);
    assert.equal(JSON.parse(res.body).status,'METHOD_NOT_ALLOWED');
  }finally{restoreEnv(old);}
});

test('OpenAI staging probe requires explicit confirmation',async()=>{
  const old=saveEnv(['VERCEL_ENV','VERCEL_GIT_COMMIT_REF']);
  process.env.VERCEL_ENV='preview';
  process.env.VERCEL_GIT_COMMIT_REF='feat/openai-platform-agent-layer-v1';
  try{
    const res=fakeRes();
    await Probe.handle(fakeReq(),res,{json:writer});
    assert.equal(res.statusCode,400);
    assert.equal(JSON.parse(res.body).status,'CONFIRMATION_REQUIRED');
  }finally{restoreEnv(old);}
});

test('safeAi strips model output to non-secret diagnostics',()=>{
  const out=Probe.safeAi({result:{status:'BLOCKED_OPENAI_PROVIDER',production_writes:0,ai_review:{status:'BLOCKED_OPENAI_PROVIDER',model:'gpt-test',blocker:'OPENAI_HTTP_ERROR',http_status:401,provider_error_type:'invalid_request_error',provider_error_code:'invalid_api_key',request_id:'req_fixture',secret:'must-not-escape'}}});
  assert.deepEqual(out,{status:'BLOCKED_OPENAI_PROVIDER',ai_status:'BLOCKED_OPENAI_PROVIDER',model:'gpt-test',blocker:'OPENAI_HTTP_ERROR',http_status:401,provider_error_type:'invalid_request_error',provider_error_code:'invalid_api_key',request_id:'req_fixture',production_writes:0});
  assert.equal(JSON.stringify(out).includes('must-not-escape'),false);
});
