#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const HF = require('../server/hf-event-assist.js');

const fixturePath = path.resolve(__dirname, '../tests/fixtures/hf-event-assist-benchmark.json');
const DEFAULT_MAX_LIVE_CALLS = 20;

function boundedPositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 100 ? n : fallback;
}

function main() {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const candidates = fixture.candidates || [];
  const enabled = HF.isEnabled(process.env);
  const token = String(process.env.HF_TOKEN || '').trim();
  const tokenPresent = Boolean(token);
  const maxLiveCalls = boundedPositiveInt(process.env.HF_UAT_MAX_CALLS, DEFAULT_MAX_LIVE_CALLS);
  const plannedLiveCalls = candidates.length + 1;
  const zeroShotModel = process.env.HF_ZERO_SHOT_MODEL || HF.DEFAULT_ZERO_SHOT_MODEL;
  const embeddingModel = process.env.HF_EMBED_MODEL || HF.DEFAULT_EMBED_MODEL;

  const blockers = [];
  if (!enabled) blockers.push('HF_EVENT_ASSIST_DISABLED');
  if (!tokenPresent) blockers.push('HF_TOKEN_MISSING');
  if (plannedLiveCalls > maxLiveCalls) blockers.push('PLANNED_CALLS_EXCEED_HF_UAT_MAX_CALLS');

  let modelConfigValid = true;
  try {
    HF.endpointForModel(zeroShotModel);
    HF.endpointForModel(embeddingModel);
  } catch (_) {
    modelConfigValid = false;
    blockers.push('INVALID_MODEL_ID');
  }

  const report = {
    generated_by: 'kk-hf-event-assist-readiness-v1',
    fixture_version: fixture.version,
    candidate_count: candidates.length,
    planned_live_calls: plannedLiveCalls,
    max_live_calls: maxLiveCalls,
    hf_enabled: enabled,
    hf_token_present: tokenPresent,
    model_config_valid: modelConfigValid,
    models: {
      zero_shot: zeroShotModel,
      embedding: embeddingModel
    },
    network_calls: 0,
    production_writes: 0,
    final_truth_mutation: false,
    notification_sends: 0,
    blockers,
    status: blockers.length ? 'BLOCKED' : 'READY_FOR_LIVE_UAT',
    next_action: blockers.length
      ? 'RESOLVE_BLOCKERS_WITHOUT_COMMITTING_OR_LOGGING_SECRETS'
      : 'RUN_NPM_HF_ASSIST_BENCHMARK_IN_CONTROLLED_ENVIRONMENT'
  };

  const serialized = JSON.stringify(report, null, 2);
  if (token && serialized.includes(token)) throw new Error('SECRET_LEAK_GUARD_TRIGGERED');
  process.stdout.write(serialized + '\n');
}

try {
  main();
} catch (error) {
  process.stderr.write(HF.redactSecret((error && error.stack) || String(error), process.env.HF_TOKEN || ''));
  process.stderr.write('\n');
  process.exitCode = 1;
}
