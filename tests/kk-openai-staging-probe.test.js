'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');

function fakeReq({method='POST',headers={},body='{}'}={}){
  const chunks=[Buffer.from(body)];
  return {
    method,
    headers,
    async *[Symbol.asyncIterator](){for(const chunk of chunks) yield chunk;}
  };
}
function fakeRes(){
  return {
    statusCode:0,headers:{},body:'',
    setHeader(k,v){this.headers[String(k).toLowerCase()]=v;},
    end(v=''){this.body=String(v);}
  };
}

test('OpenAI staging runtime probe is preview-only and zero-write',async()=>{
  const old={VERCEL_ENV:process.env.VERCEL_ENV,VERCEL_GIT_COMMIT_REF:process.env.VERCEL_GIT_COMMIT_REF};
  process.env.VERCEL_ENV='production';
  process.env.VERCEL_GIT_COMMIT_REF='main';
  delete require.cache[require.resolve('../api/kk-openai-staging-probe.js')];
  const handler=require('../api/kk-openai-staging-probe.js');
  const res=fakeRes();
  await handler(fakeReq({headers:{'x-vercel-protection-bypass':'fixture'},body:JSON.stringify({confirm:'RUN_OPENAI_STAGING_PROBE'})}),res);
  const body=JSON.parse(res.body);
  assert.equal(res.statusCode,404);
  assert.equal(body.status,'PREVIEW_ONLY');
  assert.equal(body.production_writes,0);
  if(old.VERCEL_ENV===undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV=old.VERCEL_ENV;
  if(old.VERCEL_GIT_COMMIT_REF===undefined) delete process.env.VERCEL_GIT_COMMIT_REF; else process.env.VERCEL_GIT_COMMIT_REF=old.VERCEL_GIT_COMMIT_REF;
});

test('OpenAI staging runtime probe requires protected automation header',async()=>{
  const old={VERCEL_ENV:process.env.VERCEL_ENV,VERCEL_GIT_COMMIT_REF:process.env.VERCEL_GIT_COMMIT_REF};
  process.env.VERCEL_ENV='preview';
  process.env.VERCEL_GIT_COMMIT_REF='feat/openai-platform-agent-layer-v1';
  delete require.cache[require.resolve('../api/kk-openai-staging-probe.js')];
  const handler=require('../api/kk-openai-staging-probe.js');
  const res=fakeRes();
  await handler(fakeReq({body:JSON.stringify({confirm:'RUN_OPENAI_STAGING_PROBE'})}),res);
  const body=JSON.parse(res.body);
  assert.equal(res.statusCode,403);
  assert.equal(body.status,'PROTECTED_AUTOMATION_REQUIRED');
  assert.equal(body.production_writes,0);
  if(old.VERCEL_ENV===undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV=old.VERCEL_ENV;
  if(old.VERCEL_GIT_COMMIT_REF===undefined) delete process.env.VERCEL_GIT_COMMIT_REF; else process.env.VERCEL_GIT_COMMIT_REF=old.VERCEL_GIT_COMMIT_REF;
});

test('safeAi strips model result to non-secret diagnostics',()=>{
  const handler=require('../api/kk-openai-staging-probe.js');
  const out=handler.safeAi({result:{status:'BLOCKED_OPENAI_PROVIDER',production_writes:0,ai_review:{status:'BLOCKED_OPENAI_PROVIDER',model:'gpt-test',blocker:'OPENAI_HTTP_ERROR',http_status:401,provider_error_type:'invalid_request_error',provider_error_code:'invalid_api_key',request_id:'req_fixture',secret:'must-not-escape'}}});
  assert.deepEqual(out,{status:'BLOCKED_OPENAI_PROVIDER',ai_status:'BLOCKED_OPENAI_PROVIDER',model:'gpt-test',blocker:'OPENAI_HTTP_ERROR',http_status:401,provider_error_type:'invalid_request_error',provider_error_code:'invalid_api_key',request_id:'req_fixture',production_writes:0});
  assert.equal(JSON.stringify(out).includes('must-not-escape'),false);
});
