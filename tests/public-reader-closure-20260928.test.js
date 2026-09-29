'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/kk-data');
const privateSheets = require('../api/lib/private-google-sheets');

function response() {
  return {
    statusCode: 200, headers: {}, body: '',
    setHeader(key, value) { this.headers[key.toLowerCase()] = value; },
    end(body) { this.body = body; },
  };
}

test('public allowlist rejects inherited object names without any upstream read', async t => {
  let upstreamReads = 0;
  t.mock.method(global, 'fetch', async () => { upstreamReads++; throw new Error('unexpected upstream'); });
  for (const sheet of ['toString', '__proto__', 'constructor', 'hasOwnProperty', 'valueOf']) {
    const res = response();
    await handler({method: 'GET', url: `/api/kk-data?sheet=${sheet}&range=A4%3AK`}, res);
    assert.equal(res.statusCode, 400, sheet);
    assert.equal(res.body, 'Sheet/range not allowed');
  }
  assert.equal(upstreamReads, 0);
});

test('ambiguous and array query parameters cannot reach an upstream reader', async t => {
  let upstreamReads = 0;
  t.mock.method(global, 'fetch', async () => { upstreamReads++; throw new Error('unexpected upstream'); });
  for (const req of [
    {url: '/api/kk-data?sheet=08_Web_Ready&sheet=00_Master_Booking&range=A4%3AK', query: {sheet: '08_Web_Ready', range: 'A4:K'}},
    {url: '/api/kk-data?sheet=08_Web_Ready&range=A4%3AK&range=A%3AZ'},
    {query: {sheet: ['08_Web_Ready'], range: 'A4:K'}},
  ]) {
    const res = response();
    await handler({method: 'GET', ...req}, res);
    assert.equal(res.statusCode, 400);
  }
  assert.equal(upstreamReads, 0);
});

test('empty authenticated result never falls back to anonymous GViz, including strict mode', async t => {
  const before = process.env.KK_PUBLIC_SHEET_REQUIRE_PRIVATE;
  t.after(() => {
    if (before === undefined) delete process.env.KK_PUBLIC_SHEET_REQUIRE_PRIVATE;
    else process.env.KK_PUBLIC_SHEET_REQUIRE_PRIVATE = before;
  });
  t.mock.method(privateSheets, 'credentialsFromEnv', () => ({email: 'fixture@example.invalid', privateKey: 'test boundary only'}));
  let privateReads = 0;
  t.mock.method(privateSheets, 'readValuesCsv', async () => { privateReads++; return ''; });
  let publicReads = 0;
  t.mock.method(global, 'fetch', async () => {
    publicReads++;
    return {ok: true, text: async () => 'event_id,poster_image_url,action_for_web\nEVT-20990101-TEST,,show'};
  });
  for (const strict of ['1', '0']) {
    process.env.KK_PUBLIC_SHEET_REQUIRE_PRIVATE = strict;
    const res = response();
    await handler({method: 'GET', url: '/api/kk-data?sheet=08_Web_Ready&range=A4%3AK'}, res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.headers['x-kk-sheet-source'], 'private-service-account');
    assert.match(res.body, /invalid public-data schema/);
  }
  assert.equal(privateReads, 2);
  assert.equal(publicReads, 0);
});

test('valid authenticated derived feed remains available and retains safe customer copy', async t => {
  t.mock.method(privateSheets, 'credentialsFromEnv', () => ({email: 'fixture@example.invalid', privateKey: 'test boundary only'}));
  t.mock.method(privateSheets, 'readValuesCsv', async () => [
    'event_id,event_name,event_date_text,poster_image_url,event_note,action_for_web',
    'EVT-20990101-TEST,Future Show,01/01/2099,,ข้อความสำหรับลูกค้า,show',
  ].join('\n'));
  t.mock.method(global, 'fetch', async () => { throw new Error('anonymous read is forbidden'); });
  const res = response();
  await handler({method: 'GET', url: '/api/kk-data?sheet=08_Web_Ready&range=A4%3AK'}, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers['x-kk-sheet-source'], 'private-service-account');
  assert.match(res.body, /ข้อความสำหรับลูกค้า/);
});
