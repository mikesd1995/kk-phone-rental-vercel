'use strict';

const Reliability=require('./kk-reliability-learning-agent.js');

const VERSION='KK_RELIABILITY_FEEDBACK_LOOP_V1';

function uniq(values){return [...new Set((values||[]).filter(Boolean))];}

function buildEngineeringGuards(task, observations=[], options={}){
  const report=Reliability.analyzeReliability(observations,{
    memory:options.memory,
    memory_path:options.memory_path,
    incident_history:options.incident_history
  });
  const known=report.incidents.filter(x=>x.known);
  const guards=uniq(known.flatMap(x=>x.regression_guards||[]));
  const neverDo=uniq(known.flatMap(x=>x.never_do||[]));
  const repairs=known.map(x=>({
    fingerprint_id:x.fingerprint_id,
    recurrence:x.recurrence,
    root_cause_confidence:x.root_cause_confidence,
    known_repair:x.known_repair
  }));
  return {
    schema_version:VERSION,
    task:String(task||'').trim(),
    status:known.length?'KNOWN_PATTERNS_APPLIED':(report.incidents.length?'NOVEL_INCIDENT_REQUIRES_TRIAGE':'NO_INCIDENT_EVIDENCE'),
    reliability_report:report,
    planner_guard:{
      known_repairs:repairs,
      required_regression_guards:guards,
      forbidden_actions:neverDo,
      instructions:known.length
        ? ['Reuse known repair before proposing new architecture.','Planner must include every required regression guard.','Implementer must not violate forbidden actions.','Independent Reviewer must verify the repair and guards against the original evidence.']
        : ['Preserve failing evidence.','Isolate the first failing boundary before implementation.','Do not learn a durable repair until evidence and regression coverage exist.']
    },
    authority:{advisory_only:true,production_writes:0,auto_apply:false,auto_merge:false,auto_deploy:false,human_review_required:true}
  };
}

function evaluateRepair(input={}){
  const plan=input.feedback_plan||{};
  const implemented=uniq(input.implemented_regression_guards||[]);
  const required=uniq(plan.planner_guard&&plan.planner_guard.required_regression_guards||[]);
  const missing=required.filter(x=>!implemented.includes(x));
  const reviewer=Boolean(input.independent_reviewer_passed);
  const originalEvidence=Boolean(input.original_failure_evidence_preserved);
  const regression=Boolean(input.regression_passed);
  const blockers=[];
  if(!originalEvidence) blockers.push('ORIGINAL_FAILURE_EVIDENCE_MISSING');
  if(missing.length) blockers.push('REQUIRED_REGRESSION_GUARDS_MISSING');
  if(!regression) blockers.push('REGRESSION_NOT_PASSED');
  if(!reviewer) blockers.push('INDEPENDENT_REVIEW_NOT_PASSED');
  return {
    schema_version:'KK_RELIABILITY_REPAIR_ACCEPTANCE_V1',
    status:blockers.length?'BLOCKED':'ACCEPTED_FOR_HUMAN_REVIEW',
    blockers,missing_regression_guards:missing,
    safe_to_auto_apply:false,production_writes:0,auto_merge:false,auto_deploy:false,human_review_required:true
  };
}

module.exports={VERSION,buildEngineeringGuards,evaluateRepair};
