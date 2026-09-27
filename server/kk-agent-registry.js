'use strict';

const REGISTRY_VERSION = 'KK_AGENT_REGISTRY_V1';

const AGENTS = Object.freeze({
  'kk-discovery-scanner': Object.freeze({
    version: '2026-09-27',
    authority: 'STAGING_ONLY',
    surface: 'RUNTIME_PIPELINE',
    production_writes: 0
  }),
  'kk-discovery-source-watch': Object.freeze({
    version: '2026-09-27',
    authority: 'ADVISORY',
    surface: 'RUNTIME_PIPELINE',
    production_writes: 0
  }),
  'kk-event-verifier': Object.freeze({
    version: '2026-09-27',
    authority: 'GOVERNED_VERIFICATION',
    surface: 'RUNTIME_PIPELINE',
    production_writes: 0
  }),
  'kk-canary-safety': Object.freeze({
    version: '2026-09-27',
    authority: 'ZERO_WRITE_ACCEPTANCE',
    surface: 'RUNTIME_PIPELINE',
    production_writes: 0
  }),
  'kk-content-strategy': Object.freeze({
    version: '2026-09-27',
    authority: 'READ_ONLY_ADVISOR',
    surface: 'CHAT_REQUEST',
    production_writes: 0
  }),
  'kk-content-agent': Object.freeze({
    version: 'KK_CONTENT_AGENT_PLAN_V2',
    authority: 'READ_ONLY_ADVISOR',
    surface: 'CHAT_REQUEST',
    production_writes: 0
  }),
  'kk-reliability-learning': Object.freeze({
    version: '2026-09-25',
    authority: 'READ_ONLY_ADVISOR',
    surface: 'AUDIT_PIPELINE',
    production_writes: 0
  }),
  'hf-event-assist': Object.freeze({
    version: 'scanner-hf-advisory-v1',
    authority: 'NONAUTHORITATIVE_ADVISORY',
    surface: 'CONTROLLED_UAT',
    production_writes: 0
  })
});

const ROUTES = Object.freeze({
  direct_rental_x: Object.freeze({
    route_id: 'CHAT_CONTENT_DIRECT_RENTAL_X',
    required_agents: Object.freeze(['kk-content-strategy', 'kk-content-agent']),
    owner_review_required: true,
    persistent_invocation_evidence_required: true
  }),
  content_draft: Object.freeze({
    route_id: 'CHAT_CONTENT_DRAFT',
    required_agents: Object.freeze(['kk-content-strategy', 'kk-content-agent']),
    owner_review_required: true,
    persistent_invocation_evidence_required: true
  })
});

function normalizeIntent(value) {
  return String(value || '').trim().toLowerCase();
}

function routeForIntent(intent) {
  const key = normalizeIntent(intent);
  return ROUTES[key] || null;
}

function agentVersions(agentIds = []) {
  const out = {};
  for (const id of agentIds) {
    if (AGENTS[id]) out[id] = AGENTS[id].version;
  }
  return out;
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

  const invoked = [...new Set(
    (Array.isArray(invokedAgents) ? invokedAgents : [])
      .map(value => String(value || '').trim())
      .filter(Boolean)
  )];
  const missing = route.required_agents.filter(id => !invoked.includes(id));

  return {
    registry_version: REGISTRY_VERSION,
    applicable: true,
    pass: missing.length === 0,
    route_id: route.route_id,
    required_agents: [...route.required_agents],
    invoked_agents: invoked,
    missing_agents: missing,
    owner_review_required: route.owner_review_required,
    persistent_invocation_evidence_required: route.persistent_invocation_evidence_required,
    agent_versions: agentVersions(route.required_agents)
  };
}

function publicRegistry() {
  return {
    registry_version: REGISTRY_VERSION,
    agents: AGENTS,
    routes: ROUTES
  };
}

module.exports = {
  REGISTRY_VERSION,
  AGENTS,
  ROUTES,
  routeForIntent,
  agentVersions,
  validateInvocation,
  publicRegistry
};
