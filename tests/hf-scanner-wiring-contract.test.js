'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Wiring = require('../server/hf-scanner-wiring-contract.js');

function baseInput(overrides = {}) {
  const runId = 'SCV415-20260918T090000-UAT';
  return {
    run_id: runId,
    candidate: {
      candidate_id: 'CAND-001',
      name: 'LYKN Concert',
      event_date_iso: '2026-10-23'
    },
    active_policies: [
      { active: true, policy_version: 'v4.9.15' }
    ],
    pre_acquire_conflicting_writers: [],
    core_locks: [
      {
        scope: 'CORE_SHARED_WRITER',
        run_id: runId,
        status: 'HELD',
        fencing_token: '101'
      }
    ],
    scanner_locks: [
      {
        scope: 'SCANNER',
        run_id: runId,
        status: 'HELD',
        fencing_token: '202'
      }
    ],
    post_acquire_writer_recheck: true,
    post_acquire_conflicting_writers: [],
    manifests: [
      {
        run_id: runId,
        role: 'SCANNER',
        frozen_at: '2026-09-18T09:00:05+07:00',
        policy_version: 'v4.9.15',
        fencing_token: '202'
      }
    ],
    planner_items: [
      {
        run_id: runId,
        authorized: true,
        work_item_id: 'PLAN-001'
      }
    ],
    ...overrides
  };
}

function envEnabled() {
  return { HF_EVENT_ASSIST_ENABLED: 'true' };
}

function assistedClassification(overrides = {}) {
  return {
    status: 'ASSISTED',
    task: 'ZERO_SHOT_EVENT_CLASSIFICATION',
    model: 'MoritzLaurer/bge-m3-zeroshot-v2.0',
    top_label: 'CONCERT',
    top_score: 0.91,
    confidence_band: 'HIGH',
    authoritative: false,
    verifier_required: true,
    production_writes: 0,
    ...overrides
  };
}

test('HF Scanner wiring is disabled by default and performs zero external calls', async () => {
  let calls = 0;
  const result = await Wiring.runGuardedScannerHfAssist(baseInput(), {
    env: {},
    assistFn: async () => { calls++; return assistedClassification(); }
  });

  assert.equal(result.status, 'SKIPPED');
  assert.equal(result.preflight.external_hf_access_allowed, false);
  assert.equal(result.preflight.blockers.includes('HF_EVENT_ASSIST_DISABLED'), true);
  assert.equal(result.hf_call_attempted, false);
  assert.equal(result.hf_call_count, 0);
  assert.equal(calls, 0);
  assert.equal(result.production_writes, 0);
});

test('active policy must be exact1 before HF external access', async () => {
  let calls = 0;
  const input = baseInput({
    active_policies: [
      {active:true, policy_version:'v4.9.15'},
      {active:true, policy_version:'v4.9.16'}
    ]
  });
  const result = await Wiring.runGuardedScannerHfAssist(input, {
    env: envEnabled(),
    assistFn: async () => { calls++; return assistedClassification(); }
  });

  assert.equal(result.status, 'BLOCKED');
  assert.match(result.preflight.blockers.join('|'), /ACTIVE_POLICY_NOT_EXACT1:2/);
  assert.equal(calls, 0);
});

test('pre-acquire conflicting writer blocks HF before any call', async () => {
  let calls = 0;
  const input = baseInput({
    pre_acquire_conflicting_writers: [{run_id:'OTHER'}]
  });
  const result = await Wiring.runGuardedScannerHfAssist(input, {
    env: envEnabled(),
    assistFn: async () => { calls++; return assistedClassification(); }
  });

  assert.match(result.preflight.blockers.join('|'), /PRE_ACQUIRE_WRITER_CONFLICT:1/);
  assert.equal(result.hf_call_attempted, false);
  assert.equal(calls, 0);
});

test('CORE shared writer must be exact1 with held status and fencing token', async () => {
  let calls = 0;
  const input = baseInput({ core_locks: [] });
  const result = await Wiring.runGuardedScannerHfAssist(input, {
    env: envEnabled(),
    assistFn: async () => { calls++; return assistedClassification(); }
  });

  assert.match(result.preflight.blockers.join('|'), /CORE_SHARED_WRITER_NOT_EXACT1:0/);
  assert.equal(calls, 0);
});

test('Scanner role lock must be exact1', async () => {
  let calls = 0;
  const input = baseInput({ scanner_locks: [] });
  const result = await Wiring.runGuardedScannerHfAssist(input, {
    env: envEnabled(),
    assistFn: async () => { calls++; return assistedClassification(); }
  });

  assert.match(result.preflight.blockers.join('|'), /SCANNER_ROLE_LOCK_NOT_EXACT1:0/);
  assert.equal(calls, 0);
});

test('post-acquire writer recheck is mandatory', async () => {
  let calls = 0;
  const input = baseInput({ post_acquire_writer_recheck: false });
  const result = await Wiring.runGuardedScannerHfAssist(input, {
    env: envEnabled(),
    assistFn: async () => { calls++; return assistedClassification(); }
  });

  assert.equal(result.preflight.blockers.includes('POST_ACQUIRE_WRITER_RECHECK_MISSING'), true);
  assert.equal(calls, 0);
});

test('new writer appearing after lock acquisition blocks HF access', async () => {
  let calls = 0;
  const input = baseInput({
    post_acquire_conflicting_writers: [{run_id:'RACE-WRITER'}]
  });
  const result = await Wiring.runGuardedScannerHfAssist(input, {
    env: envEnabled(),
    assistFn: async () => { calls++; return assistedClassification(); }
  });

  assert.match(result.preflight.blockers.join('|'), /POST_ACQUIRE_WRITER_CONFLICT:1/);
  assert.equal(calls, 0);
});

test('Scanner Manifest must be frozen and policy-aligned', async () => {
  let calls = 0;
  const input = baseInput({
    manifests: [{
      run_id:'SCV415-20260918T090000-UAT',
      role:'SCANNER',
      frozen_at:'',
      policy_version:'v4.9.14',
      fencing_token:'202'
    }]
  });
  const result = await Wiring.runGuardedScannerHfAssist(input, {
    env: envEnabled(),
    assistFn: async () => { calls++; return assistedClassification(); }
  });

  assert.equal(result.preflight.blockers.includes('SCANNER_MANIFEST_NOT_FROZEN'), true);
  assert.equal(result.preflight.blockers.includes('SCANNER_MANIFEST_POLICY_MISMATCH'), true);
  assert.equal(calls, 0);
});

test('Scanner Manifest fencing token must match Scanner role lock', async () => {
  let calls = 0;
  const input = baseInput({
    manifests: [{
      run_id:'SCV415-20260918T090000-UAT',
      role:'SCANNER',
      frozen_at:'2026-09-18T09:00:05+07:00',
      policy_version:'v4.9.15',
      fencing_token:'999'
    }]
  });
  const result = await Wiring.runGuardedScannerHfAssist(input, {
    env: envEnabled(),
    assistFn: async () => { calls++; return assistedClassification(); }
  });

  assert.equal(result.preflight.blockers.includes('SCANNER_MANIFEST_FENCE_MISMATCH'), true);
  assert.equal(calls, 0);
});

test('Planner must have exactly one authorized work item', async () => {
  let calls = 0;
  const input = baseInput({ planner_items: [] });
  const result = await Wiring.runGuardedScannerHfAssist(input, {
    env: envEnabled(),
    assistFn: async () => { calls++; return assistedClassification(); }
  });

  const blockers = result.preflight.blockers.join('|');
  assert.match(blockers, /SCANNER_PLANNER_ITEM_NOT_EXACT1:0/);
  assert.match(blockers, /SCANNER_PLANNER_AUTHORIZED_NOT_EXACT1:0/);
  assert.equal(calls, 0);
});

test('duplicate Planner items fail closed before external access', async () => {
  let calls = 0;
  const runId='SCV415-20260918T090000-UAT';
  const input = baseInput({
    planner_items: [
      {run_id:runId, authorized:true, work_item_id:'P1'},
      {run_id:runId, authorized:true, work_item_id:'P2'}
    ]
  });
  const result = await Wiring.runGuardedScannerHfAssist(input, {
    env: envEnabled(),
    assistFn: async () => { calls++; return assistedClassification(); }
  });

  assert.match(result.preflight.blockers.join('|'), /SCANNER_PLANNER_ITEM_NOT_EXACT1:2/);
  assert.equal(calls, 0);
});

test('missing candidate identity blocks HF access', async () => {
  let calls = 0;
  const input = baseInput({ candidate: { name:'Unnamed Candidate' } });
  const result = await Wiring.runGuardedScannerHfAssist(input, {
    env: envEnabled(),
    assistFn: async () => { calls++; return assistedClassification(); }
  });

  assert.equal(result.preflight.blockers.includes('CANDIDATE_ID_MISSING'), true);
  assert.equal(calls, 0);
});

test('successful preflight permits exactly one advisory assist call', async () => {
  let calls = 0;
  const result = await Wiring.runGuardedScannerHfAssist(baseInput(), {
    env: envEnabled(),
    assistFn: async () => {
      calls++;
      return assistedClassification();
    }
  });

  assert.equal(result.status, 'ADVISORY_HANDOFF_PREPARED');
  assert.equal(result.preflight.external_hf_access_allowed, true);
  assert.equal(result.hf_call_attempted, true);
  assert.equal(result.hf_call_count, 1);
  assert.equal(calls, 1);
  assert.equal(result.handoff.handoff_state, 'READY_FOR_VERIFIER');
  assert.equal(result.handoff.route, 'EXISTING_SCANNER_TO_VERIFIER_HANDOFF');
  assert.equal(result.handoff.authoritative, false);
  assert.equal(result.handoff.verifier_required, true);
  assert.equal(result.handoff.production_writes, 0);
  assert.equal(result.handoff.direct_business_write_allowed, false);
  assert.equal(result.handoff.direct_notification_allowed, false);
});

test('authoritative HF result is rejected and never becomes a handoff', async () => {
  const result = await Wiring.runGuardedScannerHfAssist(baseInput(), {
    env: envEnabled(),
    assistFn: async () => assistedClassification({authoritative:true})
  });

  assert.equal(result.status, 'HF_ASSIST_RESULT_REJECTED');
  assert.equal(result.handoff, null);
  assert.equal(result.blockers.includes('HF_RESULT_MUST_BE_NONAUTHORITATIVE'), true);
  assert.equal(result.production_writes, 0);
});

test('HF result with production writes is rejected', async () => {
  const result = await Wiring.runGuardedScannerHfAssist(baseInput(), {
    env: envEnabled(),
    assistFn: async () => assistedClassification({production_writes:1})
  });

  assert.equal(result.status, 'HF_ASSIST_RESULT_REJECTED');
  assert.equal(result.handoff, null);
  assert.equal(result.blockers.includes('HF_RESULT_PRODUCTION_WRITES_NONZERO'), true);
});

test('HF result cannot smuggle final authority fields', async () => {
  const result = await Wiring.runGuardedScannerHfAssist(baseInput(), {
    env: envEnabled(),
    assistFn: async () => assistedClassification({verified:true})
  });

  assert.equal(result.status, 'HF_ASSIST_RESULT_REJECTED');
  assert.equal(result.handoff, null);
  assert.equal(result.blockers.includes('HF_RESULT_FORBIDDEN_AUTHORITY_FIELD:verified'), true);
});

test('HF timeout or provider error yields no fabricated decision or handoff', async () => {
  const result = await Wiring.runGuardedScannerHfAssist(baseInput(), {
    env: envEnabled(),
    assistFn: async () => {
      const error = new Error('provider timeout');
      error.code = 'ETIMEDOUT';
      throw error;
    }
  });

  assert.equal(result.status, 'HF_ASSIST_UNAVAILABLE_NONAUTHORITATIVE');
  assert.equal(result.hf_call_attempted, true);
  assert.equal(result.hf_call_count, 1);
  assert.equal(result.handoff, null);
  assert.equal(result.authoritative, false);
  assert.equal(result.production_writes, 0);
  assert.equal(result.final_truth_mutation, false);
  assert.equal(result.notification_sends, 0);
});

test('advisory handoff summarizes embedding output without copying vectors', async () => {
  const result = await Wiring.runGuardedScannerHfAssist(baseInput(), {
    env: envEnabled(),
    assistFn: async () => ({
      status:'ASSISTED',
      task:'EVENT_EMBEDDING',
      model:'intfloat/multilingual-e5-large',
      vectors:[[1,0,0]],
      authoritative:false,
      verifier_required:true,
      production_writes:0
    })
  });

  assert.equal(result.status, 'ADVISORY_HANDOFF_PREPARED');
  assert.deepEqual(result.handoff.hf_assist.summary, {
    vector_count:1,
    vector_dimension:3
  });
  assert.equal(Object.prototype.hasOwnProperty.call(result.handoff.hf_assist, 'vectors'), false);
});

test('advisory handoff summarizes dedup output and preserves verifier authority', async () => {
  const result = await Wiring.runGuardedScannerHfAssist(baseInput(), {
    env: envEnabled(),
    assistFn: async () => ({
      status:'ASSISTED',
      task:'EVENT_DEDUP_ASSIST',
      model:'intfloat/multilingual-e5-large',
      threshold:0.92,
      pairs:[{left_key:'A',right_key:'B'}],
      conflicts:[{conflict:'SHOW_ID_MISMATCH'}],
      authoritative:false,
      verifier_required:true,
      production_writes:0
    })
  });

  assert.equal(result.status, 'ADVISORY_HANDOFF_PREPARED');
  assert.deepEqual(result.handoff.hf_assist.summary, {
    pair_count:1,
    identity_conflict_count:1,
    threshold:0.92
  });
  assert.equal(result.handoff.verifier_required, true);
});

test('pure Scanner wiring contract never exposes a direct business-write target', async () => {
  const result = await Wiring.runGuardedScannerHfAssist(baseInput(), {
    env: envEnabled(),
    assistFn: async () => assistedClassification()
  });
  const serialized = JSON.stringify(result.handoff);
  for (const forbidden of ['_Monthly','_Price_Evidence','_Notification_Ledger','BOOKING_WRITE','INVENTORY_WRITE']) {
    assert.equal(serialized.includes(forbidden), false);
  }
  assert.equal(result.handoff.route, 'EXISTING_SCANNER_TO_VERIFIER_HANDOFF');
});
