'use strict';

const FAILURE_TYPES = new Set([
  'KNOWLEDGE_GAP',
  'SKILL_GAP',
  'TOOL_GAP',
  'MODEL_GAP',
  'DATA_GAP',
  'WORKFLOW_GAP',
  'CODE_DEFECT',
  'POLICY_BLOCK',
  'EXTERNAL_FAILURE',
  'AMBIGUOUS_TASK'
]);

const CANDIDATE_TYPES = new Set([
  'MEMORY',
  'LESSON',
  'PROMPT',
  'SKILL',
  'TOOL',
  'WORKFLOW',
  'CODE',
  'MODEL_ROUTING',
  'EVAL_CASE',
  'SOURCE'
]);

const FORBIDDEN_SELF_MODIFICATION = new Set([
  'PLATFORM_POLICY',
  'PERMISSION_SYSTEM',
  'RAW_SECRETS',
  'OWNER_IDENTITY',
  'APPROVAL_REQUIREMENTS',
  'AUDIT_HISTORY',
  'KILL_SWITCH',
  'PRODUCTION_GUARDRAILS',
  'BILLING_AUTHORITY'
]);

function text(value) {
  return String(value == null ? '' : value).trim();
}

function normalizeUpper(value) {
  return text(value).toUpperCase();
}

function validateFailureDiagnosis(diagnosis = {}) {
  const type = normalizeUpper(diagnosis.failure_type);
  if (!FAILURE_TYPES.has(type)) {
    return { ok: false, reason: 'FAILURE_TYPE_INVALID' };
  }
  if (!text(diagnosis.run_id)) return { ok: false, reason: 'RUN_ID_REQUIRED' };
  if (!text(diagnosis.observation)) return { ok: false, reason: 'OBSERVATION_REQUIRED' };
  return { ok: true, reason: null };
}

function validateImprovementCandidate(candidate = {}) {
  const type = normalizeUpper(candidate.candidate_type);
  const target = normalizeUpper(candidate.target_class);

  if (!CANDIDATE_TYPES.has(type)) {
    return { ok: false, reason: 'CANDIDATE_TYPE_INVALID' };
  }
  if (!target) {
    return { ok: false, reason: 'TARGET_CLASS_REQUIRED' };
  }
  if (FORBIDDEN_SELF_MODIFICATION.has(target)) {
    return { ok: false, reason: 'SELF_MODIFICATION_FORBIDDEN' };
  }
  if (!text(candidate.candidate_id)) {
    return { ok: false, reason: 'CANDIDATE_ID_REQUIRED' };
  }
  if (!text(candidate.source_run_id)) {
    return { ok: false, reason: 'SOURCE_RUN_REQUIRED' };
  }
  if (candidate.direct_production_authority === true) {
    return { ok: false, reason: 'DIRECT_PRODUCTION_AUTHORITY_FORBIDDEN' };
  }
  return { ok: true, reason: null };
}

function validateLessonCandidate(candidate = {}) {
  const observations = Array.isArray(candidate.observation_ids)
    ? [...new Set(candidate.observation_ids.map(text).filter(Boolean))]
    : [];
  const evidence = Array.isArray(candidate.evidence_ids)
    ? [...new Set(candidate.evidence_ids.map(text).filter(Boolean))]
    : [];
  const confidence = Number(candidate.confidence);

  if (observations.length < 2) return { ok: false, reason: 'LESSON_REQUIRES_MULTIPLE_OBSERVATIONS' };
  if (evidence.length < 1) return { ok: false, reason: 'LESSON_REQUIRES_EVIDENCE' };
  if (!Number.isFinite(confidence) || confidence < 0.8 || confidence > 1) {
    return { ok: false, reason: 'LESSON_CONFIDENCE_INSUFFICIENT' };
  }
  if (candidate.independent_evaluator_pass !== true) {
    return { ok: false, reason: 'INDEPENDENT_EVALUATOR_REQUIRED' };
  }
  return { ok: true, reason: null };
}

function validateFactCandidate(candidate = {}) {
  const evidence = Array.isArray(candidate.evidence_ids)
    ? [...new Set(candidate.evidence_ids.map(text).filter(Boolean))]
    : [];
  if (evidence.length < 1) return { ok: false, reason: 'FACT_REQUIRES_EVIDENCE' };
  const verifiedAt = Date.parse(text(candidate.last_verified_at));
  if (!Number.isFinite(verifiedAt)) return { ok: false, reason: 'FACT_VERIFICATION_TIME_INVALID' };
  return { ok: true, reason: null };
}

function evaluatePromotion(input = {}) {
  if (input.hard_safety_pass !== true) {
    return { promote: false, reason: 'HARD_SAFETY_FAILED' };
  }
  if (input.independent_evaluator_pass !== true) {
    return { promote: false, reason: 'INDEPENDENT_EVALUATOR_FAILED' };
  }
  if (input.critical_regression === true) {
    return { promote: false, reason: 'CRITICAL_REGRESSION' };
  }
  if (input.production_writes_during_eval === undefined || Number(input.production_writes_during_eval) !== 0) {
    return { promote: false, reason: 'EVAL_MUST_PROVE_ZERO_PRODUCTION_WRITE' };
  }

  const samples = Number(input.sample_size);
  const minimumSamples = Number(input.minimum_sample_size || 1);
  if (!Number.isInteger(samples) || samples < minimumSamples) {
    return { promote: false, reason: 'INSUFFICIENT_SAMPLE_SIZE' };
  }

  const primaryDelta = Number(input.primary_metric_delta);
  const requiredDelta = Number(input.required_primary_delta || 0);
  if (!Number.isFinite(primaryDelta) || primaryDelta < requiredDelta) {
    return { promote: false, reason: 'PRIMARY_METRIC_NOT_IMPROVED' };
  }

  const maxCostDelta = Number(input.max_cost_delta_pct == null ? 100 : input.max_cost_delta_pct);
  const costDelta = Number(input.cost_delta_pct || 0);
  if (!Number.isFinite(costDelta) || costDelta > maxCostDelta) {
    return { promote: false, reason: 'COST_REGRESSION' };
  }

  return { promote: true, reason: 'PROMOTION_GATES_PASSED' };
}

function classifyLearningAction(input = {}) {
  const target = normalizeUpper(input.target_class);
  if (FORBIDDEN_SELF_MODIFICATION.has(target)) {
    return {
      allowed: false,
      action: 'DENY',
      reason: 'GOVERNANCE_BOUNDARY'
    };
  }

  const candidateType = normalizeUpper(input.candidate_type);
  if (!CANDIDATE_TYPES.has(candidateType)) {
    return {
      allowed: false,
      action: 'DENY',
      reason: 'UNKNOWN_CANDIDATE_TYPE'
    };
  }

  return {
    allowed: true,
    action: 'CREATE_CANDIDATE_ONLY',
    reason: 'EVALUATION_REQUIRED_BEFORE_PROMOTION'
  };
}

module.exports = {
  FAILURE_TYPES,
  CANDIDATE_TYPES,
  FORBIDDEN_SELF_MODIFICATION,
  validateFailureDiagnosis,
  validateImprovementCandidate,
  validateLessonCandidate,
  validateFactCandidate,
  evaluatePromotion,
  classifyLearningAction
};
