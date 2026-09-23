'use strict';

const { changeHash } = require('../server/agent-governance-contract');
const STATES = Object.freeze({
  CREATED: ['VALIDATING', 'CANCELLED'], VALIDATING: ['READY', 'REJECTED', 'FAILED', 'CANCELLED'],
  READY: ['PLANNING', 'CANCELLED'], PLANNING: ['RUNNING', 'WAITING_APPROVAL', 'FAILED', 'CANCELLED'],
  RUNNING: ['WAITING_APPROVAL', 'RETRY_PENDING', 'EVALUATING', 'STAGED', 'RECOVERING', 'FAILED', 'CANCELLED'],
  WAITING_APPROVAL: ['READY', 'RUNNING', 'REJECTED', 'CANCELLED'],
  RETRY_PENDING: ['RUNNING', 'RECOVERING', 'FAILED', 'CANCELLED'],
  EVALUATING: ['SUCCEEDED', 'STAGED', 'FAILED', 'CANCELLED'], STAGED: ['SUCCEEDED', 'FAILED', 'CANCELLED'],
  RECOVERING: ['RUNNING', 'FAILED', 'CANCELLED'], SUCCEEDED: [], FAILED: [], REJECTED: [], CANCELLED: []
});
const TERMINAL = new Set(['SUCCEEDED', 'FAILED', 'REJECTED', 'CANCELLED']);
const BUDGET_KEYS = Object.freeze(['steps', 'tool_calls', 'retries', 'cost']);
const VERSION_KEYS = Object.freeze(['policy_version', 'project_pack_version', 'workflow_version', 'agent_version', 'tool_contract_version', 'capability_certificate_version']);
const SWITCHES = Object.freeze(['AGENT_EXECUTION', 'EXTERNAL_WRITE', 'PRODUCTION_WRITE', 'DEPLOYMENT', 'SCHEDULES']);
const FAILURE_CODES = Object.freeze(['MODEL_DOWN', 'PROVIDER_DOWN', 'TOOL_TIMEOUT', 'TOOL_SCHEMA_MISMATCH', 'RATE_LIMIT', 'BUDGET_EXCEEDED', 'LOOP_DETECTED', 'SOURCE_CONFLICT', 'STALE_DATA', 'LEASE_CONFLICT', 'VERSION_CONFLICT', 'READBACK_MISMATCH', 'EVAL_FAILED', 'CANARY_FAILED', 'APPROVAL_EXPIRED', 'CHECKPOINT_CORRUPT', 'CHECKPOINT_VERSION_DRIFT', 'PROJECT_SCOPE_VIOLATION', 'KILL_SWITCH_UNAVAILABLE', 'AUDIT_WRITE_FAILED', 'WRITE_AMBIGUOUS_RECONCILE_REQUIRED']);
const RETENTION = Object.freeze({ tasks: 'PROJECT_HISTORY_HUMAN_REVIEW', runs: 'PROJECT_HISTORY_HUMAN_REVIEW', audit: 'SECURITY_LEGAL_HOLD_NO_AGENT_DELETE', evidence: 'SOURCE_VALIDITY_AND_CLAIM_HOLD', checkpoints: 'UNTIL_TERMINAL_AND_RECOVERY_HOLD', tool_traces: 'MINIMIZED_30_DAYS_CANDIDATE', cost_records: 'ACCOUNTING_HUMAN_REVIEW' });
function fail(code) { const e = new Error(code); e.code = code; throw e; }
function requireThat(value, code) { if (!value) fail(code); }
function text(value, code = 'SCHEMA_INVALID') { requireThat(typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 512, code); return value; }
function id(value) { text(value, 'IDENTITY_REQUIRED'); requireThat(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value), 'IDENTITY_INVALID'); return value; }
function utc(value) { requireThat(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value, 'TIMESTAMP_INVALID'); return value; }
function rank(value, kind, max) { requireThat(typeof value === 'string' && new RegExp(`^${kind}[0-${max}]$`).test(value), kind === 'P' ? 'PERMISSION_INVALID' : 'RISK_INVALID'); return Number(value.slice(1)); }
function strings(value) { requireThat(Array.isArray(value) && value.length <= 128 && value.every(x => typeof x === 'string' && x.length > 0 && x.length <= 128) && new Set(value).size === value.length, 'SCHEMA_INVALID'); return value; }
function budget(value) { requireThat(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 4, 'BUDGET_INVALID'); for (const k of BUDGET_KEYS) requireThat(Number.isSafeInteger(value[k]) && value[k] >= 0, 'BUDGET_INVALID'); return value; }
function zeroBudget() { return { steps: 0, tool_calls: 0, retries: 0, cost: 0 }; }
function versions(value) { for (const k of VERSION_KEYS) text(value[k], 'VERSION_IDENTITY_REQUIRED'); return Object.fromEntries(VERSION_KEYS.map(k => [k, value[k]])); }
function assertSafeData(value) {
  const visited = new Set(); let nodes = 0;
  function shape(v, depth) {
    requireThat(++nodes <= 10000 && depth <= 12, 'PAYLOAD_TOO_LARGE');
    if (v === null || typeof v === 'string' || typeof v === 'boolean') return;
    if (typeof v === 'number') { requireThat(Number.isFinite(v), 'SCHEMA_INVALID'); return; }
    requireThat(v && typeof v === 'object' && !visited.has(v) && (Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype), 'SCHEMA_INVALID');
    visited.add(v);
    for (const k of Object.keys(v)) {
      const descriptor = Object.getOwnPropertyDescriptor(v, k);
      requireThat(!['__proto__', 'prototype', 'constructor'].includes(k) && descriptor && Object.hasOwn(descriptor, 'value'), 'SCHEMA_INVALID');
      shape(descriptor.value, depth + 1);
    }
    if (Array.isArray(v)) requireThat(Object.keys(v).length === v.length, 'SCHEMA_INVALID');
    visited.delete(v);
  }
  shape(value, 0);
  const raw = JSON.stringify(value);
  requireThat(raw && Buffer.byteLength(raw) <= 65536, 'PAYLOAD_TOO_LARGE');
  requireThat(!/-----BEGIN [A-Z ]*PRIVATE KEY-----|\bBearer\s+\S+|\b(?:ghp_|sk_live_|sb_secret_)[A-Za-z0-9_]+|(?:postgres(?:ql)?|https?):\/\/[^\s"/]+:[^\s"/]+@/i.test(raw), 'SECRET_DATA_FORBIDDEN');
  function walk(v) {
    if (!v || typeof v !== 'object') return;
    for (const [k, val] of Object.entries(v)) {
      const accountingField = ['input_tokens', 'output_tokens', 'fencing_token'].includes(k) && Number.isSafeInteger(val);
      requireThat(accountingField || !/(?:authorization|cookies?|password|passwd|pin|private[_-]?key|api[_-]?key|tokens?|service[_-]?role(?:[_-]?key)?|secret|raw_payload|customer_data)$/i.test(k), 'SECRET_DATA_FORBIDDEN');
      if (k === 'data_classification') requireThat(['PUBLIC', 'INTERNAL'].includes(val), 'DATA_CLASSIFICATION_DENIED');
      walk(val);
    }
  }
  walk(value);
}
function transition(from, to) { requireThat(Object.hasOwn(STATES, from) && STATES[from].includes(to), 'INVALID_TASK_TRANSITION'); }
function contentHash(record, omit = []) { const copy = { ...record }; for (const k of ['id', 'version', ...omit]) delete copy[k]; return changeHash(copy); }
module.exports = { STATES, TERMINAL, BUDGET_KEYS, VERSION_KEYS, SWITCHES, FAILURE_CODES, RETENTION, fail, requireThat, text, id, utc, rank, strings, budget, zeroBudget, versions, assertSafeData, transition, contentHash, changeHash };
