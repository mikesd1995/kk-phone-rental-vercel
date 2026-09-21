'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

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
  assert.match(source,/cron:\s*'7 \* \* \* \*'/);
  assert.match(source,/id-token:\s*write/);
  assert.match(source,/ACTIONS_ID_TOKEN_REQUEST_URL/);
  assert.match(source,/ACTIONS_ID_TOKEN_REQUEST_TOKEN/);
  assert.match(source,/GITHUB_ACTIONS_CRON/);
  assert.match(source,/kk-scanner-github-witness-v1/);
  assert.doesNotMatch(source,/workflow_dispatch/);
  assert.doesNotMatch(source,/secrets\./);
  assert.doesNotMatch(source,/VERCEL_TOKEN|SUPABASE_SECRET_KEY|CLOUDFLARE/);
  assert.match(source,/Math\.floor\(now\/HOUR_MS\)\*HOUR_MS/);
  assert.match(source,/occurrence_id:'SCANNER\|'\+scheduled_at/);
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
  assert.match(source,/values\s*\(\s*'github_oidc_witness_v1'\s*,\s*false/);
  assert.match(source,/enable row level security/);
  assert.match(source,/revoke all on table public\.kk_control_plane_config from public, anon, authenticated/);
  assert.match(source,/grant select, update on table public\.kk_control_plane_config to service_role/);
});


test('witness scheduler avoids minute zero while preserving top-hour occurrence semantics',()=>{
  const source=fs.readFileSync(
    path.join(root,'.github','workflows','kk-external-witness-clock.yml'),
    'utf8'
  );
  assert.match(source,/cron:\s*'7 \* \* \* \*'/);
  assert.doesNotMatch(source,/cron:\s*'0 \* \* \* \*'/);
  assert.match(source,/const scheduled=Math\.floor\(now\/HOUR_MS\)\*HOUR_MS;/);
  assert.match(source,/scheduled_at=bangkokIso\(scheduled\)/);
  assert.match(source,/issued_at:bangkokIso\(now\)/);
});


test('witness workflow emits Edge-compatible second-precision Bangkok timestamps',()=>{
  const source=fs.readFileSync(
    path.join(root,'.github','workflows','kk-external-witness-clock.yml'),
    'utf8'
  );
  const offsetLine=source.match(/const BANGKOK_OFFSET_MS=[^;]+;/)?.[0];
  const isoLine=source.match(/const bangkokIso=\(ms\)=>[^;]+;/)?.[0];
  assert.ok(offsetLine,'BANGKOK_OFFSET_MS helper missing');
  assert.ok(isoLine,'bangkokIso helper missing');
  const bangkokIso=vm.runInNewContext(
    `${offsetLine}\n${isoLine}\nbangkokIso`
  );
  const rendered=bangkokIso(Date.parse('2026-09-21T15:00:00Z'));
  assert.equal(rendered,'2026-09-21T22:00:00+07:00');
  assert.doesNotMatch(rendered,/\.\d{3}\+07:00$/);
  assert.match(source,/WITNESS_SCHEDULE_FORMAT_INVALID/);
  assert.match(source,/TOP_HOUR_BANGKOK\.test\(scheduled_at\)/);
});
