'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const Control=require('../server/admin-write-control-oidc');
const Writer=require('../api/lib/admin-google-sheets-writer');
const SnapshotV6=require('../api/kk-admin-snapshot-v6');

const TOKEN='header.payload.signature';

test('Admin write-control bridge is pinned to canonical Supabase control function',()=>{
  assert.equal(Control.CONTROL_PROJECT_REF,'zehlsagzrpromtfqqflt');
  assert.equal(Control.CONTROL_FUNCTION,'kk-admin-write-control');
  assert.equal(
    Control.endpoint(),
    'https://zehlsagzrpromtfqqflt.supabase.co/functions/v1/kk-admin-write-control'
  );
  assert.equal(Control.CONTROL_TIMEOUT_MS,5000);
});

test('Admin write-control bridge uses supported Vercel OIDC helper and never direct token env access',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','server','admin-write-control-oidc.js'),'utf8');
  assert.match(source,/require\('@vercel\/functions\/oidc'\)/);
  assert.match(source,/getVercelOidcToken/);
  assert.doesNotMatch(source,/process\.env\.VERCEL_OIDC_TOKEN/);
  assert.doesNotMatch(source,/x-vercel-oidc-token/i);
});

test('missing Vercel OIDC token fails closed before control network access',async()=>{
  let calls=0;
  const result=await Control.health({
    getTokenImpl:async()=>'',
    fetchImpl:async()=>{calls+=1;throw new Error('must not call');}
  });
  assert.equal(result.ok,false);
  assert.equal(result.attempted,false);
  assert.equal(result.error_code,'VERCEL_OIDC_TOKEN_MISSING');
  assert.equal(result.business_writes,0);
  assert.equal(result.google_sheet_writes,0);
  assert.equal(calls,0);
});

test('control health forwards OIDC only in Authorization and returns sanitized status',async()=>{
  let captured;
  const result=await Control.health({
    getTokenImpl:async()=>TOKEN,
    fetchImpl:async(url,options)=>{
      captured={url,options};
      return {
        ok:true,
        status:200,
        async json(){
          return {
            ok:true,
            authenticated:true,
            version:'kk-admin-write-control-v1',
            configured:true,
            scope:'core-admin',
            fencing_token:7,
            lock_held:false,
            business_writes:0,
            google_sheet_writes:0
          };
        }
      };
    }
  });
  assert.equal(result.ok,true);
  assert.equal(result.authenticated,true);
  assert.equal(result.version,'kk-admin-write-control-v1');
  assert.equal(result.fencing_token,7);
  assert.equal(captured.options.method,'POST');
  assert.equal(captured.options.headers.Authorization,`Bearer ${TOKEN}`);
  assert.deepEqual(JSON.parse(captured.options.body),{version:'v1',action:'health'});
  assert.doesNotMatch(captured.url,/header\.payload\.signature/);
  assert.doesNotMatch(JSON.stringify(result),/header\.payload\.signature/);
});

test('control acquire uses a bounded 60-second lease contract',async()=>{
  let request;
  const result=await Control.acquire('admin-test-request-001',{
    leaseSeconds:60,
    getTokenImpl:async()=>TOKEN,
    fetchImpl:async(_url,options)=>{
      request=JSON.parse(options.body);
      return {
        ok:true,
        status:200,
        async json(){
          return {
            ok:true,authenticated:true,acquired:true,fencing_token:8,
            lease_until:'2026-09-22T13:30:00Z',business_writes:0,google_sheet_writes:0
          };
        }
      };
    }
  });
  assert.equal(result.acquired,true);
  assert.equal(result.fencing_token,8);
  assert.deepEqual(request,{
    version:'v1',action:'acquire',request_id:'admin-test-request-001',lease_seconds:60
  });
});

test('dedicated Google writer does not inherit generic read-only service-account credentials',()=>{
  const state=Writer.configState({
    GOOGLE_SHEET_ID:'sheet-1',
    GOOGLE_SERVICE_ACCOUNT_EMAIL:'reader@example.test',
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:'reader-key',
    KK_ADMIN_DIRECT_WRITER_ENABLED:'1'
  });
  assert.equal(state.enabled,true);
  assert.equal(state.credentialsReady,false);
  assert.equal(state.configured,false);
  assert.equal(state.authMode,'none');
});

test('dedicated Google writer recognizes only dedicated credentials and stays disabled by default',()=>{
  const env={
    GOOGLE_SHEET_ID:'sheet-1',
    GOOGLE_ADMIN_WRITER_SERVICE_ACCOUNT_EMAIL:'writer@example.test',
    GOOGLE_ADMIN_WRITER_SERVICE_ACCOUNT_PRIVATE_KEY:'writer-key'
  };
  const state=Writer.configState(env);
  assert.equal(state.credentialsReady,true);
  assert.equal(state.configured,true);
  assert.equal(state.enabled,false);
  assert.equal(state.authMode,'dedicated_service_account');
  assert.equal(state.scope,'https://www.googleapis.com/auth/spreadsheets');
});

test('writer mutation is blocked by feature gate before token exchange or network access',async()=>{
  let calls=0;
  await assert.rejects(
    ()=>Writer.updateValues({
      sheetId:'sheet-1',
      range:'Tab!A1',
      values:[['x']],
      env:{
        GOOGLE_ADMIN_WRITER_SERVICE_ACCOUNT_EMAIL:'writer@example.test',
        GOOGLE_ADMIN_WRITER_SERVICE_ACCOUNT_PRIVATE_KEY:'not-needed-because-disabled'
      },
      fetchImpl:async()=>{calls+=1;throw new Error('must not call');}
    }),
    err=>err&&err.code==='ADMIN_DIRECT_WRITER_DISABLED'
  );
  assert.equal(calls,0);
});

test('writer health without dedicated credential is read-only and does not use network',async()=>{
  let calls=0;
  const result=await Writer.health({
    env:{GOOGLE_SHEET_ID:'sheet-1'},
    fetchImpl:async()=>{calls+=1;throw new Error('must not call');}
  });
  assert.equal(result.ok,false);
  assert.equal(result.configured,false);
  assert.equal(result.enabled,false);
  assert.equal(result.error_code,'ADMIN_WRITER_NOT_CONFIGURED');
  assert.equal(calls,0);
});

test('v6 direct-writer health payload separates control readiness from writer activation',()=>{
  const p=SnapshotV6._test.directWriterHealthPayload(
    {ok:true,authenticated:true,version:'kk-admin-write-control-v1',business_writes:0,google_sheet_writes:0},
    {ok:false,configured:false,enabled:false,error_code:'ADMIN_WRITER_NOT_CONFIGURED'}
  );
  assert.equal(p.ok,true);
  assert.equal(p.stage,'WRITER_CREDENTIAL_PENDING');
  assert.equal(p.direct_writer_ready,false);
  assert.equal(p.business_writes,0);
  assert.equal(p.google_sheet_writes,0);
});

test('Supabase write-control Edge Function verifies exact Vercel Production identity and keeps Google writes at zero',()=>{
  const source=fs.readFileSync(
    path.join(__dirname,'..','supabase','functions','kk-admin-write-control','index.ts'),
    'utf8'
  );
  assert.match(source,/TEAM_SLUG = "mikesd1995s-projects"/);
  assert.match(source,/TEAM_ID = "team_uaeOdVIjXMSW690ZM2wPuJyt"/);
  assert.match(source,/PROJECT_NAME = "kk-phone-rental-vercel"/);
  assert.match(source,/PROJECT_ID = "prj_snbAmpya7YGmOuMbv1o8T16ouxl6"/);
  assert.match(source,/ENVIRONMENT = "production"/);
  assert.match(source,/audience: EXPECTED_AUDIENCE/);
  assert.match(source,/subject: EXPECTED_SUBJECT/);
  assert.match(source,/business_writes: 0/g);
  assert.match(source,/google_sheet_writes: 0/g);
  assert.match(source,/SUPABASE_SECRET_KEYS/);

  const config=fs.readFileSync(path.join(__dirname,'..','supabase','config.toml'),'utf8');
  assert.match(config,/\[functions\.kk-admin-write-control\]/);
  assert.match(config,/verify_jwt\s*=\s*false/);
});

test('final lock migration returns immediately after successful acquire',()=>{
  const sql=fs.readFileSync(
    path.join(__dirname,'..','supabase','migrations','20260922130931_admin_write_lock_single_row_return_v1.sql'),
    'utf8'
  );
  assert.match(sql,/if found then[\s\S]*return query select true, v_token, v_lease;[\s\S]*return;[\s\S]*end if;/i);
  assert.match(sql,/where l\.scope = p_scope/i);
});
