'use strict';
// Parent owns process creation only. Application imports happen in guarded leaves.
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const CHILD = path.join(__dirname, 'fixtures/line-booking-dummy-child.cjs');
const REGRESSIONS = [
  'line-webhook', 'line-webhook-raw-body', 'line-booking-inbox-tee',
  'line-booking-inbox-safety-integration', 'kk-line-inbox-tee',
  'kk-inbox-private-media', 'line-booking-initial-outbox-integration',
  'line-booking-owner-durable-outbox', 'line-booking-owner-approval-replay-failclosed'
];
function cleanEnv(os = {}) {
  const env = {LANG: 'C', TZ: 'UTC'};
  if (process.platform === 'win32' && typeof os.SystemRoot === 'string') env.SystemRoot = os.SystemRoot;
  return env;
}
function invoke(id, mode = 'scenario', os) {
  const result = spawnSync(process.execPath, ['--test-reporter=tap', CHILD, mode, id], {
    cwd: path.join(__dirname, '..'), env: cleanEnv(os || {SystemRoot: process.env.SystemRoot}),
    timeout: 30000, maxBuffer: 2 * 1024 * 1024, encoding: 'utf8', windowsHide: true
  });
  assert.ifError(result.error);
  const lines = result.stdout.split(/\r?\n/).filter(line => line.startsWith('S1_RESULT '));
  assert.equal(lines.length, 1, 'one final per-process attestation required');
  const data = JSON.parse(lines[0].slice(10));
  assert.equal(data.schemaVersion, 1);
  assert.equal(data.scenarioId, id);
  assert.equal(data.evidenceClass, 'LOCAL_MOCK');
  assert.equal(data.pendingCount, 0);
  assert.equal(data.guardsInstalled, true);
  if (mode === 'regression') {
    const totals = {};
    for (const field of ['tests','pass','fail','cancelled','skipped','todo']) {
      const match = result.stdout.match(new RegExp('^# ' + field + ' (\\d+)$', 'm'));
      assert.ok(match, 'per-leaf TAP totals required: ' + field);
      totals[field] = Number(match[1]);
    }
    assert.ok(totals.tests > 0); assert.equal(totals.pass, totals.tests);
    for (const field of ['fail','cancelled','skipped','todo']) assert.equal(totals[field], 0);
    data.testTotals = totals;
  }
  console.log('S1_EVIDENCE ' + JSON.stringify(data));
  return {result, data};
}
function successful(id, mode) {
  const {result, data} = invoke(id, mode);
  assert.equal(result.status, 0, `guarded leaf ${id}: ${JSON.stringify(data)}`);
  assert.deepEqual(data.assertionFailures, []);
  assert.equal(data.denialCount, 0);
  assert.equal(data.blockedAttemptCount, 0);
  return data;
}
test('lower-level guards reject every supported probe before I/O in a separate process', () => {
  const {result, data} = invoke('guard-proof');
  assert.equal(result.status, 0);
  assert.deepEqual(data.assertionFailures, []);
  assert.ok(data.expectedProbeCount >= 25);
  assert.equal(data.blockedAttemptCount, data.expectedProbeCount);
  assert.equal(data.denialCount, 0);
});
test('strict fixture transport rejects unknown URL/method/body, redirects and exhaustion', () => {
  const {result, data} = invoke('transport-proof');
  assert.equal(result.status, 0);
  assert.deepEqual(data.assertionFailures, []);
  assert.equal(data.expectedProbeCount, 9);
  assert.equal(data.denialCount, 9);
  assert.equal(data.caughtMalformedAttempts, 3);
  assert.equal(data.blockedAttemptCount, 0);
});
test('parent synthetic poison configuration cannot enter the literal child environment', () => {
  const poison = {SystemRoot: process.env.SystemRoot, NODE_OPTIONS: '--require=POISON',
    KK_INBOX_SUPABASE_URL: 'https://parent-poison.supabase.co',
    KK_INBOX_SUPABASE_SERVICE_ROLE_KEY: 'synthetic-parent-poison', S1_PARENT_POISON: 'synthetic'};
  assert.deepEqual(cleanEnv(poison), cleanEnv({SystemRoot: process.env.SystemRoot}));
  const {result, data} = invoke('disabled-inbox', 'scenario', poison);
  assert.equal(result.status, 0); assert.equal(data.denialCount, 0);
  assert.equal(data.inboxMode, 'DISABLED');
  for (const route of ['INBOX_PROFILE','INBOX_RPC','MEDIA_READ','MEDIA_WRITE']) assert.equal(data.counters[route] || 0, 0);
});
test('actual raw wrapper rejects bad ingress before any fixture or network I/O', () => {
  const out = successful('ingress');
  assert.deepEqual(out.statuses, [405,401,400,413,401]);
  assert.deepEqual(out.counters, {});
});
test('signed booking uses one event snapshot, canonical price and two one-time VM-backed receipts', () => {
  const out = successful('disabled-inbox');
  assert.equal(out.counters.PUBLIC_EVENTS, 2, 'one read per inbound event including replay');
  assert.equal(out.counters.PUBLIC_PACKAGES, 2);
  assert.equal(out.counters.AUTH_RECEIPT, 2);
  assert.equal(out.counters.LINE_PUSH, 1); assert.equal(out.counters.LINE_REPLY, 1);
  assert.equal(out.allocations, 1); assert.deepEqual(out.initialStates, ['SENT','SENT']);
  assert.equal(out.posterStatus, 200); assert.equal(out.posterType, 'image/png');
  assert.equal(out.counters.POSTER_EVENTS, 1); assert.equal(out.counters.POSTER_BYTES, 1);
});
test('mock inbox preserves profile/persist/media ordering and duplicate media semantics', () => {
  const out = successful('mock-inbox');
  assert.equal(out.counters.INBOX_PROFILE, 4); assert.equal(out.counters.INBOX_RPC, 4);
  assert.equal(out.counters.MEDIA_READ, 2); assert.equal(out.counters.MEDIA_WRITE, 2);
  assert.equal(out.inboxDuplicates, 2); assert.equal(out.mediaOrderingVerified, true);
  assert.equal(out.allocations, 1);
});
for (const id of ['hidden','ambiguous','unavailable','missing-consent','mismatched-consent']) {
  test(`${id} cannot allocate Pending or send initial notifications while inbox remains independent`, () => {
    const out = successful(id);
    assert.equal(out.allocations, 0);
    assert.equal(out.counters.GAS_ACTION || 0, 0);
    assert.equal(out.counters.LINE_PUSH || 0, 0); assert.equal(out.counters.LINE_REPLY || 0, 0);
    assert.equal(out.counters.INBOX_RPC, 2); assert.equal(out.counters.MEDIA_WRITE, 1);
  });
}
test('a denied profile request swallowed by the handler still fails the child with HTTP 200', () => {
  const {result, data} = invoke('swallowed-denial');
  assert.equal(result.status, 1); assert.equal(data.webhookStatus, 200);
  assert.equal(data.denialCount, 1); assert.deepEqual(data.assertionFailures, ['FIXTURE_DENIAL']);
});
for (const id of ['recovery','uncertain','claimed']) {
  test(`${id} keeps original Booking/pair/frozen hashes and never resends a claimed leg`, () => {
    const out = successful(id);
    assert.equal(out.allocations, 1); assert.equal(out.originalPairRetained, true);
    assert.equal(out.frozenHashesVerified, true);
    assert.equal(out.counters.LINE_PUSH, 1);
    if (id === 'recovery') assert.deepEqual(out.initialStates, ['SENT','SENT']);
    else {
      assert.equal(out.counters.LINE_REPLY || 0, 0);
      assert.deepEqual(out.initialStates, [id === 'claimed' ? 'CLAIMED' : 'UNCERTAIN','READY']);
    }
  });
}
for (const id of ['owner-confirm','owner-reject']) {
  test(`${id} uses a separate Booking and explicit mock decision upstream, customer first`, () => {
    const out = successful(id);
    assert.equal(out.decisionEvidence, 'NODE_CONTRACT_MOCK_UPSTREAM');
    assert.equal(out.counters.LINE_PUSH, 1); assert.equal(out.counters.LINE_REPLY, 1);
    assert.equal(out.ownerAckSeparate, true); assert.equal(out.terminalDecisionRetained, true);
  });
}
test('fresh repeats have equal safe state hashes and no module/global residue', () => {
  assert.deepEqual(successful('disabled-inbox').safeStateHashes, successful('disabled-inbox').safeStateHashes);
});
for (const id of REGRESSIONS) test(`guarded existing regression leaf: ${id}`, () => successful(id, 'regression'));
