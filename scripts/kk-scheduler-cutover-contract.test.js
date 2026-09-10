'use strict';
const assert=require('assert');
const c=require('../lib/kk-scheduler-cutover-contract');
let n=0;
const ok=(v,m)=>{assert(v,m);n++;};
const eq=(a,b,m)=>{assert.deepStrictEqual(a,b,m);n++;};

function base(){return {
  role:'SCANNER',
  candidate_scheduler_id:'sandbox-clock-1',
  candidate_runtime_capacity_available:true,
  independent_clock:true,
  candidate_production_write_enabled:false,
  shadow_occurrences:6,
  shadow_mismatches:0,
  min_shadow_occurrences:6,
  same_occurrence_semantics:true,
  machine_sot_remains_authority:true,
  shared_fencing_source:true,
  rollback_plan_present:true,
  explicit_owner_approval:true,
  old_scheduler_production_write_enabled:false,
  active_writer_locks:0,
  unresolved_prepared_committing:0,
  old_max_valid_lease_version:269,
  candidate_next_lease_version:270,
  old_scheduler_disabled_readback:true,
  candidate_scheduler_enabled_readback:true
};}

let r=c.shadowReadiness(base());
ok(r.ready,'shadow readiness passes with six clean no-write occurrences');
eq(r.decision,'ALLOW_SHADOW_COMPLETE','shadow completion decision');

r=c.shadowReadiness({...base(),candidate_runtime_capacity_available:false});
ok(!r.ready&&r.reasons.includes('CANDIDATE_RUNTIME_CAPACITY_REQUIRED'),'shadow cannot pass when candidate runtime capacity is unavailable');
r=c.shadowReadiness({...base(),independent_clock:false});
ok(!r.ready&&r.reasons.includes('INDEPENDENT_CLOCK_REQUIRED'),'shadow clock must be independent from current control plane');
r=c.shadowReadiness({...base(),candidate_production_write_enabled:true});
ok(!r.ready&&r.reasons.includes('SHADOW_MUST_BE_NO_WRITE'),'shadow cannot write production');
r=c.shadowReadiness({...base(),shadow_occurrences:5});
ok(!r.ready&&r.reasons.includes('SHADOW_EVIDENCE_INSUFFICIENT'),'insufficient shadow evidence denied');
r=c.shadowReadiness({...base(),shadow_mismatches:1});
ok(!r.ready&&r.reasons.includes('SHADOW_EVIDENCE_INSUFFICIENT'),'shadow mismatch denied');
r=c.shadowReadiness({...base(),same_occurrence_semantics:false});
ok(r.reasons.includes('SAME_OCCURRENCE_SEMANTICS_REQUIRED'),'same occurrence semantics required');
r=c.shadowReadiness({...base(),machine_sot_remains_authority:false});
ok(r.reasons.includes('MACHINE_SOT_AUTHORITY_REQUIRED'),'Machine SOT remains authority');
r=c.shadowReadiness({...base(),shared_fencing_source:false});
ok(r.reasons.includes('SHARED_FENCING_SOURCE_REQUIRED'),'shared fencing source required');
r=c.shadowReadiness({...base(),rollback_plan_present:false});
ok(r.reasons.includes('ROLLBACK_PLAN_REQUIRED'),'rollback plan required in shadow readiness');

r=c.liveWriterSafety({...base(),old_scheduler_production_write_enabled:true,candidate_scheduler_production_write_enabled:true});
ok(!r.safe&&r.reasons.includes('DUAL_PRODUCTION_WRITER_RISK'),'dual production writers denied');
r=c.liveWriterSafety({...base(),active_writer_locks:1});
ok(r.reasons.includes('ACTIVE_WRITER_LOCK_PRESENT'),'active writer lock blocks cutover');
r=c.liveWriterSafety({...base(),unresolved_prepared_committing:1});
ok(r.reasons.includes('UNRESOLVED_TRANSACTION_PRESENT'),'unresolved transaction blocks cutover');
r=c.liveWriterSafety(base());
ok(r.safe,'clean writer state passes');

r=c.fencingContinuity(base());
ok(r.valid,'max+1 fencing continuity passes');
eq(r.expected_next,270,'expected next fencing version is deterministic');
r=c.fencingContinuity({...base(),candidate_next_lease_version:269});
ok(!r.valid&&r.reasons.includes('FENCING_CONTINUITY_REQUIRED'),'reused fence denied');
r=c.fencingContinuity({...base(),candidate_next_lease_version:271});
ok(!r.valid,'skipped independent fence counter denied');
r=c.fencingContinuity({...base(),shared_fencing_source:false});
ok(!r.valid,'separate fencing source denied');

r=c.cutoverAuthorization(base());
ok(r.allowed,'fully proven controlled cutover may be authorized');
eq(r.decision,'ALLOW_CONTROLLED_CUTOVER','cutover decision explicit');
eq(r.sequence[0],'VERIFY_CANDIDATE_RUNTIME_CAPACITY_AND_INDEPENDENT_CLOCK','candidate capacity/independence checked first');
eq(r.sequence[3],'DISABLE_OLD_SCHEDULER_AND_EXACT_READBACK','old scheduler disabled before candidate enable');
eq(r.sequence[4],'ENABLE_CANDIDATE_SCHEDULER_AND_EXACT_READBACK','candidate enable follows old disable');

r=c.cutoverAuthorization({...base(),candidate_runtime_capacity_available:false});
ok(!r.allowed&&r.reasons.includes('CANDIDATE_RUNTIME_CAPACITY_REQUIRED'),'cutover denied when provider capacity blocks candidate runtime');
r=c.cutoverAuthorization({...base(),independent_clock:false});
ok(!r.allowed&&r.reasons.includes('INDEPENDENT_CLOCK_REQUIRED'),'cutover denied when candidate is not an independent clock');
r=c.cutoverAuthorization({...base(),explicit_owner_approval:false});
ok(!r.allowed&&r.reasons.includes('OWNER_APPROVAL_REQUIRED'),'owner approval required');
r=c.cutoverAuthorization({...base(),old_scheduler_disabled_readback:false});
ok(r.reasons.includes('OLD_SCHEDULER_DISABLE_READBACK_REQUIRED'),'old disable exact readback required');
r=c.cutoverAuthorization({...base(),candidate_scheduler_enabled_readback:false});
ok(r.reasons.includes('CANDIDATE_ENABLE_READBACK_REQUIRED'),'candidate enable exact readback required');
r=c.cutoverAuthorization({...base(),old_scheduler_production_write_enabled:true,candidate_scheduler_production_write_enabled:true});
ok(r.reasons.includes('DUAL_PRODUCTION_WRITER_RISK'),'cutover denies overlap');
r=c.cutoverAuthorization({...base(),active_writer_locks:1});
ok(r.reasons.includes('ACTIVE_WRITER_LOCK_PRESENT'),'cutover denies active lock');
r=c.cutoverAuthorization({...base(),unresolved_prepared_committing:2});
ok(r.reasons.includes('UNRESOLVED_TRANSACTION_PRESENT'),'cutover denies transaction debt');
r=c.cutoverAuthorization({...base(),candidate_next_lease_version:271});
ok(r.reasons.includes('FENCING_CONTINUITY_REQUIRED'),'cutover denies fencing discontinuity');

r=c.postCutoverAcceptance({
  old_scheduler_disabled_readback:true,
  candidate_scheduler_enabled_readback:true,
  old_scheduler_production_write_enabled:false,
  candidate_scheduler_production_write_enabled:true,
  natural_runtime_proof:true,
  min_consecutive:6,
  consecutive_clean_occurrences:6,
  soak_window_pass:true
});
ok(r.accepted,'post-cutover acceptance passes after natural proof and soak');
eq(r.status,'CUTOVER_ACCEPTED_STABLE_ENOUGH','accepted status explicit');
r=c.postCutoverAcceptance({old_scheduler_disabled_readback:true,candidate_scheduler_enabled_readback:true,natural_runtime_proof:false,consecutive_clean_occurrences:6,soak_window_pass:true});
ok(r.reasons.includes('NATURAL_RUNTIME_PROOF_REQUIRED'),'timer/config alone cannot certify cutover');
r=c.postCutoverAcceptance({old_scheduler_disabled_readback:true,candidate_scheduler_enabled_readback:true,natural_runtime_proof:true,consecutive_clean_occurrences:5,soak_window_pass:true});
ok(r.reasons.includes('SOAK_REQUIRED'),'six clean occurrences required');
r=c.postCutoverAcceptance({old_scheduler_disabled_readback:true,candidate_scheduler_enabled_readback:true,natural_runtime_proof:true,consecutive_clean_occurrences:6,soak_window_pass:false});
ok(r.reasons.includes('SOAK_REQUIRED'),'soak window required');
r=c.postCutoverAcceptance({old_scheduler_disabled_readback:false,candidate_scheduler_enabled_readback:true,natural_runtime_proof:true,consecutive_clean_occurrences:6,soak_window_pass:true});
ok(r.reasons.includes('OLD_SCHEDULER_DISABLE_READBACK_REQUIRED'),'post cutover requires old scheduler disabled proof');

r=c.rollbackAuthorization({rollback_plan_present:true,candidate_disabled_readback_before_old_reenable:true,active_writer_locks:0,unresolved_prepared_committing:0});
ok(r.allowed,'safe rollback order allowed');
r=c.rollbackAuthorization({rollback_plan_present:true,candidate_disabled_readback_before_old_reenable:false,active_writer_locks:0,unresolved_prepared_committing:0});
ok(!r.allowed&&r.reasons.includes('ROLLBACK_ORDER_INVALID'),'rollback cannot re-enable old before candidate is disabled');
r=c.rollbackAuthorization({rollback_plan_present:false,candidate_disabled_readback_before_old_reenable:true,active_writer_locks:0,unresolved_prepared_committing:0});
ok(r.reasons.includes('ROLLBACK_PLAN_REQUIRED'),'rollback plan is mandatory');
r=c.rollbackAuthorization({rollback_plan_present:true,candidate_disabled_readback_before_old_reenable:true,active_writer_locks:1,unresolved_prepared_committing:0});
ok(r.reasons.includes('ACTIVE_WRITER_LOCK_PRESENT'),'rollback waits for active writer');

console.log(`kk-scheduler-cutover-contract: ${n}/${n} PASS`);
