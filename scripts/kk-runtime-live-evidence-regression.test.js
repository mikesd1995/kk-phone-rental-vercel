'use strict';

const assert=require('assert');
const observer=require('../lib/kk-runtime-observer-contract');
const investigate=require('../lib/kk-investigate-contract');

let n=0;
function ok(v,m){assert(v,m);n++;}
function eq(a,b,m){assert.deepStrictEqual(a,b,m);n++;}
function ms(s){return Date.parse(s);}

// Captured read-only production evidence from 2026-09-10 Asia/Bangkok.
// This fixture is intentionally immutable historical regression evidence, not a live connector.
function validRuntime({leaseVersion,previousLeaseVersion,workCount,taskEnabledAfter}){
  return {
    manual_trigger:false,
    task_enabled_before:true,
    task_enabled_after:taskEnabledAfter,
    lease_acquired:true,
    lease_version:leaseVersion,
    previous_lease_version:previousLeaseVersion,
    duplicate_fence_observed:false,
    manifest_count:1,
    manifest_frozen_before_mutation:true,
    actual_runtime_evidence_count:workCount,
    legitimate_noop:false,
    terminal_manifest:true,
    lease_released:true,
    unresolved_prepared_committing:0,
    candidate_orphans:0,
    ai_orphans:0,
    unauthorized_outbound_claim:false
  };
}

const scanner1400=observer.observeExpectedOccurrence({
  expected_at_ms:ms('2026-09-10T14:00:00+07:00'),
  runtime_observed_at_ms:ms('2026-09-10T14:02:22+07:00'),
  now_ms:ms('2026-09-10T14:13:09+07:00'),
  grace_ms:5*60*1000,
  runtime_input:validRuntime({leaseVersion:266,previousLeaseVersion:265,workCount:8,taskEnabledAfter:false})
});
eq(scanner1400.status,'INCIDENT','14:00 Scanner is not full runtime acceptance because task later disabled');
eq(scanner1400.reasons,['TASK_DISABLED_AFTER'],'14:00 Scanner preserves post-run control-plane failure without inventing data-plane failure');
ok(scanner1400.machine_sot_runtime_observed,'14:00 Scanner Machine SOT runtime boundary is proven');

const verifier1430=observer.observeExpectedOccurrence({
  expected_at_ms:ms('2026-09-10T14:30:00+07:00'),
  runtime_observed_at_ms:ms('2026-09-10T14:28:48+07:00'),
  now_ms:ms('2026-09-10T14:46:08+07:00'),
  grace_ms:5*60*1000,
  runtime_input:validRuntime({leaseVersion:256,previousLeaseVersion:255,workCount:1,taskEnabledAfter:false})
});
eq(verifier1430.status,'INCIDENT','14:30 Verifier is not full runtime acceptance because task later disabled');
eq(verifier1430.reasons,['TASK_DISABLED_AFTER'],'14:30 Verifier data-plane success is separated from post-run task-off incident');
ok(verifier1430.machine_sot_runtime_observed,'14:30 Verifier Machine SOT runtime boundary is proven');

const scanner1500=observer.observeExpectedOccurrence({
  expected_at_ms:ms('2026-09-10T15:00:00+07:00'),
  runtime_observed_at_ms:ms('2026-09-10T15:01:56+07:00'),
  now_ms:ms('2026-09-10T15:27:10+07:00'),
  grace_ms:5*60*1000,
  runtime_input:validRuntime({leaseVersion:267,previousLeaseVersion:266,workCount:9,taskEnabledAfter:false})
});
eq(scanner1500.status,'INCIDENT','15:00 Scanner is not full runtime acceptance because task later disabled');
eq(scanner1500.reasons,['TASK_DISABLED_AFTER'],'15:00 Scanner post-run task-off recurrence remains explicit');
ok(scanner1500.machine_sot_runtime_observed,'15:00 Scanner Machine SOT runtime boundary is proven');

const verifier1530=observer.observeExpectedOccurrence({
  expected_at_ms:ms('2026-09-10T15:30:00+07:00'),
  now_ms:ms('2026-09-10T15:46:03+07:00'),
  grace_ms:5*60*1000,
  launcher_trigger_observed:true
});
eq(verifier1530.status,'INCIDENT','15:30 Verifier runtime proof gap is incident');
eq(verifier1530.reasons,['LAUNCHER_FIRED_RUNTIME_BOUNDARY_MISSING'],'task metadata fire is not misclassified as scheduler-not-fired');
ok(verifier1530.control_plane_trigger_observed&&!verifier1530.machine_sot_runtime_observed,'15:30 preserves launcher evidence while denying runtime proof');

const window=[scanner1400,verifier1430,scanner1500,verifier1530];
const layers=observer.evidenceLayerSummary(window);
eq(layers.evaluated,4,'four post-rearm expected occurrences evaluated');
eq(layers.launcher_trigger_observed,4,'all four have control-plane trigger evidence directly or via Machine SOT runtime');
eq(layers.machine_sot_runtime_observed,3,'three of four have Machine SOT runtime boundaries');
eq(layers.launcher_only_runtime_gaps,1,'one launcher-only runtime boundary gap remains');
eq(layers.runtime_boundary_percent,75,'Machine SOT runtime-boundary coverage is 75 percent in captured window');

const slo=observer.runnerSlo(window,{target_ratio:0.99});
eq(slo.passed,0,'strict full-occurrence acceptance has no clean pass in captured window');
eq(slo.p0_incidents,4,'all four captured occurrences contain P0 reliability incidents');
eq(slo.percent,0,'strict control+runtime SLO is zero percent for captured window');
ok(!slo.target_met,'captured window cannot satisfy production reliability target');

const closure=observer.closureHealth({
  unresolved_prepared_committing:0,
  stale_active_leases:0,
  running_manifests_past_deadline:0,
  candidate_orphans:0,
  ai_orphans:0
});
ok(closure.healthy,'transaction/lock/handoff closure can be healthy while scheduler reliability is degraded');

const rca=investigate.investigationStatus({
  incident_code:'LAUNCHER_FIRED_RUNTIME_BOUNDARY_MISSING',
  observed_facts:[
    'Verifier task metadata advanced to 15:33:35 Asia/Bangkok',
    'No canonical 15:30 Verifier Run_Lock or Run_Manifest was visible through 15:46',
    'Exact canonical Verifier task was re-armed unchanged'
  ],
  evidence_refs:[
    '_Reconciliation_Log:RECON|SYSTEM-CLOSURE|VERIFIER-1530-RUNTIME-GAP|20260910T154603',
    'automation:6a992d4d0c248191914e6c73c4f17db4'
  ],
  mitigation_applied:true,
  actor:'scheduler platform',
  actor_proven:false,
  actor_evidence_refs:[]
});
eq(rca.stage,'MITIGATED_ROOT_CAUSE_OPEN','15:30 gap remains mitigation-only RCA state');
eq(rca.actor,'UNKNOWN','actor attribution remains unknown without evidence');
ok(!rca.root_cause_closed,'15:30 incident cannot be closed from metadata-only evidence');

const permanentFix=investigate.repairAuthorization({
  incident_code:'LAUNCHER_FIRED_RUNTIME_BOUNDARY_MISSING',
  observed_facts:['launcher metadata advanced but Machine SOT runtime boundary absent'],
  evidence_refs:['_Reconciliation_Log:VERIFIER-1530-RUNTIME-GAP'],
  mitigation_applied:true,
  mitigation_safe_and_reversible:true,
  requested_action:'PERMANENT_FIX'
});
ok(!permanentFix.allowed,'permanent scheduler fix is denied without mechanism proof');
ok(permanentFix.reasons.includes('MECHANISM_PROOF_REQUIRED_BEFORE_PERMANENT_FIX'),'root-cause-first gate explains denial');

console.log(`kk-runtime-live-evidence-regression: ${n}/${n} PASS`);
