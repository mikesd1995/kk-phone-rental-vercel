'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const A=require('../server/canary-acceptance');

function definition(id='CANARY-01'){
  return {
    test_id:id,
    scenario:'Duplicate event',
    expected_result:'DEDUP; no second final Show',
    enabled:true,
    policy_version:'v4.9.2',
    isolation_namespace:`TEST|${id}`,
    last_run_id:'CANARY|20260919|0815|TEST',
    last_result:'PASS',
    actual_result:'CANARY_SYNTHETIC_PASS|ASSERTION_EVIDENCE_BOUND|PRODUCTION_WRITES=0',
    production_writes:'0'
  };
}

function workspace(id='CANARY-01'){
  return {
    run_id:'CANARY|20260919|0815|TEST',
    test_id:id,
    synthetic_entity_id:`TEST|${id}|20260919`,
    input_state:'existing Show fingerprint + identical duplicate candidate',
    synthetic_evidence:'same canonical identity/date/venue/ticket round independently evaluated',
    expected_decision:'DEDUP; no second final Show',
    actual_decision:'DEDUP_NO_SECOND_SHOW',
    expected_write_boundary:'CANARY_WORKSPACE_ONLY; PRODUCTION=0',
    actual_write_count:'0',
    result:'PASS',
    ran_at:'2026-09-19T08:15:10+07:00'
  };
}

function provenance(){
  return {
    run_id:'CANARY|20260919|0815|TEST',
    task_id:'canary-task-id',
    expected_task_id:'canary-task-id',
    task_title:'KK Canary Safety — Enabled Suite',
    expected_task_title:'KK Canary Safety — Enabled Suite',
    task_enabled_before:true,
    task_enabled_after:true,
    scheduled_at:'2026-09-19T08:15:00+07:00',
    task_last_run_time:'2026-09-19T08:15:30+07:00',
    run_at:'2026-09-19T08:15:10+07:00',
    matching_lock_count:0,
    matching_reconciliation_count:0
  };
}

test('accepts scenario-specific zero-write synthetic proof with natural attribution',()=>{
  const r=A.auditCanarySnapshot({
    run_id:'CANARY|20260919|0815|TEST',
    definition_snapshot_frozen:true,
    definition_snapshot_drift:false,
    definitions:[definition()],
    workspace:[workspace()],
    provenance:provenance()
  });
  assert.equal(r.ok,true);
  assert.equal(r.structural_completeness,true);
  assert.equal(r.scenario_specific_assertions,true);
  assert.equal(r.zero_production_writes,true);
  assert.equal(r.natural_runtime_attribution,true);
  assert.equal(r.classification,'CANARY_SYNTHETIC_ACCEPTED_NATURAL_ATTRIBUTED');
  assert.equal(r.production_or_provider_proof,false);
  assert.equal(r.production_cutover_authorized,false);
});

test('natural Canary attribution does not invent a mandatory Run_Lock or reconciliation gate',()=>{
  const p=provenance();
  p.matching_lock_count=0;
  p.matching_reconciliation_count=0;
  const r=A.provenanceAudit(p,'CANARY|20260919|0815|TEST');
  assert.equal(r.natural_runtime_attribution,true);
  assert.equal(r.reasons.length,0);
  assert.deepEqual(r.optional_evidence,{
    matching_lock_count:0,
    matching_reconciliation_count:0
  });
});


test('accepts definition-specific frozen marker without requiring expected-result text copy',()=>{
  const ws=workspace();
  ws.expected_decision='frozen definition CANARY-01';
  const r=A.auditCanarySnapshot({
    run_id:'CANARY|20260919|0815|TEST',
    definition_snapshot_frozen:true,
    definition_snapshot_drift:false,
    definitions:[definition()],
    workspace:[ws],
    provenance:provenance()
  });
  assert.equal(r.scenario_specific_assertions,true);
  assert.equal(r.synthetic_acceptance,true);
});

test('requires explicit frozen definition snapshot and clean drift state',()=>{
  const r=A.auditCanarySnapshot({
    run_id:'CANARY|20260919|0815|TEST',
    definitions:[definition()],
    workspace:[workspace()],
    provenance:provenance()
  });
  assert.equal(r.structural_completeness,false);
  assert.ok(r.structural_errors.includes('DEFINITION_SNAPSHOT_NOT_PROVEN_FROZEN'));
  assert.ok(r.structural_errors.includes('DEFINITION_SNAPSHOT_DRIFT_STATE_NOT_CLEAN'));
});

test('rejects the Sep18-style generic frozen boundary and safe-branch markers',()=>{
  const ws=workspace();
  ws.input_state='isolated current-run scenario branch for CANARY-01';
  ws.synthetic_evidence='independent synthetic assertion executed from frozen CANARY-01 definition; fail-closed/write-boundary invariant evaluated; production side-effect counter=0';
  ws.expected_decision='FROZEN_DEFINITION_BOUNDARY';
  ws.actual_decision='CANARY_01_SAFE_BRANCH_ASSERTED';

  const r=A.auditCanarySnapshot({
    run_id:'CANARY|20260919|0815|TEST',
    definition_snapshot_frozen:true,
    definition_snapshot_drift:false,
    definitions:[definition()],
    workspace:[ws],
    provenance:provenance()
  });
  assert.equal(r.structural_completeness,true);
  assert.equal(r.zero_production_writes,true);
  assert.equal(r.scenario_specific_assertions,false);
  assert.equal(r.synthetic_acceptance,false);
  assert.equal(r.classification,'CANARY_STRUCTURAL_PASS_ASSERTION_EVIDENCE_REJECTED');
  assert.ok(r.assertion_errors.includes('CANARY-01:EXPECTED_DECISION_NOT_BOUND_TO_FROZEN_DEFINITION'));
  assert.ok(r.assertion_errors.includes('CANARY-01:GENERIC_EXPECTED_DECISION_REJECTED'));
  assert.ok(r.assertion_errors.includes('CANARY-01:SCENARIO_SPECIFIC_INPUT_STATE_REQUIRED'));
  assert.ok(r.assertion_errors.includes('CANARY-01:SCENARIO_SPECIFIC_SYNTHETIC_EVIDENCE_REQUIRED'));
  assert.ok(r.assertion_errors.includes('CANARY-01:SCENARIO_SPECIFIC_ACTUAL_DECISION_REQUIRED'));
});

test('rejects any production write count above zero',()=>{
  const ws=workspace();
  ws.actual_write_count='1';
  const r=A.auditCanarySnapshot({
    run_id:'CANARY|20260919|0815|TEST',
    definition_snapshot_frozen:true,
    definition_snapshot_drift:false,
    definitions:[definition()],
    workspace:[ws],
    provenance:provenance()
  });
  assert.equal(r.zero_production_writes,false);
  assert.equal(r.synthetic_acceptance,false);
  assert.ok(r.write_errors.includes('CANARY-01:WORKSPACE_PRODUCTION_WRITES_NOT_ZERO'));
});

test('rejects duplicate enabled Test IDs and isolation namespaces',()=>{
  const d1=definition();
  const d2=definition();
  const r=A.auditCanarySnapshot({
    definitions:[d1,d2],
    workspace:[workspace()],
    provenance:provenance()
  });
  assert.equal(r.structural_completeness,false);
  assert.ok(r.structural_errors.includes('ENABLED_TEST_IDS_MUST_BE_NONBLANK_UNIQUE'));
  assert.ok(r.structural_errors.includes('ENABLED_ISOLATION_NAMESPACES_MUST_BE_NONBLANK_UNIQUE'));
});

test('requires exact enabled/workspace set equality',()=>{
  const d1=definition('CANARY-01');
  const d2=definition('CANARY-02');
  d2.scenario='Date conflict';
  d2.expected_result='P0 CONFLICT; preserve previous final date';
  d2.isolation_namespace='TEST|CANARY-02';
  const r=A.auditCanarySnapshot({
    run_id:'CANARY|20260919|0815|TEST',
    definition_snapshot_frozen:true,
    definition_snapshot_drift:false,
    definitions:[d1,d2],
    workspace:[workspace('CANARY-01')],
    provenance:provenance()
  });
  assert.equal(r.structural_completeness,false);
  assert.ok(r.structural_errors.includes('ENABLED_COUNT_MUST_EQUAL_WORKSPACE_COUNT'));
  assert.ok(r.structural_errors.includes('WORKSPACE_TEST_SET_MISMATCH:CANARY-02'));
});

test('scenario-specific synthetic proof does not imply natural scheduler attribution',()=>{
  const p=provenance();
  p.task_enabled_before=false;
  p.task_enabled_after=false;
  p.task_last_run_time='2026-09-14T08:19:00+07:00';

  const r=A.auditCanarySnapshot({
    run_id:'CANARY|20260919|0815|TEST',
    definition_snapshot_frozen:true,
    definition_snapshot_drift:false,
    definitions:[definition()],
    workspace:[workspace()],
    provenance:p
  });
  assert.equal(r.synthetic_acceptance,true);
  assert.equal(r.natural_runtime_attribution,false);
  assert.equal(r.classification,'CANARY_SYNTHETIC_ACCEPTED_RUNTIME_UNATTRIBUTED');
  assert.ok(r.provenance_reasons.includes('TASK_NOT_PROVEN_ON_BEFORE_RUN'));
  assert.ok(r.provenance_reasons.includes('TASK_NOT_PROVEN_ON_AFTER_RUN'));
  assert.ok(r.provenance_reasons.includes('TASK_LAST_RUN_NOT_BOUND_TO_RUN_WINDOW'));
  assert.ok(!r.provenance_reasons.includes('MATCHING_RUN_LOCK_EXACT1_REQUIRED'));
  assert.ok(!r.provenance_reasons.includes('MATCHING_RECONCILIATION_REQUIRED'));
});

test('rejects a run that is not bound to the scheduled Canary window',()=>{
  const p=provenance();
  p.run_at='2026-09-19T10:00:00+07:00';
  p.task_last_run_time='2026-09-19T10:00:05+07:00';
  const r=A.provenanceAudit(p,'CANARY|20260919|0815|TEST');
  assert.equal(r.natural_runtime_attribution,false);
  assert.ok(r.reasons.includes('RUN_NOT_BOUND_TO_SCHEDULED_WINDOW'));
});

test('rejects task identity drift for natural attribution',()=>{
  const p=provenance();
  p.task_id='different-task';
  p.task_title='Different Canary';
  const r=A.provenanceAudit(p,'CANARY|20260919|0815|TEST');
  assert.equal(r.natural_runtime_attribution,false);
  assert.ok(r.reasons.includes('TASK_ID_MISMATCH'));
  assert.ok(r.reasons.includes('TASK_TITLE_MISMATCH'));
});

test('actual decision cannot simply copy expected text',()=>{
  const ws=workspace();
  ws.actual_decision=ws.expected_decision;
  const r=A.auditCanarySnapshot({
    run_id:'CANARY|20260919|0815|TEST',
    definition_snapshot_frozen:true,
    definition_snapshot_drift:false,
    definitions:[definition()],
    workspace:[ws],
    provenance:provenance()
  });
  assert.equal(r.scenario_specific_assertions,false);
  assert.ok(r.assertion_errors.includes('CANARY-01:ACTUAL_DECISION_MUST_BE_INDEPENDENT_OF_EXPECTED_TEXT'));
});

test('synthetic entity must be bound to the enabled isolation namespace',()=>{
  const ws=workspace();
  ws.synthetic_entity_id='OTHER|ENTITY';
  const r=A.auditCanarySnapshot({
    run_id:'CANARY|20260919|0815|TEST',
    definition_snapshot_frozen:true,
    definition_snapshot_drift:false,
    definitions:[definition()],
    workspace:[ws],
    provenance:provenance()
  });
  assert.equal(r.scenario_specific_assertions,false);
  assert.ok(r.assertion_errors.includes('CANARY-01:SYNTHETIC_ENTITY_NOT_BOUND_TO_ISOLATION_NAMESPACE'));
});
