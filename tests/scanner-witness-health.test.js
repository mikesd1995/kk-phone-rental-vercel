'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const H=require('../api/kk-scanner-dispatch');

test('witness health is safely disabled by default',()=>{
  const s=H._test.readinessSnapshot({});
  assert.equal(s.external_scanner_enabled,false);
  assert.equal(s.runtime_ledger_enabled,false);
  assert.equal(s.ready_for_witness,false);
  assert.equal(s.scanner_execution_capable,false);
  assert.equal(s.business_writes_capable,false);
});

test('witness health becomes ready only when every config gate is present',()=>{
  const s=H._test.readinessSnapshot({
    KK_EXTERNAL_SCANNER_ENABLED:'true',
    KK_EXTERNAL_SCANNER_MODE:'witness',
    KK_EXTERNAL_SCANNER_SECRET:'hmac-secret',
    KK_RUNTIME_LEDGER_ENABLED:'true',
    SUPABASE_URL:'https://example.supabase.co',
    SUPABASE_SECRET_KEY:'sb_secret_server-only'
  });
  assert.equal(s.ready_for_witness,true);
  assert.equal(s.supabase_key_mode,'secret');
  assert.equal(s.scanner_execution_capable,false);
  assert.equal(s.business_writes_capable,false);
});

test('missing HMAC secret keeps witness not ready',()=>{
  const s=H._test.readinessSnapshot({
    KK_EXTERNAL_SCANNER_ENABLED:'true',
    KK_EXTERNAL_SCANNER_MODE:'witness',
    KK_RUNTIME_LEDGER_ENABLED:'true',
    SUPABASE_URL:'https://example.supabase.co',
    SUPABASE_SECRET_KEY:'sb_secret_server-only'
  });
  assert.equal(s.ready_for_witness,false);
});
