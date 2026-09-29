'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const workflowPath=path.join(__dirname,'..','.github','workflows','gpt6-shadow-live-acceptance.yml');

test('live GPT-6 workflow is owner-authorized, label-gated, OIDC-only and zero-write',()=>{
  const w=fs.readFileSync(workflowPath,'utf8');

  assert.match(w,/pull_request:[\s\S]*types:\s*\[labeled\]/);
  assert.match(w,/github\.event\.pull_request\.number\s*==\s*314/);
  assert.match(w,/github\.actor\s*==\s*github\.repository_owner/);
  assert.match(w,/github\.event\.pull_request\.head\.ref\s*==\s*'feat\/gpt6-shadow-runtime-20260929'/);
  assert.match(w,/gpt6-live-eval/);

  assert.match(w,/VERCEL_TOKEN:\s*\$\{\{ secrets\.VERCEL_TOKEN \}\}/);
  assert.match(w,/vercel env pull[\s\S]*--environment=preview/);
  assert.match(w,/::add-mask::/);
  assert.match(w,/VERCEL_OIDC_TOKEN/);
  assert.match(w,/node scripts\/kk-gpt6-shadow-readiness\.js/);

  assert.match(w,/KK_GPT6_SHADOW_TRANSPORT:\s*vercel_ai_gateway/);
  assert.match(w,/KK_GPT6_SHADOW_ALLOW_ENV_OIDC:\s*'true'/);
  assert.match(w,/KK_GPT6_SHADOW_ENABLED:\s*'true'/);
  assert.match(w,/node scripts\/kk-gpt6-shadow-eval\.js/);
  assert.match(w,/node scripts\/kk-gpt6-zero-write-acceptance\.js/);

  assert.doesNotMatch(w,/secrets\.OPENAI_API_KEY/);
  assert.doesNotMatch(w,/secrets\.AI_GATEWAY_API_KEY/);
  assert.doesNotMatch(w,/vercel deploy/);
  assert.doesNotMatch(w,/--prod/);
  assert.doesNotMatch(w,/production_writes\s*:\s*[1-9]/i);
});

test('live GPT-6 workflow uploads only secret-safe acceptance reports',()=>{
  const w=fs.readFileSync(workflowPath,'utf8');
  assert.match(w,/actions\/upload-artifact@v4/);
  assert.match(w,/gpt6-shadow-eval\.json/);
  assert.match(w,/gpt6-zero-write\.json/);
  assert.doesNotMatch(w,/\.env\.gpt6-shadow/);
  assert.doesNotMatch(w,/\/tmp\/gpt6-shadow\.env[\s\S]*upload-artifact/);
});
