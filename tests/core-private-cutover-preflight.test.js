'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Preflight=require('../scripts/core-private-cutover-preflight.cjs');
const AdminFallback=require('../server/admin-sheet-fallback.js');

const env={
  KK_CORE_SHEET_REQUIRE_PRIVATE:'1',
  GOOGLE_SHEET_ID:'core-test-sheet',
  GOOGLE_SERVICE_ACCOUNT_EMAIL:'read-only@example.invalid',
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:'test-injected-identity'
};
test('configuration-only check never calls any network or writes',()=>{
  const p=Preflight.plan({...env,GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:''});
  assert.equal(p.ok,false);
  assert.equal(p.credentials_ready,false);
  assert.equal(p.data_writes,0);
  assert.equal(p.permission_writes,0);
  assert.equal(p.public_gviz_reads,0);
  assert.doesNotMatch(JSON.stringify(p),/core-test-sheet|read-only@example|test-injected/);
});
test('missing private credentials block before a single private/public call',async()=>{
  let calls=0;
  const state=await Preflight.probe({
    env:{...env,GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:undefined},
    reader:async()=>{calls++;throw Error('must not be called');}
  });
  assert.equal(state.ok,false);
  assert.equal(state.datasets_checked,0);
  assert.equal(calls,0);
});
test('private-only probe audits 11 Admin datasets plus 2 Analytics sources with no row values in output',async()=>{
  const bySheet={};
  for(const cfg of [...Object.values(AdminFallback.SPECS),...Object.values(Preflight.EXTRA_SPECS)]){
    bySheet[cfg.sheet]=cfg.header||'sample_col';
  }
  const calls=[];
  const state=await Preflight.probe({
    env,
    reader:async info=>{
      calls.push(info);
      return [[bySheet[info.sheet],'customer_private_contact'],['A','VERY_PRIVATE_CUSTOMER_PHONE']];
    }
  });
  assert.equal(calls.length,13);
  assert.equal(state.datasets_checked,13);
  assert.equal(state.passed,13);
  assert.equal(state.failed,0);
  assert.equal(state.ok,true);
  assert.equal(state.status,'PRIVATE_READS_PASS');
  assert.equal(state.data_writes,0);
  assert.equal(state.public_gviz_reads,0);
  const printed=JSON.stringify(state);
  assert.doesNotMatch(printed,/VERY_PRIVATE_CUSTOMER_PHONE|customer_private_contact|test-injected|read-only@example|core-test-sheet/);
});
test('schema error or private auth outage fails the complete probe, with classified non-sensitive output',async()=>{
  const state=await Preflight.probe({
    env,
    reader:async ({sheet})=>{
      if(sheet==='00_Master_Booking')return [['not_booking_id'],['PRIVATE']];
      if(sheet==='13_Event_Archive')throw Object.assign(Error('sensitive internal value'),{code:'CRM_PRIVATE_READ_FAILED'});
      return [['Check','booking_id','event_id','asset_id','model_group','package_id','event_id','template_id','customer_key','lock_id'],['A']];
    }
  });
  assert.equal(state.ok,false);
  assert.equal(state.status,'PRIVATE_READS_BLOCKED');
  assert.ok(state.failed>=2);
  const printed=JSON.stringify(state);
  assert.doesNotMatch(printed,/sensitive internal value|PRIVATE$/);
  assert.match(printed,/PRIVATE_SCHEMA_INVALID/);
  assert.match(printed,/CRM_PRIVATE_READ_FAILED/);
});
test('preflight explicitly redacts unrecognized error messages',()=>{
  const e=new Error('CUSTOMER_IDENTIFIER_AND_PRIVATE_TOKEN');
  assert.equal(Preflight.classify(e),'CORE_PRIVATE_PROBE_FAILED');
});
