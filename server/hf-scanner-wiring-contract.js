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

function candidateId(candidate) {
  return text(value(candidate, 'candidate_id', 'candidateId', 'Candidate ID', 'show_id', 'showId', 'Show ID'));
}

function isFeatureEnabled(env = process.env) {
  return String(env.HF_EVENT_ASSIST_ENABLED || '').toLowerCase() === 'true';
}

function isActivePolicy(row) {
  return truthyFlag(value(row, 'active', 'is_active', 'isActive', 'Active', 'enabled', 'Enabled'));
}

function isHeldLock(row, acceptedScopes, expectedRunId) {
  return acceptedScopes.has(scope(row)) &&
    runId(row) === expectedRunId &&
    HELD_STATUSES.has(status(row)) &&
    Boolean(fence(row));
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
  const expectedRunId = text(input.run_id);
  const cid = candidateId(input.candidate || {});

  const report = {
    contract_version: 'scanner-hf-wiring-v1',
    role: 'SCANNER',
    run_id: expectedRunId || null,
    candidate_id: cid || null,
    policy_version: null,
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

  if (!expectedRunId) blockers.push('RUN_ID_MISSING');
  if (!cid) blockers.push('CANDIDATE_ID_MISSING');

  const policies = (input.active_policies || []).filter(isActivePolicy);
  if (policies.length !== 1) {
    blockers.push(`ACTIVE_POLICY_NOT_EXACT1:${policies.length}`);
  } else {
    report.policy_version = policyVersion(policies[0]) || null;
    if (!report.policy_version) blockers.push('ACTIVE_POLICY_VERSION_MISSING');
  }

  const preConflicts = input.pre_acquire_conflicting_writers || [];
  if (preConflicts.length) blockers.push(`PRE_ACQUIRE_WRITER_CONFLICT:${preConflicts.length}`);

  const coreLocks = (input.core_locks || []).filter(row => isHeldLock(row, CORE_SCOPES, expectedRunId));
  if (coreLocks.length !== 1) blockers.push(`CORE_SHARED_WRITER_NOT_EXACT1:${coreLocks.length}`);

  const scannerLocks = (input.scanner_locks || []).filter(row => isHeldLock(row, SCANNER_SCOPES, expectedRunId));
  if (scannerLocks.length !== 1) blockers.push(`SCANNER_ROLE_LOCK_NOT_EXACT1:${scannerLocks.length}`);

  if (input.post_acquire_writer_recheck !== true) blockers.push('POST_ACQUIRE_WRITER_RECHECK_MISSING');
  const postConflicts = input.post_acquire_conflicting_writers || [];
  if (postConflicts.length) blockers.push(`POST_ACQUIRE_WRITER_CONFLICT:${postConflicts.length}`);

  const manifests = (input.manifests || []).filter(row =>
    runId(row) === expectedRunId && upper(value(row, 'role', 'Role')) === 'SCANNER'
  );
  if (manifests.length !== 1) {
    blockers.push(`SCANNER_MANIFEST_NOT_EXACT1:${manifests.length}`);
  } else {
    const manifest = manifests[0];
    const frozenAt = text(value(manifest, 'frozen_at', 'frozenAt', 'Frozen At'));
    const manifestPolicy = policyVersion(manifest);
    const manifestFence = fence(manifest);
    if (!frozenAt) blockers.push('SCANNER_MANIFEST_NOT_FROZEN');
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
      error_message: text(error && error.message) || 'HF assist failed',
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
