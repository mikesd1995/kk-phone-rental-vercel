'use strict';

const REGISTRY_VERSION = 'KK_AGENT_REGISTRY_V9';

const AGENTS = Object.freeze({
  'kk-discovery-scanner': Object.freeze({
    version: 'KK_FULL_DISCOVERY_WORKER_V2',
    authority: 'STAGING_ONLY',
    runtime_state: 'CALLABLE_PROVIDER_GATED',
    surface: 'AGENT_GATEWAY_AND_SCANNER_CONTROL_PLANE',
    production_writes: 0,
    note: 'Full worker core normalizes/deduplicates validated provider results and prepares READY_FOR_VERIFIER. ULTRA_DEEP runs now fail closed unless Official, Ticketing, Venue, Artist/Agency, Brand/Sponsor, Social, Competitor and Public Calendar source classes are covered. Recurring public-web provider execution remains gated until an approved provider executor is bound to the existing runner.'
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
  'kk-marketing-agent': Object.freeze({
    version: 'KK_MARKETING_AGENT_V1',
    authority: 'READ_ONLY_ADVISOR',
    runtime_state: 'LIVE_GATEWAY_MANDATORY_FOR_CONTENT',
    surface: 'AGENT_GATEWAY',
    production_writes: 0,
    note: 'Chooses objective, campaign mode, timing/priority context and opportunity score before Content Strategy. Cannot write final copy, publish, spend, or mutate price/inventory/Machine SOT.'
  }),
  'kk-content-selector': Object.freeze({
    version: 'KK_CONTENT_SELECTOR_V1',
    authority: 'READ_ONLY_SELECTOR',
    runtime_state: 'LIVE_GATEWAY_MANDATORY_FOR_DIRECT_RENTAL',
    surface: 'AGENT_GATEWAY',
    production_writes: 0,
    note: 'Ranks three internal QA-passing candidates against the Marketing objective and exposes exactly one final post for Owner Review. Scores are estimates, never reach guarantees.'
  }),
  'kk-content-qa': Object.freeze({
    version: 'KK_CONTENT_QA_GATE_V1',
    authority: 'READ_ONLY_VALIDATOR',
    runtime_state: 'LIVE_GATEWAY_MANDATORY_FOR_CONTENT',
    surface: 'AGENT_GATEWAY',
    production_writes: 0,
    note: 'Fail-closed pre-publish validator for verified hashtags, duplicate date/venue facts, Standard A structure, and commercial truth.'
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
  'kk-operating-partner': Object.freeze({
    version: 'KK_OPERATING_PARTNER_V1',
    authority: 'ADVISORY_DECISION_SUPPORT',
    runtime_state: 'CALLABLE_LEARNING_ADVISOR',
    surface: 'AGENT_GATEWAY',
    production_writes: 0,
    note: 'May score opportunities, prepare owner briefs and record bounded decision-learning events. Cannot publish, price-write, contact customers, merge, deploy, or change Machine SOT.'
  }),
  'kk-creative-production': Object.freeze({
    version: 'KK_CREATIVE_PRODUCTION_V1',
    authority: 'READ_ONLY_CREATIVE_ADVISOR',
    runtime_state: 'CALLABLE_PLAN_AND_QA',
    surface: 'AGENT_GATEWAY',
    production_writes: 0,
    note: 'Locks supplied references, plans image/motion production, and fails closed on identity/reference QA. Cannot publish or mutate business data.'
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
    required_agents: Object.freeze(['kk-marketing-agent', 'kk-content-strategy', 'kk-content-agent', 'kk-content-qa', 'kk-content-selector']),
    downstream_agents: Object.freeze([]),
    runtime_available: true,
    owner_review_required: true,
    persistent_invocation_evidence_required: true
  }),
  content_draft: Object.freeze({
    route_id: 'CHAT_CONTENT_DRAFT',
    request_type: 'CHAT_CONTENT_REQUEST',
    required_agents: Object.freeze(['kk-marketing-agent', 'kk-content-strategy', 'kk-content-agent', 'kk-content-qa']),
    downstream_agents: Object.freeze([]),
    runtime_available: true,
    owner_review_required: true,
    persistent_invocation_evidence_required: true
  }),
  creative_production_plan: Object.freeze({
    route_id: 'CREATIVE_PRODUCTION_PLAN',
    request_type: 'CREATIVE_PRODUCTION_REQUEST',
    required_agents: Object.freeze(['kk-creative-production']),
    downstream_agents: Object.freeze([]),
    runtime_available: true,
    owner_review_required: true,
    persistent_invocation_evidence_required: true
  }),
  creative_media_qa: Object.freeze({
    route_id: 'CREATIVE_MEDIA_QA',
    request_type: 'CREATIVE_QA_REQUEST',
    required_agents: Object.freeze(['kk-creative-production']),
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
  operating_partner_brief: Object.freeze({
    route_id: 'OPERATING_PARTNER_DAILY_BRIEF',
    request_type: 'OPERATING_PARTNER_BRIEF',
    required_agents: Object.freeze(['kk-operating-partner']),
    downstream_agents: Object.freeze([]),
    runtime_available: true,
    owner_review_required: true,
    persistent_invocation_evidence_required: true
  }),
  opportunity_review: Object.freeze({
    route_id: 'OPERATING_PARTNER_OPPORTUNITY_REVIEW',
    request_type: 'OPPORTUNITY_REVIEW',
    required_agents: Object.freeze(['kk-operating-partner']),
    downstream_agents: Object.freeze([]),
    runtime_available: true,
    owner_review_required: true,
    persistent_invocation_evidence_required: true
  }),
  decision_feedback: Object.freeze({
    route_id: 'OPERATING_PARTNER_DECISION_FEEDBACK',
    request_type: 'DECISION_FEEDBACK',
    required_agents: Object.freeze(['kk-operating-partner']),
    downstream_agents: Object.freeze([]),
    runtime_available: true,
    owner_review_required: false,
    persistent_invocation_evidence_required: true
  }),
  scan_event: Object.freeze({
    route_id: 'FULL_EVENT_DISCOVERY',
    request_type: 'EVENT_DISCOVERY',
    required_agents: Object.freeze(['kk-discovery-source-watch', 'kk-discovery-scanner']),
    downstream_agents: Object.freeze(['kk-event-verifier']),
    runtime_available: true,
    provider_executor_required: true,
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
      'scan_event worker core is callable, but recurring autonomous public-web discovery remains provider-gated; the existing external scanner endpoint is still witness-only until provider binding acceptance.',
      'verify_event final governed commit worker is not exposed through this gateway; only no-drop verifier audit is callable.',
      'hf_event_assist remains nonauthoritative and may be skipped unless HF_EVENT_ASSIST_ENABLED and scanner evidence gates pass.',
      'Operating Partner Phase 1 is callable but not yet a scheduled autonomous daily runner; live signal collectors must be wired deliberately before proactive delivery.',
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
