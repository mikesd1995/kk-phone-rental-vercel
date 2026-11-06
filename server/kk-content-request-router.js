'use strict';

const { buildCreativePlan, buildGenerationPrompt } = require('./kk-content-agent.js');
const MarketingAgent = require('./kk-marketing-agent.js');
const ContentQa = require('./kk-content-qa-gate.js');
const ContentSelector = require('./kk-content-selector.js');
const OwnerXCopy = require('./kk-x-owner-copy-policy.js');

const DIRECT_RENTAL_PATTERNS = Object.freeze([
  /ขอ(?:โพส|โพสต์).*ปล่อยเช่า/i,
  /(?:โพส|โพสต์).*ปล่อยเช่า/i,
  /(?:ปล่อยเช่า|เช่ามือถือ).*(?:บน\s*)?(?:x|twitter)/i,
  /(?:x|twitter).*(?:ปล่อยเช่า|เช่ามือถือ)/i,
  /rental.*(?:post|copy).*(?:x|twitter)/i
]);

const CONTENT_DRAFT_PATTERNS = Object.freeze([
  /(?:คิด|เขียน|ทำ|ช่วยทำ|ช่วยเขียน|ปรับ|รีไรท์|รีเฟรช).*(?:คอนเทนต์|content|แคปชัน|caption|hook|โพส|โพสต์)/i,
  /(?:ขอ|ทำ|เขียน|ช่วยทำ|ช่วยเขียน).*(?:โพส|โพสต์)/i,
  /(?:โพส|โพสต์).*(?:รวมงาน|รายสัปดาห์|อาทิตย์|สัปดาห์|last\s*call|ถึงหน้างาน|หน้างาน|ประกาศ|โปร|โปรโมชั่น|รีโพสต์|รีเฟรช|แบรนด์|awareness)/i,
  /(?:weekly|roundup|last\s*call|onsite|event\s*announcement|promo|promotion|repost|refresh|brand|awareness).*(?:post|copy|caption)/i,
  /(?:quote\s*post|โพสโควต|โพสต์โควต)/i,
  /(?:โพส|โพสต์).*(?:บน\s*)?(?:x|twitter)/i
]);

function normalizeMessage(message) {
  return String(message || '').replace(/\s+/g, ' ').trim();
}

function matchesAny(message, patterns) {
  return patterns.some(pattern => pattern.test(message));
}

function effectiveInventoryInput(input = {}) {
  const next = {...input};
  const hasRemaining = Object.prototype.hasOwnProperty.call(next, 'inventory_remaining') ||
    Object.prototype.hasOwnProperty.call(next, 'phone_inventory_remaining');
  const rawRemaining = Object.prototype.hasOwnProperty.call(next, 'inventory_remaining')
    ? next.inventory_remaining
    : next.phone_inventory_remaining;
  const remaining = Number(rawRemaining);
  const lensRemaining = Number(next.lens_remaining);

  if (hasRemaining && Number.isFinite(remaining) && remaining <= 0) {
    const lensOnly = next.lens_only_offer === true && Number.isFinite(lensRemaining) && lensRemaining > 0;
    next.inventory_available = false;
    if (lensOnly) next.lens_only_available = true;
  }
  return next;
}

function commercialTruthRequired(intent, input = {}) {
  if (intent === 'direct_rental_x') return true;
  if (input.commercial_truth_required === true) return true;
  if (input.commercial_truth_required === false) return false;
  if (String(input.sales_intent || '').toLowerCase() === 'direct') return true;
  return input.verified_pricing !== undefined ||
    input.inventory_available !== undefined ||
    Boolean(String(input.price_display || '').trim());
}

function detectContentIntent(message = '') {
  const normalized = normalizeMessage(message);
  if (!normalized) return 'non_content';
  if (matchesAny(normalized, DIRECT_RENTAL_PATTERNS)) return 'direct_rental_x';
  if (matchesAny(normalized, CONTENT_DRAFT_PATTERNS)) return 'content_draft';
  return 'non_content';
}

function routeContentRequest({
  message = '',
  input = {},
  performanceRows = []
} = {}) {
  const intent = detectContentIntent(message);

  if (intent === 'non_content') {
    return {
      schema_version: 'KK_CONTENT_REQUEST_ROUTE_V1',
      matched: false,
      route: 'NO_CONTENT_AGENT',
      intent,
      content_gate: 'NOT_APPLICABLE',
      production_writes: 0,
      publishes: 0
    };
  }

  const effectiveInput = effectiveInventoryInput(input);

  const marketingPlan = MarketingAgent.plan({
    ...effectiveInput,
    requested_channel: 'x',
    requested_intent: intent
  }, performanceRows);

  const plan = buildCreativePlan({
    ...effectiveInput,
    primary_objective: marketingPlan.objective,
    marketing_campaign_mode: marketingPlan.campaign_mode,
    marketing_opportunity_score: marketingPlan.opportunity.score,
    marketing_priority_context: marketingPlan.opportunity.reasons,
    requested_channel: 'x',
    requested_intent: intent
  }, performanceRows);

  const directRental = intent === 'direct_rental_x';
  const requiresCommercialTruth = commercialTruthRequired(intent, effectiveInput);
  const contentGate = requiresCommercialTruth && !plan.readiness.commercial_ready ? 'BLOCKED' : 'PASS';

  return {
    schema_version: 'KK_CONTENT_REQUEST_ROUTE_V1',
    matched: true,
    route: 'KK_MARKETING_TO_CONTENT_SINGLE_WINNER',
    marketing_required: true,
    marketing_plan: marketingPlan,
    intent,
    content_gate: contentGate,
    strategy_required: true,
    content_agent_required: true,
    qa_required: true,
    qa_gate_version: ContentQa.VERSION,
    selector_required: true,
    selector_version: ContentSelector.VERSION,
    commercial_truth_required: requiresCommercialTruth,
    owner_x_policy_required: requiresCommercialTruth,
    owner_x_policy_version: OwnerXCopy.VERSION,
    qa_requirements: requiresCommercialTruth
      ? ['VERIFIED_HASHTAGS','NO_DUPLICATE_DATE_VENUE','VERIFIED_EVENT_PRICE_INVENTORY','BUSINESS_CRITICAL_COPY','ANTI_REPEAT','EXACTLY_3_VARIANTS','CREATIVE_LAYOUT_FLEXIBLE']
      : ['VERIFIED_FACTS_WHEN_APPLICABLE','VERIFIED_HASHTAGS_WHEN_APPLICABLE','NO_DUPLICATE_DATE_VENUE','BRAND_FIRST','ANTI_REPEAT','EXACTLY_3_VARIANTS','CREATIVE_LAYOUT_FLEXIBLE'],
    anti_repeat_required: true,
    three_variant_engine_required: true,
    internal_candidate_count: 3,
    public_output_count: 1,
    public_output_mode: 'SINGLE_FINAL_POST',
    owner_review_required: true,
    production_writes: 0,
    publishes: 0,
    plan,
    finalization_contract: {
      commercial_truth_required: requiresCommercialTruth,
      event_truth_required: directRental || Boolean(String(effectiveInput.event || effectiveInput.official_event_hashtag || '').trim()),
      internal_candidate_count: 3,
      public_output_count: 1,
      public_output_mode: 'SINGLE_FINAL_POST'
    },
    generation_prompt: buildGenerationPrompt(plan)
  };
}

function finalizeGeneratedCandidates({
  candidates = [],
  input = {},
  marketingPlan = {}
} = {}) {
  const ownerXQa = OwnerXCopy.validateVariants(candidates, input);
  if (ownerXQa.gate === 'BLOCKED') {
    return {
      schema_version:'KK_CONTENT_FINALIZATION_V1',
      gate:'BLOCKED',
      blocker:'OWNER_X_COPY_POLICY_FAILED',
      public_output_mode:'SINGLE_FINAL_POST',
      public_output_count:0,
      owner_x_qa:ownerXQa,
      qa:null,
      selection:null
    };
  }
  const qa = ContentQa.validateVariants(candidates, input);
  if (qa.gate !== 'PASS') {
    return {
      schema_version: 'KK_CONTENT_FINALIZATION_V1',
      gate: 'BLOCKED',
      blocker: 'CONTENT_QA_FAILED',
      public_output_mode: 'SINGLE_FINAL_POST',
      public_output_count: 0,
      qa,
      selection: null
    };
  }

  const annotated = candidates.map((candidate, index) => {
    const source = candidate && typeof candidate === 'object'
      ? candidate
      : { id: 'candidate-' + (index + 1), angle: 'unspecified', copy: String(candidate || '') };
    return {
      ...source,
      qa_gate: qa.results[index] && qa.results[index].gate || 'BLOCKED'
    };
  });

  const selection = ContentSelector.selectWinner(annotated, {
    objective: marketingPlan.objective || input.primary_objective || 'awareness',
    measured_posts: marketingPlan.measured_posts || 0
  });

  if (selection.gate !== 'PASS' || !selection.winner) {
    return {
      schema_version: 'KK_CONTENT_FINALIZATION_V1',
      gate: 'BLOCKED',
      blocker: 'CONTENT_SELECTION_FAILED',
      public_output_mode: 'SINGLE_FINAL_POST',
      public_output_count: 0,
      qa,
      selection
    };
  }

  return {
    schema_version: 'KK_CONTENT_FINALIZATION_V1',
    gate: 'PASS',
    blocker: '',
    public_output_mode: 'SINGLE_FINAL_POST',
    public_output_count: 1,
    qa,
    selection,
    final_post: selection.winner.copy
  };
}

module.exports = {
  DIRECT_RENTAL_PATTERNS,
  CONTENT_DRAFT_PATTERNS,
  effectiveInventoryInput,
  commercialTruthRequired,
  detectContentIntent,
  routeContentRequest,
  validateGeneratedVariants: ContentQa.validateVariants,
  validateGeneratedPost: ContentQa.validatePost,
  selectFinalPost: ContentSelector.selectWinner,
  finalizeGeneratedCandidates
};
