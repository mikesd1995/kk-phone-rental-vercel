'use strict';

const ModelMigration = require('./kk-model-migration-policy.js');

const REGISTRY_VERSION = 'KK_AGENT_REGISTRY_V19';

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
  'kk-commercial-evidence': Object.freeze({
    version: 'KK_DISCOVERY_COMMERCIAL_PREP_V1',
    authority: 'STAGING_ONLY',
    runtime_state: 'CALLABLE_EVIDENCE_GATED',
    surface: 'AGENT_GATEWAY',
    production_writes: 0,
    note: 'Requires at least three independent exact-event competitor price sources and a verified HTTPS poster source before a candidate can advance to final Verifier.'
  }),
  'kk-event-verifier': Object.freeze({
    version: 'verifier-no-drop-reconciliation-v1',
    authority: 'GOVERNED_VERIFICATION_SUPPORT',
    runtime_state: 'CALLABLE_GOVERNED_PROMOTION',
    surface: 'AGENT_GATEWAY',
    production_writes: 0,
    note: 'No-drop reconciliation and governed storefront promotion are callable. Promotion can only execute an approved READY_FOR_GOVERNED_ADMIN_CREATE plan through the existing authenticated Admin createEvent guard.'
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
    version: 'KK_CONTENT_SELECTOR_V2',
    authority: 'READ_ONLY_SELECTOR',
    runtime_state: 'LIVE_GATEWAY_MANDATORY_FOR_ALL_SOCIAL_POSTS',
    surface: 'AGENT_GATEWAY',
    production_writes: 0,
    note: 'Ranks exactly three internal QA-passing candidates for every KK social-post request using objective fit plus event specificity, naturalness, non-template feel, hook originality and sales-pressure balance. Exposes exactly one final post for Owner Review. Scores are estimates, never reach guarantees.'
  }),
  'kk-content-qa': Object.freeze({
    version: 'KK_CONTENT_QA_GATE_V3',
    authority: 'READ_ONLY_VALIDATOR',
    runtime_state: 'LIVE_GATEWAY_MANDATORY_FOR_CONTENT',
    surface: 'AGENT_GATEWAY',
    production_writes: 0,
    note: 'Fail-closed pre-publish validator for verified facts/hashtags, live commercial truth, brand/CTA presence, canonical facts and anti-repeat. Creative paragraph order is flexible; one rigid template is not enforced.'
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
  'kk-gpt6-shadow-evaluator': Object.freeze({
    version: 'KK_GPT6_SHADOW_RUNTIME_V1',
    authority: 'SHADOW_READ_ONLY_ADVISORY',
    runtime_state: 'CALLABLE_CREDENTIAL_GATED',
    surface: 'AGENT_GATEWAY_SHADOW_ONLY',
    production_writes: 0,
    note: 'Calls GPT-6 Sol through the Responses API only on explicit Scanner/Verifier shadow routes. No tools, no business writes, no publishes, no notifications, and no authority to override Machine SOT or visibility tombstones.'
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
    route_id: 'CHAT_CONTENT_DRAFT_ALL_POST_PIPELINE',
    request_type: 'CHAT_CONTENT_REQUEST',
    required_agents: Object.freeze(['kk-marketing-agent', 'kk-content-strategy', 'kk-content-agent', 'kk-content-qa', 'kk-content-selector']),
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
  engineering_reliability_guard: Object.freeze({
    route_id: 'ENGINEERING_RELIABILITY_GUARD',
    request_type: 'ENGINEERING_RELIABILITY_GUARD',
    required_agents: Object.freeze(['kk-reliability-learning']),
    downstream_agents: Object.freeze([]),
    runtime_available: true,
    owner_review_required: false,
    persistent_invocation_evidence_required: true
  }),
  evaluate_reliability_repair: Object.freeze({
    route_id: 'ENGINEERING_RELIABILITY_REPAIR_ACCEPTANCE',
    request_type: 'ENGINEERING_RELIABILITY_REPAIR_ACCEPTANCE',
    required_agents: Object.freeze(['kk-reliability-learning']),
    downstream_agents: Object.freeze([]),
    runtime_available: true,
    owner_review_required: true,
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
  plan_monthly_deep_scan: Object.freeze({
    route_id: 'ULTRA_DEEP_MONTHLY_QUERY_PLAN',
    request_type: 'EVENT_DISCOVERY_MONTHLY_PLAN',
    required_agents: Object.freeze(['kk-discovery-source-watch', 'kk-discovery-scanner']),
    downstream_agents: Object.freeze(['hf-event-assist', 'kk-commercial-evidence', 'kk-event-verifier']),
    runtime_available: true,
    owner_review_required: false,
    persistent_invocation_evidence_required: true
  }),
  plan_ultra_deep_scan: Object.freeze({
    route_id: 'ULTRA_DEEP_V3_GAP_PLAN',
    request_type: 'EVENT_DISCOVERY_PLAN',
    required_agents: Object.freeze(['kk-discovery-source-watch', 'kk-discovery-scanner']),
    downstream_agents: Object.freeze(['hf-event-assist', 'kk-commercial-evidence', 'kk-event-verifier']),
    runtime_available: true,
    owner_review_required: false,
    persistent_invocation_evidence_required: true
  }),
  execute_ultra_deep_gaps: Object.freeze({
    route_id: 'ULTRA_DEEP_V3_PROVIDER_EXECUTION',
    request_type: 'EVENT_DISCOVERY_PROVIDER_EXECUTION',
    required_agents: Object.freeze(['kk-discovery-source-watch', 'kk-discovery-scanner']),
    downstream_agents: Object.freeze(['hf-event-assist', 'kk-commercial-evidence', 'kk-event-verifier']),
    runtime_available: true,
    provider_executor_required: true,
    owner_review_required: false,
    persistent_invocation_evidence_required: true
  }),
  accept_ultra_deep_scan: Object.freeze({
    route_id: 'ULTRA_DEEP_V3_ACCEPTANCE',
    request_type: 'EVENT_DISCOVERY_ACCEPTANCE',
    required_agents: Object.freeze(['kk-discovery-source-watch', 'kk-discovery-scanner']),
    downstream_agents: Object.freeze(['kk-commercial-evidence', 'kk-event-verifier']),
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
  prepare_event_commercial: Object.freeze({
    route_id: 'EVENT_COMMERCIAL_EVIDENCE_PREP',
    request_type: 'EVENT_COMMERCIAL_PREP',
    required_agents: Object.freeze(['kk-commercial-evidence']),
    downstream_agents: Object.freeze(['kk-event-verifier']),
    runtime_available: true,
    owner_review_required: false,
    persistent_invocation_evidence_required: true
  }),
  prepare_storefront_promotion: Object.freeze({
    route_id: 'VERIFIER_STOREFRONT_PROMOTION_PREP',
    request_type: 'EVENT_PROMOTION_PREP',
    required_agents: Object.freeze(['kk-event-verifier']),
    downstream_agents: Object.freeze([]),
    runtime_available: true,
    owner_review_required: false,
    persistent_invocation_evidence_required: true
  }),
  execute_storefront_promotion: Object.freeze({
    route_id: 'VERIFIER_GOVERNED_STOREFRONT_EXECUTION',
    request_type: 'EVENT_PROMOTION_EXECUTION',
    required_agents: Object.freeze(['kk-event-verifier']),
    downstream_agents: Object.freeze([]),
    runtime_available: true,
    owner_review_required: false,
    persistent_invocation_evidence_required: true
  }),
  verify_storefront_readback: Object.freeze({
    route_id: 'VERIFIER_STOREFRONT_READBACK',
    request_type: 'EVENT_PROMOTION_READBACK',
    required_agents: Object.freeze(['kk-event-verifier']),
    downstream_agents: Object.freeze([]),
    runtime_available: true,
    owner_review_required: false,
    persistent_invocation_evidence_required: true
  }),
  scanner_gpt6_shadow: Object.freeze({
    route_id: 'SCANNER_GPT6_SOL_SHADOW',
    request_type: 'SCANNER_MODEL_SHADOW',
    required_agents: Object.freeze(['kk-discovery-scanner', 'kk-gpt6-shadow-evaluator']),
    downstream_agents: Object.freeze(['kk-event-verifier']),
    runtime_available: true,
    owner_review_required: false,
    persistent_invocation_evidence_required: true
  }),
  verifier_gpt6_shadow: Object.freeze({
    route_id: 'VERIFIER_GPT6_SOL_SHADOW',
    request_type: 'VERIFIER_MODEL_SHADOW',
    required_agents: Object.freeze(['kk-event-verifier', 'kk-gpt6-shadow-evaluator']),
    downstream_agents: Object.freeze([]),
    runtime_available: true,
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
    model_migration: ModelMigration.publicPolicy(),
    agents: AGENTS,
    routes: ROUTES,
    route_health: routeHealth(),
    known_gaps: [
      'Ultra Deep provider execution is callable through the Agent Gateway, but each real provider remains explicitly binding-gated; recurring autonomous public-web discovery is not accepted until provider binding/runtime acceptance passes.',
      'Legacy verify_event remains disabled; governed storefront create is exposed only through execute_storefront_promotion after READY_FOR_GOVERNED_ADMIN_CREATE.',
      'hf_event_assist remains nonauthoritative and may be skipped unless HF_EVENT_ASSIST_ENABLED and scanner evidence gates pass.',
      'Operating Partner Phase 1 is callable but not yet a scheduled autonomous daily runner; live signal collectors must be wired deliberately before proactive delivery.',
      'All post-generation routes that enter this gateway now require Marketing → Strategy → Content → QA → Selector and a single-winner contract. ChatGPT cross-chat enforcement still requires the chat surface to call this private gateway rather than bypass it.'
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
