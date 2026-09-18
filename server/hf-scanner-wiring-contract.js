'use strict';

const ALLOWED_ASSIST_TASKS = new Set([
  'ZERO_SHOT_EVENT_CLASSIFICATION',
  'EVENT_EMBEDDING',
  'EVENT_DEDUP_ASSIST'
]);

const CORE_SCOPES = new Set(['CORE_SHARED_WRITER', 'CORE']);
const SCANNER_SCOPES = new Set(['SCANNER', 'SCANNER_GLOBAL']);
const HELD_STATUSES = new Set(['HELD', 'ACTIVE', 'ACQUIRED']);
const FORBIDDEN_AUTHORITY_FIELDS = [
  'final_decision',
  'verified',
  'approved',
  'final_truth',
  'monthly_write',
  'pricing_write',
  'booking_write',
  'inventory_write',
  'notification_send'
];

function text(value) {
  return String(value == null ? '' : value).trim();
}

function upper(value) {
  return text(value).toUpperCase();
}

function value(record, ...keys) {
  for (const key of keys) {
    if (record && record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

function truthyFlag(valueToCheck) {
  if (valueToCheck === true || valueToCheck === 1) return true;
  return ['TRUE', 'YES', 'Y', '1', 'ACTIVE', 'AUTHORIZED'].includes(upper(valueToCheck));
}

function runId(record) {
  return text(value(record, 'run_id', 'runId', 'Run ID', 'holder_run_id', 'holderRunId', 'Holder Run ID'));
}

function scope(record) {
  return upper(value(record, 'scope', 'scope_key', 'scopeKey', 'Scope Key', 'role', 'Role'));
}

function status(record) {
  return upper(value(record, 'status', 'Status'));
}

function fence(record) {
  return text(value(record, 'fencing_token', 'fencingToken', 'Fencing Token'));
}

function policyVersion(record) {
  return text(value(record, 'policy_version', 'policyVersion', 'Policy Version', 'POLICY_VERSION', 'version', 'Version'));
}

function timeValue(record, ...keys) {
  const raw = text(value(record, ...keys));
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : null;
}

function candidateId(candidate) {
  return text(value(candidate, 'candidate_id', 'candidateId', 'Candidate ID', 'show_id', 'showId', 'Show ID'));
}

function isFeatureEnabled(env = process.env) {
  return String(env.HF_EVENT_ASSIST_ENABLED || '').toLowerCase() === 'true';
}

function isActivePolicy(row) {
  return truthyFlag(value(row, 'active', 'is_active', 'isActive', 'Active', 'enabled', 'Enabled'));
}

function matchingHeldLock(row, acceptedScopes, expectedRunId) {
  return acceptedScopes.has(scope(row)) &&
    runId(row) === expectedRunId &&
    HELD_STATUSES.has(status(row)) &&
    Boolean(fence(row));
}

function isFreshHeldLock(row, acceptedScopes, expectedRunId, evidenceAtMs) {
  if (!matchingHeldLock(row, acceptedScopes, expectedRunId)) return false;
  const acquiredAt = timeValue(row, 'acquired_at', 'acquiredAt', 'Acquired At');
  const lockUntil = timeValue(row, 'lock_until', 'lockUntil', 'Lock Until');
  return acquiredAt !== null &&
    lockUntil !== null &&
    acquiredAt <= evidenceAtMs &&
    lockUntil > evidenceAtMs;
}

function authorizedPlannerItem(row, expectedRunId) {
  if (runId(row) !== expectedRunId) return false;
  const explicit = value(row, 'authorized', 'is_authorized', 'isAuthorized', 'Authorized');
  const itemStatus = upper(value(row, 'authorization_status', 'authorizationStatus', 'Authorization Status', 'status', 'Status'));
  return truthyFlag(explicit) || itemStatus === 'AUTHORIZED';
}

function scannerExternalAccessPreflight(input = {}, options = {}) {
  const env = options.env || process.env;
  const blockers = [];
  const evidenceSchema = text(input.evidence_schema);
  const expectedRunId = text(input.run_id);
  const cid = candidateId(input.candidate || {});
  const candidateBindingRunId = text(input.candidate_binding_run_id);
  const evidenceAtMs = Date.parse(text(input.evidence_checked_at));

  const report = {
    contract_version: 'scanner-hf-wiring-v1',
    evidence_schema: evidenceSchema || null,
    role: 'SCANNER',
    run_id: expectedRunId || null,
    candidate_id: cid || null,
    policy_version: null,
    evidence_checked_at: Number.isFinite(evidenceAtMs) ? new Date(evidenceAtMs).toISOString() : null,
    hf_feature_enabled: isFeatureEnabled(env),
    external_hf_access_allowed: false,
    network_calls: 0,
    production_writes: 0,
    final_truth_mutation: false,
    notification_sends: 0,
    blockers,
    status: 'BLOCKED'
  };

  if (!report.hf_feature_enabled) {
    blockers.push('HF_EVENT_ASSIST_DISABLED');
    report.status = 'SKIPPED';
    return report;
  }

  if (evidenceSchema !== 'SCANNER_HF_GATE_SNAPSHOT_V1') blockers.push('EVIDENCE_SCHEMA_NOT_ACCEPTED');
  if (!expectedRunId) blockers.push('RUN_ID_MISSING');
  if (!cid) blockers.push('CANDIDATE_ID_MISSING');
  if (!Number.isFinite(evidenceAtMs)) blockers.push('EVIDENCE_CHECKED_AT_INVALID');
  if (!candidateBindingRunId) blockers.push('CANDIDATE_RUN_BINDING_MISSING');
  else if (expectedRunId && candidateBindingRunId !== expectedRunId) blockers.push('CANDIDATE_RUN_BINDING_MISMATCH');

  const policies = (input.active_policies || []).filter(isActivePolicy);
  if (policies.length !== 1) {
    blockers.push(`ACTIVE_POLICY_NOT_EXACT1:${policies.length}`);
  } else {
    report.policy_version = policyVersion(policies[0]) || null;
    if (!report.policy_version) blockers.push('ACTIVE_POLICY_VERSION_MISSING');
  }

  const preConflicts = input.pre_acquire_conflicting_writers || [];
  if (preConflicts.length) blockers.push(`PRE_ACQUIRE_WRITER_CONFLICT:${preConflicts.length}`);

  const matchingCoreLocks = (input.core_locks || []).filter(row => matchingHeldLock(row, CORE_SCOPES, expectedRunId));
  const coreLocks = Number.isFinite(evidenceAtMs)
    ? matchingCoreLocks.filter(row => isFreshHeldLock(row, CORE_SCOPES, expectedRunId, evidenceAtMs))
    : [];
  if (matchingCoreLocks.length === 1 && coreLocks.length === 0) blockers.push('CORE_SHARED_WRITER_STALE_OR_TIME_INVALID');
  if (coreLocks.length !== 1) blockers.push(`CORE_SHARED_WRITER_NOT_EXACT1:${coreLocks.length}`);

  const matchingScannerLocks = (input.scanner_locks || []).filter(row => matchingHeldLock(row, SCANNER_SCOPES, expectedRunId));
  const scannerLocks = Number.isFinite(evidenceAtMs)
    ? matchingScannerLocks.filter(row => isFreshHeldLock(row, SCANNER_SCOPES, expectedRunId, evidenceAtMs))
    : [];
  if (matchingScannerLocks.length === 1 && scannerLocks.length === 0) blockers.push('SCANNER_ROLE_LOCK_STALE_OR_TIME_INVALID');
  if (scannerLocks.length !== 1) blockers.push(`SCANNER_ROLE_LOCK_NOT_EXACT1:${scannerLocks.length}`);

  if (input.post_acquire_writer_recheck !== true) blockers.push('POST_ACQUIRE_WRITER_RECHECK_MISSING');
  const recheckAtMs = Date.parse(text(input.post_acquire_writer_recheck_at));
  if (!Number.isFinite(recheckAtMs)) {
    blockers.push('POST_ACQUIRE_WRITER_RECHECK_AT_INVALID');
  } else if (Number.isFinite(evidenceAtMs) && recheckAtMs > evidenceAtMs) {
    blockers.push('POST_ACQUIRE_WRITER_RECHECK_AFTER_EVIDENCE_SNAPSHOT');
  } else {
    const acquiredTimes = [...coreLocks, ...scannerLocks]
      .map(row => timeValue(row, 'acquired_at', 'acquiredAt', 'Acquired At'))
      .filter(Number.isFinite);
    if (acquiredTimes.length === 2 && recheckAtMs < Math.max(...acquiredTimes)) {
      blockers.push('POST_ACQUIRE_WRITER_RECHECK_BEFORE_LOCK_ACQUISITION');
    }
  }
  const postConflicts = input.post_acquire_conflicting_writers || [];
  if (postConflicts.length) blockers.push(`POST_ACQUIRE_WRITER_CONFLICT:${postConflicts.length}`);

  const manifests = (input.manifests || []).filter(row =>
    runId(row) === expectedRunId && upper(value(row, 'role', 'Role')) === 'SCANNER'
  );
  if (manifests.length !== 1) {
    blockers.push(`SCANNER_MANIFEST_NOT_EXACT1:${manifests.length}`);
  } else {
    const manifest = manifests[0];
    const createdAtMs = timeValue(manifest, 'created_at', 'createdAt', 'Created At');
    const frozenAtMs = timeValue(manifest, 'frozen_at', 'frozenAt', 'Frozen At');
    const manifestPolicy = policyVersion(manifest);
    const manifestFence = fence(manifest);
    if (frozenAtMs === null) blockers.push('SCANNER_MANIFEST_NOT_FROZEN_OR_TIME_INVALID');
    if (createdAtMs === null) blockers.push('SCANNER_MANIFEST_CREATED_AT_INVALID');
    if (createdAtMs !== null && frozenAtMs !== null && createdAtMs > frozenAtMs) blockers.push('SCANNER_MANIFEST_TIME_ORDER_INVALID');
    if (Number.isFinite(evidenceAtMs) && frozenAtMs !== null && frozenAtMs > evidenceAtMs) blockers.push('SCANNER_MANIFEST_FROZEN_AFTER_EVIDENCE_SNAPSHOT');
    const scannerAcquiredAt = scannerLocks.length === 1
      ? timeValue(scannerLocks[0], 'acquired_at', 'acquiredAt', 'Acquired At')
      : null;
    if (scannerAcquiredAt !== null && frozenAtMs !== null && frozenAtMs < scannerAcquiredAt) {
      blockers.push('SCANNER_MANIFEST_FROZEN_BEFORE_ROLE_LOCK');
    }
    if (!manifestPolicy) blockers.push('SCANNER_MANIFEST_POLICY_MISSING');
    if (report.policy_version && manifestPolicy && manifestPolicy !== report.policy_version) {
      blockers.push('SCANNER_MANIFEST_POLICY_MISMATCH');
    }
    if (!manifestFence) blockers.push('SCANNER_MANIFEST_FENCE_MISSING');
    if (scannerLocks.length === 1 && manifestFence && manifestFence !== fence(scannerLocks[0])) {
      blockers.push('SCANNER_MANIFEST_FENCE_MISMATCH');
    }
  }

  const plannerMatches = (input.planner_items || []).filter(row => runId(row) === expectedRunId);
  const authorized = plannerMatches.filter(row => authorizedPlannerItem(row, expectedRunId));
  for (const item of authorized) {
    const plannedAtMs = timeValue(item, 'planned_at', 'plannedAt', 'Planned At');
    if (plannedAtMs === null) blockers.push('SCANNER_PLANNER_PLANNED_AT_INVALID');
    else if (Number.isFinite(evidenceAtMs) && plannedAtMs > evidenceAtMs) blockers.push('SCANNER_PLANNER_PLANNED_AFTER_EVIDENCE_SNAPSHOT');
  }
  if (plannerMatches.length !== 1) blockers.push(`SCANNER_PLANNER_ITEM_NOT_EXACT1:${plannerMatches.length}`);
  if (authorized.length !== 1) blockers.push(`SCANNER_PLANNER_AUTHORIZED_NOT_EXACT1:${authorized.length}`);

  if (blockers.length) return report;

  report.external_hf_access_allowed = true;
  report.status = 'AUTHORIZED_FOR_ONE_ADVISORY_HF_CALL';
  return report;
}

function validateAssistResult(result) {
  const blockers = [];
  if (!result || typeof result !== 'object') return ['HF_RESULT_MISSING'];
  if (upper(result.status) !== 'ASSISTED') blockers.push('HF_RESULT_STATUS_NOT_ASSISTED');
  if (!ALLOWED_ASSIST_TASKS.has(text(result.task))) blockers.push('HF_RESULT_TASK_NOT_ALLOWED');
  if (result.authoritative !== false) blockers.push('HF_RESULT_MUST_BE_NONAUTHORITATIVE');
  if (result.verifier_required !== true) blockers.push('HF_RESULT_MUST_REQUIRE_VERIFIER');
  if (Number(result.production_writes || 0) !== 0) blockers.push('HF_RESULT_PRODUCTION_WRITES_NONZERO');
  if (result.final_truth_mutation !== undefined && result.final_truth_mutation !== false) {
    blockers.push('HF_RESULT_FINAL_TRUTH_MUTATION_NOT_FALSE');
  }
  if (result.notification_sends !== undefined && Number(result.notification_sends) !== 0) {
    blockers.push('HF_RESULT_NOTIFICATION_SENDS_NONZERO');
  }
  for (const field of FORBIDDEN_AUTHORITY_FIELDS) {
    if (result[field] !== undefined && result[field] !== false && result[field] !== null && result[field] !== '' && result[field] !== 0) {
      blockers.push(`HF_RESULT_FORBIDDEN_AUTHORITY_FIELD:${field}`);
    }
  }
  return blockers;
}

function summarizeAssistResult(result) {
  if (result.task === 'ZERO_SHOT_EVENT_CLASSIFICATION') {
    return {
      top_label: result.top_label || null,
      top_score: Number.isFinite(Number(result.top_score)) ? Number(result.top_score) : null,
      confidence_band: result.confidence_band || null
    };
  }
  if (result.task === 'EVENT_EMBEDDING') {
    const vectors = Array.isArray(result.vectors) ? result.vectors : [];
    return {
      vector_count: vectors.length,
      vector_dimension: vectors.length && Array.isArray(vectors[0]) ? vectors[0].length : 0
    };
  }
  if (result.task === 'EVENT_DEDUP_ASSIST') {
    return {
      pair_count: Array.isArray(result.pairs) ? result.pairs.length : 0,
      identity_conflict_count: Array.isArray(result.conflicts) ? result.conflicts.length : 0,
      threshold: Number.isFinite(Number(result.threshold)) ? Number(result.threshold) : null
    };
  }
  return {};
}

function buildAdvisoryHandoff(input, preflight, result) {
  const blockers = validateAssistResult(result);
  if (blockers.length) {
    const error = new Error('HF assist result violates advisory contract');
    error.code = 'HF_ASSIST_RESULT_CONTRACT_VIOLATION';
    error.blockers = blockers;
    throw error;
  }

  return {
    handoff_version: 'scanner-hf-advisory-v1',
    handoff_state: 'READY_FOR_VERIFIER',
    route: 'EXISTING_SCANNER_TO_VERIFIER_HANDOFF',
    run_id: preflight.run_id,
    candidate_id: preflight.candidate_id,
    policy_version: preflight.policy_version,
    hf_assist: {
      task: result.task,
      model: result.model || null,
      summary: summarizeAssistResult(result)
    },
    authoritative: false,
    verifier_required: true,
    production_writes: 0,
    final_truth_mutation: false,
    notification_sends: 0,
    direct_business_write_allowed: false,
    direct_notification_allowed: false
  };
}

async function runGuardedScannerHfAssist(input = {}, options = {}) {
  const preflight = scannerExternalAccessPreflight(input, options);
  const base = {
    contract_version: 'scanner-hf-wiring-v1',
    preflight,
    hf_call_attempted: false,
    hf_call_count: 0,
    handoff: null,
    authoritative: false,
    verifier_required: true,
    production_writes: 0,
    final_truth_mutation: false,
    notification_sends: 0
  };

  if (!preflight.external_hf_access_allowed) {
    return { ...base, status: preflight.status };
  }

  if (typeof options.assistFn !== 'function') {
    return {
      ...base,
      status: 'BLOCKED',
      blockers: ['HF_ASSIST_FUNCTION_MISSING']
    };
  }

  let result;
  try {
    result = await options.assistFn(input.candidate, options.assistOptions || {});
  } catch (error) {
    return {
      ...base,
      hf_call_attempted: true,
      hf_call_count: 1,
      status: 'HF_ASSIST_UNAVAILABLE_NONAUTHORITATIVE',
      error_class: text(error && (error.code || error.name)) || 'ERROR',
      blockers: ['HF_ASSIST_CALL_FAILED']
    };
  }

  const resultBlockers = validateAssistResult(result);
  if (resultBlockers.length) {
    return {
      ...base,
      hf_call_attempted: true,
      hf_call_count: 1,
      status: 'HF_ASSIST_RESULT_REJECTED',
      blockers: resultBlockers
    };
  }

  return {
    ...base,
    hf_call_attempted: true,
    hf_call_count: 1,
    status: 'ADVISORY_HANDOFF_PREPARED',
    handoff: buildAdvisoryHandoff(input, preflight, result)
  };
}

module.exports = {
  ALLOWED_ASSIST_TASKS,
  scannerExternalAccessPreflight,
  validateAssistResult,
  buildAdvisoryHandoff,
  runGuardedScannerHfAssist
};
