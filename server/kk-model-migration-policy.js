'use strict';

const POLICY_VERSION = 'KK_MODEL_MIGRATION_POLICY_V2';

const ROUTING = Object.freeze({
  scanner: Object.freeze({
    primary_model: 'gpt-6-sol',
    reasoning_effort: 'low',
    escalation_model: null,
    escalation_effort: null
  }),
  verifier: Object.freeze({
    primary_model: 'gpt-6-sol',
    reasoning_effort: 'high',
    escalation_model: 'gpt-6-astra',
    escalation_effort: 'xhigh'
  }),
  high_volume_classification: Object.freeze({
    primary_model: 'gpt-6-luna',
    reasoning_effort: 'low',
    escalation_model: 'gpt-6-sol',
    escalation_effort: 'medium'
  }),
  content: Object.freeze({
    primary_model: 'gpt-6-sol',
    reasoning_effort: 'medium',
    escalation_model: null,
    escalation_effort: null
  }),
  code_repair: Object.freeze({
    primary_model: 'gpt-6-sol',
    reasoning_effort: 'high',
    escalation_model: 'gpt-6-astra',
    escalation_effort: 'xhigh'
  }),
  canary: Object.freeze({
    primary_model: 'DETERMINISTIC_NO_LLM',
    reasoning_effort: null,
    escalation_model: null,
    escalation_effort: null
  })
});

const REQUIRED_GATES = Object.freeze([
  'prompt_audit_passed',
  'shadow_transport_wired',
  'credential_ready',
  'shadow_eval_passed',
  'zero_write_acceptance_passed',
  'production_transport_approved'
]);

function routingForWorkload(name) {
  const key = String(name || '').trim().toLowerCase();
  return ROUTING[key] ? { ...ROUTING[key] } : null;
}

function migrationReadiness(evidence = {}) {
  const missing = REQUIRED_GATES.filter(gate => evidence[gate] !== true);
  return { ready: missing.length === 0, missing };
}

function publicPolicy() {
  return {
    policy_version: POLICY_VERSION,
    target_family: 'gpt-6',
    default_model: 'gpt-6-sol',
    api_preference: 'RESPONSES_API',
    shadow_transport_wired: true,
    transport_state: 'SHADOW_WIRED_CREDENTIAL_GATED',
    execution_mode: 'SHADOW_ONLY',
    execution_evidence: false,
    cutover_allowed: false,
    production_writes: 0,
    required_gates: [...REQUIRED_GATES],
    routing: Object.fromEntries(
      Object.entries(ROUTING).map(([key, value]) => [key, { ...value }])
    )
  };
}

module.exports = {
  POLICY_VERSION,
  ROUTING,
  REQUIRED_GATES,
  routingForWorkload,
  migrationReadiness,
  publicPolicy
};
