'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');

test('GitHub OIDC witness Edge Function is pinned to exact repo/main/schedule workflow',()=>{
  const source=fs.readFileSync(
    path.join(root,'supabase','functions','kk-runtime-ledger-github-witness','index.ts'),
    'utf8'
  );
  assert.match(source,/ISSUER = "https:\/\/token\.actions\.githubusercontent\.com"/);
  assert.match(source,/repository !== REPOSITORY/);
  assert.match(source,/repository_id/);
  assert.match(source,/repository_owner_id/);
  assert.match(source,/p\.ref !== REF/);
  assert.match(source,/p\.event_name !== EVENT_NAME/);
  assert.match(source,/p\.workflow_ref !== WORKFLOW_REF/);
  assert.match(source,/EVENT_NAME = "schedule"/);
  assert.match(source,/refs\/heads\/main/);
  assert.match(source,/kk-external-witness-clock\.yml@refs\/heads\/main/);
});

test('GitHub OIDC witness path is witness-only and writes only runtime expectations',()=>{
  const source=fs.readFileSync(
    path.join(root,'supabase','functions','kk-runtime-ledger-github-witness','index.ts'),
    'utf8'
  );
  assert.match(source,/SOURCE = "GITHUB_ACTIONS_CRON"/);
  assert.match(source,/VERSION = "kk-scanner-github-witness-v1"/);
  assert.match(source,/MODE = "WITNESS_ONLY"/);
  assert.match(source,/rest\/v1\/kk_runtime_expectations/);
  assert.match(source,/resolution=ignore-duplicates/);
  assert.match(source,/business_writes: 0/g);
  assert.match(source,/scanner_execution_started: false/);
  assert.doesNotMatch(source,/Candidate|Booking|Inventory|Pricing|Notification_Ledger/);
});

test('scheduled GitHub witness clock uses OIDC only and has no secret dependency',()=>{
  const source=fs.readFileSync(
    path.join(root,'.github','workflows','kk-external-witness-clock.yml'),
    'utf8'
  );
  assert.match(source,/cron:\s*'0 \* \* \* \*'/);
  assert.match(source,/id-token:\s*write/);
  assert.match(source,/ACTIONS_ID_TOKEN_REQUEST_URL/);
  assert.match(source,/ACTIONS_ID_TOKEN_REQUEST_TOKEN/);
  assert.match(source,/GITHUB_ACTIONS_CRON/);
  assert.match(source,/kk-scanner-github-witness-v1/);
  assert.doesNotMatch(source,/workflow_dispatch/);
  assert.doesNotMatch(source,/secrets\./);
  assert.doesNotMatch(source,/VERCEL_TOKEN|SUPABASE_SECRET_KEY|CLOUDFLARE/);
});

test('Supabase config keeps custom OIDC verification at the function boundary',()=>{
  const source=fs.readFileSync(path.join(root,'supabase','config.toml'),'utf8');
  assert.match(source,/\[functions\.kk-runtime-ledger-github-witness\]/);
  assert.match(source,/verify_jwt\s*=\s*false/);
});
