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

test('private dashboard preflight uses its actual display header, not machine field aliases',()=>{
 assert.equal(Preflight.EXTRA_SPECS.rental_dashboard_data.header,'Booking ID');
 assert.equal(Preflight.hasHeader([['Source','Booking ID','Created At']],'Booking ID'),true);
 assert.equal(Preflight.hasHeader([['Source','booking_id']],'Booking ID'),false);
 assert.equal(Preflight.hasHeader([['Source'],['Booking ID']],'Booking ID'),false);
});

test('archive schema gate requires archived_at as a genuine header on row 1',async()=>{
  assert.equal(Preflight.EXTRA_SPECS.event_archive.header,'archived_at');
  assert.equal(Preflight.hasHeader([['archived_at','event_id']],'archived_at'),true);
  assert.equal(Preflight.hasHeader([['wrong_header'],['archived_at']],'archived_at'),false);
  assert.equal(Preflight.hasHeader([['private_row_only']],'archived_at'),false);
  const keys=Object.fromEntries([...Object.values(AdminFallback.SPECS),...Object.values(Preflight.EXTRA_SPECS)].map(s=>[s.sheet,s.header]));
  const probe=await Preflight.probe({env,reader:async ({sheet})=>[
    [sheet==='13_Event_Archive'?'bad_archive':keys[sheet]],
    ['CUSTOMER_PRIVATE_ROW_NEVER_LOG']
  ]});
  assert.equal(probe.datasets_checked,13);
  assert.equal(probe.passed,12);
  assert.equal(probe.failed,1);
  assert.deepEqual(probe.results.filter(x=>!x.ok).map(x=>x.dataset),['event_archive']);
  assert.doesNotMatch(JSON.stringify(probe),/CUSTOMER_PRIVATE_ROW_NEVER_LOG|bad_archive/);
});
test('Apps Script preflight emits only explicitly permitted non-PII diagnostics',()=>{
  for(const code of [
    'CORE_APPS_SCRIPT_NOT_CONFIGURED','CORE_APPS_SCRIPT_ID_MISMATCH',
    'CORE_APPS_SCRIPT_FETCH_UNAVAILABLE','CORE_APPS_SCRIPT_BAD_REDIRECT',
    'CORE_APPS_SCRIPT_HTTP_FAILURE','CORE_APPS_SCRIPT_RESPONSE_INVALID',
    'CORE_APPS_SCRIPT_TIMEOUT','CORE_APPS_SCRIPT_UNAVAILABLE'
  ])assert.equal(Preflight.classify({code}),code);
  for(const code of [
    'CORE_APPS_SCRIPT_BAD_REDIRECT_PRIVATE_PHONE',
    'CORE_APPS_SCRIPT_HTTP_FAILURE;customer=PRIVATE',
    'CORE_APPS_SCRIPT_UNAVAILABLE;apiKey=PRIVATE'
  ])assert.equal(Preflight.classify({code}),'CORE_PRIVATE_PROBE_FAILED');
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

test('missing transport diagnostic remains exact and suffixes stay private',()=>{
 assert.equal(Preflight.classify({code:'CORE_PRIVATE_TRANSPORT_NOT_CONFIGURED'}),'CORE_PRIVATE_TRANSPORT_NOT_CONFIGURED');
 assert.equal(Preflight.classify({code:'CORE_PRIVATE_TRANSPORT_NOT_CONFIGURED_PRIVATE'}),'CORE_PRIVATE_PROBE_FAILED');
});

test('private-cutover diagnostic does not repeat an unrecognized transport secret',async()=>{
 const injected='PRIVATE_TRANSPORT_TOKEN_DO_NOT_PRINT';
 const malformed={...env,KK_CORE_PRIVATE_TRANSPORT:injected};
 let readCount=0;
 const plan=Preflight.plan(malformed);
 assert.equal(plan.transport,'invalid');
 assert.equal(plan.ok,false);
 assert.equal(plan.transport_ready,false);
 assert.doesNotMatch(JSON.stringify(plan),/PRIVATE_TRANSPORT_TOKEN_DO_NOT_PRINT/);
 const probe=await Preflight.probe({env:malformed,reader:async()=>{readCount++;throw Error('MUST_NOT_READ');}});
 assert.equal(readCount,0);
 assert.equal(probe.datasets_checked,0);
 assert.equal(probe.status,'NOT_READY');
 assert.equal(Preflight.classify({code:'CORE_PRIVATE_TRANSPORT_INVALID'}),'CORE_PRIVATE_TRANSPORT_INVALID');
 assert.equal(Preflight.classify({code:'CORE_PRIVATE_TRANSPORT_INVALID_PRIVATE_CONTACT'}),'CORE_PRIVATE_PROBE_FAILED');
});
test('private-cutover schema rejects duplicate and prototype headers, even without mandatory key',()=>{
 const header=Preflight.hasHeader;
 assert.equal(header([['booking_id','event_id','booking_id']],'booking_id'),false);
 assert.equal(header([['booking_id','event_id','event_id']],'booking_id'),false);
 for(const key of ['__proto__','constructor','prototype']){
   assert.equal(header([['booking_id',key]],'booking_id'),false);
 }
 assert.equal(header([[]],null),false);
 assert.equal(header([['archived_at','archived_at']],null),false);
 assert.equal(header([['booking_id','','event_id']],'booking_id'),true);
 assert.equal(header([['archived_at','source_row']],null),true);
});
test('13-range probe rejects ambiguous master booking and archive headers without exposing rows',async()=>{
 const all=[...Object.values(AdminFallback.SPECS),...Object.values(Preflight.EXTRA_SPECS)];
 const result=await Preflight.probe({env,reader:async({sheet})=>{
   if(sheet==='00_Master_Booking')return [['booking_id','customer_contact','booking_id'],['BK-FIXTURE','PRIVATE_CONTACT_FIXTURE','BK-DUPLICATE']];
   if(sheet==='13_Event_Archive')return [['archived_at','archived_at'],['PRIVATE_ARCHIVE_FIXTURE','X']];
   const spec=all.find(x=>x.sheet===sheet);
   return [[spec.header||'archive_col'],['valid_fixture']];
 }});
 assert.equal(result.datasets_checked,13);
 assert.equal(result.passed,11);
 assert.equal(result.failed,2);
 assert.equal(result.ok,false);
 assert.deepEqual(result.results.filter(x=>!x.ok).map(x=>x.dataset),['bookings','event_archive']);
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE_CONTACT_FIXTURE|PRIVATE_ARCHIVE_FIXTURE|BK-FIXTURE|BK-DUPLICATE/);
});

test('13-range preflight and real Admin reader reject the same reserved headers',()=>{
 const runtime=AdminFallback.valuesAsObjects;
 for(const reserved of ['__row_number','__proto__','constructor','prototype',
   'toString','valueOf','hasOwnProperty','__defineGetter__','isPrototypeOf']){
   const row=['booking_id',reserved,'event_id'];
   assert.equal(Preflight.hasHeader([row],'booking_id'),false,
     'Preflight must reject reserved field '+reserved);
   assert.throws(()=>runtime([row,['B-FIXTURE','PRIVATE_FIXTURE','E-FIXTURE']],'booking_id',4),
     err=>err.code==='CORE_PRIVATE_SCHEMA_INVALID',
     'Real Admin reader must reject the same field '+reserved);
 }
 assert.equal(Preflight.hasHeader([['booking_id','event_id']],'booking_id'),true);
 assert.equal(runtime([['booking_id','event_id'],['B-FIXTURE','E-FIXTURE']],'booking_id',4).length,1);
});

test('13-source probe fails on runtime-reserved headers without exposing row values',async()=>{
 const expected=new Map([...Object.values(AdminFallback.SPECS),...Object.values(Preflight.EXTRA_SPECS)]
   .map(spec=>[spec.sheet,spec.header]));
 const realSecret='PRIVATE_FIXTURE_MUST_NOT_LEAK';
 const result=await Preflight.probe({env,reader:async ({sheet})=>{
   const header=expected.get(sheet)||'generic_field';
   return [[header,sheet==='00_Master_Booking'?'__row_number':'safe_field'],
     [realSecret,'VALUE']];
 }});
 assert.equal(result.datasets_checked,13);
 assert.equal(result.passed,12);
 assert.equal(result.failed,1);
 assert.equal(result.results.find(x=>x.dataset==='bookings').classification,'PRIVATE_SCHEMA_INVALID');
 assert.doesNotMatch(JSON.stringify(result),/PRIVATE_FIXTURE_MUST_NOT_LEAK|VALUE/);
 assert.equal(result.data_writes,0);
 assert.equal(result.public_gviz_reads,0);
});
