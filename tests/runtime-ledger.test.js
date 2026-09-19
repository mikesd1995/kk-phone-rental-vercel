'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const L=require('../server/runtime-ledger');

const env={
  KK_RUNTIME_LEDGER_ENABLED:'true',
  SUPABASE_URL:'https://example.supabase.co',
  SUPABASE_SECRET_KEY:'sb_secret_server-only-test-key'
};

const row={
  occurrence_id:'SCANNER|2026-09-18T23:00:00+07:00',
  role:'SCANNER',
  scheduled_at:'2026-09-18T23:00:00+07:00',
  issued_at:'2026-09-18T23:00:10+07:00',
  source:'CLOUDFLARE_CRON',
  trigger_version:'kk-scanner-trigger-v1',
  nonce:'nonce-20260918T230000-01',
  payload_hash:'a'.repeat(64),
  status:'EXPECTED',
  mode:'WITNESS_ONLY'
};

test('runtime ledger stays disabled unless explicitly enabled',()=>{
  const s=L.configState({});
  assert.equal(s.enabled,false);
  assert.equal(s.configured,false);
});

test('runtime ledger requires Supabase URL plus a server-only credential',()=>{
  const s=L.configState({KK_RUNTIME_LEDGER_ENABLED:'true',SUPABASE_URL:'https://example.supabase.co'});
  assert.equal(s.enabled,true);
  assert.equal(s.configured,false);
});

test('new Supabase secret key is preferred over legacy service_role key',()=>{
  const s=L.resolveServerKey({
    SUPABASE_SECRET_KEY:'sb_secret_new',
    SUPABASE_SERVICE_ROLE_KEY:'legacy-key'
  });
  assert.equal(s.mode,'secret');
  assert.equal(s.value,'sb_secret_new');
});

test('legacy service_role remains a compatibility fallback',()=>{
  const s=L.resolveServerKey({SUPABASE_SERVICE_ROLE_KEY:'legacy-key'});
  assert.equal(s.mode,'legacy_service_role');
  assert.equal(s.value,'legacy-key');
});

test('expectation insert uses service-only REST call and returns inserted row',async()=>{
  let captured;
  const fetchImpl=async(url,options)=>{
    captured={url,options};
    return {
      ok:true,
      status:201,
      async json(){ return [row]; }
    };
  };
  const result=await L.recordExpectation({env,fetchImpl,row});
  assert.equal(result.ok,true);
  assert.equal(result.inserted,true);
  assert.equal(result.idempotent_duplicate,false);
  assert.match(captured.url,/\/rest\/v1\/kk_runtime_expectations\?on_conflict=occurrence_id$/);
  assert.equal(captured.options.headers.apikey,env.SUPABASE_SECRET_KEY);
  assert.equal(captured.options.headers.Authorization,`Bearer ${env.SUPABASE_SECRET_KEY}`);
  assert.doesNotMatch(captured.url,/sb_secret_server-only-test-key/);
});

test('duplicate occurrence is idempotent when Supabase returns no new representation',async()=>{
  const fetchImpl=async()=>({
    ok:true,
    status:201,
    async json(){ return []; }
  });
  const result=await L.recordExpectation({env,fetchImpl,row});
  assert.equal(result.inserted,false);
  assert.equal(result.idempotent_duplicate,true);
});

test('ledger fails closed when enabled but not configured',async()=>{
  await assert.rejects(
    L.recordExpectation({
      env:{KK_RUNTIME_LEDGER_ENABLED:'true'},
      fetchImpl:async()=>{ throw new Error('must not call fetch'); },
      row
    }),
    err=>err.code==='RUNTIME_LEDGER_NOT_CONFIGURED'
  );
});


test('witness expectation read is bounded, service-only and does not place secret in URL',async()=>{
  let captured;
  const fetchImpl=async(url,options)=>{
    captured={url,options};
    return {
      ok:true,
      status:200,
      async json(){ return [row]; }
    };
  };
  const result=await L.listExpectations({env,fetchImpl,role:'SCANNER',mode:'WITNESS_ONLY',limit:24});
  assert.equal(result.ok,true);
  assert.equal(result.rows.length,1);
  assert.equal(captured.options.method,'GET');
  assert.equal(captured.options.headers.apikey,env.SUPABASE_SECRET_KEY);
  assert.equal(captured.options.headers.Authorization,`Bearer ${env.SUPABASE_SECRET_KEY}`);
  assert.doesNotMatch(captured.url,/sb_secret_server-only-test-key/);
  assert.match(captured.url,/role=eq\.SCANNER/);
  assert.match(captured.url,/mode=eq\.WITNESS_ONLY/);
  assert.match(captured.url,/limit=24/);
  assert.match(captured.url,/scheduled_at\.desc/);
});

test('witness expectation read rejects non-array protocol responses',async()=>{
  await assert.rejects(
    L.listExpectations({
      env,
      fetchImpl:async()=>({
        ok:true,
        status:200,
        async json(){ return {unexpected:true}; }
      })
    }),
    err=>err.code==='RUNTIME_LEDGER_RESPONSE_INVALID'
  );
});

test('witness expectation read rejects unsupported role before network access',async()=>{
  let called=false;
  await assert.rejects(
    L.listExpectations({
      env,
      role:'CANARY',
      fetchImpl:async()=>{ called=true; throw new Error('must not fetch'); }
    }),
    err=>err.code==='RUNTIME_LEDGER_ROLE_INVALID'
  );
  assert.equal(called,false);
});
