'use strict';

const G = require('../server/agent-governance-contract.js');
const S = require('./security-boundaries.js');

const VERSION = /^\d+\.\d+\.\d+$/;
const CAPABILITY = /^[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)+$/;
const TYPES = ['object', 'array', 'string', 'integer', 'number', 'boolean', 'null'];
const FORMATS = ['identifier', 'public-url', 'relative-path', 'utc-time'];
const CONTROL_DOMAINS = ['AGENT_EXECUTION', 'EXTERNAL_WRITE', 'DEPLOYMENT', 'SCHEDULES'];
const SCHEMA_KEYS = ['type', 'properties', 'required', 'additionalProperties', 'items', 'enum',
  'minLength', 'maxLength', 'minimum', 'maximum', 'minItems', 'maxItems', 'format'];

function validateSchemaDefinition(schema, depth = 0) {
  S.exactKeys(schema, SCHEMA_KEYS, ['type']);
  if (depth > 8 || !TYPES.includes(schema.type)) S.fail('TOOL_CONTRACT_INVALID');
  const allowed = new Set(['type', 'enum']);
  const add = (keys) => keys.forEach((key) => allowed.add(key));
  if (schema.type === 'object') add(['properties', 'required', 'additionalProperties']);
  if (schema.type === 'array') add(['items', 'minItems', 'maxItems']);
  if (schema.type === 'string') add(['minLength', 'maxLength', 'format']);
  if (schema.type === 'number' || schema.type === 'integer') add(['minimum', 'maximum']);
  if (Object.keys(schema).some((key) => !allowed.has(key))) S.fail('TOOL_CONTRACT_INVALID');
  if (schema.enum !== undefined) {
    if (!Array.isArray(schema.enum) || schema.enum.length < 1 || schema.enum.length > 100) S.fail('TOOL_CONTRACT_INVALID');
    S.assertSafeJson(schema.enum);
  }
  if (schema.type === 'object') {
    S.object(schema.properties, 'TOOL_CONTRACT_INVALID');
    if (schema.additionalProperties !== false || !Array.isArray(schema.required) ||
        schema.required.some((key) => typeof key !== 'string' || !Object.hasOwn(schema.properties, key)) ||
        new Set(schema.required).size !== schema.required.length || Object.keys(schema.properties).length > 64) S.fail('TOOL_CONTRACT_INVALID');
    for (const [key, child] of Object.entries(schema.properties)) {
      if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(key) || ['__proto__', 'constructor', 'prototype'].includes(key)) S.fail('TOOL_CONTRACT_INVALID');
      validateSchemaDefinition(child, depth + 1);
    }
  }
  if (schema.type === 'array') validateSchemaDefinition(schema.items, depth + 1);
  for (const [minKey, maxKey, cap] of [['minLength', 'maxLength', 65536], ['minItems', 'maxItems', 1000]]) {
    for (const key of [minKey, maxKey]) {
      if (schema[key] !== undefined && (!Number.isSafeInteger(schema[key]) || schema[key] < 0 || schema[key] > cap)) S.fail('TOOL_CONTRACT_INVALID');
    }
    if (schema[minKey] !== undefined && schema[maxKey] !== undefined && schema[minKey] > schema[maxKey]) S.fail('TOOL_CONTRACT_INVALID');
  }
  for (const key of ['minimum', 'maximum']) {
    if (schema[key] !== undefined && (typeof schema[key] !== 'number' || !Number.isFinite(schema[key]))) S.fail('TOOL_CONTRACT_INVALID');
  }
  if (schema.minimum !== undefined && schema.maximum !== undefined && schema.minimum > schema.maximum) S.fail('TOOL_CONTRACT_INVALID');
  if (schema.format !== undefined && !FORMATS.includes(schema.format)) S.fail('TOOL_CONTRACT_INVALID');
  return true;
}

function validateSchemaValue(schema, value, { allowed_hosts = [], max_bytes = 65536 } = {}) {
  validateSchemaDefinition(schema);
  S.assertSafeJson(value, { max_bytes });
  function visit(definition, item) {
    const mismatch = () => S.fail('TOOL_SCHEMA_MISMATCH');
    if (definition.enum && !definition.enum.some((choice) => G.changeHash(choice) === G.changeHash(item))) mismatch();
    switch (definition.type) {
      case 'object':
        S.exactKeys(item, Object.keys(definition.properties), definition.required);
        for (const [key, child] of Object.entries(item)) visit(definition.properties[key], child);
        break;
      case 'array':
        if (!Array.isArray(item) || item.length > (definition.maxItems ?? 1000) || item.length < (definition.minItems ?? 0)) mismatch();
        item.forEach((child) => visit(definition.items, child));
        break;
      case 'string':
        if (typeof item !== 'string' || item.length > (definition.maxLength ?? 65536) || item.length < (definition.minLength ?? 0)) mismatch();
        if (definition.format === 'identifier') S.identity(item);
        if (definition.format === 'public-url') S.validatePublicUrl(item, { allowed_hosts });
        if (definition.format === 'relative-path') S.validateRelativePath(item);
        if (definition.format === 'utc-time' && (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(item) ||
            !Number.isFinite(Date.parse(item)) || new Date(item).toISOString() !== item)) mismatch();
        break;
      case 'integer':
      case 'number':
        if (typeof item !== 'number' || !Number.isFinite(item) || definition.type === 'integer' && !Number.isSafeInteger(item) ||
            definition.minimum !== undefined && item < definition.minimum || definition.maximum !== undefined && item > definition.maximum) mismatch();
        break;
      case 'boolean': if (typeof item !== 'boolean') mismatch(); break;
      case 'null': if (item !== null) mismatch(); break;
      default: mismatch();
    }
  }
  visit(schema, value);
  return true;
}

function validateToolContract(contract) {
  S.assertSafeJson(contract);
  S.exactKeys(contract, ['tool_id', 'version', 'input_schema', 'output_schema', 'risk_class',
    'required_capability', 'allowed_environments', 'read_only', 'side_effect', 'idempotent',
    'timeout', 'retry_policy', 'approval_requirement', 'credential_class', 'network_destination',
    'audit_level', 'redaction_policy', 'estimated_cost', 'control_domain'], ['tool_id', 'version', 'input_schema', 'output_schema', 'risk_class',
    'required_capability', 'allowed_environments', 'read_only', 'side_effect', 'idempotent',
    'timeout', 'retry_policy', 'approval_requirement', 'credential_class', 'network_destination',
    'audit_level', 'redaction_policy'], 'TOOL_CONTRACT_INVALID');
  if (contract.estimated_cost !== undefined && (!Number.isSafeInteger(contract.estimated_cost) || contract.estimated_cost < 0)) S.fail('TOOL_CONTRACT_INVALID');
  if (contract.control_domain !== undefined && !CONTROL_DOMAINS.includes(contract.control_domain)) S.fail('TOOL_CONTRACT_INVALID');
  if (typeof contract.tool_id !== 'string' || !CAPABILITY.test(contract.tool_id) ||
      typeof contract.version !== 'string' || !VERSION.test(contract.version) ||
      !['R0', 'R1', 'R2', 'R3'].includes(contract.risk_class) ||
      typeof contract.required_capability !== 'string' || !CAPABILITY.test(contract.required_capability) ||
      !Array.isArray(contract.allowed_environments) || !contract.allowed_environments.length ||
      new Set(contract.allowed_environments).size !== contract.allowed_environments.length) S.fail('TOOL_CONTRACT_INVALID');
  G.assertCapabilityNotHardGovernance(contract.required_capability);
  if (/(?:^|\.)(?:prod|production)(?:\.|$)/.test(contract.tool_id) ||
      /(?:^|\.)(?:prod|production)(?:\.|$)/.test(contract.required_capability)) S.fail('PRODUCTION_AUTHORITY_DENIED');
  for (const environment of contract.allowed_environments) S.assertEnvironment(environment);
  for (const name of ['read_only', 'idempotent']) if (typeof contract[name] !== 'boolean') S.fail('TOOL_CONTRACT_INVALID');
  if (!['NONE', 'LOCAL_WRITE', 'EXTERNAL_WRITE'].includes(contract.side_effect) ||
      contract.read_only !== (contract.side_effect === 'NONE') ||
      !contract.read_only && !['R2', 'R3'].includes(contract.risk_class) ||
      !Number.isInteger(contract.timeout) || contract.timeout < 1 || contract.timeout > 300000 ||
      !['NONE', 'HUMAN'].includes(contract.approval_requirement) ||
      !['NONE', 'SCOPED_SHORT_LIVED'].includes(contract.credential_class) ||
      contract.audit_level !== 'MANDATORY' || contract.redaction_policy !== 'HASH_ONLY') S.fail('TOOL_CONTRACT_INVALID');
  if (!contract.read_only) {
    for (const [pattern, domain] of [[/(?:^|\.)(?:deploy|deployment)(?:\.|$)/, 'DEPLOYMENT'],
      [/(?:^|\.)(?:schedule|schedules)(?:\.|$)/, 'SCHEDULES']]) {
      if ((pattern.test(contract.tool_id) || pattern.test(contract.required_capability)) && contract.control_domain !== domain) S.fail('CONTROL_DOMAIN_MISMATCH');
    }
  }
  S.exactKeys(contract.retry_policy, ['max_attempts', 'backoff_ms'], undefined, 'TOOL_CONTRACT_INVALID');
  if (!Number.isInteger(contract.retry_policy.max_attempts) || contract.retry_policy.max_attempts < 1 ||
      contract.retry_policy.max_attempts > 3 || !contract.idempotent && contract.retry_policy.max_attempts !== 1 ||
      !Number.isInteger(contract.retry_policy.backoff_ms) || contract.retry_policy.backoff_ms < 0 ||
      contract.retry_policy.backoff_ms > 60000) S.fail('TOOL_CONTRACT_INVALID');
  S.exactKeys(contract.network_destination, ['mode', 'allowed_hosts'], undefined, 'TOOL_CONTRACT_INVALID');
  const destination = contract.network_destination;
  if (!['DENY', 'ALLOWLIST'].includes(destination.mode) || !Array.isArray(destination.allowed_hosts) ||
      destination.allowed_hosts.length > 32 || destination.mode === 'DENY' && destination.allowed_hosts.length ||
      destination.mode === 'ALLOWLIST' && !destination.allowed_hosts.length) S.fail('TOOL_CONTRACT_INVALID');
  for (const host of destination.allowed_hosts) S.validatePublicUrl(`https://${host}/`, { allowed_hosts: [host] });
  validateSchemaDefinition(contract.input_schema);
  validateSchemaDefinition(contract.output_schema);
  return true;
}

// This is intentionally only a typed proposal constructor. It does not accept
// an authorization boolean, issue certificates, consume approvals, or execute.
// The persistent control-plane service must atomically authorize and audit it.
function prepareToolCall({ request, contract }) {
  validateToolContract(contract);
  S.assertSafeJson(request);
  S.exactKeys(request, ['tool_id', 'tool_version', 'workspace_id', 'project_id', 'task_id',
    'run_id', 'environment', 'idempotency_key', 'target', 'proposal_id', 'input'],
  ['tool_id', 'tool_version', 'workspace_id', 'project_id', 'task_id', 'run_id', 'environment', 'idempotency_key', 'input']);
  if (request.tool_id !== contract.tool_id || request.tool_version !== contract.version) S.fail('TOOL_UNKNOWN');
  for (const key of ['workspace_id', 'project_id', 'task_id', 'run_id', 'idempotency_key']) S.identity(request[key], 'PROJECT_IDENTITY_REQUIRED');
  if (request.target !== undefined) S.identity(request.target, 'TARGET_INVALID');
  if (request.proposal_id !== undefined) S.identity(request.proposal_id, 'PROPOSAL_INVALID');
  S.assertEnvironment(request.environment);
  if (!contract.allowed_environments.includes(request.environment)) S.fail('ENVIRONMENT_DENIED');
  validateSchemaValue(contract.input_schema, request.input, { allowed_hosts: contract.network_destination.allowed_hosts });
  const normalized = JSON.parse(JSON.stringify(request));
  const payloadHash = G.changeHash({ ...normalized, tool_contract_hash: G.changeHash(contract) });
  const intent = { ...normalized, risk_class: contract.risk_class,
    required_capability: contract.required_capability, read_only: contract.read_only,
    side_effect: contract.side_effect, approval_requirement: contract.approval_requirement,
    tool_contract_version: contract.version, tool_contract_hash: G.changeHash(contract),
    payload_hash: payloadHash, status: 'PROPOSED_NO_EXECUTION', execution_enabled: false };
  function freeze(value) {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  }
  return freeze(intent);
}

function validateToolOutput({ contract, output }) {
  validateToolContract(contract);
  validateSchemaValue(contract.output_schema, output, { allowed_hosts: contract.network_destination.allowed_hosts });
  return { trust_class: G.TRUST_CLASSES.EXTERNAL_DATA, may_authorize: false,
    output_hash: G.changeHash(output), classification: 'UNTRUSTED_EXTERNAL_DATA' };
}

module.exports = { validateSchemaDefinition, validateSchemaValue, validateToolContract,
  prepareToolCall, validateToolOutput };
