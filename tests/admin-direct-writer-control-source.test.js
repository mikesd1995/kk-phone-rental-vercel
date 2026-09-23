'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const Control=require('../server/admin-write-control-oidc');
const DedicatedWriter=require('../api/lib/admin-google-sheets-writer');
const DirectWriter=require('../server/admin-direct-writer');

test('write-control bridge is pinned to canonical Supabase project and function',()=>{
  assert.equal(Control.CONTROL_PROJECT_REF,'zehlsagzrpromtfqqflt');
  assert.equal(Control.CONTROL_FUNCTION,'kk-admin-write-control');
  assert.equal(Control.endpoint(),'https://zehlsagzrpromtfqqflt.supabase.co/functions/v1/kk-admin-write-control');
  assert.equal(Control.CONTROL_TIMEOUT_MS,5000);
});

test('write-control uses official Vercel OIDC helper and fails closed without token',async()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','server','admin-write-control-oidc.js'),'utf8');
  assert.match(source,/require\('@vercel\/functions\/oidc'\)/);
  assert.match(source,/getVercelOidcToken/);
  assert.doesNotMatch(source,/process\.env\.VERCEL_OIDC_TOKEN/);
  let calls=0;
  const result=await Control.health({
    getTokenImpl:async()=> '',
    fetchImpl:async()=>{calls+=1;throw new Error('must not call');}
  });
  assert.equal(result.ok,false);
  assert.equal(result.attempted,false);
  assert.equal(result.error_code,'VERCEL_OIDC_TOKEN_MISSING');
  assert.equal(calls,0);
});

test('dedicated writer credential namespace never inherits generic reader credentials',()=>{
  const generic={
    GOOGLE_SHEET_ID:DirectWriter.CORE_SHEET_ID,
    GOOGLE_SERVICE_ACCOUNT_EMAIL:'reader@example.test',
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:'reader-key',
    KK_ADMIN_DIRECT_WRITER_ENABLED:'1',
    KK_ADMIN_DIRECT_WRITER_ACCEPTED:'1',
    KK_ADMIN_DIRECT_WRITER_WRITE_PROBE_PASSED:'1'
  };
  assert.equal(DedicatedWriter.configState(generic).credentialsReady,false);
  assert.equal(DirectWriter.state(generic).credentials_ready,false);
  assert.equal(DirectWriter.state(generic).ready,false);
});

test('dedicated writer identity still requires enable acceptance and write probe',()=>{
  const env={
    GOOGLE_SHEET_ID:DirectWriter.CORE_SHEET_ID,
    GOOGLE_ADMIN_WRITER_SERVICE_ACCOUNT_EMAIL:'writer@example.test',
    GOOGLE_ADMIN_WRITER_SERVICE_ACCOUNT_PRIVATE_KEY:'writer-key'
  };
  const s=DirectWriter.state(env);
  assert.equal(s.credentials_ready,true);
  assert.equal(s.auth_mode,'dedicated_service_account');
  assert.equal(s.enabled,false);
  assert.equal(s.accepted,false);
  assert.equal(s.write_probe_passed,false);
  assert.equal(s.ready,false);
});

test('Supabase function config keeps custom Vercel OIDC verification enabled in handler',()=>{
  const config=fs.readFileSync(path.join(__dirname,'..','supabase','config.toml'),'utf8');
  assert.match(config,/\[functions\.kk-admin-write-control\]/);
  assert.match(config,/\[functions\.kk-admin-write-control\][\s\S]*verify_jwt\s*=\s*false/);
  const source=fs.readFileSync(path.join(__dirname,'..','supabase','functions','kk-admin-write-control','index.ts'),'utf8');
  assert.match(source,/TEAM_ID = "team_uaeOdVIjXMSW690ZM2wPuJyt"/);
  assert.match(source,/PROJECT_ID = "prj_snbAmpya7YGmOuMbv1o8T16ouxl6"/);
  assert.match(source,/ENVIRONMENT = "production"/);
  assert.match(source,/business_writes: 0/g);
  assert.match(source,/google_sheet_writes: 0/g);
});

test('admin write-control migrations preserve service-role-only access and single-row lock return',()=>{
  const first=fs.readFileSync(path.join(__dirname,'..','supabase','migrations','20260922130544_admin_write_lock_idempotency_v1.sql'),'utf8');
  assert.match(first,/revoke all on table public\.kk_admin_write_locks from anon, authenticated/i);
  assert.match(first,/grant select, insert, update, delete on table public\.kk_admin_write_locks to service_role/i);
  assert.match(first,/revoke all on function public\.kk_admin_lock_acquire\(text,text,integer\) from public, anon, authenticated/i);

  const finalMigration=fs.readFileSync(path.join(__dirname,'..','supabase','migrations','20260922130931_admin_write_lock_single_row_return_v1.sql'),'utf8');
  assert.match(finalMigration,/if found then[\s\S]*return query select true, v_token, v_lease;[\s\S]*return;[\s\S]*end if;/i);
});
