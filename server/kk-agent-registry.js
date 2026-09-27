'use strict';

const REGISTRY_VERSION = 'KK_AGENT_REGISTRY_V2';

const AGENTS = Object.freeze({
  'kk-discovery-scanner': Object.freeze({
    version: '2026-09-27',
    authority: 'STAGING_ONLY',
    runtime_state: 'WITNESS_ONLY_NOT_SCANNING',
    surface: 'SCANNER_CONTROL_PLANE',
    production_writes: 0,
    note: 'Current external scanner endpoint proves schedule/witness delivery only; it does not execute event discovery.'
  }),
  'kk-discovery-source-watch': Object.freeze({
    version: 'discovery-source-watch-v1',
    authority: 'ADVISORY',
    runtime_state: 'CALLABLE',
    surface: 'AGENT_GATEWAY',
    production_writes: 0
  }),
  'kk-event-verifier': Object.freeze({
    version: 'verifier-no-drop-reconciliation-v1',
    authority: 'GOVERNED_VERIFICATION_SUPPORT',
    runtime_state: 'CALLABLE_AUDIT_ONLY',
    surface: 'AGENT_GATEWAY',
    production_writes: 0,
    note: 'No-drop reconciliation is callable; final Verifier business commit remains outside this gateway.'
  }),
  'kk-canary-safety': Object.freeze({
    version: '2026-09-27',
    authority: 'ZERO_WRITE_ACCEPTANCE',
    runtime_state: 'CALLABLE',
    surface: 'AGENT_GATEWAY_AND_CLI',
    production_writes: 0
  }),
  'kk-content-strategy': Object.freeze({
    version: '2026-09-27',
    authority: 'READ_ONLY_ADVISOR',
    runtime_state: 'LIVE_GATEWAY',
    surface: 'AGENT_GATEWAY',
    production_writes: 0
  }),
  'kk-content-agent': Object.freeze({
    version: 'KK_CONTENT_AGENT_PLAN_V2',
    authority: 'READ_ONLY_ADVISOR',
    runtime_state: 'LIVE_GATEWAY',
    surface: 'AGENT_GATEWAY',
    production_writes: 0
  }),
  'kk-reliability-learning': Object.freeze({
    version: '2026-09-25',
    authority: 'READ_ONLY_ADVISOR',
    runtime_state: 'LIVE_AUDIT_AND_CALLABLE',
    surface: 'SYSTEM_AUDIT_AND_AGENT_GATEWAY',
    production_writes: 0
  }),
  'hf-event-assist': Object.freeze({
    version: 'scanner-hf-advisory-v1',
    authority: 'NONAUTHORITATIVE_ADVISORY',
    runtime_state: 'CONTROLLED_UAT_OR_CALLABLE_WHEN_ENABLED',
    surface: 'AGENT_GATEWAY',
    production_writes: 0
  })
});

const ROUTES = Object.freeze({
  direct_rental_x: Object.freeze({
    route_id: 'CHAT_CONTENT_DIRECT_RENTAL_X',
    request_type: 'CHAT_CONTENT_REQUEST',
    required_agents: Object.freeze(['kk-content-strategy', 'kk-content-agent']),
    downstream_agents: Object.freeze([]),
    runtime_available: true,
    owner_review_required: true,
    persistent_invocation_evidence_required: true
  }),
  content_draft: Object.freeze({
    route_id: 'CHAT_CONTENT_DRAFT',
    request_type: 'CHAT_CONTENT_REQUEST',
    required_agents: Object.freeze(['kk-content-strategy', 'kk-content-agent']),
    downstream_agents: Object.freeze([]),
    runtime_available: true,
    owner_review_required: true,
    persistent_invocation_evidence_required: true
  }),
  source_watch_check: Object.freeze({
    route_id: 'DISCOVERY_SOURCE_WATCH_CHECK',
    request_type: 'DISCOVERY_SOURCE_WATCH',
    required_agents: Object.freeze(['kk-discovery-source-watch']),
    downstream_agents: Object.freeze(['kk-discovery-scanner', 'kk-event-verifier']),
    runtime_available: true,
    owner_review_required: false,
    persistent_invocation_evidence_required: true
  }),
  verifier_no_drop_audit: Object.freeze({
    route_id: 'VERIFIER_NO_DROP_AUDIT',
    request_type: 'VERIFIER_AUDIT',
    required_agents: Object.freeze(['kk-event-verifier']),
    downstream_agents: Object.freeze([]),
    runtime_available: true,
    owner_review_required: false,
    persistent_invocation_evidence_required: true
  }),
  canary_audit: Object.freeze({
    route_id: 'CANARY_SAFETY_AUDIT',
    request_type: 'CANARY_AUDIT',
    required_agents: Object.freeze(['kk-canary-safety']),
    downstream_agents: Object.freeze([]),
    runtime_available: true,
    owner_review_required: false,
    persistent_invocation_evidence_required: true
  }),
  reliability_audit: Object.freeze({
    route_id: 'RELIABILITY_LEARNING_AUDIT',
    request_type: 'RELIABILITY_AUDIT',
    required_agents: Object.freeze(['kk-reliability-learning']),
    downstream_agents: Object.freeze([]),
    runtime_available: true,
    owner_review_required: false,
    persistent_invocation_evidence_required: true
  }),
  hf_event_assist: Object.freeze({
    route_id: 'SCANNER_HF_EVENT_ASSIST',
    request_type: 'HF_EVENT_ASSIST',
    required_agents: Object.freeze(['hf-event-assist']),
    downstream_agents: Object.freeze(['kk-event-verifier']),
    runtime_available: true,
    owner_review_required: false,
    persistent_invocation_evidence_required: true
  }),
  scan_event: Object.freeze({
    route_id: 'FULL_EVENT_DISCOVERY',
    request_type: 'EVENT_DISCOVERY',
    required_agents: Object.freeze(['kk-discovery-source-watch', 'kk-discovery-scanner']),
    downstream_agents: Object.freeze(['kk-event-verifier']),
    runtime_available: false,
    blocked_reason: 'FULL_SCANNER_WORKER_NOT_WIRED',
    owner_review_required: false,
    persistent_invocation_evidence_required: true
  }),
  verify_event: Object.freeze({
    route_id: 'FINAL_EVENT_VERIFICATION',
    request_type: 'EVENT_VERIFICATION',
    required_agents: Object.freeze(['kk-event-verifier']),
    downstream_agents: Object.freeze([]),
    runtime_available: false,
    blocked_reason: 'FINAL_VERIFIER_COMMIT_WORKER_NOT_WIRED',
    owner_review_required: false,
    persistent_invocation_evidence_required: true
  })
});

function normalizeIntent(value) {
  return String(value || '').trim().toLowerCase();
}

function routeForIntent(intent) {
  return ROUTES[normalizeIntent(intent)] || null;
}

function agentVersions(agentIds = []) {
  const out = {};
  for (const id of agentIds) {
    if (AGENTS[id]) out[id] = AGENTS[id].version;
  }
  return out;
}

function normalizeIds(values) {
  return [...new Set(
    (Array.isArray(values) ? values : [])
      .map(value => String(value || '').trim())
      .filter(Boolean)
  )];
}

function validateInvocation(intent, invokedAgents = []) {
  const route = routeForIntent(intent);
  if (!route) {
    return {
      registry_version: REGISTRY_VERSION,
      applicable: false,
      pass: true,
      required_agents: [],
      invoked_agents: [],
      missing_agents: []
    };
  }

  const invoked = normalizeIds(invokedAgents);
  const missing = route.required_agents.filter(id => !invoked.includes(id));

  return {
    registry_version: REGISTRY_VERSION,
    applicable: true,
    pass: missing.length === 0,
    route_id: route.route_id,
    runtime_available: route.runtime_available,
    required_agents: [...route.required_agents],
    downstream_agents: [...route.downstream_agents],
    invoked_agents: invoked,
    missing_agents: missing,
    owner_review_required: route.owner_review_required,
    persistent_invocation_evidence_required: route.persistent_invocation_evidence_required,
    agent_versions: agentVersions(route.required_agents)
  };
}

function routeHealth() {
  return Object.entries(ROUTES).map(([intent, route]) => ({
    intent,
    route_id: route.route_id,
    runtime_available: route.runtime_available,
    required_agents: [...route.required_agents],
    downstream_agents: [...route.downstream_agents],
    blocked_reason: route.runtime_available ? '' : route.blocked_reason
  }));
}

function publicRegistry() {
  return {
    registry_version: REGISTRY_VERSION,
    agents: AGENTS,
    routes: ROUTES,
    route_health: routeHealth(),
    known_gaps: [
      'scan_event is not yet a live full discovery worker; current external scanner runtime is witness-only.',
      'verify_event final governed commit worker is not exposed through this gateway; only no-drop verifier audit is callable.',
      'hf_event_assist remains nonauthoritative and may be skipped unless HF_EVENT_ASSIST_ENABLED and scanner evidence gates pass.',
      'ChatGPT cross-chat enforcement still requires an installed connector/tool that calls this private gateway.'
    ]
  };
}

module.exports = {
  REGISTRY_VERSION,
  AGENTS,
  ROUTES,
  routeForIntent,
  agentVersions,
  validateInvocation,
  routeHealth,
  publicRegistry
};
