'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/kk-data');

function fakeRes({rejectNonAsciiHeaders = false} = {}) {
  let body = '';
  const headers = {};
  return {
    statusCode: 200,
    headers,
    setHeader(key, value) {
      const text = String(value);
      if (rejectNonAsciiHeaders && /[^\x20-\x7E]/.test(text)) {
        throw new TypeError('invalid header content');
      }
      headers[String(key).toLowerCase()] = text;
    },
    end(value) { body = String(value == null ? '' : value); },
    get body() { return body; },
  };
}

function withEnv(patch, fn) {
  const before = {};
  for (const key of Object.keys(patch)) {
    before[key] = process.env[key];
    const value = patch[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return Promise.resolve().then(fn).finally(() => {
    for (const key of Object.keys(patch)) {
      if (before[key] === undefined) delete process.env[key];
      else process.env[key] = before[key];
    }
  });
}

function withoutPrivateCredentials(extra = {}) {
  return Object.assign({
    GOOGLE_SERVICE_ACCOUNT_EMAIL: undefined,
    GOOGLE_CLIENT_EMAIL: undefined,
    GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: undefined,
    GOOGLE_PRIVATE_KEY: undefined,
    GOOGLE_SERVICE_ACCOUNT_JSON: undefined,
  }, extra);
}

test('public-data proxy emits HTTP-safe ASCII headers and no Sheet ID header', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => 'event_id,poster_image_url,action_for_web\nE1,https://example.test/p.jpg,show',
  });
  try {
    await withEnv(withoutPrivateCredentials({
      GOOGLE_SHEET_ID: 'sheet-test-123',
      KK_PUBLIC_SHEET_REQUIRE_PRIVATE: undefined,
    }), async () => {
      const req = {method: 'GET', query: {sheet: '08_Web_Ready', range: 'A4:K'}};
      const res = fakeRes({rejectNonAsciiHeaders: true});
      await handler(req, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.headers['x-kk-sheet-id'], undefined);
      assert.equal(res.headers['x-kk-sheet-source'], 'public-gviz-fallback');
      assert.match(res.body, /event_id/);
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('strict private mode fails closed before attempting public GViz when credentials are missing', async () => {
  const originalFetch = global.fetch;
  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls++;
    throw new Error('public fallback must not run');
  };
  try {
    await withEnv(withoutPrivateCredentials({
      GOOGLE_SHEET_ID: 'sheet-test-123',
      KK_PUBLIC_SHEET_REQUIRE_PRIVATE: '1',
    }), async () => {
      const req = {method: 'GET', query: {sheet: '08_Web_Ready', range: 'A4:K'}};
      const res = fakeRes({rejectNonAsciiHeaders: true});
      await handler(req, res);
      assert.equal(res.statusCode, 503);
      assert.equal(res.headers['x-kk-sheet-source'], 'private-not-configured');
      assert.equal(fetchCalls, 0);
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test('allowlist rejects unexpected Sheet ranges', async () => {
  await withEnv(withoutPrivateCredentials({GOOGLE_SHEET_ID: 'sheet-test-123'}), async () => {
    const req = {method: 'GET', query: {sheet: '00_Master_Booking', range: 'A:Z'}};
    const res = fakeRes({rejectNonAsciiHeaders: true});
    await handler(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body, 'Sheet/range not allowed');
  });
});


test('public-data allowlist blocks internal package templates and event override tables', async () => {
  await withEnv(withoutPrivateCredentials({GOOGLE_SHEET_ID: 'sheet-test-123'}), async () => {
    for (const query of [
      {sheet: '03_Packages', range: 'A4:J'},
      {sheet: '04_Event_Overrides', range: 'A4:G'},
    ]) {
      const res = fakeRes({rejectNonAsciiHeaders: true});
      await handler({method: 'GET', query}, res);
      assert.equal(res.statusCode, 400);
      assert.equal(res.body, 'Sheet/range not allowed');
    }
  });
});

test('public package feed drops rows that have prices but no package identity', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => [
      'package_id,event_id,package_type,model_group,model_display,lens_group,lens_display,price,available_count,package_status,sort_order,package_note,raw_available_count,use_case',
      'PKG-1,EVT-1,phone_only,VIVO_X300_PRO,Vivo X300 Pro,NONE,,890,2,available,10,,2,',
      ',,,,,,,1290,,,,,,',
    ].join('\n'),
  });
  try {
    await withEnv(withoutPrivateCredentials({
      GOOGLE_SHEET_ID: 'sheet-test-123',
      KK_PUBLIC_SHEET_REQUIRE_PRIVATE: undefined,
    }), async () => {
      const req = {method: 'GET', query: {sheet: '09_Web_Packages', range: 'A4:N'}};
      const res = fakeRes({rejectNonAsciiHeaders: true});
      await handler(req, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.headers['x-kk-public-rows-dropped'], '1');
      assert.match(res.body, /PKG-1,EVT-1,phone_only/);
      assert.doesNotMatch(res.body, /1290/);
    });
  } finally {
    global.fetch = originalFetch;
  }
});
