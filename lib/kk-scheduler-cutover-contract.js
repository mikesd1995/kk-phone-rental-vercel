'use strict';

function text(v){ return String(v == null ? '' : v).trim(); }
function upper(v){ return text(v).toUpperCase(); }
function bool(v){ return v===true || upper(v)==='TRUE'; }
function num(v){ const n=Number(v); return Number.isFinite(n)?n:0; }

const REASONS=Object.freeze({
  ROLE_REQUIRED:'ROLE_REQUIRED',
  CANDIDATE_SCHEDULER_REQUIRED:'CANDIDATE_SCHEDULER_REQUIRED',
  CANDIDATE_RUNTIME_CAPACITY_REQUIRED:'CANDIDATE_RUNTIME_CAPACITY_REQUIRED',
  INDEPENDENT_CLOCK_REQUIRED:'INDEPENDENT_CLOCK_REQUIRED',
  SHADOW_MUST_BE_NO_WRITE:'SHADOW_MUST_BE_NO_WRITE',
  SHADOW_EVIDENCE_INSUFFICIENT:'SHADOW_EVIDENCE_INSUFFICIENT',
  SAME_OCCURRENCE_SEMANTICS_REQUIRED:'SAME_OCCURRENCE_SEMANTICS_REQUIRED',
  MACHINE_SOT_AUTHORITY_REQUIRED:'MACHINE_SOT_AUTHORITY_REQUIRED',
  SHARED_FENCING_SOURCE_REQUIRED:'SHARED_FENCING_SOURCE_REQUIRED',
  OWNER_APPROVAL_REQUIRED:'OWNER_APPROVAL_REQUIRED',
  ACTIVE_WRITER_LOCK_PRESENT:'ACTIVE_WRITER_LOCK_PRESENT',
  UNRESOLVED_TRANSACTION_PRESENT:'UNRESOLVED_TRANSACTION_PRESENT',
  OLD_SCHEDULER_DISABLE_READBACK_REQUIRED:'OLD_SCHEDULER_DISABLE_READBACK_REQUIRED',
  CANDIDATE_ENABLE_READBACK_REQUIRED:'CANDIDATE_ENABLE_READBACK_REQUIRED',
  DUAL_PRODUCTION_WRITER_RISK:'DUAL_PRODUCTION_WRITER_RISK',
  FENCING_CONTINUITY_REQUIRED:'FENCING_CONTINUITY_REQUIRED',
  ROLLBACK_PLAN_REQUIRED:'ROLLBACK_PLAN_REQUIRED',
  ROLLBACK_ORDER_INVALID:'ROLLBACK_ORDER_INVALID',
  NATURAL_RUNTIME_PROOF_REQUIRED:'NATURAL_RUNTIME_PROOF_REQUIRED',
  SOAK_REQUIRED:'SOAK_REQUIRED'
});

function shadowReadiness(input={}){
  const reasons=[];
  const role=upper(input.role);
  const candidate=text(input.candidate_scheduler_id);
  if(!role) reasons.push(REASONS.ROLE_REQUIRED);
  if(!candidate) reasons.push(REASONS.CANDIDATE_SCHEDULER_REQUIRED);
  if(!bool(input.candidate_runtime_capacity_available)) reasons.push(REASONS.CANDIDATE_RUNTIME_CAPACITY_REQUIRED);
  if(!bool(input.independent_clock)) reasons.push(REASONS.INDEPENDENT_CLOCK_REQUIRED);
  if(bool(input.candidate_production_write_enabled)) reasons.push(REASONS.SHADOW_MUST_BE_NO_WRITE);
  const min=Math.max(1,num(input.min_shadow_occurrences)||6);
  if(num(input.shadow_occurrences)<min || num(input.shadow_mismatches)>0) reasons.push(REASONS.SHADOW_EVIDENCE_INSUFFICIENT);
  if(!bool(input.same_occurrence_semantics)) reasons.push(REASONS.SAME_OCCURRENCE_SEMANTICS_REQUIRED);
  if(!bool(input.machine_sot_remains_authority)) reasons.push(REASONS.MACHINE_SOT_AUTHORITY_REQUIRED);
  if(!bool(input.shared_fencing_source)) reasons.push(REASONS.SHARED_FENCING_SOURCE_REQUIRED);
  if(!bool(input.rollback_plan_present)) reasons.push(REASONS.ROLLBACK_PLAN_REQUIRED);
  return {
    ready:reasons.length===0,
    decision:reasons.length?'DENY':'ALLOW_SHADOW_COMPLETE',
    reasons:Array.from(new Set(reasons)),
    required_shadow_occurrences:min
  };
}

function liveWriterSafety(input={}){
  const reasons=[];
  const oldProd=bool(input.old_scheduler_production_write_enabled);
  const candidateProd=bool(input.candidate_scheduler_production_write_enabled);
  if(oldProd && candidateProd) reasons.push(REASONS.DUAL_PRODUCTION_WRITER_RISK);
  if(num(input.active_writer_locks)>0) reasons.push(REASONS.ACTIVE_WRITER_LOCK_PRESENT);
  if(num(input.unresolved_prepared_committing)>0) reasons.push(REASONS.UNRESOLVED_TRANSACTION_PRESENT);
  return {safe:reasons.length===0,reasons};
}

function fencingContinuity(input={}){
  const oldMax=num(input.old_max_valid_lease_version);
  const candidateNext=num(input.candidate_next_lease_version);
  const shared=bool(input.shared_fencing_source);
  const valid=shared && oldMax>0 && candidateNext===oldMax+1;
  return {
    valid,
    expected_next:oldMax>0?oldMax+1:null,
    reasons:valid?[]:[REASONS.FENCING_CONTINUITY_REQUIRED]
  };
}

function cutoverAuthorization(input={}){
  const reasons=[];
  const shadow=shadowReadiness(input);
  reasons.push(...shadow.reasons);
  const safety=liveWriterSafety(input);
  reasons.push(...safety.reasons);
  const fence=fencingContinuity(input);
  reasons.push(...fence.reasons);

  if(!bool(input.explicit_owner_approval)) reasons.push(REASONS.OWNER_APPROVAL_REQUIRED);
  if(!bool(input.old_scheduler_disabled_readback)) reasons.push(REASONS.OLD_SCHEDULER_DISABLE_READBACK_REQUIRED);
  if(!bool(input.candidate_scheduler_enabled_readback)) reasons.push(REASONS.CANDIDATE_ENABLE_READBACK_REQUIRED);
  if(!bool(input.rollback_plan_present)) reasons.push(REASONS.ROLLBACK_PLAN_REQUIRED);

  const unique=Array.from(new Set(reasons));
  return {
    allowed:unique.length===0,
    decision:unique.length?'DENY':'ALLOW_CONTROLLED_CUTOVER',
    reasons:unique,
    shadow,
    writer_safety:safety,
    fencing:fence,
    sequence:[
      'VERIFY_CANDIDATE_RUNTIME_CAPACITY_AND_INDEPENDENT_CLOCK',
      'VERIFY_NO_ACTIVE_WRITER_LOCK',
      'VERIFY_UNRESOLVED_PREPARED_COMMITTING_ZERO',
      'DISABLE_OLD_SCHEDULER_AND_EXACT_READBACK',
      'ENABLE_CANDIDATE_SCHEDULER_AND_EXACT_READBACK',
      'REQUIRE_SHARED_FENCING_MAX_PLUS_ONE',
      'OBSERVE_NATURAL_RUNTIME',
      'ROLLBACK_BY_DISABLING_CANDIDATE_BEFORE_REENABLING_OLD_IF_REQUIRED'
    ]
  };
}

function postCutoverAcceptance(input={}){
  const reasons=[];
  if(!bool(input.old_scheduler_disabled_readback)) reasons.push(REASONS.OLD_SCHEDULER_DISABLE_READBACK_REQUIRED);
  if(!bool(input.candidate_scheduler_enabled_readback)) reasons.push(REASONS.CANDIDATE_ENABLE_READBACK_REQUIRED);
  if(bool(input.old_scheduler_production_write_enabled)&&bool(input.candidate_scheduler_production_write_enabled)) reasons.push(REASONS.DUAL_PRODUCTION_WRITER_RISK);
  if(!bool(input.natural_runtime_proof)) reasons.push(REASONS.NATURAL_RUNTIME_PROOF_REQUIRED);
  const min=Math.max(1,num(input.min_consecutive)||6);
  if(num(input.consecutive_clean_occurrences)<min || !bool(input.soak_window_pass)) reasons.push(REASONS.SOAK_REQUIRED);
  return {
    accepted:reasons.length===0,
    status:reasons.length?'CUTOVER_ACCEPTANCE_INCOMPLETE':'CUTOVER_ACCEPTED_STABLE_ENOUGH',
    reasons:Array.from(new Set(reasons)),
    required_consecutive:min
  };
}

function rollbackAuthorization(input={}){
  const reasons=[];
  if(!bool(input.rollback_plan_present)) reasons.push(REASONS.ROLLBACK_PLAN_REQUIRED);
  if(!bool(input.candidate_disabled_readback_before_old_reenable)) reasons.push(REASONS.ROLLBACK_ORDER_INVALID);
  if(num(input.active_writer_locks)>0) reasons.push(REASONS.ACTIVE_WRITER_LOCK_PRESENT);
  if(num(input.unresolved_prepared_committing)>0) reasons.push(REASONS.UNRESOLVED_TRANSACTION_PRESENT);
  return {
    allowed:reasons.length===0,
    decision:reasons.length?'DENY':'ALLOW_ROLLBACK',
    reasons:Array.from(new Set(reasons))
  };
}

module.exports={REASONS,shadowReadiness,liveWriterSafety,fencingContinuity,cutoverAuthorization,postCutoverAcceptance,rollbackAuthorization};
