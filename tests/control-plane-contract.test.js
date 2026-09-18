'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../server/control-plane-contract.js');

const released=(scope,run)=>({
  scope_key:scope,
  holder_run_id:run,
  status:'RELEASED',
  acquired_at:'2026-09-18T06:00:01+07:00',
  lease_until:'2026-09-18T06:20:01+07:00',
  lease_version:300,
  fencing_token:'TEST-FENCE-300'
});
const manifest=(role,run,status='FINISHED_PARTIAL')=>({role,run_id:run,status});

function base(role='SCANNER'){
  const run=role==='SCANNER'?'SCV415-20260918T060000-SCHEDULED-0600':'GPTV415-20260918T063000-SCHEDULED-0630';
  return {
    role,
    scheduled_at:role==='SCANNER'?'2026-09-18T06:00:00+07:00':'2026-09-18T06:30:00+07:00',
    task_before:{enabled:true},
    task_after:{enabled:true},
    launcher_before:'2026-09-18T05:02:50+07:00',
    launcher_after:role==='SCANNER'?'2026-09-18T06:02:40+07:00':'2026-09-18T06:32:40+07:00',
    core_locks:[released('CORE',run)],
    role_locks:[released(role,run)],
    manifests:[manifest(role,run)],
    transactions:[]
  };
}

test('canonical Machine-SOT headers remain exact and ordered',()=>{
  assert.equal(C.assertManifestHeaders([...C.MANIFEST_HEADERS]),true);
  assert.equal(C.assertTransactionHeaders([...C.TRANSACTION_HEADERS]),true);
  assert.throws(()=>C.assertManifestHeaders([...C.MANIFEST_HEADERS].reverse()),/header mismatch/);
  assert.throws(()=>C.assertTransactionHeaders([...C.TRANSACTION_HEADERS,'extra']),/header count mismatch/);
});

test('cross-surface fencing requires strict max+1',()=>{
  assert.equal(C.assertStrictlyMonotonicFence([291,292,294],295),true);
  assert.throws(()=>C.assertStrictlyMonotonicFence([291,292,294],294),/max\+1/);
  assert.throws(()=>C.assertStrictlyMonotonicFence([291,292,294],296),/max\+1/);
});

test('clean natural occurrence becomes an acceptance candidate',()=>{
  const r=C.analyzeNaturalOccurrence(base('SCANNER'));
  assert.equal(r.runtime_boundary_proven,true);
  assert.equal(r.runtime_proven,true);
  assert.equal(r.runtime_body_classification,'RUNTIME_BODY_TERMINAL_CLEAN');
  assert.equal(r.task_persistence_ok,true);
  assert.equal(r.task_persistence_classification,'TASK_REMAINED_ON_AFTER_RUNTIME_BOUNDARY');
  assert.equal(r.acceptance_candidate,true);
  assert.equal(r.classification,'PASS_ACCEPTANCE_CANDIDATE');
});

test('task OFF before the boundary fails before launcher/runtime inference',()=>{
  const x=base('SCANNER');
  x.task_before.enabled=false;
  x.launcher_after=x.launcher_before;
  x.core_locks=[];
  x.role_locks=[];
  x.manifests=[];
  const r=C.analyzeNaturalOccurrence(x);
  assert.equal(r.classification,'TASK_OFF_BEFORE_BOUNDARY');
  assert.equal(r.acceptance_candidate,false);
});

test('launcher metadata without Machine-SOT boundary is never runtime proof',()=>{
  const x=base('SCANNER');
  x.core_locks=[];
  x.role_locks=[];
  x.manifests=[];
  const r=C.analyzeNaturalOccurrence(x);
  assert.equal(r.classification,'LAUNCHER_METADATA_ADVANCED_RUNTIME_BOUNDARY_MISSING');
  assert.equal(r.runtime_proven,false);
});

test('half-materialized CORE lock append is a malformed runtime boundary, not an active valid lock',()=>{
  const x=base('VERIFIER');
  x.core_locks=[{
    scope_key:'CORE',
    holder_run_id:'GPTV415-20260918T043203-SCHEDULED-0430'
  }];
  x.role_locks=[];
  x.manifests=[];
  const r=C.analyzeNaturalOccurrence(x);
  assert.equal(r.classification,'MALFORMED_RUNTIME_LOCK_RECORD');
  assert.equal(r.runtime_proven,false);
  assert.equal(r.acceptance_candidate,false);
  assert.match(r.blockers.join(' '),/status/);
  assert.match(r.blockers.join(' '),/fencing_token/);
});

test('runtime with no exact Manifest fails closed',()=>{
  const x=base('VERIFIER');
  x.manifests=[];
  const r=C.analyzeNaturalOccurrence(x);
  assert.equal(r.classification,'RUNTIME_MANIFEST_IDENTITY_NOT_EXACT1');
});

test('terminal runtime does not pass persistence acceptance if task turns OFF',()=>{
  const x=base('VERIFIER');
  x.task_after.enabled=false;
  const r=C.analyzeNaturalOccurrence(x);
  assert.equal(r.runtime_boundary_proven,true);
  assert.equal(r.runtime_proven,true);
  assert.equal(r.runtime_body_classification,'RUNTIME_BODY_TERMINAL_CLEAN');
  assert.equal(r.task_persistence_ok,false);
  assert.equal(r.task_persistence_classification,'TASK_PERSISTENCE_FAILED_AFTER_RUNTIME_BOUNDARY');
  assert.equal(r.acceptance_candidate,false);
  assert.equal(r.classification,'TASK_PERSISTENCE_FAILED_AFTER_RUNTIME');
});

test('PREPARED/COMMITTING transaction blocks runtime acceptance',()=>{
  const x=base('VERIFIER');
  x.transactions=[{run_id:x.core_locks[0].holder_run_id,status:'PREPARED'}];
  const r=C.analyzeNaturalOccurrence(x);
  assert.equal(r.classification,'RUNTIME_TRANSACTION_UNRESOLVED');
});

test('duplicate runtime lock identity is ambiguous and fails closed',()=>{
  const x=base('SCANNER');
  x.role_locks.push({...x.role_locks[0]});
  const r=C.analyzeNaturalOccurrence(x);
  assert.equal(r.classification,'RUNTIME_BOUNDARY_AMBIGUOUS');
});

test('snapshot audit counts only actual acceptance candidates',()=>{
  const pass=base('SCANNER');
  const fail=base('VERIFIER');
  fail.task_after.enabled=false;
  const r=C.auditSnapshot({
    manifest_headers:C.MANIFEST_HEADERS,
    transaction_headers:C.TRANSACTION_HEADERS,
    occurrences:[pass,fail]
  });
  assert.equal(r.scanner_acceptance_candidates,1);
  assert.equal(r.verifier_acceptance_candidates,0);
  assert.equal(r.pass,false);
});


test('Verifier body failure and task persistence failure are reported independently',()=>{
  const x=base('VERIFIER');
  const run=x.core_locks[0].holder_run_id;
  x.manifests=[manifest('VERIFIER',run,'FROZEN')];
  x.task_after.enabled=false;
  const r=C.analyzeNaturalOccurrence(x);
  assert.equal(r.runtime_boundary_proven,true);
  assert.equal(r.runtime_proven,false);
  assert.equal(r.classification,'RUNTIME_MANIFEST_NOT_TERMINAL');
  assert.equal(r.runtime_body_classification,'RUNTIME_MANIFEST_NOT_TERMINAL');
  assert.equal(r.task_persistence_ok,false);
  assert.equal(r.task_persistence_classification,'TASK_PERSISTENCE_FAILED_AFTER_RUNTIME_BOUNDARY');
  assert.match(r.persistence_blockers.join(' '),/did not remain ON/);
});

test('Scanner pre-Manifest failure still preserves independent task persistence verdict',()=>{
  const x=base('SCANNER');
  x.manifests=[];
  x.task_after.enabled=false;
  const r=C.analyzeNaturalOccurrence(x);
  assert.equal(r.runtime_boundary_proven,true);
  assert.equal(r.runtime_proven,false);
  assert.equal(r.classification,'RUNTIME_MANIFEST_IDENTITY_NOT_EXACT1');
  assert.equal(r.runtime_body_classification,'RUNTIME_MANIFEST_IDENTITY_NOT_EXACT1');
  assert.equal(r.task_persistence_ok,false);
  assert.equal(r.task_persistence_classification,'TASK_PERSISTENCE_FAILED_AFTER_RUNTIME_BOUNDARY');
});
