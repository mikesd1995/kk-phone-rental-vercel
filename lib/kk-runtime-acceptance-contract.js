'use strict';

function text(v){ return String(v == null ? '' : v).trim(); }
function upper(v){ return text(v).toUpperCase(); }
function num(v){ const n=Number(v); return Number.isFinite(n)?n:0; }
function bool(v){ return v===true || upper(v)==='TRUE'; }

const INCIDENT_SEVERITY=Object.freeze({
  SCHEDULER_NOT_FIRED:'P0',
  LAUNCHER_FIRED_RUNTIME_BOUNDARY_MISSING:'P0',
  TASK_DISABLED_BEFORE:'P0',
  TASK_DISABLED_AFTER:'P0',
  MANUAL_RUN_NOT_NATURAL_PROOF:'P0',
  LEASE_NOT_ACQUIRED:'P0',
  NON_MONOTONIC_FENCE:'P0',
  DUPLICATE_FENCE:'P0',
  MANIFEST_COUNT_NOT_ONE:'P0',
  MANIFEST_NOT_FROZEN_PRE_MUTATION:'P0',
  NO_RUNTIME_EVIDENCE:'P0',
  MANIFEST_NOT_TERMINAL:'P0',
  LEASE_NOT_RELEASED:'P0',
  UNAUTHORIZED_OUTBOUND_CLAIM:'P0',
  UNRESOLVED_TRANSACTION:'P1',
  CANDIDATE_ORPHAN:'P1',
  AI_ORPHAN:'P1'
});

function incidentSeverity(code){ return INCIDENT_SEVERITY[upper(code)] || 'P2'; }

function runtimeAcceptance(input={}){
  const expected=input.expected_occurrence!==false;
  const manual=bool(input.manual_trigger);
  const scheduledTrigger=bool(input.scheduled_trigger_observed);
  const leaseAcquired=bool(input.lease_acquired);
  const leaseVersion=num(input.lease_version);
  const previousLeaseVersion=num(input.previous_lease_version);
  const manifestCount=num(input.manifest_count);
  const workCount=num(input.actual_runtime_evidence_count);
  const reasons=[];

  if(!expected) return {accepted:false,status:'NOT_DUE',natural_run:false,reasons:[],highest_severity:null};
  if(manual) reasons.push('MANUAL_RUN_NOT_NATURAL_PROOF');
  if(!bool(input.task_enabled_before)) reasons.push('TASK_DISABLED_BEFORE');
  if(!scheduledTrigger) reasons.push('SCHEDULER_NOT_FIRED');
  if(!leaseAcquired) reasons.push('LEASE_NOT_ACQUIRED');
  if(leaseAcquired && (leaseVersion<=0 || (previousLeaseVersion>0 && leaseVersion<=previousLeaseVersion))) reasons.push('NON_MONOTONIC_FENCE');
  if(bool(input.duplicate_fence_observed)) reasons.push('DUPLICATE_FENCE');
  if(manifestCount!==1) reasons.push('MANIFEST_COUNT_NOT_ONE');
  if(!bool(input.manifest_frozen_before_mutation)) reasons.push('MANIFEST_NOT_FROZEN_PRE_MUTATION');
  if(workCount<=0 && !bool(input.legitimate_noop)) reasons.push('NO_RUNTIME_EVIDENCE');
  if(!bool(input.terminal_manifest)) reasons.push('MANIFEST_NOT_TERMINAL');
  if(!bool(input.lease_released)) reasons.push('LEASE_NOT_RELEASED');
  if(num(input.unresolved_prepared_committing)>0) reasons.push('UNRESOLVED_TRANSACTION');
  if(num(input.candidate_orphans)>0) reasons.push('CANDIDATE_ORPHAN');
  if(num(input.ai_orphans)>0) reasons.push('AI_ORPHAN');
  if(bool(input.unauthorized_outbound_claim)) reasons.push('UNAUTHORIZED_OUTBOUND_CLAIM');
  if(!bool(input.task_enabled_after)) reasons.push('TASK_DISABLED_AFTER');

  const unique=Array.from(new Set(reasons));
  const rank={P0:3,P1:2,P2:1};
  let highest=null;
  for(const reason of unique){
    const severity=incidentSeverity(reason);
    if(!highest || rank[severity]>rank[highest]) highest=severity;
  }
  return {
    accepted:unique.length===0,
    status:unique.length===0?'PASS':'FAIL',
    natural_run:!manual,
    reasons:unique,
    highest_severity:highest
  };
}

function reliabilitySLI(occurrences=[]){
  const expected=occurrences.filter(o=>o && o.expected_occurrence!==false);
  let accepted=0;
  for(const occurrence of expected){ if(runtimeAcceptance(occurrence).accepted) accepted++; }
  const total=expected.length;
  return {
    expected:total,
    accepted,
    failed:total-accepted,
    ratio:total?accepted/total:1,
    percent:total?Number(((accepted/total)*100).toFixed(4)):100
  };
}

function hasManualRescue(o={}){ return bool(o.manual_rescue) || bool(o.manual_trigger); }

function runnerSoak(occurrences=[], options={}){
  const minConsecutive=Math.max(1,num(options.min_consecutive)||6);
  const runner=upper(options.runner_type);
  const relevant=occurrences.filter(o=>o && o.expected_occurrence!==false && (!runner || upper(o.runner_type)===runner));
  const accepted=[];
  const failures=[];
  let currentStreak=0;
  let maxStreak=0;
  let manualRescueCount=0;
  for(const occurrence of relevant){
    if(hasManualRescue(occurrence)) manualRescueCount++;
    const result=runtimeAcceptance(occurrence);
    if(result.accepted && !hasManualRescue(occurrence)){
      currentStreak++;
      accepted.push(occurrence);
      if(currentStreak>maxStreak) maxStreak=currentStreak;
    } else {
      currentStreak=0;
      failures.push({occurrence,result});
    }
  }
  const p0Failures=failures.filter(x=>x.result.highest_severity==='P0').length;
  const stable=currentStreak>=minConsecutive;
  return {
    stable,
    status:stable?'STABLE_ENOUGH_FOR_NORMAL_OPERATION':'SOAK_INCOMPLETE',
    min_consecutive:minConsecutive,
    current_streak:currentStreak,
    max_streak:maxStreak,
    observed:relevant.length,
    accepted:accepted.length,
    failures:failures.length,
    p0_failures:p0Failures,
    manual_rescues:manualRescueCount,
    historical_failures_allowed_for_recovery:true
  };
}

function combinedRunnerSoak(occurrences=[], options={}){
  const minConsecutive=Math.max(1,num(options.min_consecutive)||6);
  const scanner=runnerSoak(occurrences,{runner_type:'SCANNER',min_consecutive:minConsecutive});
  const verifier=runnerSoak(occurrences,{runner_type:'VERIFIER',min_consecutive:minConsecutive});
  const stable=scanner.stable&&verifier.stable;
  return {stable,status:stable?'CORE_RUNNERS_SOAK_PASS':'CORE_RUNNERS_SOAK_INCOMPLETE',scanner,verifier};
}

function releaseEvidenceGate(input={}){
  const requirement=bool(input.requirement_defined);
  const architecture=requirement&&bool(input.architecture_approved);
  const ready=architecture&&bool(input.ready_for_implementation);
  const implementation=ready&&bool(input.implementation_pass);
  const ci=implementation&&bool(input.ci_pass);
  const runtime=ci&&bool(input.runtime_pass);
  const provider=runtime&&bool(input.provider_pass);
  const production=provider&&bool(input.production_stable);
  let gate='KK-G-1 NOT_READY';
  if(requirement) gate='KK-G0 REQUIREMENT_DEFINED';
  if(architecture) gate='KK-G1 ARCHITECTURE_APPROVED';
  if(ready) gate='KK-G2 READY_FOR_IMPLEMENTATION';
  if(ci) gate='KK-G3 CI_PASS';
  if(runtime) gate='KK-G4 RUNTIME_PASS';
  if(provider) gate='KK-G5 PROVIDER_OR_E2E_PASS';
  if(production) gate='KK-G6 PRODUCTION_STABLE';
  return {gate};
}

module.exports={INCIDENT_SEVERITY,incidentSeverity,runtimeAcceptance,reliabilitySLI,runnerSoak,combinedRunnerSoak,releaseEvidenceGate};
