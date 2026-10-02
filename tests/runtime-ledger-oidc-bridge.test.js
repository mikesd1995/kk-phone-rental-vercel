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
  assert.equal(Bridge.OIDC_BRIDGE_TIMEOUT_MS,4000);
});

test('OIDC bridge uses Vercel request-context-aware helper instead of direct env token access',()=>{
  const source=fs.readFileSync(
    path.join(__dirname,'..','server','runtime-ledger-oidc-bridge.js'),
    'utf8'
  );
  assert.match(source,/require\('@vercel\/functions\/oidc'\)/);
  assert.match(source,/getVercelOidcToken/);
  assert.doesNotMatch(source,/process\.env\.VERCEL_OIDC_TOKEN/);
  assert.doesNotMatch(source,/x-vercel-oidc-token/i);
});

test('OIDC token resolver delegates to the supported helper and never exposes the token in metadata',async()=>{
  let calls=0;
  const token=await Bridge.resolveOidcToken({
    getTokenImpl:async()=>{
      calls+=1;
      return TOKEN;
    }
  });
  assert.equal(calls,1);
  assert.equal(token,TOKEN);
});

test('missing Vercel OIDC token fails closed before network access',async()=>{
  let called=false;
  const result=await Bridge.probe({
    getTokenImpl:async()=>'',
    fetchImpl:async()=>{called=true;throw new Error('must not call');}
  });
  assert.equal(result.attempted,false);
  assert.equal(result.ok,false);
  assert.equal(result.error_code,'VERCEL_OIDC_TOKEN_MISSING');
  assert.equal(result.business_writes,0);
  assert.equal(called,false);
});

test('OIDC helper failure fails closed before network access',async()=>{
  let called=false;
  const result=await Bridge.probe({
    getTokenImpl:async()=>{throw new Error('request context unavailable');},
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
  assert.ok(captured.options.signal instanceof AbortSignal);
  assert.doesNotMatch(captured.url,/header\.payload\.signature/);
  assert.doesNotMatch(JSON.stringify(result),/header\.payload\.signature/);
});

test('OIDC bridge timeout is classified fail-closed and remains zero-write',async()=>{
  const err=new Error('timed out');
  err.name='TimeoutError';
  const result=await Bridge.probe({
    getTokenImpl:async()=>TOKEN,
    fetchImpl:async()=>{throw err;}
  });
  assert.equal(result.ok,false);
  assert.equal(result.attempted,true);
  assert.equal(result.error_code,'OIDC_BRIDGE_TIMEOUT');
  assert.equal(result.business_writes,0);
});

test('OIDC bridge transport failure is classified fail-closed and remains zero-write',async()=>{
  const result=await Bridge.probe({
    getTokenImpl:async()=>TOKEN,
    fetchImpl:async()=>{throw new Error('network unavailable');}
  });
  assert.equal(result.ok,false);
  assert.equal(result.attempted,true);
  assert.equal(result.error_code,'OIDC_BRIDGE_TRANSPORT_FAILED');
  assert.equal(result.business_writes,0);
});

test('OIDC bridge remote auth failure remains zero-write and secret-safe',async()=>{
  const result=await Bridge.probe({
    getTokenImpl:async()=>TOKEN,
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

test('scanner dispatcher keeps OIDC probe disabled by default and never invokes bridge',async()=>{
  const original=Bridge.probe;
  let called=false;
  Bridge.probe=async()=>{called=true;throw new Error('must not call');};
  const previous=process.env.KK_RUNTIME_LEDGER_OIDC_PROBE_ENABLED;
  delete process.env.KK_RUNTIME_LEDGER_OIDC_PROBE_ENABLED;
  try{
    const req={
      method:'GET',
      query:{probe:'ledger-oidc'},
      headers:{},
      url:'/api/kk-scanner-dispatch?probe=ledger-oidc'
    };
    let status=0;
    let body='';
    const res={
      set statusCode(value){status=value;},
      get statusCode(){return status;},
      setHeader(){},
      end(v){body=String(v||'');}
    };
    await Handler(req,res);
    const parsed=JSON.parse(body);
    assert.equal(status,503);
    assert.equal(parsed.ok,false);
    assert.equal(parsed.data.runtime_ledger_oidc_probe_enabled,false);
    assert.equal(parsed.runtime_ledger_oidc_probe.attempted,false);
    assert.equal(parsed.runtime_ledger_oidc_probe.error_code,'OIDC_PROBE_DISABLED');
    assert.equal(parsed.runtime_ledger_oidc_probe.business_writes,0);
    assert.equal(called,false);
  }finally{
    Bridge.probe=original;
    if(previous===undefined) delete process.env.KK_RUNTIME_LEDGER_OIDC_PROBE_ENABLED;
    else process.env.KK_RUNTIME_LEDGER_OIDC_PROBE_ENABLED=previous;
  }
});

test('scanner dispatcher exposes explicitly enabled OIDC probe without enabling Scanner or business writes',async()=>{
  const original=Bridge.probe;
  const previous=process.env.KK_RUNTIME_LEDGER_OIDC_PROBE_ENABLED;
  process.env.KK_RUNTIME_LEDGER_OIDC_PROBE_ENABLED='true';
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
    if(previous===undefined) delete process.env.KK_RUNTIME_LEDGER_OIDC_PROBE_ENABLED;
    else process.env.KK_RUNTIME_LEDGER_OIDC_PROBE_ENABLED=previous;
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
  assert.match(source,/timeoutDuration:\s*3000/);
  assert.match(source,/AbortSignal\.timeout\(3000\)/);
  assert.match(source,/LEDGER_READ_TIMEOUT/);
  assert.match(source,/LEDGER_READ_TRANSPORT_FAILED/);
  assert.match(source,/SUPABASE_SECRET_KEYS/);
  assert.match(source,/OIDC_REQUEST_CONTRACT_INVALID/);
  assert.match(source,/body\.probe === "runtime-ledger"/);
  assert.match(source,/body\.probe === "project-memory"/);
  assert.match(source,/kk_project_memory_events/);
  assert.match(source,/body\.version !== "v1"/);
  assert.match(source,/method: "GET"/);
  assert.match(source,/limit: "1"/);
  assert.match(source,/business_writes: 0/g);
  assert.doesNotMatch(source,/method:\s*"(?:POST|PUT|PATCH|DELETE)"[\s\S]*rest\/v1\/(?:kk_runtime_expectations|kk_project_memory_events)/i);
  assert.doesNotMatch(source,/insert\s*\(|update\s*\(|delete\s*\(/i);

  const config=fs.readFileSync(
    path.join(__dirname,'..','supabase','config.toml'),
    'utf8'
  );
  assert.match(config,/\[functions\.kk-runtime-ledger-oidc-probe\]/);
  assert.match(config,/verify_jwt\s*=\s*false/);
});


test('OIDC project memory read is bounded, domain-filtered and token-safe',async()=>{
  let captured;
  const result=await Bridge.readProjectMemory({
    domains:['project_memory','content','INVALID SPACE'],
    limit:2,
    getTokenImpl:async()=>TOKEN,
    fetchImpl:async(url,options)=>{
      captured={url,options,body:JSON.parse(options.body)};
      return {
        ok:true,status:200,
        async json(){return {
          ok:true,authenticated:true,read_only:true,bounded_limit:2,business_writes:0,
          rows:[{memory_id:'kk:memory:test:oidc01',occurred_at:'2026-10-02T12:00:00+07:00',kind:'IMPLEMENTATION',domain:'project_memory',summary:'Durable project memory readback is available through the production OIDC bridge.',evidence_refs:['github:test'],supersedes:null,status:'ACTIVE',source:'test',source_commit_sha:''}]
        };}
      };
    }
  });
  assert.equal(result.ok,true);
  assert.equal(result.rows.length,1);
  assert.deepEqual(captured.body.domains,['project_memory','content']);
  assert.equal(captured.body.limit,2);
  assert.equal(captured.body.probe,'project-memory');
  assert.equal(captured.options.headers.Authorization,`Bearer ${TOKEN}`);
  assert.doesNotMatch(JSON.stringify(result),/header\.payload\.signature/);
  assert.equal(result.business_writes,0);
});
