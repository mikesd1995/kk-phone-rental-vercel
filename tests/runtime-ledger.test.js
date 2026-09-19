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
  assert.equal(s.key_mode,'none');
});

test('runtime ledger requires URL plus a server-only Supabase key',()=>{
  const s=L.configState({KK_RUNTIME_LEDGER_ENABLED:'true',SUPABASE_URL:'https://example.supabase.co'});
  assert.equal(s.enabled,true);
  assert.equal(s.configured,false);
  assert.equal(s.server_key_configured,false);
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

test('expectation insert uses server-only secret key and returns inserted row',async()=>{
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
