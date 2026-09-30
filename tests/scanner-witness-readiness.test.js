'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const H=require('../api/kk-scanner-dispatch');

test('witness readiness is safely disabled by default',()=>{
  const s=H._test.readinessSnapshot({});
  assert.equal(s.external_scanner_enabled,false);
  assert.equal(s.runtime_ledger_enabled,false);
  assert.equal(s.ready_for_witness,false);
  assert.equal(s.scanner_execution_capable,false);
  assert.equal(s.business_writes_capable,false);
});

test('witness readiness requires every configuration gate',()=>{
  const s=H._test.readinessSnapshot({
    KK_EXTERNAL_SCANNER_ENABLED:'true',
    KK_EXTERNAL_SCANNER_MODE:'witness',
    KK_EXTERNAL_SCANNER_SECRET:'hmac-secret',
    KK_RUNTIME_LEDGER_ENABLED:'true',
    KK_RUNTIME_LEDGER_PROJECT_REF:'zehlsagzrpromtfqqflt',
    SUPABASE_URL:'https://zehlsagzrpromtfqqflt.supabase.co',
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
    KK_RUNTIME_LEDGER_PROJECT_REF:'zehlsagzrpromtfqqflt',
    SUPABASE_URL:'https://zehlsagzrpromtfqqflt.supabase.co',
    SUPABASE_SECRET_KEY:'sb_secret_server-only'
  });
  assert.equal(s.ready_for_witness,false);
});


test('project binding mismatch keeps witness not ready',()=>{
  const s=H._test.readinessSnapshot({
    KK_EXTERNAL_SCANNER_ENABLED:'true',
    KK_EXTERNAL_SCANNER_MODE:'witness',
    KK_EXTERNAL_SCANNER_SECRET:'hmac-secret',
    KK_RUNTIME_LEDGER_ENABLED:'true',
    KK_RUNTIME_LEDGER_PROJECT_REF:'zehlsagzrpromtfqqflt',
    SUPABASE_URL:'https://unxangvmhjtlqmiiuurw.supabase.co',
    SUPABASE_SECRET_KEY:'sb_secret_server-only'
  });
  assert.equal(s.runtime_ledger_configured,false);
  assert.equal(s.supabase_project_ref_configured,true);
  assert.equal(s.supabase_url_project_ref_resolved,true);
  assert.equal(s.supabase_project_binding_matches,false);
  assert.equal(s.ready_for_witness,false);
  assert.equal(s.scanner_execution_capable,false);
  assert.equal(s.business_writes_capable,false);
});


test('ledger connectivity probe is disabled and performs no read when ledger is off',async()=>{
  let called=false;
  const result=await H._test.ledgerConnectivityProbe({
    env:{},
    listExpectations:async()=>{ called=true; throw new Error('must not call'); }
  });
  assert.equal(result.attempted,false);
  assert.equal(result.ok,false);
  assert.equal(result.error_code,'RUNTIME_LEDGER_DISABLED');
  assert.equal(result.read_only,true);
  assert.equal(result.bounded_limit,1);
  assert.equal(result.business_writes,0);
  assert.equal(called,false);
});

test('ledger connectivity probe inherits canonical project binding and blocks network on mismatch',async()=>{
  let called=false;
  const result=await H._test.ledgerConnectivityProbe({
    env:{
      KK_RUNTIME_LEDGER_ENABLED:'true',
      KK_RUNTIME_LEDGER_PROJECT_REF:'zehlsagzrpromtfqqflt',
      SUPABASE_URL:'https://unxangvmhjtlqmiiuurw.supabase.co',
      SUPABASE_SECRET_KEY:'sb_secret_probe_test'
    },
    listExpectations:async()=>{ called=true; throw new Error('must not call'); }
  });
  assert.equal(result.attempted,false);
  assert.equal(result.ok,false);
  assert.equal(result.error_code,'RUNTIME_LEDGER_NOT_CONFIGURED');
  assert.equal(result.business_writes,0);
  assert.equal(called,false);
});

test('ledger connectivity probe performs one bounded read and returns only aggregate status',async()=>{
  let captured;
  const env={
    KK_RUNTIME_LEDGER_ENABLED:'true',
    KK_RUNTIME_LEDGER_PROJECT_REF:'zehlsagzrpromtfqqflt',
    SUPABASE_URL:'https://zehlsagzrpromtfqqflt.supabase.co',
    SUPABASE_SECRET_KEY:'sb_secret_probe_test'
  };
  const result=await H._test.ledgerConnectivityProbe({
    env,
    listExpectations:async(args)=>{
      captured=args;
      return {ok:true,rows:[{occurrence_id:'hidden-detail'}]};
    }
  });
  assert.equal(result.attempted,true);
  assert.equal(result.ok,true);
  assert.equal(result.row_count,1);
  assert.equal(result.read_only,true);
  assert.equal(result.bounded_limit,1);
  assert.equal(result.business_writes,0);
  assert.equal(captured.role,'SCANNER');
  assert.equal(captured.mode,'WITNESS_ONLY');
  assert.equal(captured.limit,1);
  assert.equal(JSON.stringify(result).includes('hidden-detail'),false);
  assert.equal(JSON.stringify(result).includes('sb_secret_probe_test'),false);
  assert.equal(JSON.stringify(result).includes('zehlsagzrpromtfqqflt'),false);
});

test('ledger connectivity probe fail-closes without leaking server credential',async()=>{
  const env={
    KK_RUNTIME_LEDGER_ENABLED:'true',
    KK_RUNTIME_LEDGER_PROJECT_REF:'zehlsagzrpromtfqqflt',
    SUPABASE_URL:'https://zehlsagzrpromtfqqflt.supabase.co',
    SUPABASE_SECRET_KEY:'sb_secret_probe_test'
  };
  const err=Object.assign(new Error('remote denied'),{
    code:'RUNTIME_LEDGER_READ_FAILED',
    status:401
  });
  const result=await H._test.ledgerConnectivityProbe({
    env,
    listExpectations:async()=>{ throw err; }
  });
  assert.equal(result.attempted,true);
  assert.equal(result.ok,false);
  assert.equal(result.error_code,'RUNTIME_LEDGER_READ_FAILED');
  assert.equal(result.remote_status,401);
  assert.equal(result.business_writes,0);
  assert.equal(JSON.stringify(result).includes('sb_secret_probe_test'),false);
  assert.equal(JSON.stringify(result).includes('zehlsagzrpromtfqqflt'),false);
});

test('queryValue resolves ledger probe from query object or URL',()=>{
  assert.equal(H._test.queryValue({query:{probe:'ledger'}},'probe'),'ledger');
  assert.equal(H._test.queryValue({url:'/api/kk-scanner-dispatch?probe=ledger'},'probe'),'ledger');
  assert.equal(H._test.queryValue({url:'/api/kk-scanner-dispatch?probe=one&probe=two'},'probe'),'');
  assert.equal(H._test.queryValue({url:'/api/kk-scanner-dispatch'},'probe'),'');
});

test('read-only scanner execution requires explicit enablement and unknown-URL search',()=>{
  const base={
    KK_EXTERNAL_SCANNER_ENABLED:'true',
    KK_EXTERNAL_SCANNER_MODE:'execute-readonly',
    KK_EXTERNAL_SCANNER_SECRET:'hmac-secret',
    KK_RUNTIME_LEDGER_ENABLED:'true',
    KK_RUNTIME_LEDGER_PROJECT_REF:'zehlsagzrpromtfqqflt',
    SUPABASE_URL:'https://zehlsagzrpromtfqqflt.supabase.co',
    SUPABASE_SECRET_KEY:'sb_secret_server-only'
  };
  const blocked=H._test.readinessSnapshot(base);
  assert.equal(blocked.scanner_execution_capable,false);
  assert.equal(blocked.ready_for_execution,false);
  const ready=H._test.readinessSnapshot({...base,KK_EXTERNAL_SCANNER_EXECUTION_ENABLED:'true',KK_SEARXNG_ENDPOINT:'https://search.example/search'});
  assert.equal(ready.scanner_execution_capable,true);
  assert.equal(ready.ready_for_execution,true);
  assert.equal(ready.business_writes_capable,false);
});
