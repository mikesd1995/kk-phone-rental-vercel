'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const workflowPath=path.join(root,'.github','workflows','kk-external-witness-clock.yml');
const edgePath=path.join(root,'supabase','functions','kk-runtime-ledger-github-witness','index.ts');
const migrationPath=path.join(root,'supabase','migrations','20260921193000_github_oidc_witness_control.sql');
const ledgerPath=path.join(root,'supabase','staging','kk-runtime-ledger-v1.sql');
const retirementPath=path.join(root,'docs','GITHUB_OIDC_WITNESS_RETIREMENT_2026-09-28.md');

test('scheduled GitHub witness workflow is retired from the active tree',()=>{
  assert.equal(fs.existsSync(workflowPath),false);
});

test('historical GitHub OIDC witness Edge remains fail-closed and witness-only',()=>{
  const source=fs.readFileSync(edgePath,'utf8');
  assert.match(source,/ISSUER = "https:\/\/token\.actions\.githubusercontent\.com"/);
  assert.match(source,/EVENT_NAME = "schedule"/);
  assert.match(source,/CONTROL_KEY = "github_oidc_witness_v1"/);
  assert.match(source,/WITNESS_KILL_SWITCH_DISABLED/);
  assert.match(source,/MODE = "WITNESS_ONLY"/);
  assert.match(source,/rest\/v1\/kk_runtime_expectations/);
  assert.match(source,/business_writes: 0/g);
  assert.match(source,/scanner_execution_started: false/);
  assert.doesNotMatch(source,/Candidate|Booking|Inventory|Pricing|Notification_Ledger/);
});

test('witness control migration remains disabled by default and service-role only',()=>{
  const source=fs.readFileSync(migrationPath,'utf8');
  assert.match(source,/github_oidc_witness_v1/);
  assert.match(source,/enabled boolean not null default false/);
  assert.match(source,/values\s*\(\s*'github_oidc_witness_v1'\s*,\s*false/);
  assert.match(source,/enable row level security/);
  assert.match(source,/revoke all on table public\.kk_control_plane_config from public, anon, authenticated/);
  assert.match(source,/grant select, update on table public\.kk_control_plane_config to service_role/);
});

test('historical witness ledger still enforces one persisted expectation per represented slot',()=>{
  const source=fs.readFileSync(ledgerPath,'utf8');
  assert.match(source,/occurrence_id text primary key/);
  assert.match(source,/unique \(role, scheduled_at\)/);
  assert.match(source,/unique \(nonce\)/);
});

test('retirement contract forbids replacement clocks, backfill, and witness reactivation',()=>{
  const source=fs.readFileSync(retirementPath,'utf8');
  assert.match(source,/Status:\s*\*\*RETIRED/);
  assert.match(source,/github_oidc_witness_v1=false/);
  assert.match(source,/no backfill/i);
  assert.match(source,/do not create a replacement witness clock/i);
  assert.match(source,/6ab272b36b1881919577ff3367fa8245/);
  assert.match(source,/6ab7e060fa788191b5f17a7028494c3a/);
});
