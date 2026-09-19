'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const Bridge=require('../server/runtime-ledger-oidc-bridge');
const Handler=require('../api/kk-scanner-dispatch');

const TOKEN='header.payload.signature';

test('OIDC bridge endpoint is pinned to canonical runtime-ledger project',()=>{
  assert.equal(
    Bridge.endpoint(),
    'https://zehlsagzrpromtfqqflt.supabase.co/functions/v1/kk-runtime-ledger-oidc-probe'
  );
});

test('missing Vercel OIDC token fails closed before network access',async()=>{
  let called=false;
  const result=await Bridge.probe({
    env:{},
    fetchImpl:async()=>{called=true;throw new Error('must not call');}
  });
  assert.equal(result.attempted,false);
  assert.equal(result.ok,false);
  assert.equal(result.error_code,'VERCEL_OIDC_TOKEN_MISSING');
  assert.equal(result.business_writes,0);
  assert.equal(called,false);
});

test('OIDC bridge forwards token only in Authorization header and returns aggregate result',async()=>{
  let captured;
  const result=await Bridge.probe({
    env:{VERCEL_OIDC_TOKEN:TOKEN},
    fetchImpl:async(url,options)=>{
      captured={url,options};
      return {
        ok:true,
        status:200,
        async json(){
          return {
            ok:true,
            authenticated:true,
            read_only:true,
            bounded_limit:1,
            row_count:0,
            business_writes:0
          };
        }
      };
    }
  });
  assert.equal(result.ok,true);
  assert.equal(result.authenticated,true);
  assert.equal(result.row_count,0);
  assert.equal(result.business_writes,0);
  assert.equal(captured.options.method,'POST');
  assert.equal(captured.options.headers.Authorization,`Bearer ${TOKEN}`);
  assert.doesNotMatch(captured.url,/header\.payload\.signature/);
  assert.doesNotMatch(JSON.stringify(result),/header\.payload\.signature/);
});

test('OIDC bridge remote auth failure remains zero-write and secret-safe',async()=>{
  const result=await Bridge.probe({
    env:{VERCEL_OIDC_TOKEN:TOKEN},
    fetchImpl:async()=>({
      ok:false,
      status:401,
      async json(){return {ok:false,error_code:'OIDC_CLAIMS_MISMATCH'};}
    })
  });
  assert.equal(result.ok,false);
  assert.equal(result.attempted,true);
  assert.equal(result.remote_status,401);
  assert.equal(result.error_code,'OIDC_CLAIMS_MISMATCH');
  assert.equal(result.business_writes,0);
  assert.doesNotMatch(JSON.stringify(result),/header\.payload\.signature/);
});

test('scanner dispatcher exposes OIDC probe without enabling Scanner or business writes',async()=>{
  const original=Bridge.probe;
  Bridge.probe=async()=>({
    attempted:true,
    ok:true,
    authenticated:true,
    row_count:0,
    read_only:true,
    bounded_limit:1,
    business_writes:0
  });
  try{
    const req={
      method:'GET',
      query:{probe:'ledger-oidc'},
      headers:{},
      url:'/api/kk-scanner-dispatch?probe=ledger-oidc'
    };
    let status=0;
    const headers={};
    let body='';
    const res={
      set statusCode(value){status=value;},
      get statusCode(){return status;},
      setHeader(k,v){headers[k]=v;},
      end(v){body=String(v||'');}
    };
    await Handler(req,res);
    const parsed=JSON.parse(body);
    assert.equal(status,200);
    assert.equal(parsed.ok,true);
    assert.equal(parsed.data.external_scanner_enabled,false);
    assert.equal(parsed.data.scanner_execution_capable,false);
    assert.equal(parsed.data.business_writes_capable,false);
    assert.equal(parsed.runtime_ledger_oidc_probe.ok,true);
    assert.equal(parsed.runtime_ledger_oidc_probe.business_writes,0);
  }finally{
    Bridge.probe=original;
  }
});

test('Supabase Edge Function contract is exact-production, read-only and secret-internal',()=>{
  const source=fs.readFileSync(
    path.join(__dirname,'..','supabase','functions','kk-runtime-ledger-oidc-probe','index.ts'),
    'utf8'
  );
  assert.match(source,/TEAM_SLUG = "mikesd1995s-projects"/);
  assert.match(source,/TEAM_ID = "team_uaeOdVIjXMSW690ZM2wPuJyt"/);
  assert.match(source,/PROJECT_NAME = "kk-phone-rental-vercel"/);
  assert.match(source,/PROJECT_ID = "prj_snbAmpya7YGmOuMbv1o8T16ouxl6"/);
  assert.match(source,/ENVIRONMENT = "production"/);
  assert.match(source,/npm:jose@6\.2\.4/);
  assert.match(source,/SUPABASE_SECRET_KEYS/);
  assert.match(source,/method: "GET"/);
  assert.match(source,/limit: "1"/);
  assert.match(source,/business_writes: 0/g);
  assert.doesNotMatch(source,/method:\s*"(?:POST|PUT|PATCH|DELETE)"[\s\S]*rest\/v1\/kk_runtime_expectations/i);
  assert.doesNotMatch(source,/insert\s*\(|update\s*\(|delete\s*\(/i);
});
