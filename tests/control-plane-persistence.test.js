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
    base.scanner_run_coverage=[{run_id:run,coverage_family:'OFFICIAL',status:'COVERED'}];
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


test('live task-registry prompt can be fingerprinted without precomputed prompt_fingerprint',()=>{
  const s=snapshot();
  for(const task of Object.values(s.canonical_tasks)){
    const role=task.task_id.startsWith('scanner')?'SCANNER':'VERIFIER';
    delete task.prompt_fingerprint;
    task.prompt=`${role} canonical live-SOT launcher`;
  }
  for(const row of s.occurrences){
    const prompt=`${row.role} canonical live-SOT launcher`;
    for(const task of [row.task_before,row.task_after]){
      delete task.prompt_fingerprint;
      task.prompt=prompt;
    }
  }
  const r=P.auditPersistenceSnapshot(s);
  assert.equal(r.pass,true);
  assert.match(r.scanner.occurrences[0].task_id,/scanner-current-id/);
});

test('raw prompt drift inside a natural occurrence is rejected after fingerprint derivation',()=>{
  const s=snapshot();
  for(const task of Object.values(s.canonical_tasks)){
    delete task.prompt_fingerprint;
    task.prompt=task.task_id.startsWith('scanner')
      ?'SCANNER canonical live-SOT launcher'
      :'VERIFIER canonical live-SOT launcher';
  }
  for(const row of s.occurrences){
    const prompt=`${row.role} canonical live-SOT launcher`;
    for(const task of [row.task_before,row.task_after]){
      delete task.prompt_fingerprint;
      task.prompt=prompt;
    }
  }
  const row=s.occurrences.find(x=>x.role==='SCANNER'&&x.scheduled_at.includes('13:00'));
  row.task_after.prompt='SCANNER mutated launcher prompt';
  const r=P.auditPersistenceSnapshot(s);
  assert.equal(r.pass,false);
  assert.equal(r.scanner.acceptance_credit,0);
  assert.ok(r.scanner.rejected_occurrences.some(x=>x.classification==='TASK_IDENTITY_DRIFT'));
});


test('canonical GLOBAL lock scopes prove the same runtime boundary as legacy aliases',()=>{
  const s=snapshot();
  for(const row of s.occurrences){
    row.core_locks[0].scope_key='CORE_SHARED_WRITER';
    row.role_locks[0].scope_key=row.role==='SCANNER'?'SCANNER_GLOBAL':'VERIFIER_GLOBAL';
  }
  const r=P.auditPersistenceSnapshot(s);
  assert.equal(r.pass,true);
  assert.equal(r.scanner.acceptance_credit,6);
  assert.equal(r.verifier.acceptance_credit,6);
});

test('Scanner cannot receive persistence credit without at least one owned _Run_Coverage row',()=>{
  const s=snapshot();
  delete s.occurrences.find(x=>x.role==='SCANNER'&&x.scheduled_at.includes('14:00')).scanner_run_coverage;
  const r=P.auditPersistenceSnapshot(s);
  assert.equal(r.pass,false);
  assert.equal(r.scanner.acceptance_credit,0);
  assert.ok(r.scanner.rejected_occurrences.some(x=>x.blockers.includes('SCANNER_RUN_COVERAGE_EVIDENCE_MISSING')));
});

test('Scanner rejects coverage rows belonging to another runtime',()=>{
  const s=snapshot();
  const row=s.occurrences.find(x=>x.role==='SCANNER'&&x.scheduled_at.includes('14:00'));
  row.scanner_run_coverage=[{run_id:'OTHER-RUN',coverage_family:'OFFICIAL',status:'COVERED'}];
  const r=P.auditPersistenceSnapshot(s);
  assert.equal(r.pass,false);
  assert.ok(r.scanner.rejected_occurrences.some(x=>x.blockers.includes('SCANNER_RUN_COVERAGE_EMPTY')));
});

const DAILY_CADENCE={
  SCANNER:'BEGIN:VEVENT\nDTSTART;TZID=Asia/Bangkok:20260924T210000\nRRULE:FREQ=DAILY;BYHOUR=1,9,12,15,18,21;BYMINUTE=0;BYSECOND=0;UNTIL=20261231T235959\nEND:VEVENT',
  VERIFIER:'BEGIN:VEVENT\nDTSTART;TZID=Asia/Bangkok:20260924T213000\nRRULE:FREQ=DAILY;BYHOUR=1,7,9,12,15,18,21;BYMINUTE=30;BYSECOND=0;UNTIL=20261231T235959\nEND:VEVENT'
};

function dailySnapshot(overnight=false){
  const s=snapshot();
  const slots=overnight?{
    SCANNER:['14T15:00','14T18:00','14T21:00','15T01:00','15T09:00','15T12:00'],
    VERIFIER:['14T18:30','14T21:30','15T01:30','15T07:30','15T09:30','15T12:30']
  }:{
    SCANNER:['15T01:00','15T09:00','15T12:00','15T15:00','15T18:00','15T21:00'],
    VERIFIER:['15T07:30','15T09:30','15T12:30','15T15:30','15T18:30','15T21:30']
  };
  for(const role of ['SCANNER','VERIFIER']){
    s.canonical_tasks[role].cadence=DAILY_CADENCE[role];
    s.occurrences.filter(row=>row.role===role).forEach((row,index)=>{
      row.scheduled_at='2026-10-'+slots[role][index]+':00+07:00';
      row.launcher_after=row.scheduled_at;
      row.task_before.cadence=DAILY_CADENCE[role];
      row.task_after.cadence=DAILY_CADENCE[role];
    });
  }
  return s;
}

function replaceRoleCadence(s,role,cadence){
  s.canonical_tasks[role].cadence=cadence;
  for(const row of s.occurrences.filter(row=>row.role===role)){
    row.task_before.cadence=cadence;
    row.task_after.cadence=cadence;
  }
}

test('current explicit daily cadences count six scheduled occurrences without inventing hourly gaps',()=>{
  const r=P.auditPersistenceSnapshot(dailySnapshot());
  assert.equal(r.pass,true);
  assert.equal(r.scanner.consecutive,6);
  assert.equal(r.verifier.consecutive,6);
  assert.equal(r.production_writes,0);
  assert.equal(r.task_mutations,0);
  assert.equal(r.production_stable_authorized,false);
  assert.equal(r.hf_production_activation_authorized,false);
});

test('sparse cadence acceptance follows the canonical slots across Bangkok midnight',()=>{
  const r=P.auditPersistenceSnapshot(dailySnapshot(true));
  assert.equal(r.pass,true);
  assert.equal(r.scanner.acceptance_credit,6);
  assert.equal(r.verifier.acceptance_credit,6);
});

test('missing one required daily slot cannot be repaired by counting other receipts',()=>{
  const s=dailySnapshot();
  s.occurrences=s.occurrences.filter(row=>!(row.role==='SCANNER'&&row.scheduled_at.includes('18:00')));
  const r=P.auditPersistenceSnapshot(s);
  assert.equal(r.pass,false);
  assert.equal(r.scanner.detail_classification,'PERSISTENCE_WINDOW_GAP');
  assert.equal(r.scanner.missing_slots,1);
  assert.equal(r.scanner.acceptance_credit,0);
});

test('an extra off-cadence natural receipt invalidates the window despite six valid scheduled receipts',()=>{
  const s=dailySnapshot();
  const extra=structuredClone(s.occurrences.find(row=>row.role==='SCANNER'));
  extra.scheduled_at='2026-10-15T20:00:00+07:00';
  extra.launcher_after=extra.scheduled_at;
  s.occurrences.push(extra);
  const r=P.auditPersistenceSnapshot(s);
  assert.equal(r.pass,false);
  assert.equal(r.scanner.acceptance_credit,0);
  assert.ok(r.scanner.rejected_occurrences.some(row=>row.classification==='NATURAL_SCHEDULE_OUTSIDE_CANONICAL_CADENCE'));
});

test('nonzero scheduled seconds cannot receive natural runtime acceptance',()=>{
  const s=snapshot();
  const row=s.occurrences.find(row=>row.role==='SCANNER');
  row.scheduled_at=row.scheduled_at.replace(':00+07:00',':30+07:00');
  row.launcher_after=row.scheduled_at;
  const r=P.evaluateNaturalOccurrence(row,{canonical_task:s.canonical_tasks.SCANNER});
  assert.equal(r.ok,false);
  assert.equal(r.classification,'NATURAL_SCHEDULE_OUTSIDE_CANONICAL_CADENCE');
});

test('missing malformed unsupported or role-mismatched cadence fails closed without hourly fallback',()=>{
  const invalid=[
    '',
    'RRULE:FREQ=DAILY;BYMINUTE=0',
    'RRULE:FREQ=HOURLY;INTERVAL=2;BYMINUTE=0',
    'RRULE:FREQ=HOURLY;BYMINUTE=30',
    'RRULE:FREQ=HOURLY;BYMINUTE=0;BYSECOND=30',
    'RRULE:FREQ=WEEKLY;BYMINUTE=0',
    'RRULE:FREQ=HOURLY;BYMINUTE=0;BYDAY=MO',
    'RRULE:FREQ=HOURLY;FREQ=HOURLY;BYMINUTE=0',
    'RRULE:FREQ=DAILY;BYHOUR=1,1,9;BYMINUTE=0',
    'RRULE:FREQ=DAILY;BYHOUR=1,24;BYMINUTE=0',
    'RRULE:FREQ=HOURLY;BYMINUTE=0;UNTIL=20260230T000000',
    'RRULE:FREQ=HOURLY;BYMINUTE=0\nRRULE:FREQ=HOURLY;BYMINUTE=0',
    'BEGIN:VEVENT\nDTSTART;TZID=UTC:20260901T100000\nRRULE:FREQ=HOURLY;BYMINUTE=0\nEND:VEVENT'
  ];
  for(const cadence of invalid){
    const s=snapshot();
    replaceRoleCadence(s,'SCANNER',cadence);
    const r=P.auditPersistenceSnapshot(s);
    assert.equal(r.pass,false,cadence||'missing cadence');
    assert.equal(r.scanner.classification,'CANONICAL_CADENCE_INVALID',cadence||'missing cadence');
    assert.equal(r.scanner.acceptance_credit,0);
  }
});

test('finite schedule start and expiry are enforced instead of crediting out-of-range occurrences',()=>{
  for(const boundary of ['DTSTART;TZID=Asia/Bangkok:20261016T000000','UNTIL=20261014T235959']){
    const s=dailySnapshot();
    const cadence=boundary.startsWith('DTSTART')
      ?DAILY_CADENCE.SCANNER.replace('DTSTART;TZID=Asia/Bangkok:20260924T210000',boundary)
      :DAILY_CADENCE.SCANNER.replace('UNTIL=20261231T235959',boundary);
    replaceRoleCadence(s,'SCANNER',cadence);
    const r=P.auditPersistenceSnapshot(s);
    assert.equal(r.pass,false,boundary);
    assert.equal(r.scanner.acceptance_credit,0);
    assert.ok(r.scanner.occurrences.some(row=>row.classification==='NATURAL_SCHEDULE_OUTSIDE_CANONICAL_CADENCE'));
  }
});

test('five daily receipts remain insufficient even when each occurrence is valid',()=>{
  const s=dailySnapshot();
  s.occurrences=s.occurrences.filter(row=>!(row.role==='SCANNER'&&row.scheduled_at.includes('01:00')));
  const r=P.auditPersistenceSnapshot(s);
  assert.equal(r.scanner.occurrences.every(row=>row.ok),true);
  assert.equal(r.scanner.acceptance_credit,0);
  assert.equal(r.pass,false);
});

test('nonzero DTSTART seconds without BYSECOND cannot imply zero-second natural slots',()=>{
  for(const role of ['SCANNER','VERIFIER']){
    const s=snapshot();
    const minute=role==='SCANNER'?'00':'30';
    const cadence=`BEGIN:VEVENT\nDTSTART;TZID=Asia/Bangkok:20260901T09${minute}30\nRRULE:FREQ=HOURLY;BYMINUTE=${Number(minute)}\nEND:VEVENT`;
    replaceRoleCadence(s,role,cadence);
    const r=P.auditPersistenceSnapshot(s);
    assert.equal(r.pass,false,role);
    assert.equal(r[role.toLowerCase()].classification,'CANONICAL_CADENCE_INVALID');
    assert.equal(r[role.toLowerCase()].acceptance_credit,0);
  }
});

test('explicit BYSECOND zero overrides nonzero DTSTART seconds for the supported hourly rule',()=>{
  const s=snapshot();
  for(const role of ['SCANNER','VERIFIER']){
    const minute=role==='SCANNER'?'00':'30';
    const cadence=`BEGIN:VEVENT\nDTSTART;TZID=Asia/Bangkok:20260901T09${minute}30\nRRULE:FREQ=HOURLY;BYMINUTE=${Number(minute)};BYSECOND=0\nEND:VEVENT`;
    replaceRoleCadence(s,role,cadence);
  }
  const r=P.auditPersistenceSnapshot(s);
  assert.equal(r.pass,true);
  assert.equal(r.scanner.acceptance_credit,6);
  assert.equal(r.verifier.acceptance_credit,6);
  assert.equal(r.task_mutations,0);
});
