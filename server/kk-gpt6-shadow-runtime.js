'use strict';

const Policy = require('./kk-model-migration-policy.js');

const RUNTIME_VERSION = 'KK_GPT6_SHADOW_RUNTIME_V1';
const RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';
const MAX_INPUT_BYTES = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 30000;
const SUPPORTED_WORKLOADS = Object.freeze(['scanner', 'verifier']);
const DECISIONS = Object.freeze(['READY_FOR_VERIFIER', 'HOLD', 'REJECT', 'RECONCILE']);
const EVIDENCE_TYPES = Object.freeze(['observed_fact', 'source_claim', 'inference', 'recommendation']);
const SENSITIVE_KEYS = new Set([
  'customer',
  'customer_name',
  'customer_email',
  'customer_phone',
  'email',
  'phone_number',
  'line_id',
  'line_user_id',
  'booking_id',
  'bookings',
  'payment',
  'payment_id',
  'deposit',
  'card_number',
  'address'
]);

const SHADOW_SCHEMA = Object.freeze({
  type: 'object',
  properties: {
    decision: { type:'string', enum:[...DECISIONS] },
    reason_codes: { type:'array', items:{type:'string'}, maxItems:20 },
    evidence_labels: {
      type:'array',
      maxItems:30,
      items:{
        type:'object',
        properties:{
          type:{type:'string',enum:[...EVIDENCE_TYPES]},
          field:{type:'string'},
          value:{type:'string'},
          source_ref:{type:'string'}
        },
        required:['type','field','value','source_ref'],
        additionalProperties:false
      }
    },
    conflicts: { type:'array', items:{type:'string'}, maxItems:20 },
    confidence: { type:'number', minimum:0, maximum:1 },
    rationale_summary: { type:'string' },
    authority: { type:'string', enum:['SHADOW_ADVISORY_ONLY'] },
    production_writes: { type:'integer', enum:[0] },
    publishes: { type:'integer', enum:[0] },
    notification_sends: { type:'integer', enum:[0] },
    final_truth_mutation: { type:'boolean', enum:[false] }
  },
  required:[
    'decision','reason_codes','evidence_labels','conflicts','confidence','rationale_summary',
    'authority','production_writes','publishes','notification_sends','final_truth_mutation'
  ],
  additionalProperties:false
});

function text(value) {
  return String(value == null ? '' : value).trim();
}

function boolEnabled(value) {
  return String(value || '').trim().toLowerCase() === 'true';
}

function cloneWithoutExpected(value) {
  if (Array.isArray(value)) return value.map(cloneWithoutExpected);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (/^expected(?:_|$)/i.test(key)) continue;
    out[key] = cloneWithoutExpected(item);
  }
  return out;
}

function sensitivePaths(value, path = '') {
  const found = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => found.push(...sensitivePaths(item, path ? `${path}[${index}]` : `[${index}]`)));
    return found;
  }
  if (!value || typeof value !== 'object') return found;
  for (const [rawKey, item] of Object.entries(value)) {
    const key = String(rawKey).trim().toLowerCase();
    const next = path ? `${path}.${rawKey}` : rawKey;
    if (SENSITIVE_KEYS.has(key) && item != null && String(item).trim() !== '') {
      found.push(next);
      continue;
    }
    found.push(...sensitivePaths(item, next));
  }
  return found;
}

function instructionsFor(workload) {
  const common = [
    'You are a shadow-only evaluator for KK Phone Rental.',
    'Model capability never expands project authority.',
    'Return only the requested structured output.',
    'You have no tools and no permission to write, publish, notify, schedule, price, book, change inventory, or mutate Machine SOT.',
    'Keep observed_fact, source_claim, inference, and recommendation distinct.',
    'Model confidence is not source authority.',
    'Persistent visibility history is authoritative for anti-recreate behavior: LOCKED cannot be reopened or recreated; SEEN_CORE without a current Core row is historical reconciliation debt; a regenerated event ID does not bypass history.',
    'Missing exact-event competitor pricing alone is not a reason to reject an otherwise eligible event; mark uncertainty and preserve provisional/recheck semantics.',
    'When protected identity, evidence, fencing, or readback is ambiguous, choose HOLD rather than inventing certainty.'
  ];
  if (workload === 'scanner') {
    return [
      ...common,
      'Scanner authority is staging-only. The strongest positive decision is READY_FOR_VERIFIER; it is never final business truth.',
      'Use RECONCILE when the event already exists or durable history shows it existed. Use HOLD for owner-hidden LOCKED state or unresolved evidence conflict.',
      'Never bypass the final governed Verifier.'
    ].join('\n');
  }
  return [
    ...common,
    'Verifier shadow output is advisory only and cannot become a final governed handoff by itself.',
    'A final governed handoff still requires current Machine-SOT policy, exact candidate identity, source freshness, conflict resolution, authorized write path, and exact readback.',
    'Use HOLD for unresolved conflicts, owner-hidden recreation attempts, family-completeness debt, or protected readback failure.',
    'Use RECONCILE for an existing/historical identity that must not be recreated. Use REJECT when authoritative evidence establishes cancellation or clear ineligibility.'
  ].join('\n');
}

function requestFor(workload, input, options = {}) {
  const route = Policy.routingForWorkload(workload);
  if (!route) return null;
  const clean = cloneWithoutExpected(input || {});
  const model = text(options.model) || route.primary_model;
  const effort = text(options.reasoningEffort) || route.reasoning_effort;
  return {
    model,
    reasoning: { effort },
    store: false,
    instructions: instructionsFor(workload),
    input: JSON.stringify(clean),
    max_output_tokens: 1800,
    text: {
      format: {
        type: 'json_schema',
        name: 'kk_gpt6_shadow_decision',
        strict: true,
        schema: SHADOW_SCHEMA
      }
    }
  };
}

function extractOutputText(response) {
  if (typeof response?.output_text === 'string' && response.output_text.trim()) {
    return response.output_text.trim();
  }
  for (const item of Array.isArray(response?.output) ? response.output : []) {
    if (item?.type !== 'message') continue;
    for (const part of Array.isArray(item.content) ? item.content : []) {
      if (part?.type === 'output_text' && typeof part.text === 'string') {
        return part.text.trim();
      }
    }
  }
  return '';
}

function validateShadowDecision(value) {
  const errors = [];
  const authorityErrors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { pass:false, errors:['OUTPUT_NOT_OBJECT'], authority_errors:[] };
  }
  if (!DECISIONS.includes(value.decision)) errors.push('DECISION_INVALID');
  if (!Array.isArray(value.reason_codes)) errors.push('REASON_CODES_INVALID');
  if (!Array.isArray(value.evidence_labels)) errors.push('EVIDENCE_LABELS_INVALID');
  if (!Array.isArray(value.conflicts)) errors.push('CONFLICTS_INVALID');
  const confidence = Number(value.confidence);
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) errors.push('CONFIDENCE_INVALID');
  if (!text(value.rationale_summary)) errors.push('RATIONALE_REQUIRED');

  if (value.authority !== 'SHADOW_ADVISORY_ONLY') authorityErrors.push('AUTHORITY_ESCALATION');
  if (Number(value.production_writes) !== 0) authorityErrors.push('PRODUCTION_WRITES_NONZERO');
  if (Number(value.publishes) !== 0) authorityErrors.push('PUBLISHES_NONZERO');
  if (Number(value.notification_sends) !== 0) authorityErrors.push('NOTIFICATION_SENDS_NONZERO');
  if (value.final_truth_mutation !== false) authorityErrors.push('FINAL_TRUTH_MUTATION');

  for (const label of Array.isArray(value.evidence_labels) ? value.evidence_labels : []) {
    if (!label || typeof label !== 'object') {
      errors.push('EVIDENCE_LABEL_INVALID');
      continue;
    }
    if (!EVIDENCE_TYPES.includes(label.type)) errors.push('EVIDENCE_TYPE_INVALID');
    for (const key of ['field','value','source_ref']) {
      if (typeof label[key] !== 'string') errors.push(`EVIDENCE_${key.toUpperCase()}_INVALID`);
    }
  }

  return {
    pass: errors.length === 0 && authorityErrors.length === 0,
    errors:[...new Set(errors)],
    authority_errors:[...new Set(authorityErrors)]
  };
}

function baseResult(workload, status, extra = {}) {
  return {
    runtime_version: RUNTIME_VERSION,
    status,
    workload: text(workload).toLowerCase(),
    shadow_only: true,
    authoritative: false,
    verifier_required: true,
    shadow_decision: null,
    network_calls: 0,
    production_writes: 0,
    publishes: 0,
    notification_sends: 0,
    final_truth_mutation: false,
    ...extra
  };
}

function readiness(workload, env = process.env) {
  const normalized = text(workload).toLowerCase();
  const supported = SUPPORTED_WORKLOADS.includes(normalized);
  const enabled = boolEnabled(env.KK_GPT6_SHADOW_ENABLED);
  const credentialReady = Boolean(text(env.OPENAI_API_KEY));
  const route = Policy.routingForWorkload(normalized);
  return {
    runtime_version:RUNTIME_VERSION,
    workload:normalized,
    supported,
    enabled,
    credential_ready:credentialReady,
    model:route?.primary_model || null,
    reasoning_effort:route?.reasoning_effort || null,
    endpoint:RESPONSES_ENDPOINT,
    store:false,
    production_writes:0
  };
}

async function runShadow(workload, input = {}, options = {}) {
  const normalized = text(workload).toLowerCase();
  const env = options.env || process.env;

  if (!SUPPORTED_WORKLOADS.includes(normalized)) {
    return baseResult(normalized, 'BLOCKED_SHADOW_WORKLOAD_UNSUPPORTED');
  }
  if (!boolEnabled(env.KK_GPT6_SHADOW_ENABLED)) {
    return baseResult(normalized, 'SHADOW_DISABLED');
  }

  const apiKey = text(options.apiKey || env.OPENAI_API_KEY);
  if (!apiKey) {
    return baseResult(normalized, 'BLOCKED_OPENAI_API_KEY_MISSING');
  }

  const cleanInput = cloneWithoutExpected(input || {});
  const sensitive = sensitivePaths(cleanInput);
  if (sensitive.length) {
    return baseResult(normalized, 'BLOCKED_SHADOW_INPUT_SENSITIVE', {
      blockers:sensitive.map(path => `SENSITIVE_FIELD:${path}`)
    });
  }

  let serialized;
  try {
    serialized = JSON.stringify(cleanInput);
  } catch (_) {
    return baseResult(normalized, 'BLOCKED_SHADOW_INPUT_INVALID');
  }
  if (Buffer.byteLength(serialized, 'utf8') > MAX_INPUT_BYTES) {
    return baseResult(normalized, 'BLOCKED_SHADOW_INPUT_TOO_LARGE', {
      max_input_bytes:MAX_INPUT_BYTES
    });
  }

  const payload = requestFor(normalized, cleanInput, options);
  const fetchImpl = options.fetchImpl || global.fetch;
  if (typeof fetchImpl !== 'function') {
    return baseResult(normalized, 'BLOCKED_SHADOW_FETCH_UNAVAILABLE');
  }

  const controller = new AbortController();
  const timeoutMs = Math.max(1000, Number(options.timeoutMs || DEFAULT_TIMEOUT_MS));
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(RESPONSES_ENDPOINT, {
      method:'POST',
      headers:{
        'content-type':'application/json',
        'authorization':`Bearer ${apiKey}`
      },
      body:JSON.stringify(payload),
      signal:controller.signal
    });
  } catch (error) {
    clearTimeout(timer);
    return baseResult(normalized, 'SHADOW_PROVIDER_UNAVAILABLE', {
      network_calls:1,
      provider_error_code:text(error?.code || error?.name || 'NETWORK_ERROR')
    });
  }
  clearTimeout(timer);

  let data = null;
  try {
    data = await response.json();
  } catch (_) {
    return baseResult(normalized, 'BLOCKED_SHADOW_PROVIDER_RESPONSE_INVALID', {
      network_calls:1,
      provider_status:Number(response?.status || 0)
    });
  }

  if (!response?.ok) {
    return baseResult(normalized, 'SHADOW_PROVIDER_UNAVAILABLE', {
      network_calls:1,
      provider_status:Number(response.status || 0),
      provider_error_code:text(data?.error?.code || data?.error?.type || 'OPENAI_HTTP_ERROR')
    });
  }

  const rawText = extractOutputText(data);
  if (!rawText) {
    return baseResult(normalized, 'BLOCKED_SHADOW_OUTPUT_INVALID', {
      network_calls:1,
      response_id:text(data?.id),
      blockers:['OUTPUT_TEXT_MISSING']
    });
  }

  let decision;
  try {
    decision = JSON.parse(rawText);
  } catch (_) {
    return baseResult(normalized, 'BLOCKED_SHADOW_OUTPUT_INVALID', {
      network_calls:1,
      response_id:text(data?.id),
      blockers:['OUTPUT_JSON_INVALID']
    });
  }

  const checked = validateShadowDecision(decision);
  if (checked.authority_errors.length) {
    return baseResult(normalized, 'BLOCKED_SHADOW_OUTPUT_AUTHORITY_VIOLATION', {
      network_calls:1,
      response_id:text(data?.id),
      blockers:checked.authority_errors
    });
  }
  if (!checked.pass) {
    return baseResult(normalized, 'BLOCKED_SHADOW_OUTPUT_INVALID', {
      network_calls:1,
      response_id:text(data?.id),
      blockers:checked.errors
    });
  }

  return baseResult(normalized, 'SHADOW_RESULT_READY', {
    shadow_decision:decision,
    network_calls:1,
    response_id:text(data?.id),
    model:payload.model,
    reasoning_effort:payload.reasoning.effort,
    usage:{
      input_tokens:Number(data?.usage?.input_tokens || 0),
      output_tokens:Number(data?.usage?.output_tokens || 0),
      reasoning_tokens:Number(data?.usage?.output_tokens_details?.reasoning_tokens || 0)
    }
  });
}

module.exports = {
  RUNTIME_VERSION,
  RESPONSES_ENDPOINT,
  MAX_INPUT_BYTES,
  DEFAULT_TIMEOUT_MS,
  SUPPORTED_WORKLOADS,
  DECISIONS,
  SHADOW_SCHEMA,
  cloneWithoutExpected,
  sensitivePaths,
  instructionsFor,
  requestFor,
  extractOutputText,
  validateShadowDecision,
  readiness,
  runShadow
};
