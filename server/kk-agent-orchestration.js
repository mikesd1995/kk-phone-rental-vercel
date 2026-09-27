'use strict';

const crypto = require('crypto');
const Registry = require('./kk-agent-registry.js');
const Ledger = require('./kk-agent-invocation-ledger.js');

const ORCHESTRATION_VERSION = 'KK_AGENT_ORCHESTRATION_V1';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((out, key) => {
    out[key] = stable(value[key]);
    return out;
  }, {});
}

function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function deterministicInvocationId({ intent, correlation_id, request_hash }) {
  const digest = sha256({
    intent: String(intent || ''),
    correlation_id: String(correlation_id || ''),
    request_hash: String(request_hash || '')
  });
  return `agi_${digest.slice(0, 40)}`;
}

function buildRecord({
  intent,
  request_type,
  invoked_agents,
  input,
  output,
  correlation_id = '',
  gate_status = 'RECORDED',
  blocked_reason = '',
  content_gate = '',
  owner_review_required
} = {}) {
  const route = Registry.routeForIntent(intent);
  if (!route) {
    throw Object.assign(new Error('agent route not registered'), {
      code: 'AGENT_ROUTE_NOT_REGISTERED'
    });
  }

  const check = Registry.validateInvocation(intent, invoked_agents);
  const requestHash = sha256({ intent, input: input || {}, correlation_id });
  const truthHash = sha256({ intent, output: output || {}, correlation_id });
  const finalGate = check.pass ? gate_status : 'BLOCKED_REQUIRED_AGENT_NOT_INVOKED';
  const reason = check.pass ? blocked_reason : check.missing_agents.join(',');

  return {
    invocation_id: deterministicInvocationId({
      intent,
      correlation_id,
      request_hash: requestHash
    }),
    request_type: request_type || route.request_type,
    intent,
    route_id: route.route_id,
    required_agents: check.required_agents,
    invoked_agents: check.invoked_agents,
    agent_versions: check.agent_versions,
    registry_version: Registry.REGISTRY_VERSION,
    gateway_version: ORCHESTRATION_VERSION,
    gate_status: finalGate,
    blocked_reason: reason,
    content_gate,
    request_hash: requestHash,
    truth_hash: truthHash,
    source_commit_sha: String(process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || '').trim(),
    owner_review_required: owner_review_required === undefined
      ? route.owner_review_required
      : owner_review_required === true,
    production_writes: 0,
    publishes: 0
  };
}

async function recordExecution(args = {}, options = {}) {
  const record = buildRecord(args);
  const env = options.env || process.env;
  const cfg = Ledger.configState(env);
  const ledgerFn = typeof options.ledgerFn === 'function'
    ? options.ledgerFn
    : row => Ledger.recordInvocation({ env, row });

  if (!cfg.enabled && typeof options.ledgerFn !== 'function') {
    return {
      pass: record.gate_status !== 'BLOCKED_REQUIRED_AGENT_NOT_INVOKED',
      persistent: false,
      status: 'EVIDENCE_ONLY_LEDGER_DISABLED',
      record,
      receipt: null
    };
  }

  try {
    const receipt = await ledgerFn(record);
    return {
      pass: !String(record.gate_status).startsWith('BLOCKED_'),
      persistent: true,
      status: record.gate_status,
      record,
      receipt
    };
  } catch (error) {
    return {
      pass: false,
      persistent: false,
      status: 'BLOCKED_LEDGER_UNAVAILABLE',
      record: {
        ...record,
        gate_status: 'BLOCKED_LEDGER_UNAVAILABLE',
        blocked_reason: String(error && (error.code || error.name) || 'ERROR')
      },
      receipt: null,
      error_code: String(error && (error.code || error.name) || 'ERROR')
    };
  }
}

function coverageSummary(rows = []) {
  const normalized = Array.isArray(rows) ? rows : [];
  const byIntent = {};
  let complete = 0;
  let blocked = 0;

  for (const row of normalized) {
    const required = Array.isArray(row.required_agents) ? row.required_agents : [];
    const invoked = new Set(Array.isArray(row.invoked_agents) ? row.invoked_agents : []);
    const missing = required.filter(id => !invoked.has(id));
    const blockedRow = String(row.gate_status || '').startsWith('BLOCKED_');
    if (!missing.length && !blockedRow) complete += 1;
    if (blockedRow || missing.length) blocked += 1;

    const intent = String(row.intent || 'unknown');
    const item = byIntent[intent] || { total:0, complete:0, blocked:0 };
    item.total += 1;
    if (!missing.length && !blockedRow) item.complete += 1;
    if (blockedRow || missing.length) item.blocked += 1;
    byIntent[intent] = item;
  }

  return {
    total: normalized.length,
    complete,
    blocked,
    coverage_percent: normalized.length ? Number(((complete / normalized.length) * 100).toFixed(2)) : null,
    by_intent: byIntent
  };
}

module.exports = {
  ORCHESTRATION_VERSION,
  sha256,
  deterministicInvocationId,
  buildRecord,
  recordExecution,
  coverageSummary
};
