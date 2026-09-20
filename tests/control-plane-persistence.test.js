'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const P=require('../server/control-plane-persistence.js');

const identity=(role)=>({
  task_id:role==='SCANNER'?'scanner-current-id':'verifier-current-id',
  title:role==='SCANNER'?'KK Discovery Scanner — Current Policy':'KK GPT Verifier — Current Policy',
  cadence:role==='SCANNER'?'RRULE:FREQ=HOURLY;BYMINUTE=0':'RRULE:FREQ=HOURLY;BYMINUTE=30',
  timezone:'Asia/Bangkok',
  prompt_fingerprint:role==='SCANNER'?'scanner-fingerprint':'verifier-fingerprint',
  enabled:true
});

function bangkokAt(role,index){
  const hour=10+index;
  const minute=role==='SCANNER'?'00':'30';
  return `2026-09-21T${String(hour).padStart(2,'0')}:${minute}:00+07:00`;
}

function occurrence(role,index){
  const scheduled=bangkokAt(role,index);
  const run=role==='SCANNER'
    ?`SCV-PERSIST-${index}`
    :`GPTV-PERSIST-${index}`;
  const task=identity(role);
  const manifest={
    manifest_id:`M-${run}`,
    run_id:run,
    role,
    fencing_token:`FENCE-${index}`,
    status:'FINISHED_PARTIAL'
  };
  const base={
    role,
    origin:'NATURAL_SCHEDULED',
    manual:false,
    backfilled:false,
    scheduled_at:scheduled,
    task_before:{...task},
    task_after:{...task},
    launcher_before:'2026-09-21T09:00:00+07:00',
    launcher_after:scheduled,
    core_locks:[{
      scope_key:'CORE',
      holder_run_id:run,
      status:'RELEASED',
      acquired_at:'2026-09-21T09:00:01+07:00',
      lease_until:'2026-09-21T09:20:01+07:00',
      lease_version:index+1,
      fencing_token:`CORE-${index+1}`
    }],
    role_locks:[{
      scope_key:role,
      holder_run_id:run,
      status:'RELEASED',
      acquired_at:'2026-09-21T09:00:02+07:00',
      lease_until:'2026-09-21T09:20:02+07:00',
      lease_version:index+1,
      fencing_token:`${role}-${index+1}`
    }],
    manifests:[manifest],
    transactions:[]
  };
  if(role==='VERIFIER'){
    base.verifier_manifest_readback={
      expected:{...manifest},
      max_attempts:3,
      attempts:[[],[{...manifest,status:'FROZEN'}]]
    };
  }else{
    base.scanner_due_work={
      occurrence_id:run,
      buckets:{
        p0_preemption:[],
        current_pack:[],
        missed_pack_catch_forward:[],
        regression_debt:[]
      }
    };
    base.scanner_planner_readback=[];
  }
  return base;
}

function snapshot(){
  const occurrences=[];
  for(let i=0;i<6;i++){
    occurrences.push(occurrence('SCANNER',i));
    occurrences.push(occurrence('VERIFIER',i));
  }
  return {
    canonical_tasks:{SCANNER:identity('SCANNER'),VERIFIER:identity('VERIFIER')},
    occurrences
  };
}

test('exact six natural Scanner and Verifier occurrences pass only with role-specific evidence',()=>{
  const r=P.auditPersistenceSnapshot(snapshot());
  assert.equal(r.pass,true);
  assert.equal(r.scanner.consecutive,6);
  assert.equal(r.verifier.consecutive,6);
  assert.equal(r.scanner.acceptance_credit,6);
  assert.equal(r.verifier.acceptance_credit,6);
  assert.equal(r.production_stable_authorized,false);
  assert.equal(r.hf_production_activation_authorized,false);
});

test('manual or backfilled occurrence receives zero persistence credit',()=>{
  const s=snapshot();
  s.occurrences.find(x=>x.role==='SCANNER'&&x.scheduled_at.includes('12:00')).manual=true;
  const r=P.auditPersistenceSnapshot(s);
  assert.equal(r.pass,false);
  assert.equal(r.scanner.acceptance_credit,0);
  assert.ok(r.scanner.rejected_occurrences.some(x=>x.classification==='NATURAL_PROVENANCE_REJECTED'));
});

test('task identity rotation inside the streak is rejected',()=>{
  const s=snapshot();
  const row=s.occurrences.find(x=>x.role==='VERIFIER'&&x.scheduled_at.includes('13:30'));
  row.task_after.task_id='rotated-task-id';
  const r=P.auditPersistenceSnapshot(s);
  assert.equal(r.pass,false);
  assert.equal(r.verifier.acceptance_credit,0);
  assert.ok(r.verifier.rejected_occurrences.some(x=>x.classification==='TASK_IDENTITY_DRIFT'));
});

test('Verifier cannot receive persistence credit without bounded immutable Manifest readback evidence',()=>{
  const s=snapshot();
  delete s.occurrences.find(x=>x.role==='VERIFIER'&&x.scheduled_at.includes('14:30')).verifier_manifest_readback;
  const r=P.auditPersistenceSnapshot(s);
  assert.equal(r.pass,false);
  assert.ok(r.verifier.rejected_occurrences.some(x=>x.blockers.includes('VERIFIER_MANIFEST_READBACK_EVIDENCE_MISSING')));
});

test('Scanner cannot receive persistence credit without deterministic due-work and exact Planner readback',()=>{
  const s=snapshot();
  delete s.occurrences.find(x=>x.role==='SCANNER'&&x.scheduled_at.includes('14:00')).scanner_planner_readback;
  const r=P.auditPersistenceSnapshot(s);
  assert.equal(r.pass,false);
  assert.ok(r.scanner.rejected_occurrences.some(x=>x.blockers.includes('SCANNER_PLANNER_READBACK_MISSING')));
});

test('a missing natural hourly slot fails the six-run acceptance window',()=>{
  const s=snapshot();
  s.occurrences=s.occurrences.filter(x=>!(x.role==='SCANNER'&&x.scheduled_at.includes('13:00')));
  const r=P.auditPersistenceSnapshot(s);
  assert.equal(r.pass,false);
  assert.equal(r.scanner.detail_classification,'PERSISTENCE_WINDOW_GAP');
  assert.equal(r.scanner.acceptance_credit,0);
});

test('duplicate natural boundary is rejected instead of choosing one occurrence',()=>{
  const s=snapshot();
  const duplicate=JSON.parse(JSON.stringify(s.occurrences.find(x=>x.role==='VERIFIER'&&x.scheduled_at.includes('15:30'))));
  s.occurrences.push(duplicate);
  const r=P.auditPersistenceSnapshot(s);
  assert.equal(r.pass,false);
  assert.equal(r.verifier.detail_classification,'PERSISTENCE_WINDOW_DUPLICATE_SLOT');
});
