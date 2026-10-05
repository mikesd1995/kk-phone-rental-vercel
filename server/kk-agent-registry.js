'use strict';

const REGISTRY_VERSION = 'KK_AGENT_REGISTRY_V33';

const AGENTS = Object.freeze({
  'kk-discovery-scanner': Object.freeze({
    version: 'KK_FULL_DISCOVERY_WORKER_V5',
    authority: 'STAGING_ONLY',
    runtime_state: 'CALLABLE_PROVIDER_GATED',
    surface: 'AGENT_GATEWAY_AND_SCANNER_CONTROL_PLANE',
    production_writes: 0,
    note: 'Ultra Deep V5 requires source-class proof, explicit source-universe execution, independent reconciliation and known-miss regression evidence before FULL. Runtime execution is read-only/provider-gated and remains production_writes=0 with Verifier mandatory.'
  }),
  'kk-discovery-source-watch': Object.freeze({
    version: 'discovery-source-watch-v1',
    authority: 'ADVISORY',
    runtime_state: 'CALLABLE',
    surface: 'AGENT_GATEWAY',
    production_writes: 0
  }),
  'kk-commercial-evidence': Object.freeze({
    version: 'KK_DISCOVERY_COMMERCIAL_PREP_V4',
    authority: 'STAGING_ONLY',
    runtime_state: 'CALLABLE_EVIDENCE_GATED',
    surface: 'AGENT_GATEWAY',
    production_writes: 0,
    note: 'Phase-3 pricing scope is read-only and separate from Phase-4 poster evidence. It uses exact-event competitor median when available, then comparable event, prior-month comparable, and governed 690/890 base fallback with bounded demand/seat-map adjustment. Full-commercial mode still requires verified poster evidence before promotion.'
  }),
  'kk-event-verifier': Object.freeze({
    version: 'verifier-no-drop-reconciliation-v2-learning-feedback',
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
    version: 'KK_MARKETING_AGENT_V2_X_SIGNAL',
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
  'kk-storefront-art-director': Object.freeze({
    version: 'KK_STOREFRONT_ART_DIRECTOR_V3',
    authority: 'READ_ONLY_ART_DIRECTION',
    runtime_state: 'CALLABLE_DIRECTION_AND_ACCEPTANCE',
    surface: 'AGENT_GATEWAY',
    production_writes: 0,
    note: 'Pre-implementation visual authority for Storefront V2. Produces deterministic design direction and fails closed on acceptance without independent multi-viewport visual QA. Cannot mutate business truth, merge, deploy or publish.'
  }),
  'kk-storefront-ux-reviewer': Object.freeze({
    version: 'KK_STOREFRONT_UX_REVIEWER_V1', authority: 'READ_ONLY_DESIGN_ADVISOR', runtime_state: 'CALLABLE_REVIEW_AND_VISUAL_QA', surface: 'AGENT_GATEWAY', production_writes: 0,
    note: 'Mandatory read-only Product/UX/UI review gate for storefront and Admin/product-flow interface work. Reviews supplied viewport/layout metrics and screenshot observations. P0/P1 findings block affected-surface acceptance. Cannot mutate business truth, merge, deploy, or publish.'
  }),
  'kk-storefront-conversion-reviewer': Object.freeze({version:'KK_STOREFRONT_CONVERSION_REVIEWER_V1',authority:'READ_ONLY_DESIGN_REVIEW',runtime_state:'CALLABLE_COUNCIL',surface:'AGENT_GATEWAY',production_writes:0}),
  'kk-storefront-fandom-reviewer': Object.freeze({version:'KK_STOREFRONT_FANDOM_REVIEWER_V1',authority:'READ_ONLY_DESIGN_REVIEW',runtime_state:'CALLABLE_COUNCIL',surface:'AGENT_GATEWAY',production_writes:0}),
  'kk-storefront-accessibility-reviewer': Object.freeze({version:'KK_STOREFRONT_ACCESSIBILITY_REVIEWER_V1',authority:'READ_ONLY_DESIGN_REVIEW',runtime_state:'CALLABLE_COUNCIL',surface:'AGENT_GATEWAY',production_writes:0}),
  'kk-storefront-performance-reviewer': Object.freeze({version:'KK_STOREFRONT_PERFORMANCE_REVIEWER_V1',authority:'READ_ONLY_DESIGN_REVIEW',runtime_state:'CALLABLE_COUNCIL',surface:'AGENT_GATEWAY',production_writes:0}),
  'kk-storefront-visual-critic': Object.freeze({version:'KK_STOREFRONT_VISUAL_CRITIC_V2',authority:'READ_ONLY_ADVERSARIAL_REVIEW',runtime_state:'CALLABLE_COUNCIL',surface:'AGENT_GATEWAY',production_writes:0}),
  'kk-openai-storefront-reviewer': Object.freeze({
    version:'KK_OPENAI_AGENT_ADAPTERS_V1',
    authority:'READ_ONLY_MODEL_REVIEW',
    runtime_state:'OPTIONAL_PAID_ZERO_COST_DEFAULT_OFF',
    surface:'AGENT_GATEWAY',
    production_writes:0,
    note:'Optional paid multimodal reviewer. Zero-cost deterministic council is canonical; paid calls require KK_ALLOW_PAID_EXTERNAL_AI=true in addition to the OpenAI enable flag. Cannot merge, deploy, publish, or mutate business truth.'
  }),
  'kk-openai-discovery-reasoner': Object.freeze({
    version:'KK_OPENAI_AGENT_ADAPTERS_V1',
    authority:'NONAUTHORITATIVE_ADVISORY',
    runtime_state:'OPTIONAL_PAID_ZERO_COST_DEFAULT_OFF',
    surface:'AGENT_GATEWAY',
    production_writes:0,
    note:'Optional paid reasoning assist only. Zero-cost deterministic gap planning remains canonical; paid calls require KK_ALLOW_PAID_EXTERNAL_AI=true. Deterministic dedup and governed Verifier remain authoritative.'
  }),
  'kk-openai-inbox-drafter': Object.freeze({
    version:'KK_OPENAI_AGENT_ADAPTERS_V1',
    authority:'DRAFT_ONLY',
    runtime_state:'OPTIONAL_PAID_ZERO_COST_AND_CUSTOMER_DATA_GATED',
    surface:'AGENT_GATEWAY',
    production_writes:0,
    note:'Optional paid extraction/drafting only; zero-cost local owner-review template remains available. Paid calls require KK_ALLOW_PAID_EXTERNAL_AI=true and customer data additionally requires its separate explicit gate. No auto-send, booking write, pricing write, inventory write, or identity merge.'
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
  x_posting_plan: Object.freeze({
    route_id: 'CHAT_X_POSTING_PLAN',
    request_type: 'X_POSTING_PLAN_REQUEST',
    required_agents: Object.freeze(['kk-marketing-agent']),
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
  storefront_design_council: Object.freeze({ route_id:'STOREFRONT_DESIGN_COUNCIL', request_type:'STOREFRONT_DESIGN_COUNCIL', required_agents:Object.freeze(['kk-storefront-art-director','kk-storefront-ux-reviewer','kk-storefront-conversion-reviewer','kk-storefront-fandom-reviewer','kk-storefront-accessibility-reviewer','kk-storefront-performance-reviewer','kk-storefront-visual-critic']), downstream_agents:Object.freeze([]), runtime_available:true, owner_review_required:true, persistent_invocation_evidence_required:true }),
  storefront_design_council_acceptance: Object.freeze({ route_id:'STOREFRONT_DESIGN_COUNCIL_ACCEPTANCE', request_type:'STOREFRONT_DESIGN_COUNCIL_ACCEPTANCE', required_agents:Object.freeze(['kk-storefront-art-director','kk-storefront-ux-reviewer','kk-storefront-conversion-reviewer','kk-storefront-fandom-reviewer','kk-storefront-accessibility-reviewer','kk-storefront-performance-reviewer','kk-storefront-visual-critic']), downstream_agents:Object.freeze([]), runtime_available:true, owner_review_required:true, persistent_invocation_evidence_required:true }),
  storefront_art_direction: Object.freeze({ route_id:'STOREFRONT_ART_DIRECTION', request_type:'STOREFRONT_ART_DIRECTION', required_agents:Object.freeze(['kk-storefront-art-director']), downstream_agents:Object.freeze(['kk-storefront-ux-reviewer']), runtime_available:true, owner_review_required:true, persistent_invocation_evidence_required:true }),
  storefront_art_acceptance: Object.freeze({ route_id:'STOREFRONT_ART_ACCEPTANCE', request_type:'STOREFRONT_ART_ACCEPTANCE', required_agents:Object.freeze(['kk-storefront-art-director']), downstream_agents:Object.freeze(['kk-storefront-ux-reviewer']), runtime_available:true, owner_review_required:true, persistent_invocation_evidence_required:true }),
  storefront_ux_review: Object.freeze({ route_id:'STOREFRONT_UX_REVIEW', request_type:'STOREFRONT_UX_REVIEW', required_agents:Object.freeze(['kk-storefront-ux-reviewer']), downstream_agents:Object.freeze([]), runtime_available:true, owner_review_required:true, persistent_invocation_evidence_required:true }),
  admin_unified_inbox_review: Object.freeze({ route_id:'ADMIN_UNIFIED_INBOX_REVIEW', request_type:'ADMIN_UNIFIED_INBOX_REVIEW', required_agents:Object.freeze(['kk-reliability-learning','kk-storefront-ux-reviewer']), downstream_agents:Object.freeze([]), runtime_available:true, owner_review_required:true, persistent_invocation_evidence_required:true }),
  storefront_visual_qa: Object.freeze({ route_id:'STOREFRONT_VISUAL_QA', request_type:'STOREFRONT_VISUAL_QA', required_agents:Object.freeze(['kk-storefront-ux-reviewer']), downstream_agents:Object.freeze([]), runtime_available:true, owner_review_required:true, persistent_invocation_evidence_required:true }),
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
    required_agents: Object.freeze(['kk-event-verifier','kk-reliability-learning']),
    downstream_agents: Object.freeze([]),
    runtime_available: true,
    owner_review_required: false,
    persistent_invocation_evidence_required: true
  }),
  phase3_commercial_pricing: Object.freeze({
    route_id: 'ULTRA_DEEP_PHASE3_COMMERCIAL_PRICING',
    request_type: 'ULTRA_DEEP_PHASE3_PRICING',
    required_agents: Object.freeze(['kk-commercial-evidence','kk-reliability-learning']),
    downstream_agents: Object.freeze([]),
    runtime_available: true,
    owner_review_required: false,
    persistent_invocation_evidence_required: true,
    note: 'Official execution requires PHASE2_ACCEPTED + ready_for_phase3. diagnostic_only may exercise pricing logic without crossing the phase boundary. Always production_writes=0 and never starts Phase 4.'
  }),
  phase2_verification_learning: Object.freeze({
    route_id: 'ULTRA_DEEP_PHASE2_VERIFICATION_LEARNING',
    request_type: 'ULTRA_DEEP_PHASE2_VERIFICATION',
    required_agents: Object.freeze(['kk-event-verifier','kk-reliability-learning']),
    downstream_agents: Object.freeze([]),
    runtime_available: true,
    owner_review_required: false,
    persistent_invocation_evidence_required: true,
    note: 'Executes the autonomous Phase-2 verifier + Learning recovery runtime when given a frozen Phase-1 artifact; controller-only evaluation remains supported for already-materialized results. Always read-only and never starts Phase 3.'
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
  execute_monthly_ultra_deep: Object.freeze({
    route_id: 'ULTRA_DEEP_MONTHLY_RUNTIME_EXECUTION',
    request_type: 'EVENT_DISCOVERY_MONTHLY_EXECUTION',
    required_agents: Object.freeze(['kk-discovery-source-watch', 'kk-discovery-scanner']),
    downstream_agents: Object.freeze(['kk-commercial-evidence', 'kk-event-verifier']),
    runtime_available: true,
    provider_executor_required: true,
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
  execute_ultra_deep_full_loop: Object.freeze({
    route_id: 'ULTRA_DEEP_FULL_LOOP_EXECUTION',
    request_type: 'ULTRA_DEEP_FULL_LOOP_EXECUTION',
    required_agents: Object.freeze(['kk-discovery-source-watch','kk-discovery-scanner','kk-commercial-evidence','kk-event-verifier','kk-reliability-learning']),
    downstream_agents: Object.freeze([]),
    runtime_available: true,
    owner_review_required: false,
    persistent_invocation_evidence_required: true
  }),
  evaluate_ultra_deep_owner_policy: Object.freeze({
    route_id: 'ULTRA_DEEP_OWNER_POLICY',
    request_type: 'ULTRA_DEEP_OWNER_POLICY_EVALUATION',
    required_agents: Object.freeze(['kk-discovery-scanner','kk-commercial-evidence','kk-event-verifier']),
    downstream_agents: Object.freeze([]),
    runtime_available: true,
    owner_review_required: false,
    persistent_invocation_evidence_required: true
  }),
  learn_ultra_deep_miss: Object.freeze({
    route_id: 'ULTRA_DEEP_KNOWN_MISS_LEARNING',
    request_type: 'ULTRA_DEEP_VERIFIED_MISS_LEARNING',
    required_agents: Object.freeze(['kk-discovery-scanner','kk-reliability-learning']),
    downstream_agents: Object.freeze([]),
    runtime_available: true,
    owner_review_required: true,
    persistent_invocation_evidence_required: true
  }),
  accept_ultra_deep_learning: Object.freeze({
    route_id: 'ULTRA_DEEP_LEARNING_ACCEPTANCE',
    request_type: 'ULTRA_DEEP_LEARNING_ACCEPTANCE',
    required_agents: Object.freeze(['kk-discovery-scanner','kk-reliability-learning']),
    downstream_agents: Object.freeze([]),
    runtime_available: true,
    owner_review_required: false,
    persistent_invocation_evidence_required: true
  }),
  accept_ultra_deep_full_loop: Object.freeze({
    route_id: 'ULTRA_DEEP_FULL_LOOP_COMPLETION_ACCEPTANCE',
    request_type: 'EVENT_DISCOVERY_TO_PRODUCTION_ACCEPTANCE',
    required_agents: Object.freeze(['kk-discovery-scanner', 'kk-commercial-evidence', 'kk-event-verifier', 'kk-reliability-learning']),
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
  storefront_ai_review: Object.freeze({
    route_id:'OPENAI_STOREFRONT_VISUAL_REVIEW',
    request_type:'OPENAI_STOREFRONT_REVIEW',
    required_agents:Object.freeze(['kk-storefront-art-director','kk-storefront-ux-reviewer','kk-storefront-conversion-reviewer','kk-storefront-fandom-reviewer','kk-storefront-accessibility-reviewer','kk-storefront-performance-reviewer','kk-storefront-visual-critic','kk-openai-storefront-reviewer']),
    downstream_agents:Object.freeze([]),
    runtime_available:true,
    owner_review_required:true,
    persistent_invocation_evidence_required:true
  }),
  ultra_deep_ai_reasoning: Object.freeze({
    route_id:'OPENAI_ULTRA_DEEP_REASONING_ASSIST',
    request_type:'OPENAI_DISCOVERY_REASONING',
    required_agents:Object.freeze(['kk-discovery-source-watch','kk-discovery-scanner','kk-openai-discovery-reasoner']),
    downstream_agents:Object.freeze(['kk-event-verifier']),
    runtime_available:true,
    owner_review_required:false,
    persistent_invocation_evidence_required:true
  }),
  unified_inbox_ai_draft: Object.freeze({
    route_id:'OPENAI_UNIFIED_INBOX_DRAFT',
    request_type:'OPENAI_INBOX_DRAFT',
    required_agents:Object.freeze(['kk-openai-inbox-drafter']),
    downstream_agents:Object.freeze([]),
    runtime_available:true,
    owner_review_required:true,
    persistent_invocation_evidence_required:true
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

function runtimeProofAudit() {
  const routeBackedAgents = new Set();
  for (const route of Object.values(ROUTES)) {
    for (const id of route.required_agents || []) routeBackedAgents.add(id);
  }
  const rows = Object.entries(AGENTS).map(([agent_id, spec]) => {
    const routes = Object.entries(ROUTES)
      .filter(([, route]) => (route.required_agents || []).includes(agent_id))
      .map(([intent, route]) => ({intent, runtime_available: route.runtime_available, persistent_invocation_evidence_required: route.persistent_invocation_evidence_required === true}));
    const callableRoute = routes.some(route => route.runtime_available === true);
    const evidenceRequired = routes.length > 0 && routes.every(route => route.persistent_invocation_evidence_required === true);
    const pass = callableRoute && evidenceRequired;
    return {
      agent_id,
      declared_runtime_state: spec.runtime_state,
      routes,
      callable_route: callableRoute,
      persistent_evidence_required: evidenceRequired,
      status: pass ? 'RUNTIME_PROOF_REQUIRED' : 'NOT_PROVEN_RUNTIME_READY'
    };
  });
  return {
    registry_version: REGISTRY_VERSION,
    pass: rows.every(row => row.status === 'RUNTIME_PROOF_REQUIRED'),
    agents: rows,
    unproven_agents: rows.filter(row => row.status !== 'RUNTIME_PROOF_REQUIRED').map(row => row.agent_id)
  };
}

function publicRegistry() {
  return {
    registry_version: REGISTRY_VERSION,
    agents: AGENTS,
    routes: ROUTES,
    route_health: routeHealth(),
    runtime_proof_audit: runtimeProofAudit(),
    known_gaps: [
      'Ultra Deep monthly runtime execution is callable read-only through the Agent Gateway, but discovery FULL is not end-to-end completion. Ultra Deep COMPLETE additionally requires commercial pricing or fallback, verified poster, storefront comparison, governed publish when required, production readback and final-report evidence through accept_ultra_deep_full_loop.',
      'Legacy verify_event remains disabled; governed storefront create is exposed only through execute_storefront_promotion after READY_FOR_GOVERNED_ADMIN_CREATE.',
      'hf_event_assist remains nonauthoritative and may be skipped unless HF_EVENT_ASSIST_ENABLED and scanner evidence gates pass.',
      'Operating Partner Phase 1 is callable but not yet a scheduled autonomous daily runner; live signal collectors must be wired deliberately before proactive delivery.',
      'Storefront UX Reviewer consumes supplied viewport/layout metrics and screenshot observations; browser visual evidence remains required for final visual acceptance.',
      'All post-generation routes that enter this gateway now require Marketing → Strategy → Content → QA → Selector and a single-winner contract. X posting-plan requests are auto-detected as x_posting_plan inside the gateway and invoke the Marketing Agent with persistent evidence. External chat surfaces still must call this private gateway rather than bypass it.'
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
  publicRegistry,
  runtimeProofAudit
};
