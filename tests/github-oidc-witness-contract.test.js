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
  assert.match(source,/rest\/v1\/kk_control_plane_config/);
  assert.match(source,/CONTROL_KEY = "github_oidc_witness_v1"/);
  assert.match(source,/WITNESS_KILL_SWITCH_DISABLED/);
  assert.match(source,/body\.length !== 1/);
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


test('witness control migration defaults disabled and is service-role only',()=>{
  const source=fs.readFileSync(
    path.join(root,'supabase','migrations','20260921193000_github_oidc_witness_control.sql'),
    'utf8'
  );
  assert.match(source,/github_oidc_witness_v1/);
  assert.match(source,/enabled boolean not null default false/);
  assert.match(source,/values \('github_oidc_witness_v1', false/);
  assert.match(source,/enable row level security/);
  assert.match(source,/revoke all on table public\.kk_control_plane_config from public, anon, authenticated/);
  assert.match(source,/grant select, update on table public\.kk_control_plane_config to service_role/);
});
