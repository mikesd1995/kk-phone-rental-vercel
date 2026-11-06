'use strict';

const crypto = require('crypto');
const ContentRouter = require('./kk-content-request-router.js');
const Registry = require('./kk-agent-registry.js');
const TaskRouter = require('./kk-agent-task-router.js');
const Orchestration = require('./kk-agent-orchestration.js');
const ProjectMemory = require('./kk-project-memory.js');
const ProjectMemoryCorpus = require('../config/kk-project-memory.json');
const ProjectMemoryLedger = require('./kk-project-memory-ledger.js');
const XPostingPlan = require('./kk-x-posting-plan.js');
const OwnerPosterOps = require('./kk-owner-poster-ops.js');

const GATEWAY_VERSION = 'KK_AGENT_GATEWAY_V6';

function memoryDomainsForIntent(intent='') {
  const key=String(intent||'').trim().toLowerCase();
  if(key.includes('content')||key==='direct_rental_x'||key==='x_posting_plan') return ['content','agent_orchestration'];
  if(key.includes('ultra_deep')||key.includes('scan')||key.includes('source_watch')) return ['discovery_scanner','agent_orchestration','reliability_debug'];
  if(key==='owner_poster_update') return ['storefront','agent_orchestration','reliability_debug'];
  if(key.includes('storefront')) return ['storefront','agent_orchestration','reliability_debug'];
  if(key.includes('reliability')) return ['reliability_debug','agent_orchestration'];
  return ['agent_orchestration','project_memory'];
}

async function bootstrapProjectMemory(intent, options={}) {
  if(options.projectMemoryBypass===true) return {status:'BYPASS_FOR_TEST_ONLY',context:[]};
  const corpus=options.projectMemoryCorpus||ProjectMemoryCorpus;
  const domains=memoryDomainsForIntent(intent);
  let durable=[];
  let durableMode='disabled';
  const ledgerFn=options.projectMemoryListFn||ProjectMemoryLedger.listEvents;
  try { const live=await ledgerFn({env:options.env||process.env,fetchImpl:options.fetchImpl,limit:200,domains}); durable=Array.isArray(live&&live.rows)?live.rows:[]; durableMode=String(live&&live.mode||'disabled'); }
  catch(error){ throw Object.assign(new Error('project memory durable ledger unavailable'),{code:errorCode(error)}); }
  const result=ProjectMemory.buildBootstrap([...(corpus.items||[]),...durable],{domains,limit:80});
  if(result.status!=='READY') throw Object.assign(new Error('project memory unavailable'),{code:'PROJECT_MEMORY_BOOTSTRAP_BLOCKED',details:result});
  return {...result,durable_mode:durableMode,durable_context_count:durable.length};
}

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

  let projectMemory;
  try { projectMemory=await bootstrapProjectMemory(intent,options); }
  catch(error){ return {schema_version:GATEWAY_VERSION,status:'BLOCKED_PROJECT_MEMORY_UNAVAILABLE',intent,matched:true,blocker:errorCode(error),production_writes:0,publishes:0}; }

  const routeFn = typeof options.contentRouteFn === 'function'
    ? options.contentRouteFn
    : ContentRouter.routeContentRequest;
  const routed = routeFn({ message, input, performanceRows });
  const fullContentPipelineReady = routed &&
    routed.matched === true &&
    routed.marketing_required === true &&
    Boolean(routed.marketing_plan) &&
    routed.strategy_required === true &&
    routed.content_agent_required === true &&
    Boolean(routed.plan) &&
    routed.qa_required === true &&
    routed.selector_required === true &&
    Boolean(routed.selector_version);
  const invokedAgents = fullContentPipelineReady
    ? ['kk-marketing-agent', 'kk-content-strategy', 'kk-content-agent', 'kk-content-qa', 'kk-content-selector']
    : [];
  const invocationCheck = Registry.validateInvocation(intent, invokedAgents);

  let gateStatus = 'READY_FOR_OWNER_REVIEW';
  let blockedReason = '';
  if (!invocationCheck.pass) {
    gateStatus = 'BLOCKED_REQUIRED_AGENT_NOT_INVOKED';
    blockedReason = invocationCheck.missing_agents.join(',');
  } else if (routed.content_gate !== 'PASS') {
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
    project_memory: {status:projectMemory.status, context_count:projectMemory.context.length, durable_mode:projectMemory.durable_mode, durable_context_count:projectMemory.durable_context_count},
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

  let projectMemory;
  try { projectMemory=await bootstrapProjectMemory(intent,options); }
  catch(error){ return {schema_version:GATEWAY_VERSION,status:'BLOCKED_PROJECT_MEMORY_UNAVAILABLE',intent,matched:true,blocker:errorCode(error),production_writes:0,publishes:0}; }

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
    project_memory: {status:projectMemory.status, context_count:projectMemory.context.length, durable_mode:projectMemory.durable_mode, durable_context_count:projectMemory.durable_context_count},
    owner_review_required: routeSpec.owner_review_required,
    production_writes: 0,
    publishes: 0
  };
}

async function executeAgentRequest(payload = {}, options = {}) {
  if (String(payload.task_type || '').trim()) {
    return executeOperationalRequest(payload, options);
  }
  if (OwnerPosterOps.detectOwnerPosterRequest(payload.message)) {
    return executeOperationalRequest({...payload, task_type:'owner_poster_update'}, options);
  }
  if (XPostingPlan.detectRequest(payload.message)) {
    return executeOperationalRequest({...payload, task_type:'x_posting_plan'}, options);
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
  executeAgentRequest,
  memoryDomainsForIntent,
  bootstrapProjectMemory
};
