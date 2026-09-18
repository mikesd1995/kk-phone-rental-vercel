'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Adapter = require('../server/hf-scanner-adapter.js');

function fakeResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => JSON.stringify(body)
  };
}

function baseInput(overrides = {}) {
  const runId = 'SCV415-20260918T100000-ADAPTER';
  return {
    run_id: runId,
    candidate: {
      candidate_id: 'CAND-ADAPTER-001',
      name: 'LYKN Reflexion Concert',
      venue: 'IMPACT',
      event_date_iso: '2026-10-23'
    },
    active_policies: [{active:true, policy_version:'v4.9.15'}],
    pre_acquire_conflicting_writers: [],
    core_locks: [{
      scope:'CORE_SHARED_WRITER',
      run_id:runId,
      status:'HELD',
      fencing_token:'301'
    }],
    scanner_locks: [{
      scope:'SCANNER',
      run_id:runId,
      status:'HELD',
      fencing_token:'302'
    }],
    post_acquire_writer_recheck: true,
    post_acquire_conflicting_writers: [],
    manifests: [{
      run_id:runId,
      role:'SCANNER',
      frozen_at:'2026-09-18T10:00:03+07:00',
      policy_version:'v4.9.15',
      fencing_token:'302'
    }],
    planner_items: [{
      run_id:runId,
      authorized:true,
      work_item_id:'PLAN-ADAPTER-001'
    }],
    ...overrides
  };
}

test('disabled adapter never reaches HF fetch even when token and fetch are supplied', async () => {
  let fetchCalls = 0;
  const result = await Adapter.classifyScannerCandidate(baseInput(), {
    env:{HF_EVENT_ASSIST_ENABLED:'false'},
    token:'test-token',
    fetchImpl:async () => {
      fetchCalls++;
      return fakeResponse([]);
    }
  });

  assert.equal(result.status, 'SKIPPED');
  assert.equal(fetchCalls, 0);
  assert.equal(result.hf_call_count, 0);
  assert.equal(result.production_writes, 0);
});

test('failed Scanner gate prevents network call even when HF feature is enabled', async () => {
  let fetchCalls = 0;
  const input = baseInput({
    post_acquire_conflicting_writers:[{run_id:'RACE'}]
  });
  const result = await Adapter.classifyScannerCandidate(input, {
    env:{HF_EVENT_ASSIST_ENABLED:'true'},
    token:'test-token',
    fetchImpl:async () => {
      fetchCalls++;
      return fakeResponse([]);
    }
  });

  assert.equal(result.status, 'BLOCKED');
  assert.equal(fetchCalls, 0);
  assert.equal(result.preflight.external_hf_access_allowed, false);
});

test('valid Scanner gates compose HF classification into nonauthoritative verifier handoff', async () => {
  let fetchCalls = 0;
  let capturedPayload = null;

  const result = await Adapter.classifyScannerCandidate(baseInput(), {
    env:{HF_EVENT_ASSIST_ENABLED:'true'},
    token:'test-token',
    fetchImpl:async (_url, init) => {
      fetchCalls++;
      capturedPayload = JSON.parse(init.body);
      return fakeResponse([
        {label:'concert', score:0.88},
        {label:'fan meeting', score:0.08},
        {label:'other event', score:0.04}
      ]);
    }
  });

  assert.equal(fetchCalls, 1);
  assert.equal(result.status, 'ADVISORY_HANDOFF_PREPARED');
  assert.equal(result.hf_call_count, 1);
  assert.equal(result.handoff.handoff_state, 'READY_FOR_VERIFIER');
  assert.equal(result.handoff.hf_assist.task, 'ZERO_SHOT_EVENT_CLASSIFICATION');
  assert.equal(result.handoff.hf_assist.summary.top_label, 'CONCERT');
  assert.equal(result.handoff.authoritative, false);
  assert.equal(result.handoff.verifier_required, true);
  assert.equal(result.handoff.production_writes, 0);
  assert.equal(capturedPayload.parameters.candidate_labels.includes('concert'), true);
  assert.equal(capturedPayload.parameters.candidate_labels.includes('graduation event'), true);
});

test('provider failure returns no advisory handoff and no fabricated Scanner decision', async () => {
  let fetchCalls = 0;

  const result = await Adapter.classifyScannerCandidate(baseInput(), {
    env:{HF_EVENT_ASSIST_ENABLED:'true'},
    token:'test-token',
    fetchImpl:async () => {
      fetchCalls++;
      return fakeResponse({error:'provider unavailable'}, 503);
    }
  });

  assert.equal(fetchCalls, 1);
  assert.equal(result.status, 'HF_ASSIST_UNAVAILABLE_NONAUTHORITATIVE');
  assert.equal(result.handoff, null);
  assert.equal(result.authoritative, false);
  assert.equal(result.production_writes, 0);
  assert.equal(result.final_truth_mutation, false);
  assert.equal(result.notification_sends, 0);
});


test('staged Scanner HF adapter is not imported by production entrypoints', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.resolve(__dirname, '..');
  const files = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.js')) files.push(full);
    }
  }

  walk(path.join(root, 'api'));
  walk(path.join(root, 'admin'));
  files.push(path.join(root, 'script.js'));

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    assert.equal(
      source.includes('hf-scanner-adapter'),
      false,
      `production entrypoint imports staged HF Scanner adapter: ${path.relative(root, file)}`
    );
  }
});
