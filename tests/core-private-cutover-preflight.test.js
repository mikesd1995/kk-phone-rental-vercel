'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Preflight=require('../scripts/core-private-cutover-preflight.cjs');
const AdminFallback=require('../server/admin-sheet-fallback.js');

const env={
  KK_CORE_SHEET_REQUIRE_PRIVATE:'1',
  KK_CORE_PRIVATE_TRANSPORT:'service-account',
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
test('missing explicit Core transport blocks before any of 13 private reads',async()=>{
 let calls=0;
 const p=await Preflight.probe({
   env:{...env,KK_CORE_PRIVATE_TRANSPORT:undefined},
   reader:async()=>{calls++;throw Error('NO_PRIVATE_READER_MUST_RUN');}
 });
 assert.equal(p.ok,false);
 assert.equal(p.datasets_checked,0);
 assert.equal(calls,0);
 assert.equal(Preflight.plan({...env,KK_CORE_PRIVATE_TRANSPORT:undefined}).transport,'none');
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
test('actual Rental Dashboard helper header is Booking ID, fail closed on guessed snake_case or data-row header',async()=>{
  assert.equal(Preflight.EXTRA_SPECS.rental_dashboard_data.header,'Booking ID');
  assert.equal(Preflight.hasHeader([['Source','Booking ID','Created At'],['MASTER','BK-MOCK','2026-10-15']],'Booking ID'),true);
  assert.equal(Preflight.hasHeader([['source','booking_id','created_at']],'Booking ID'),false);
  assert.equal(Preflight.hasHeader([['Source','Other'],['MASTER','Booking ID']],'Booking ID'),false);
  const specs=[...Object.values(AdminFallback.SPECS),...Object.values(Preflight.EXTRA_SPECS)];
  const result=await Preflight.probe({env,reader:async ({sheet})=>{
    const spec=specs.find(s=>s.sheet===sheet);
    if(!spec)throw Error('Unexpected sheet');
    return [[spec.header||'Archive Header'],['SANITIZED_ROW']];
  }});
  assert.equal(result.datasets_checked,13);
  assert.equal(result.passed,13);
  assert.equal(result.failed,0);
  assert.equal(result.ok,true);
  assert.equal(result.public_gviz_reads,0);
  assert.equal(result.permission_writes,0);
  assert.equal(result.data_writes,0);
  assert.doesNotMatch(JSON.stringify(result),/SANITIZED_ROW|BK-MOCK/);
});
test('preflight explicitly redacts unrecognized error messages',()=>{
  const e=new Error('CUSTOMER_IDENTIFIER_AND_PRIVATE_TOKEN');
  assert.equal(Preflight.classify(e),'CORE_PRIVATE_PROBE_FAILED');
  assert.equal(Preflight.classify({code:'CORE_PRIVATE_CUSTOMER_PHONE_66812345678'}),'CORE_PRIVATE_PROBE_FAILED');
  assert.equal(Preflight.classify({code:'CRM_PRIVATE_READ_FAILED;token=PRIVATE_TOKEN'}),'CORE_PRIVATE_PROBE_FAILED');
  assert.equal(Preflight.classify({code:'CRM_PRIVATE_READ_FAILED'}),'CRM_PRIVATE_READ_FAILED');
  assert.equal(Preflight.classify({code:'CORE_PRIVATE_SCHEMA_INVALID'}),'CORE_PRIVATE_SCHEMA_INVALID');
});


test('schema validation must not mistake a private data row for the header',()=>{
  assert.equal(Preflight.hasHeader([['booking_id','event_id'],['A','B']],'booking_id'),true);
  assert.equal(Preflight.hasHeader([['other_column'],['booking_id']],'booking_id'),false);
  assert.equal(Preflight.hasHeader([[],['booking_id']],'booking_id'),false);
  assert.equal(Preflight.hasHeader([['booking_id']],'booking_id'),true);
  assert.equal(Preflight.hasHeader([],'booking_id'),false);
  assert.equal(Preflight.hasHeader([['not_booking_id']],'booking_id'),false);
});
test('private probe fails closed if a missing header appears only as a data value',async()=>{
  const expected=new Map([...Object.values(AdminFallback.SPECS),...Object.values(Preflight.EXTRA_SPECS)].map(s=>[s.sheet,s.header]));
  const state=await Preflight.probe({
    env,
    reader:async ({sheet})=>{
      if(sheet==='00_Master_Booking')return [['wrong_heading'],['booking_id','PRIVATE_PHONE_SHOULD_NOT_BE_EXPOSED']];
      return [[expected.get(sheet)||'archive_col'],['safe_fixture']];
    }
  });
  assert.equal(state.datasets_checked,13);
  assert.equal(state.passed,12);
  assert.equal(state.failed,1);
  assert.equal(state.ok,false);
  assert.equal(state.status,'PRIVATE_READS_BLOCKED');
  assert.deepEqual(state.results.filter(x=>!x.ok).map(x=>x.dataset),['bookings']);
  assert.equal(state.results.find(x=>x.dataset==='bookings').classification,'PRIVATE_SCHEMA_INVALID');
  assert.doesNotMatch(JSON.stringify(state),/PRIVATE_PHONE_SHOULD_NOT_BE_EXPOSED|wrong_heading/);
});
