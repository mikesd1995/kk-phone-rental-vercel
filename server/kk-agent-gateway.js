'use strict';

const crypto = require('crypto');
const ContentRouter = require('./kk-content-request-router.js');
const Registry = require('./kk-agent-registry.js');
const TaskRouter = require('./kk-agent-task-router.js');
const Orchestration = require('./kk-agent-orchestration.js');

const GATEWAY_VERSION = 'KK_AGENT_GATEWAY_V2';

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

function invocationId(requestHash) {
  const nonce = crypto.randomUUID().replace(/-/g, '');
  return `agi_${requestHash.slice(0, 12)}_${nonce.slice(0, 20)}`;
}

function truthFingerprint(input = {}) {
  return sha256({
    event: input.event || '',
    venue: input.venue || '',
    artist: input.artist || '',
    verified_event: input.verified_event === true,
    verified_pricing: input.verified_pricing === true,
    price_display: input.price_display || '',
    inventory_available: input.inventory_available === true,
    primary_objective: input.primary_objective || '',
    requested_channel: input.requested_channel || ''
  });
}

function blockedRoute(route) {
  if (!route || typeof route !== 'object') return route;
  const copy = { ...route };
  delete copy.generation_prompt;
  return copy;
}

function errorCode(error) {
  return String(error && (error.code || error.name) || 'ERROR');
}

async function writeLedger(record, ledgerFn) {
  if (typeof ledgerFn !== 'function') {
    throw Object.assign(new Error('agent invocation ledger function missing'), {
      code: 'AGENT_INVOCATION_LEDGER_FUNCTION_MISSING'
    });
  }
  return ledgerFn(record);
}

async function executeContentRequest(payload = {}, options = {}) {
  const message = String(payload.message || '').trim();
  const input = payload.input && typeof payload.input === 'object' ? payload.input : {};
  const performanceRows = Array.isArray(payload.performanceRows) ? payload.performanceRows : [];
  const intent = ContentRouter.detectContentIntent(message);

  if (intent === 'non_content') {
    return {
      schema_version: GATEWAY_VERSION,
      status: 'NO_AGENT_ROUTE',
      intent,
      matched: false,
      production_writes: 0,
      publishes: 0
    };
  }

  const routeSpec = Registry.routeForIntent(intent);
  if (!routeSpec) {
    return {
      schema_version: GATEWAY_VERSION,
      status: 'BLOCKED_REQUIRED_AGENT_NOT_INVOKED',
      intent,
      matched: true,
      blocker: 'AGENT_ROUTE_NOT_REGISTERED',
      production_writes: 0,
      publishes: 0
    };
  }

  const routeFn = typeof options.contentRouteFn === 'function'
    ? options.contentRouteFn
    : ContentRouter.routeContentRequest;
  const routed = routeFn({ message, input, performanceRows });
  const invokedAgents = routed && routed.matched && routed.marketing_required === true && routed.marketing_plan
    ? ['kk-marketing-agent', 'kk-content-strategy', 'kk-content-agent']
    : [];
  const invocationCheck = Registry.validateInvocation(intent, invokedAgents);

  let gateStatus = 'READY_FOR_OWNER_REVIEW';
  let blockedReason = '';
  if (!invocationCheck.pass) {
    gateStatus = 'BLOCKED_REQUIRED_AGENT_NOT_INVOKED';
    blockedReason = invocationCheck.missing_agents.join(',');
  } else if (intent === 'direct_rental_x' && routed.content_gate !== 'PASS') {
    gateStatus = 'BLOCKED_CONTENT_GATE';
    blockedReason = (routed.plan && routed.plan.readiness && routed.plan.readiness.commercial_blockers || []).join(',');
  }

  const requestHash = sha256({ message, input, performance_rows_count: performanceRows.length });
  const record = {
    invocation_id: invocationId(requestHash),
    request_type: routeSpec.request_type,
    intent,
    route_id: invocationCheck.route_id || routeSpec.route_id,
    required_agents: invocationCheck.required_agents,
    invoked_agents: invocationCheck.invoked_agents,
    agent_versions: invocationCheck.agent_versions,
    registry_version: Registry.REGISTRY_VERSION,
    gateway_version: GATEWAY_VERSION,
    gate_status: gateStatus,
    blocked_reason: blockedReason,
    content_gate: routed.content_gate || '',
    request_hash: requestHash,
    truth_hash: truthFingerprint(input),
    source_commit_sha: String(process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || '').trim(),
    owner_review_required: true,
    production_writes: 0,
    publishes: 0
  };

  let ledgerReceipt;
  try {
    ledgerReceipt = await writeLedger(record, options.ledgerFn);
  } catch (error) {
    return {
      schema_version: GATEWAY_VERSION,
      status: 'BLOCKED_LEDGER_UNAVAILABLE',
      intent,
      matched: true,
      blocker: errorCode(error),
      invocation: {...record, gate_status:'BLOCKED_LEDGER_UNAVAILABLE', blocked_reason:errorCode(error)},
      route: blockedRoute(routed),
      production_writes: 0,
      publishes: 0
    };
  }

  const ready = gateStatus === 'READY_FOR_OWNER_REVIEW';
  return {
    schema_version: GATEWAY_VERSION,
    status: gateStatus,
    intent,
    matched: true,
    invocation: record,
    ledger: ledgerReceipt,
    invocation_check: invocationCheck,
    route: ready ? routed : blockedRoute(routed),
    owner_review_required: true,
    production_writes: 0,
    publishes: 0
  };
}

async function executeOperationalRequest(payload = {}, options = {}) {
  const intent = String(payload.task_type || '').trim().toLowerCase();
  const input = payload.input && typeof payload.input === 'object' ? payload.input : {};
  const routeSpec = Registry.routeForIntent(intent);

  if (!routeSpec) {
    return {
      schema_version: GATEWAY_VERSION,
      status: 'NO_AGENT_ROUTE',
      intent,
      matched: false,
      blocker: 'AGENT_ROUTE_NOT_REGISTERED',
      production_writes: 0,
      publishes: 0
    };
  }

  const correlationId = String(payload.correlation_id || crypto.randomUUID()).trim();

  if (!routeSpec.runtime_available) {
    const evidence = await Orchestration.recordExecution({
      intent,
      request_type: routeSpec.request_type,
      invoked_agents: [],
      input,
      output: {runtime_available:false,blocked_reason:routeSpec.blocked_reason},
      correlation_id: correlationId,
      gate_status: 'BLOCKED_RUNTIME_NOT_AVAILABLE',
      blocked_reason: routeSpec.blocked_reason,
      owner_review_required: routeSpec.owner_review_required
    }, {ledgerFn: options.ledgerFn, env: options.env});

    return {
      schema_version: GATEWAY_VERSION,
      status: evidence.status === 'BLOCKED_LEDGER_UNAVAILABLE'
        ? 'BLOCKED_LEDGER_UNAVAILABLE'
        : 'BLOCKED_RUNTIME_NOT_AVAILABLE',
      intent,
      matched: true,
      blocker: routeSpec.blocked_reason,
      invocation: evidence.record,
      ledger: evidence.receipt,
      downstream_agents: [...routeSpec.downstream_agents],
      result: null,
      production_writes: 0,
      publishes: 0
    };
  }

  let executed;
  try {
    const taskFn = typeof options.taskRouteFn === 'function'
      ? options.taskRouteFn
      : TaskRouter.executeTask;
    executed = await taskFn(intent, input, options);
  } catch (error) {
    const evidence = await Orchestration.recordExecution({
      intent,
      request_type: routeSpec.request_type,
      invoked_agents: [],
      input,
      output: {error_class:errorCode(error)},
      correlation_id: correlationId,
      gate_status: 'BLOCKED_AGENT_EXECUTION_FAILED',
      blocked_reason: errorCode(error),
      owner_review_required: routeSpec.owner_review_required
    }, {ledgerFn: options.ledgerFn, env: options.env});

    return {
      schema_version: GATEWAY_VERSION,
      status: evidence.status === 'BLOCKED_LEDGER_UNAVAILABLE'
        ? 'BLOCKED_LEDGER_UNAVAILABLE'
        : 'BLOCKED_AGENT_EXECUTION_FAILED',
      intent,
      matched: true,
      blocker: errorCode(error),
      invocation: evidence.record,
      ledger: evidence.receipt,
      result: null,
      production_writes: 0,
      publishes: 0
    };
  }

  const check = Registry.validateInvocation(intent, executed.invoked_agents);
  const evidence = await Orchestration.recordExecution({
    intent,
    request_type: routeSpec.request_type,
    invoked_agents: executed.invoked_agents,
    input,
    output: executed.result,
    correlation_id: correlationId,
    gate_status: check.pass ? 'RECORDED' : 'BLOCKED_REQUIRED_AGENT_NOT_INVOKED',
    blocked_reason: check.pass ? '' : check.missing_agents.join(','),
    owner_review_required: routeSpec.owner_review_required
  }, {ledgerFn: options.ledgerFn, env: options.env});

  if (!evidence.pass) {
    return {
      schema_version: GATEWAY_VERSION,
      status: evidence.status,
      intent,
      matched: true,
      blocker: evidence.record.blocked_reason,
      invocation: evidence.record,
      ledger: evidence.receipt,
      result: null,
      downstream_agents: [...routeSpec.downstream_agents],
      production_writes: 0,
      publishes: 0
    };
  }

  return {
    schema_version: GATEWAY_VERSION,
    status: 'RECORDED',
    intent,
    matched: true,
    invocation: evidence.record,
    ledger: evidence.receipt,
    invocation_check: check,
    downstream_agents: [...routeSpec.downstream_agents],
    result: executed.result,
    owner_review_required: routeSpec.owner_review_required,
    production_writes: 0,
    publishes: 0
  };
}

async function executeAgentRequest(payload = {}, options = {}) {
  if (String(payload.task_type || '').trim()) {
    return executeOperationalRequest(payload, options);
  }
  return executeContentRequest(payload, options);
}

module.exports = {
  GATEWAY_VERSION,
  sha256,
  truthFingerprint,
  blockedRoute,
  executeContentRequest,
  executeOperationalRequest,
  executeAgentRequest
};
