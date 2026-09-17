#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const HF = require('../server/hf-event-assist.js');

const fixturePath = path.resolve(__dirname, '../tests/fixtures/hf-event-assist-benchmark.json');

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

async function main() {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const candidates = fixture.candidates || [];
  const expectedPairs = expectedDuplicatePairs(candidates);
  const enabled = HF.isEnabled(process.env);
  const tokenPresent = Boolean(String(process.env.HF_TOKEN || '').trim());

  const base = {
    generated_by: 'kk-hf-event-assist-benchmark-v1',
    fixture_version: fixture.version,
    candidate_count: candidates.length,
    expected_duplicate_pair_count: expectedPairs.size,
    hf_enabled: enabled,
    hf_token_present: tokenPresent,
    production_writes: 0,
    final_truth_mutation: false,
    notification_sends: 0
  };

  if (!enabled || !tokenPresent) {
    process.stdout.write(JSON.stringify({
      ...base,
      status: 'PREPARED_NOT_EXECUTED',
      reason: !enabled ? 'HF_EVENT_ASSIST_DISABLED' : 'HF_TOKEN_MISSING',
      live_hf_calls: 0,
      quality_gate_pass: null
    }, null, 2) + '\n');
    return;
  }

  const classifications = [];
  for (const candidate of candidates) {
    const result = await HF.classifyEventCandidate(candidate);
    classifications.push({
      candidate_id: candidate.candidate_id,
      expected_label: candidate.expected_label || null,
      predicted_label: result.top_label,
      top_score: result.top_score,
      confidence_band: result.confidence_band,
      correct: candidate.expected_label ? result.top_label === candidate.expected_label : null
    });
  }

  const embedded = await HF.embedEventCandidates(candidates);
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
    base.production_writes === 0;

  process.stdout.write(JSON.stringify({
    ...base,
    status: 'LIVE_BENCHMARK_COMPLETE',
    live_hf_calls: candidates.length + 1,
    models: {
      zero_shot: HF.DEFAULT_ZERO_SHOT_MODEL,
      embedding: HF.DEFAULT_EMBED_MODEL
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
  }, null, 2) + '\n');
}

main().catch(error => {
  process.stderr.write((error && error.stack) || String(error));
  process.stderr.write('\n');
  process.exitCode = 1;
});
