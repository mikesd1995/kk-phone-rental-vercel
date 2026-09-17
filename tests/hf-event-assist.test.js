'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const HF = require('../server/hf-event-assist.js');

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

test('embedding assist returns vectors but never final truth', async () => {
  const fetchImpl = async () => fakeResponse([[1,0,0],[0.98,0.1,0]]);
  const result = await HF.embedEventCandidates(
    [{name:'Event A'},{name:'Event A 2026'}],
    {env:{HF_EVENT_ASSIST_ENABLED:'true'}, token:'test-token', fetchImpl}
  );
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
