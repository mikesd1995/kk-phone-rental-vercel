'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const Policy = require('../server/kk-model-migration-policy.js');
const Registry = require('../server/kk-agent-registry.js');

test('migration policy V2 exposes wired shadow transport but blocks production cutover', () => {
  const state = Policy.publicPolicy();

  assert.equal(Policy.POLICY_VERSION, 'KK_MODEL_MIGRATION_POLICY_V2');
  assert.equal(state.target_family, 'gpt-6');
  assert.equal(state.default_model, 'gpt-6-sol');
  assert.equal(state.shadow_transport_wired, true);
  assert.equal(state.transport_state, 'SHADOW_WIRED_CREDENTIAL_GATED');
  assert.equal(state.execution_mode, 'SHADOW_ONLY');
  assert.equal(state.execution_evidence, false);
  assert.equal(state.cutover_allowed, false);
  assert.equal(state.production_writes, 0);
});

test('routing keeps Sol primary and deterministic Canary', () => {
  assert.deepEqual(Policy.routingForWorkload('scanner'), {
    primary_model: 'gpt-6-sol',
    reasoning_effort: 'low',
    escalation_model: null,
    escalation_effort: null
  });
  assert.deepEqual(Policy.routingForWorkload('verifier'), {
    primary_model: 'gpt-6-sol',
    reasoning_effort: 'high',
    escalation_model: 'gpt-6-astra',
    escalation_effort: 'xhigh'
  });
  assert.deepEqual(Policy.routingForWorkload('canary'), {
    primary_model: 'DETERMINISTIC_NO_LLM',
    reasoning_effort: null,
    escalation_model: null,
    escalation_effort: null
  });
});

test('production readiness requires real credential, live shadow eval and zero-write acceptance', () => {
  const blocked = Policy.migrationReadiness({
    prompt_audit_passed: true,
    shadow_transport_wired: true,
    credential_ready: false,
    shadow_eval_passed: false,
    zero_write_acceptance_passed: false,
    production_transport_approved: false
  });
  assert.equal(blocked.ready, false);
  assert.deepEqual(blocked.missing, [
    'credential_ready',
    'shadow_eval_passed',
    'zero_write_acceptance_passed',
    'production_transport_approved'
  ]);

  const ready = Policy.migrationReadiness({
    prompt_audit_passed: true,
    shadow_transport_wired: true,
    credential_ready: true,
    shadow_eval_passed: true,
    zero_write_acceptance_passed: true,
    production_transport_approved: true
  });
  assert.deepEqual(ready, { ready:true, missing:[] });
});

test('prompt hardening coexists with latest owner visibility tombstone contract', () => {
  const agents = fs.readFileSync('AGENTS.md', 'utf8');
  const scanner = fs.readFileSync('.agents/skills/kk-discovery-scanner/SKILL.md', 'utf8');
  const verifier = fs.readFileSync('.agents/skills/kk-event-verifier/SKILL.md', 'utf8');
  const canary = fs.readFileSync('.agents/skills/kk-canary-safety/SKILL.md', 'utf8');

  assert.match(agents, /Model capability never expands project authority/i);
  assert.match(agents, /observed fact.*source claim.*inference.*recommendation/is);

  assert.match(scanner, /model or provider.*does not expand Scanner authority/is);
  assert.match(scanner, /18_Event_Visibility_Locks/);
  assert.match(scanner, /SEEN_CORE/);

  assert.match(verifier, /model or provider.*does not expand Verifier authority/is);
  assert.match(verifier, /OWNER_HIDDEN_RECREATE_PROHIBITED/);
  assert.match(verifier, /HISTORICAL_EVENT_RECREATE_PROHIBITED/);

  assert.match(canary, /new model family.*not.*acceptance/is);
  assert.match(canary, /production writes = 0/i);
});

test('Agent Registry exposes explicit shadow routes and zero-write migration metadata', () => {
  const registry = Registry.publicRegistry();
  assert.equal(registry.model_migration.policy_version, Policy.POLICY_VERSION);
  assert.equal(registry.model_migration.transport_state, 'SHADOW_WIRED_CREDENTIAL_GATED');
  assert.equal(registry.model_migration.cutover_allowed, false);

  const scanner = Registry.routeForIntent('scanner_gpt6_shadow');
  const verifier = Registry.routeForIntent('verifier_gpt6_shadow');
  assert.deepEqual(scanner.required_agents, ['kk-discovery-scanner','kk-gpt6-shadow-evaluator']);
  assert.deepEqual(verifier.required_agents, ['kk-event-verifier','kk-gpt6-shadow-evaluator']);
  assert.equal(Registry.AGENTS['kk-gpt6-shadow-evaluator'].production_writes, 0);
});
