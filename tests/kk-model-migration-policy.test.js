'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const Policy = require('../server/kk-model-migration-policy.js');

test('GPT-6 migration policy is shadow-only and cannot claim production cutover', () => {
  const state = Policy.publicPolicy();

  assert.equal(Policy.POLICY_VERSION, 'KK_MODEL_MIGRATION_POLICY_V1');
  assert.equal(state.target_family, 'gpt-6');
  assert.equal(state.default_model, 'gpt-6-sol');
  assert.equal(state.transport_state, 'NOT_WIRED');
  assert.equal(state.execution_evidence, false);
  assert.equal(state.cutover_allowed, false);
  assert.equal(state.production_writes, 0);
});

test('GPT-6 routing preserves workload roles and deterministic Canary', () => {
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

  assert.deepEqual(Policy.routingForWorkload('high_volume_classification'), {
    primary_model: 'gpt-6-luna',
    reasoning_effort: 'low',
    escalation_model: 'gpt-6-sol',
    escalation_effort: 'medium'
  });

  assert.deepEqual(Policy.routingForWorkload('canary'), {
    primary_model: 'DETERMINISTIC_NO_LLM',
    reasoning_effort: null,
    escalation_model: null,
    escalation_effort: null
  });
});

test('cutover readiness fails closed until every required gate is proven', () => {
  assert.deepEqual(
    Policy.migrationReadiness({
      transport_wired: false,
      prompt_audit_passed: true,
      shadow_eval_passed: true,
      zero_write_acceptance_passed: true
    }),
    {
      ready: false,
      missing: ['transport_wired']
    }
  );

  assert.deepEqual(
    Policy.migrationReadiness({
      transport_wired: true,
      prompt_audit_passed: true,
      shadow_eval_passed: true,
      zero_write_acceptance_passed: true
    }),
    {
      ready: true,
      missing: []
    }
  );
});

test('GPT-6 prompt hardening preserves role authority and evidence discipline', () => {
  const agents = fs.readFileSync('AGENTS.md', 'utf8');
  const scanner = fs.readFileSync('.agents/skills/kk-discovery-scanner/SKILL.md', 'utf8');
  const verifier = fs.readFileSync('.agents/skills/kk-event-verifier/SKILL.md', 'utf8');
  const canary = fs.readFileSync('.agents/skills/kk-canary-safety/SKILL.md', 'utf8');

  assert.match(agents, /Model capability never expands project authority/i);
  assert.match(agents, /observed fact.*source claim.*inference.*recommendation/is);
  assert.match(agents, /protected write.*fail closed/is);

  assert.match(scanner, /model or provider.*does not expand Scanner authority/is);
  assert.match(scanner, /staging-only/i);

  assert.match(verifier, /model or provider.*does not expand Verifier authority/is);
  assert.match(verifier, /final governed handoff/i);

  assert.match(canary, /new model family.*not.*acceptance/is);
  assert.match(canary, /production writes = 0/i);
});
