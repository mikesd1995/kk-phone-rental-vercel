'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const HF = require('../server/hf-event-assist.js');

function assertControlledUatPushGuard(workflow) {
  const hasPush = /(?:^|\n)  push:\s*(?:\n|$)/m.test(workflow);
  if (!hasPush) return;
  assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- hf-event-assist-v1-20260918/);
  assert.match(workflow, /contains\(github\.event\.head_commit\.message, '\[RUN_HF_ZERO_WRITE_UAT\]'\)/);
}

function fakeResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => JSON.stringify(body)
  };
}

test('disabled-by-default returns zero-write skipped result', async () => {
  const result = await HF.classifyEventCandidate({name:'LYKN Concert'}, {env:{}});
  assert.equal(result.status, 'SKIPPED');
  assert.equal(result.reason, 'HF_EVENT_ASSIST_DISABLED');
  assert.equal(result.production_writes, 0);
});

test('enabled without token fails closed as skipped, not a final decision', async () => {
  const result = await HF.classifyEventCandidate({name:'LYKN Concert'}, {env:{HF_EVENT_ASSIST_ENABLED:'true'}});
  assert.equal(result.status, 'SKIPPED');
  assert.equal(result.reason, 'HF_TOKEN_MISSING');
  assert.equal(result.authoritative, false);
});

test('event classification normalizes ranking and preserves verifier authority', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({url, init});
    return fakeResponse([
      {label:'fan_meeting', score:0.12},
      {label:'concert', score:0.81},
      {label:'other', score:0.07}
    ]);
  };
  const result = await HF.classifyEventCandidate(
    {name:'LYKN Reflexion', venue:'IMPACT', source_text:'concert 23 Oct'},
    {env:{HF_EVENT_ASSIST_ENABLED:'true'}, token:'test-token', fetchImpl}
  );
  assert.equal(result.top_label, 'CONCERT');
  assert.equal(result.verifier_required, true);
  assert.equal(result.authoritative, false);
  assert.equal(result.production_writes, 0);
  assert.match(calls[0].url, /router\.huggingface\.co/);
  assert.equal(calls[0].init.headers.authorization, 'Bearer test-token');
});

test('embedding assist applies E5 query prefix and never becomes final truth', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({url, init});
    return fakeResponse([[1,0,0],[0.98,0.1,0]]);
  };
  const result = await HF.embedEventCandidates(
    [{name:'Event A'},{name:'Event A 2026'}],
    {env:{HF_EVENT_ASSIST_ENABLED:'true'}, token:'test-token', fetchImpl}
  );
  const payload = JSON.parse(calls[0].init.body);
  assert.equal(payload.inputs.every(value => value.startsWith('query: ')), true);
  assert.equal(result.vectors.length, 2);
  assert.equal(result.authoritative, false);
  assert.equal(result.production_writes, 0);
});

test('dedup assist flags only pairs above threshold', () => {
  const result = HF.duplicatePairs(
    [{candidate_id:'A'},{candidate_id:'B'},{candidate_id:'C'}],
    [[1,0],[0.99,0.01],[0,1]],
    {threshold:0.95}
  );
  assert.equal(result.pairs.length, 1);
  assert.equal(result.pairs[0].left_key, 'A');
  assert.equal(result.pairs[0].right_key, 'B');
  assert.equal(result.pairs[0].disposition, 'POSSIBLE_DUPLICATE_REQUIRES_VERIFIER');
});

test('invalid model id cannot redirect credentials to another host', () => {
  assert.throws(() => HF.endpointForModel('https://evil.example/model'), /invalid Hugging Face model id/);
});

test('remote errors do not silently become decisions', async () => {
  const fetchImpl = async () => fakeResponse({error:'model unavailable'}, 503);
  await assert.rejects(
    HF.classifyEventCandidate({name:'Event'}, {
      env:{HF_EVENT_ASSIST_ENABLED:'true'},
      token:'test-token',
      fetchImpl
    }),
    /HTTP 503/
  );
});


test('classification exposes KK-specific opportunity labels without making them authoritative', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({url, init});
    return fakeResponse([
      {label:'graduation event', score:0.82},
      {label:'artist appearance', score:0.10},
      {label:'other event', score:0.08}
    ]);
  };
  const result = await HF.classifyEventCandidate(
    {name:'Pooh Graduation Celebration 2026', venue:'Samyan Mitrtown'},
    {env:{HF_EVENT_ASSIST_ENABLED:'true'}, token:'test-token', fetchImpl}
  );
  const payload = JSON.parse(calls[0].init.body);
  assert.equal(payload.parameters.candidate_labels.includes('graduation event'), true);
  assert.equal(payload.parameters.candidate_labels.includes('brand event'), true);
  assert.equal(result.top_label, 'GRADUATION');
  assert.equal(result.confidence_band, 'HIGH');
  assert.equal(result.authoritative, false);
});

test('high semantic similarity with different exact ISO dates is not put in duplicate bucket', () => {
  const result = HF.duplicatePairs(
    [
      {candidate_id:'NONT-S1', event_date_iso:'2026-10-03', name:'NONT TANONT ARENA ENCORE'},
      {candidate_id:'NONT-S2', event_date_iso:'2026-10-04', name:'NONT TANONT ARENA ENCORE'}
    ],
    [[1,0],[0.999,0.001]],
    {threshold:0.92}
  );
  assert.equal(result.pairs.length, 0);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].conflict, 'EVENT_DATE_MISMATCH');
  assert.equal(result.conflicts[0].disposition, 'SIMILAR_BUT_DISTINCT_IDENTITY_REQUIRES_VERIFIER');
});

test('different explicit Show IDs are protected from semantic auto-dedup', () => {
  const result = HF.duplicatePairs(
    [
      {candidate_id:'SHOW-A', show_id:'SHOW|event|20261010|S1', name:'Same Event'},
      {candidate_id:'SHOW-B', show_id:'SHOW|event|20261010|S2', name:'Same Event'}
    ],
    [[1,0],[1,0]],
    {threshold:0.92}
  );
  assert.equal(result.pairs.length, 0);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].conflict, 'SHOW_ID_MISMATCH');
});

test('non-E5 custom embedding model does not receive E5 query prefix', () => {
  assert.equal(HF.embeddingInput('Example Event', 'thenlper/gte-large'), 'Example Event');
});


test('benchmark fixture is bounded, unique and uses supported labels', () => {
  const fixturePath = path.resolve(__dirname, 'fixtures/hf-event-assist-benchmark.json');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const candidates = fixture.candidates || [];
  assert.equal(candidates.length, 14);
  assert.equal(new Set(candidates.map(item => item.candidate_id)).size, candidates.length);
  for (const item of candidates) {
    if (item.expected_label) assert.equal(HF.EVENT_LABELS.includes(item.expected_label), true);
  }
  const groups = new Map();
  for (const item of candidates) {
    if (!item.duplicate_group) continue;
    groups.set(item.duplicate_group, (groups.get(item.duplicate_group) || 0) + 1);
  }
  assert.equal([...groups.values()].every(count => count >= 2), true);
});


test('redacts echoed HF credentials from remote error surfaces', async () => {
  const token = 'hf_super_secret_test_token';
  const fetchImpl = async () => fakeResponse({
    error: `Authorization failed for Bearer ${token}; token=${token}`
  }, 401);

  let caught;
  try {
    await HF.classifyEventCandidate({name:'Secret Leak Test Event'}, {
      env:{HF_EVENT_ASSIST_ENABLED:'true'},
      token,
      fetchImpl
    });
  } catch (error) {
    caught = error;
  }

  assert.ok(caught);
  const message = String(caught && caught.message || caught);
  assert.equal(message.includes(token), false);
  assert.match(message, /\[REDACTED\]/);
});

test('redactSecret removes explicit token and bearer credential text', () => {
  const token = 'hf_example_token_123';
  const value = `failure Bearer ${token} direct=${token}`;
  const redacted = HF.redactSecret(value, token);
  assert.equal(redacted.includes(token), false);
  assert.match(redacted, /\[REDACTED\]/);
});


test('manual UAT workflow stays zero-write, bounded, and explicit', () => {
  const fs = require('fs');
  const path = require('path');
  const workflow = fs.readFileSync(path.resolve(__dirname, '../.github/workflows/hf-event-assist-uat.yml'), 'utf8');

  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /RUN_HF_ZERO_WRITE_UAT/);
  assert.match(workflow, /HF_UAT_MAX_CALLS/);
  assert.match(workflow, /secrets\.HF_TOKEN/);
  assert.match(workflow, /hf-event-assist-readiness\.js/);
  assert.match(workflow, /hf-event-assist-benchmark\.js/);
  assert.match(workflow, /production_writes!==0/);
  assert.match(workflow, /final_truth_mutation!==false/);
  assert.match(workflow, /notification_sends!==0/);
  assert.doesNotMatch(workflow, /schedule:/);
  assertControlledUatPushGuard(workflow);
  assert.doesNotMatch(workflow, /pull_request:/);
});


test('controlled UAT workflow prefers short-lived OIDC credentials with secret fallback', () => {
  const fs = require('fs');
  const path = require('path');
  const workflow = fs.readFileSync(path.resolve(__dirname, '../.github/workflows/hf-event-assist-uat.yml'), 'utf8');

  assert.match(workflow, /id-token:\s*write/);
  assert.match(workflow, /HF_OIDC_RESOURCE:\s*'Mikesd1995'/);
  assert.match(workflow, /https:\/\/hf\.co\/cli\/install\.sh/);
  assert.match(workflow, /hf" auth token/);
  assert.match(workflow, /HF_OIDC_CICD_IDENTITY_MISSING_OR_MISMATCH/);
  assert.match(workflow, /HF_AUTH_MODE=HF_OIDC_CICD_IDENTITY/);
  assert.match(workflow, /HF_AUTH_MODE=GITHUB_ACTIONS_SECRET/);
  assert.match(workflow, /secrets\.HF_TOKEN/);
  assert.match(workflow, /::add-mask::/);
  assert.doesNotMatch(workflow, /schedule:/);
  assertControlledUatPushGuard(workflow);
  assert.doesNotMatch(workflow, /pull_request:/);
});


test('controlled UAT workflow contains no custom direct token-exchange implementation', () => {
  const fs = require('fs');
  const path = require('path');
  const workflow = fs.readFileSync(path.resolve(__dirname, '../.github/workflows/hf-event-assist-uat.yml'), 'utf8');

  assert.doesNotMatch(workflow, /huggingface\.co\/oauth\/token/);
  assert.doesNotMatch(workflow, /urn:ietf:params:oauth:grant-type:token-exchange/);
  assert.doesNotMatch(workflow, /ACTIONS_ID_TOKEN_REQUEST_TOKEN/);
  assert.doesNotMatch(workflow, /ACTIONS_ID_TOKEN_REQUEST_URL/);
  assert.match(workflow, /HF_TOKEN_SECRET: \$\{\{ secrets\.HF_TOKEN \}\}/);
  assert.match(workflow, /::add-mask::\$hf_token/);
});


test('default zero-shot model is multilingual and provider-task compatible', () => {
  assert.equal(HF.DEFAULT_ZERO_SHOT_MODEL, 'MoritzLaurer/bge-m3-zeroshot-v2.0');
});
