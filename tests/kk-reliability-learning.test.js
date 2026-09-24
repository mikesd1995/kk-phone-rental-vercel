'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Reliability = require('../server/kk-reliability-learning-agent.js');

test('loads advisory-only memory contract', () => {
  const memory = Reliability.loadMemory();
  assert.equal(memory.schema_version, 'KK_RELIABILITY_MEMORY_V1');
  assert.equal(memory.learning_contract.auto_apply, false);
  assert.equal(memory.learning_contract.production_writes, 0);
});

test('recognizes timer-without-runtime recurrence from evidence text', () => {
  const diagnosis = Reliability.classifyObservation({
    message: 'Task metadata advanced but no governed Machine-SOT lock/Manifest boundary appeared; timer metadata only.'
  });
  assert.equal(diagnosis.known, true);
  assert.equal(diagnosis.fingerprint_id, 'CONTROL_TIMER_WITHOUT_RUNTIME_BOUNDARY');
  assert.equal(diagnosis.root_cause_confidence, 'UNKNOWN');
  assert.match(diagnosis.known_repair, /launcher minimal/i);
});

test('recognizes exact identity failure and forbids row-number resolution', () => {
  const diagnosis = Reliability.classifyObservation({
    code: 'FAIL_REQUIRES_EXACT_IDENTITY',
    message: 'Unrelated Core event caused by row-position mismatch'
  });
  assert.equal(diagnosis.fingerprint_id, 'IDENTITY_POSITIONAL_MISMATCH');
  assert.equal(diagnosis.root_cause_confidence, 'PROVEN');
  assert.equal(diagnosis.never_do.some(item => /row number/i.test(item)), true);
});

test('recognizes Make credit exhaustion as external blocker', () => {
  const diagnosis = Reliability.classifyObservation({
    message: 'Make Free-plan credits exhausted and organization or team is paused'
  });
  assert.equal(diagnosis.fingerprint_id, 'MAKE_CREDITS_EXHAUSTED');
  assert.equal(diagnosis.root_cause_confidence, 'PROVEN_EXTERNAL');
  assert.match(diagnosis.known_repair, /external capacity blocker/i);
});

test('recognizes stale exact-event market evidence', () => {
  const diagnosis = Reliability.classifyObservation({code:'STALE_EXACT_MARKET_EXCLUDED'});
  assert.equal(diagnosis.fingerprint_id, 'STALE_COMPETITOR_PRICE');
  assert.match(diagnosis.known_repair, /fresh exact-event market/i);
});

test('recognizes provider evidence gate', () => {
  const diagnosis = Reliability.classifyObservation({
    message: 'No provider evidence; SENT prohibited without provider ACK'
  });
  assert.equal(diagnosis.fingerprint_id, 'PROVIDER_ACK_MISSING');
});

test('recognizes DEP0169 but does not invent ownership', () => {
  const diagnosis = Reliability.classifyObservation({
    code:'DEP0169',
    message:'url.parse() behavior is deprecated'
  });
  assert.equal(diagnosis.fingerprint_id, 'DEP0169_URL_PARSE_WARNING');
  assert.equal(diagnosis.root_cause_confidence, 'UNKNOWN_OWNER');
  assert.match(diagnosis.known_repair, /trace the caller/i);
});

test('unknown incident stays unknown and cannot auto-fix', () => {
  const report = Reliability.analyzeReliability([{message:'brand-new unexplained symptom xyz'}]);
  assert.equal(report.unknown_incident_count, 1);
  assert.equal(report.safety.safe_to_auto_apply, false);
  assert.equal(report.safety.production_writes, 0);
});

test('history makes repeated known incidents explicitly recurrent', () => {
  const report = Reliability.analyzeReliability([
    {code:'FAIL_REQUIRES_EXACT_IDENTITY'}
  ], {
    incident_history:[
      {fingerprint_id:'IDENTITY_POSITIONAL_MISMATCH'},
      {fingerprint_id:'IDENTITY_POSITIONAL_MISMATCH'}
    ]
  });
  assert.equal(report.incidents[0].recurrence, true);
  assert.equal(report.incidents[0].occurrence_count, 3);
});

test('memory update is blocked without evidence and regression guard', () => {
  const patch = Reliability.proposeMemoryUpdate({
    fingerprint_id:'NEW_THING',
    root_cause_confidence:'PROBABLE',
    known_repair:'Do the thing'
  });
  assert.equal(patch.status, 'BLOCKED');
  assert.equal(patch.blockers.includes('EVIDENCE_MISSING'), true);
  assert.equal(patch.blockers.includes('REGRESSION_GUARD_MISSING'), true);
  assert.equal(patch.safe_to_auto_apply, false);
});

test('memory update can be proposed but still requires human review', () => {
  const patch = Reliability.proposeMemoryUpdate({
    fingerprint_id:'NEW_THING',
    root_cause_confidence:'PROVEN',
    known_repair:'Apply deterministic repair',
    evidence:['exact readback','failing test before repair'],
    regression_guards:['regression test passes after repair']
  });
  assert.equal(patch.status, 'PROPOSED');
  assert.equal(patch.requires_human_review, true);
  assert.equal(patch.safe_to_auto_apply, false);
});

test('advisor prompt preserves authority boundary', () => {
  const report = Reliability.analyzeReliability([{code:'MISSING_RUNTIME'}]);
  const prompt = Reliability.buildAdvisorPrompt(report);
  assert.match(prompt, /Never mutate production/);
  assert.match(prompt, /Never claim root cause above/);
});
