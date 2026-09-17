#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const HF = require('../server/hf-event-assist.js');

const fixturePath = path.resolve(__dirname, '../tests/fixtures/hf-event-assist-benchmark.json');
const DEFAULT_MAX_LIVE_CALLS = 20;

function pairKey(a, b) {
  return [String(a), String(b)].sort().join('::');
}

function expectedDuplicatePairs(candidates) {
  const groups = new Map();
  for (const candidate of candidates) {
    if (!candidate.duplicate_group) continue;
    const group = groups.get(candidate.duplicate_group) || [];
    group.push(candidate.candidate_id);
    groups.set(candidate.duplicate_group, group);
  }
  const pairs = new Set();
  for (const ids of groups.values()) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) pairs.add(pairKey(ids[i], ids[j]));
    }
  }
  return pairs;
}

function ratio(numerator, denominator) {
  return denominator ? Number((numerator / denominator).toFixed(4)) : 1;
}

function boundedPositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 100) return fallback;
  return n;
}

function latencySummary(values) {
  const nums = values.filter(Number.isFinite);
  if (!nums.length) return {count: 0, total_ms: 0, avg_ms: 0, max_ms: 0};
  const total = nums.reduce((a, b) => a + b, 0);
  return {
    count: nums.length,
    total_ms: total,
    avg_ms: Number((total / nums.length).toFixed(2)),
    max_ms: Math.max(...nums)
  };
}

function safeWriteReport(report, token) {
  const serialized = JSON.stringify(report, null, 2);
  if (token && serialized.includes(token)) {
    throw new Error('SECRET_LEAK_GUARD_TRIGGERED');
  }
  process.stdout.write(serialized + '\n');
}

async function main() {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const candidates = fixture.candidates || [];
  const expectedPairs = expectedDuplicatePairs(candidates);
  const enabled = HF.isEnabled(process.env);
  const token = String(process.env.HF_TOKEN || '').trim();
  const tokenPresent = Boolean(token);
  const maxLiveCalls = boundedPositiveInt(process.env.HF_UAT_MAX_CALLS, DEFAULT_MAX_LIVE_CALLS);
  const plannedLiveCalls = candidates.length + 1;

  const base = {
    generated_by: 'kk-hf-event-assist-benchmark-v1.2',
    fixture_version: fixture.version,
    candidate_count: candidates.length,
    expected_duplicate_pair_count: expectedPairs.size,
    hf_enabled: enabled,
    hf_token_present: tokenPresent,
    max_live_calls: maxLiveCalls,
    planned_live_calls: plannedLiveCalls,
    production_writes: 0,
    final_truth_mutation: false,
    notification_sends: 0
  };

  if (!enabled || !tokenPresent) {
    safeWriteReport({
      ...base,
      status: 'PREPARED_NOT_EXECUTED',
      reason: !enabled ? 'HF_EVENT_ASSIST_DISABLED' : 'HF_TOKEN_MISSING',
      live_hf_calls: 0,
      live_hf_calls_attempted: 0,
      quality_gate_pass: null
    }, token);
    return;
  }

  if (plannedLiveCalls > maxLiveCalls) {
    safeWriteReport({
      ...base,
      status: 'BLOCKED_CALL_BUDGET',
      reason: 'PLANNED_CALLS_EXCEED_HF_UAT_MAX_CALLS',
      live_hf_calls: 0,
      live_hf_calls_attempted: 0,
      quality_gate_pass: false,
      activation_recommendation: 'KEEP_DISABLED_AND_REVIEW_CALL_BUDGET'
    }, token);
    process.exitCode = 2;
    return;
  }

  const classifications = [];
  const classLatencies = [];
  let attemptedCalls = 0;

  try {
    for (const candidate of candidates) {
      attemptedCalls += 1;
      const started = Date.now();
      const result = await HF.classifyEventCandidate(candidate);
      const elapsed = Date.now() - started;
      classLatencies.push(elapsed);
      classifications.push({
        candidate_id: candidate.candidate_id,
        expected_label: candidate.expected_label || null,
        predicted_label: result.top_label,
        top_score: result.top_score,
        confidence_band: result.confidence_band,
        latency_ms: elapsed,
        correct: candidate.expected_label ? result.top_label === candidate.expected_label : null
      });
    }

    attemptedCalls += 1;
    const embedStarted = Date.now();
    const embedded = await HF.embedEventCandidates(candidates);
    const embeddingLatencyMs = Date.now() - embedStarted;
    const dedup = HF.duplicatePairs(candidates, embedded.vectors);

    const foundPairs = new Set(dedup.pairs.map(item =>
      pairKey(candidates[item.left_index].candidate_id, candidates[item.right_index].candidate_id)
    ));
    const truePositivePairs = [...foundPairs].filter(key => expectedPairs.has(key));
    const falsePositivePairs = [...foundPairs].filter(key => !expectedPairs.has(key));
    const missedPairs = [...expectedPairs].filter(key => !foundPairs.has(key));

    const classScored = classifications.filter(item => item.expected_label);
    const classCorrect = classScored.filter(item => item.correct).length;
    const classificationAccuracy = ratio(classCorrect, classScored.length);
    const duplicateRecall = ratio(truePositivePairs.length, expectedPairs.size);

    const qualityGatePass =
      classificationAccuracy >= 0.80 &&
      duplicateRecall >= 0.90 &&
      falsePositivePairs.length === 0 &&
      base.production_writes === 0 &&
      base.final_truth_mutation === false &&
      base.notification_sends === 0;

    const report = {
      ...base,
      status: 'LIVE_BENCHMARK_COMPLETE',
      live_hf_calls: attemptedCalls,
      live_hf_calls_attempted: attemptedCalls,
      models: {
        zero_shot: process.env.HF_ZERO_SHOT_MODEL || HF.DEFAULT_ZERO_SHOT_MODEL,
        embedding: process.env.HF_EMBED_MODEL || HF.DEFAULT_EMBED_MODEL
      },
      latency: {
        classification: latencySummary(classLatencies),
        embedding_ms: embeddingLatencyMs
      },
      classification: {
        scored: classScored.length,
        correct: classCorrect,
        accuracy: classificationAccuracy,
        results: classifications
      },
      dedup: {
        threshold: HF.DEFAULT_DUPLICATE_THRESHOLD,
        expected_pairs: expectedPairs.size,
        true_positive_pairs: truePositivePairs,
        missed_pairs: missedPairs,
        false_positive_pairs: falsePositivePairs,
        duplicate_recall: duplicateRecall,
        identity_conflicts: dedup.conflicts
      },
      quality_gate_pass: qualityGatePass,
      activation_recommendation: qualityGatePass
        ? 'ELIGIBLE_FOR_CONTROLLED_SCANNER_WIRING_REVIEW'
        : 'KEEP_DISABLED_AND_CALIBRATE'
    };

    safeWriteReport(report, token);
    if (!qualityGatePass) process.exitCode = 3;
  } catch (error) {
    const safeError = HF.redactSecret(error && (error.stack || error.message || error), token);
    safeWriteReport({
      ...base,
      status: 'LIVE_BENCHMARK_FAILED',
      live_hf_calls: attemptedCalls,
      live_hf_calls_attempted: attemptedCalls,
      quality_gate_pass: false,
      error: safeError,
      activation_recommendation: 'KEEP_DISABLED_AND_INVESTIGATE'
    }, token);
    process.exitCode = 1;
  }
}

main().catch(error => {
  process.stderr.write(HF.redactSecret((error && error.stack) || String(error), process.env.HF_TOKEN || ''));
  process.stderr.write('\n');
  process.exitCode = 1;
});
