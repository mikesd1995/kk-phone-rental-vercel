'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../server/capability-improvement-contract.js');

test('failure diagnosis requires known taxonomy and evidence-bearing observation', () => {
  assert.equal(C.validateFailureDiagnosis({
    failure_type: 'SKILL_GAP',
    run_id: 'run-1',
    observation: 'competitor recall below baseline'
  }).ok, true);

  assert.equal(C.validateFailureDiagnosis({
    failure_type: 'MAGIC_FAILURE',
    run_id: 'run-1',
    observation: 'x'
  }).reason, 'FAILURE_TYPE_INVALID');
});

test('improvement candidate cannot modify governance or gain direct production authority', () => {
  assert.equal(C.validateImprovementCandidate({
    candidate_id: 'cand-1',
    source_run_id: 'run-1',
    candidate_type: 'SKILL',
    target_class: 'PERMISSION_SYSTEM'
  }).reason, 'SELF_MODIFICATION_FORBIDDEN');

  assert.equal(C.validateImprovementCandidate({
    candidate_id: 'cand-2',
    source_run_id: 'run-1',
    candidate_type: 'TOOL',
    target_class: 'TOOL',
    direct_production_authority: true
  }).reason, 'DIRECT_PRODUCTION_AUTHORITY_FORBIDDEN');
});

test('lessons require repeated observations, evidence, confidence and independent evaluation', () => {
  const good = C.validateLessonCandidate({
    observation_ids: ['obs-1', 'obs-2'],
    evidence_ids: ['ev-1'],
    confidence: 0.91,
    independent_evaluator_pass: true
  });
  assert.equal(good.ok, true);

  assert.equal(C.validateLessonCandidate({
    observation_ids: ['obs-1'],
    evidence_ids: ['ev-1'],
    confidence: 0.99,
    independent_evaluator_pass: true
  }).reason, 'LESSON_REQUIRES_MULTIPLE_OBSERVATIONS');
});

test('improvement candidate requires an explicit target class', () => {
  assert.equal(C.validateImprovementCandidate({
    candidate_id: 'cand-target',
    source_run_id: 'run-1',
    candidate_type: 'SKILL'
  }).reason, 'TARGET_CLASS_REQUIRED');
});

test('facts require evidence and last verification time', () => {
  assert.equal(C.validateFactCandidate({
    evidence_ids: ['ev-1'],
    last_verified_at: '2026-09-22T03:00:00Z'
  }).ok, true);

  assert.equal(C.validateFactCandidate({
    evidence_ids: []
  }).reason, 'FACT_REQUIRES_EVIDENCE');
});

test('promotion requires safety, independent evaluation, enough samples and improvement', () => {
  const pass = C.evaluatePromotion({
    hard_safety_pass: true,
    independent_evaluator_pass: true,
    critical_regression: false,
    production_writes_during_eval: 0,
    sample_size: 200,
    minimum_sample_size: 100,
    primary_metric_delta: 4,
    required_primary_delta: 3,
    cost_delta_pct: 5,
    max_cost_delta_pct: 10
  });
  assert.equal(pass.promote, true);

  assert.equal(C.evaluatePromotion({
    hard_safety_pass: true,
    independent_evaluator_pass: true,
    production_writes_during_eval: 0,
    sample_size: 5,
    minimum_sample_size: 100,
    primary_metric_delta: 20
  }).reason, 'INSUFFICIENT_SAMPLE_SIZE');

  assert.equal(C.evaluatePromotion({
    hard_safety_pass: true,
    independent_evaluator_pass: true,
    sample_size: 200,
    minimum_sample_size: 100,
    primary_metric_delta: 20
  }).reason, 'EVAL_MUST_PROVE_ZERO_PRODUCTION_WRITE');
});

test('learning can create candidates but cannot rewrite hard governance', () => {
  assert.deepEqual(C.classifyLearningAction({
    candidate_type: 'SKILL',
    target_class: 'SKILL'
  }), {
    allowed: true,
    action: 'CREATE_CANDIDATE_ONLY',
    reason: 'EVALUATION_REQUIRED_BEFORE_PROMOTION'
  });

  assert.equal(C.classifyLearningAction({
    candidate_type: 'CODE',
    target_class: 'KILL_SWITCH'
  }).allowed, false);
});
