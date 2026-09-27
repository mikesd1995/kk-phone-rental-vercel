'use strict';

const crypto = require('crypto');
const ContentRouter = require('./kk-content-request-router.js');
const Registry = require('./kk-agent-registry.js');

const GATEWAY_VERSION = 'KK_AGENT_GATEWAY_V1';

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

async function executeAgentRequest(payload = {}, options = {}) {
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
  const invokedAgents = routed && routed.matched
    ? ['kk-content-strategy', 'kk-content-agent']
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

  const requestHash = sha256({
    message,
    input,
    performance_rows_count: performanceRows.length
  });
  const record = {
    invocation_id: invocationId(requestHash),
    request_type: 'CHAT_CONTENT_REQUEST',
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

  const ledgerFn = options.ledgerFn;
  if (typeof ledgerFn !== 'function') {
    return {
      schema_version: GATEWAY_VERSION,
      status: 'BLOCKED_LEDGER_UNAVAILABLE',
      intent,
      matched: true,
      blocker: 'AGENT_INVOCATION_LEDGER_FUNCTION_MISSING',
      invocation: record,
      route: blockedRoute(routed),
      production_writes: 0,
      publishes: 0
    };
  }

  let ledgerReceipt;
  try {
    ledgerReceipt = await ledgerFn(record);
  } catch (error) {
    return {
      schema_version: GATEWAY_VERSION,
      status: 'BLOCKED_LEDGER_UNAVAILABLE',
      intent,
      matched: true,
      blocker: errorCode(error),
      invocation: {
        ...record,
        gate_status: 'BLOCKED_LEDGER_UNAVAILABLE',
        blocked_reason: errorCode(error)
      },
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

module.exports = {
  GATEWAY_VERSION,
  sha256,
  truthFingerprint,
  blockedRoute,
  executeAgentRequest
};
