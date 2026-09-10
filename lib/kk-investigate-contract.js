'use strict';

function text(v){ return String(v == null ? '' : v).trim(); }
function upper(v){ return text(v).toUpperCase(); }
function list(v){ return Array.isArray(v) ? v : []; }
function bool(v){ return v===true || upper(v)==='TRUE'; }

const STAGES=Object.freeze([
  'INSUFFICIENT_EVIDENCE',
  'OBSERVED',
  'MITIGATED_ROOT_CAUSE_OPEN',
  'HYPOTHESIS_READY',
  'MECHANISM_PROVEN',
  'REPAIR_VERIFIED',
  'ROOT_CAUSE_CLOSED'
]);

function normalizeActor(input={}){
  const claimed=text(input.actor || input.root_cause_actor);
  const refs=list(input.actor_evidence_refs).map(text).filter(Boolean);
  const proven=bool(input.actor_proven) && refs.length>0;
  return {actor:proven&&claimed?claimed:'UNKNOWN',proven,evidence_refs:refs};
}

function investigationStatus(input={}){
  const facts=list(input.observed_facts).map(text).filter(Boolean);
  const evidence=list(input.evidence_refs).map(text).filter(Boolean);
  const mitigation=bool(input.mitigation_applied);
  const hypothesis=text(input.falsifiable_hypothesis);
  const rootCause=text(input.root_cause_claim);
  const disconfirming=bool(input.disconfirming_test_performed);
  const mechanism=bool(input.reproduced_or_mechanism_proven);
  const regression=bool(input.regression_test_added_or_updated);
  const naturalRetest=bool(input.natural_retest_pass);
  const actor=normalizeActor(input);
  const blockers=[];

  if(!text(input.incident_code)) blockers.push('INCIDENT_CODE_REQUIRED');
  if(facts.length===0) blockers.push('OBSERVED_FACT_REQUIRED');
  if(evidence.length===0) blockers.push('EVIDENCE_REFERENCE_REQUIRED');

  let stage='INSUFFICIENT_EVIDENCE';
  if(blockers.length===0) stage='OBSERVED';
  if(stage==='OBSERVED' && mitigation) stage='MITIGATED_ROOT_CAUSE_OPEN';
  if(blockers.length===0 && hypothesis && disconfirming) stage='HYPOTHESIS_READY';
  if(blockers.length===0 && hypothesis && disconfirming && mechanism) stage='MECHANISM_PROVEN';
  if(blockers.length===0 && hypothesis && disconfirming && mechanism && regression && naturalRetest) stage='REPAIR_VERIFIED';
  if(blockers.length===0 && rootCause && hypothesis && disconfirming && mechanism && regression && naturalRetest) stage='ROOT_CAUSE_CLOSED';

  const rootCauseClosed=stage==='ROOT_CAUSE_CLOSED';
  if(rootCause && !hypothesis) blockers.push('ROOT_CAUSE_REQUIRES_FALSIFIABLE_HYPOTHESIS');
  if(rootCause && !disconfirming) blockers.push('ROOT_CAUSE_REQUIRES_DISCONFIRMING_TEST');
  if(rootCause && !mechanism) blockers.push('ROOT_CAUSE_REQUIRES_MECHANISM_PROOF');
  if(rootCause && !regression) blockers.push('ROOT_CAUSE_REQUIRES_REGRESSION');
  if(rootCause && !naturalRetest) blockers.push('ROOT_CAUSE_REQUIRES_NATURAL_RETEST');

  return {
    stage,
    root_cause_closed:rootCauseClosed,
    mitigation_is_not_root_cause:mitigation&&!rootCauseClosed,
    actor:actor.actor,
    actor_proven:actor.proven,
    blockers:Array.from(new Set(blockers)),
    evidence_count:evidence.length,
    observed_fact_count:facts.length
  };
}

function repairAuthorization(input={}){
  const status=investigationStatus(input);
  const requested=upper(input.requested_action || 'ANALYZE');
  const rootFix=['PERMANENT_FIX','ROOT_CAUSE_FIX','CLOSE_INCIDENT'].includes(requested);
  const mitigation=['MITIGATE','CONTAIN','RE_ENABLE'].includes(requested);
  const reasons=[];

  if(status.stage==='INSUFFICIENT_EVIDENCE' && requested!=='ANALYZE') reasons.push('EVIDENCE_BASELINE_REQUIRED');
  if(rootFix && !['MECHANISM_PROVEN','REPAIR_VERIFIED','ROOT_CAUSE_CLOSED'].includes(status.stage)) reasons.push('MECHANISM_PROOF_REQUIRED_BEFORE_PERMANENT_FIX');
  if(requested==='CLOSE_INCIDENT' && !status.root_cause_closed) reasons.push('ROOT_CAUSE_NOT_CLOSED');
  if(mitigation && !bool(input.mitigation_safe_and_reversible)) reasons.push('MITIGATION_MUST_BE_SAFE_AND_REVERSIBLE');
  if(bool(input.destructive_action) && !bool(input.explicit_owner_approval)) reasons.push('OWNER_APPROVAL_REQUIRED_FOR_DESTRUCTIVE_ACTION');

  return {allowed:reasons.length===0,decision:reasons.length?'DENY':'ALLOW',reasons,status};
}

module.exports={STAGES,normalizeActor,investigationStatus,repairAuthorization};
