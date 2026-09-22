'use strict';

const crypto = require('node:crypto');

const POLICY_LEVELS = Object.freeze([
  'PLATFORM_HARD',
  'WORKSPACE',
  'PROJECT',
  'WORKFLOW',
  'TASK'
]);

const RISK_CLASSES = Object.freeze({
  R0: 0,
  R1: 1,
  R2: 2,
  R3: 3,
  R4: 4,
  R5: 5
});

const PERMISSIONS = Object.freeze({
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
  P4: 4,
  P5: 5,
  P6: 6
});

const TRUST_CLASSES = Object.freeze({
  PLATFORM: 'TRUSTED_PLATFORM',
  OWNER: 'TRUSTED_OWNER',
  PROJECT_POLICY: 'TRUSTED_PROJECT_POLICY',
  INTERNAL_TOOL: 'CONSTRAINED_INTERNAL_TOOL',
  EXTERNAL_DATA: 'UNTRUSTED_EXTERNAL_DATA'
});

const EXTERNAL_SOURCE_TYPES = new Set([
  'WEB',
  'EMAIL',
  'SOCIAL',
  'DOCUMENT',
  'TICKET_PAGE',
  'VENUE_PAGE',
  'EXTERNAL_API',
  'SEARCH_RESULT',
  'MODEL_OUTPUT'
]);

const HARD_GOVERNANCE_CAPABILITIES = new Set([
  'policy.modify.platform',
  'permission.modify',
  'secret.read.raw',
  'secret.write',
  'owner.identity.modify',
  'approval.requirement.modify',
  'audit.delete',
  'kill_switch.disable',
  'billing.authority.modify',
  'production.guardrail.modify'
]);

function text(value) {
  return String(value == null ? '' : value).trim();
}

function uniq(values) {
  return [...new Set((values || []).map(text).filter(Boolean))];
}

function policyLevelIndex(level) {
  const idx = POLICY_LEVELS.indexOf(text(level).toUpperCase());
  if (idx < 0) {
    const error = new Error('unknown policy level');
    error.code = 'POLICY_LEVEL_UNKNOWN';
    throw error;
  }
  return idx;
}

function permissionRank(value) {
  const key = text(value).toUpperCase();
  if (!(key in PERMISSIONS)) {
    const error = new Error('unknown permission level');
    error.code = 'PERMISSION_UNKNOWN';
    throw error;
  }
  return PERMISSIONS[key];
}

function riskRank(value) {
  const key = text(value).toUpperCase();
  if (!(key in RISK_CLASSES)) {
    const error = new Error('unknown risk class');
    error.code = 'RISK_UNKNOWN';
    throw error;
  }
  return RISK_CLASSES[key];
}

function classifyTrust(sourceType) {
  const source = text(sourceType).toUpperCase();
  if (source === 'PLATFORM_POLICY') return TRUST_CLASSES.PLATFORM;
  if (source === 'OWNER') return TRUST_CLASSES.OWNER;
  if (source === 'PROJECT_POLICY') return TRUST_CLASSES.PROJECT_POLICY;
  if (source === 'INTERNAL_TOOL') return TRUST_CLASSES.INTERNAL_TOOL;
  if (EXTERNAL_SOURCE_TYPES.has(source)) return TRUST_CLASSES.EXTERNAL_DATA;
  return TRUST_CLASSES.EXTERNAL_DATA;
}

function externalContentMayAuthorize(sourceType) {
  return classifyTrust(sourceType) !== TRUST_CLASSES.EXTERNAL_DATA;
}

function resolvePolicyLayers(layers) {
  if (!Array.isArray(layers) || layers.length === 0) {
    const error = new Error('at least one policy layer is required');
    error.code = 'POLICY_MISSING';
    throw error;
  }

  const normalized = layers.map((layer) => {
    const level = text(layer.level).toUpperCase();
    const levelIndex = policyLevelIndex(level);
    const permissionCeiling = text(layer.permission_ceiling || 'P6').toUpperCase();
    permissionRank(permissionCeiling);

    return {
      level,
      level_index: levelIndex,
      allow: uniq(layer.allow),
      deny: uniq(layer.deny),
      permission_ceiling: permissionCeiling
    };
  }).sort((a, b) => a.level_index - b.level_index);

  const denied = new Set();
  let effectiveAllow = null;
  let permissionCeiling = 'P6';

  for (const layer of normalized) {
    const rank = permissionRank(layer.permission_ceiling);
    if (rank < permissionRank(permissionCeiling)) permissionCeiling = layer.permission_ceiling;

    for (const capability of layer.deny) denied.add(capability);

    if (effectiveAllow === null) {
      effectiveAllow = new Set(layer.allow);
    } else if (layer.allow.length) {
      effectiveAllow = new Set(layer.allow.filter((capability) => effectiveAllow.has(capability)));
    }

    for (const capability of denied) {
      if (effectiveAllow) effectiveAllow.delete(capability);
    }
  }

  return {
    allow: [...(effectiveAllow || new Set())].sort(),
    deny: [...denied].sort(),
    permission_ceiling: permissionCeiling
  };
}

function capabilityAllowed(capability, resolvedPolicy) {
  const name = text(capability);
  if (!name) return false;
  if (!resolvedPolicy || !Array.isArray(resolvedPolicy.allow) || !Array.isArray(resolvedPolicy.deny)) {
    return false;
  }
  if (resolvedPolicy.deny.includes(name)) return false;
  return resolvedPolicy.allow.includes(name);
}

function assertNoPrivilegeEscalation(currentPermission, requestedPermission) {
  if (permissionRank(requestedPermission) > permissionRank(currentPermission)) {
    const error = new Error('self privilege escalation is forbidden');
    error.code = 'PRIVILEGE_ESCALATION_DENIED';
    throw error;
  }
  return true;
}

function assertCapabilityNotHardGovernance(capability) {
  const name = text(capability);
  if (HARD_GOVERNANCE_CAPABILITIES.has(name)) {
    const error = new Error('hard governance capability cannot be self-assigned or self-modified');
    error.code = 'HARD_GOVERNANCE_DENIED';
    throw error;
  }
  return true;
}

function requiresHumanApproval(riskClass) {
  return riskRank(riskClass) >= RISK_CLASSES.R4;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    const out = {};
    Object.keys(value).sort().forEach((key) => {
      out[key] = canonicalize(value[key]);
    });
    return out;
  }
  return value;
}

function changeHash(change) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalize(change)))
    .digest('hex');
}

function validateApproval(approval, change, now = Date.now()) {
  if (!approval || typeof approval !== 'object') {
    return { ok: false, reason: 'APPROVAL_MISSING' };
  }
  if (text(approval.diff_hash) !== changeHash(change)) {
    return { ok: false, reason: 'APPROVAL_HASH_MISMATCH' };
  }
  const expiresAt = Date.parse(text(approval.expires_at));
  if (!Number.isFinite(expiresAt) || expiresAt <= Number(now)) {
    return { ok: false, reason: 'APPROVAL_EXPIRED' };
  }
  if (!text(approval.approved_by)) {
    return { ok: false, reason: 'APPROVER_MISSING' };
  }
  return { ok: true, reason: null };
}

function evaluateExternalInstruction(input = {}) {
  const sourceType = text(input.source_type).toUpperCase();
  const requestedCapability = text(input.requested_capability);
  const trust = classifyTrust(sourceType);

  if (trust === TRUST_CLASSES.EXTERNAL_DATA && requestedCapability) {
    return {
      allowed: false,
      trust,
      classification: 'UNTRUSTED_DATA_CANNOT_AUTHORIZE_ACTION'
    };
  }

  return {
    allowed: true,
    trust,
    classification: 'NO_AUTHORITY_ESCALATION'
  };
}

module.exports = {
  POLICY_LEVELS,
  RISK_CLASSES,
  PERMISSIONS,
  TRUST_CLASSES,
  HARD_GOVERNANCE_CAPABILITIES,
  classifyTrust,
  externalContentMayAuthorize,
  resolvePolicyLayers,
  capabilityAllowed,
  assertNoPrivilegeEscalation,
  assertCapabilityNotHardGovernance,
  requiresHumanApproval,
  changeHash,
  validateApproval,
  evaluateExternalInstruction
};
