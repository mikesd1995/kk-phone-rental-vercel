'use strict';

const { buildCreativePlan, buildGenerationPrompt } = require('./kk-content-agent.js');

const DIRECT_RENTAL_PATTERNS = Object.freeze([
  /ขอ(?:โพส|โพสต์).*ปล่อยเช่า/i,
  /(?:โพส|โพสต์).*ปล่อยเช่า/i,
  /ขอ(?:โพส|โพสต์).*งาน.*(?:บน\s*)?(?:x|twitter)/i,
  /(?:ปล่อยเช่า|เช่ามือถือ).*(?:บน\s*)?(?:x|twitter)/i,
  /(?:x|twitter).*(?:ปล่อยเช่า|เช่ามือถือ)/i,
  /rental.*(?:post|copy).*(?:x|twitter)/i
]);

const CONTENT_DRAFT_PATTERNS = Object.freeze([
  /(?:คิด|เขียน|ทำ).*(?:คอนเทนต์|content|แคปชัน|caption|hook)/i,
  /(?:quote\s*post|โพสโควต|โพสต์โควต)/i,
  /(?:โพส|โพสต์).*(?:บน\s*)?(?:x|twitter)/i
]);

function normalizeMessage(message) {
  return String(message || '').replace(/\s+/g, ' ').trim();
}

function matchesAny(message, patterns) {
  return patterns.some(pattern => pattern.test(message));
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

  const plan = buildCreativePlan({
    ...input,
    requested_channel: 'x',
    requested_intent: intent
  }, performanceRows);

  const directRental = intent === 'direct_rental_x';
  const contentGate = directRental && !plan.readiness.commercial_ready ? 'BLOCKED' : 'PASS';

  return {
    schema_version: 'KK_CONTENT_REQUEST_ROUTE_V1',
    matched: true,
    route: 'KK_CONTENT_STRATEGY_AGENT',
    intent,
    content_gate: contentGate,
    strategy_required: true,
    anti_repeat_required: true,
    three_variant_engine_required: directRental,
    owner_review_required: true,
    production_writes: 0,
    publishes: 0,
    plan,
    generation_prompt: buildGenerationPrompt(plan)
  };
}

module.exports = {
  DIRECT_RENTAL_PATTERNS,
  CONTENT_DRAFT_PATTERNS,
  detectContentIntent,
  routeContentRequest
};
