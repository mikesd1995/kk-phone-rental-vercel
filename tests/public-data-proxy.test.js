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


test('public text boundary strips operational tokens from package and event notes', () => {
  const samples = [
    'WEEKDAY_FALLBACK_HIGH_FANDOM_2026-09-28',
    'OWNER_PRICE_ADJUST_2026-09-28_BIG_EVENT_COLLISION',
    'EXACT_EVENT_COMPETITOR_690_2026-09-28',
    'PROVISIONAL_MARKET_BENCHMARK_2026-09-28',
    'PROVISIONAL_BIG_EVENT_COLLISION_2026-09-28',
    'WEEKDAY_FANDOM_TIER_2026-09-28',
  ];

  const packageCsv = [
    'package_id,event_id,package_type,model_group,model_display,lens_group,lens_display,price,available_count,package_status,sort_order,web_note,raw_available_count,use_case',
    ...samples.map((token, index) => `PKG-${index},EVT-1,phone_only,VIVO_X300_PRO,Vivo X300 Pro,NONE,,790,2,available,${index + 1},${token},2,`),
    'PKG-SAFE,EVT-1,phone_only,VIVO_X300_PRO,Vivo X300 Pro,NONE,,790,2,available,99,เหมาะกับถ่ายเวทีไกล ซูมชัด,2,เก็บช็อตศิลปินชัดขึ้น',
  ].join('\n');

  const cleanedPackages = handler._test.sanitizePublicCsv('09_Web_Packages', packageCsv);
  assert.equal(cleanedPackages.redacted, samples.length);
  for (const token of samples) assert.doesNotMatch(cleanedPackages.text, new RegExp(token));
  assert.match(cleanedPackages.text, /เหมาะกับถ่ายเวทีไกล ซูมชัด/);
  assert.match(cleanedPackages.text, /เก็บช็อตศิลปินชัดขึ้น/);

  const eventCsv = [
    'event_id,event_name,event_date_text,venue,poster_image_url,event_note,available_phone_count,available_lens_count,booking_status_for_web,action_for_web,line_message_template',
    'EVT-1,Event,04/10/2026,Siam Paragon,,OWNER_PRICE_ADJUST_2026-09-28_BIG_EVENT_COLLISION,2,2,เปิดจอง,show,ข้อความจองสำหรับลูกค้า',
  ].join('\n');
  const cleanedEvents = handler._test.sanitizePublicCsv('08_Web_Ready', eventCsv);
  assert.equal(cleanedEvents.redacted, 1);
  assert.doesNotMatch(cleanedEvents.text, /OWNER_PRICE_ADJUST/);
  assert.match(cleanedEvents.text, /ข้อความจองสำหรับลูกค้า/);
});

test('public-data response reports redacted customer-facing fields', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    text: async () => [
      'package_id,event_id,package_type,model_group,model_display,lens_group,lens_display,price,available_count,package_status,sort_order,web_note,raw_available_count,use_case',
      'PKG-1,EVT-1,phone_only,VIVO_X300_PRO,Vivo X300 Pro,NONE,,790,2,available,10,OWNER_PRICE_ADJUST_2026-09-28_BIG_EVENT_COLLISION,2,',
    ].join('\n'),
  });
  try {
    await withEnv(withoutPrivateCredentials({
      GOOGLE_SHEET_ID: 'sheet-test-123',
      KK_PUBLIC_SHEET_REQUIRE_PRIVATE: undefined,
    }), async () => {
      const res = fakeRes({rejectNonAsciiHeaders: true});
      await handler({method: 'GET', query: {sheet: '09_Web_Packages', range: 'A4:N'}}, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.headers['x-kk-public-fields-redacted'], '1');
      assert.doesNotMatch(res.body, /OWNER_PRICE_ADJUST/);
      assert.match(res.body, /PKG-1,EVT-1,phone_only/);
    });
  } finally {
    global.fetch = originalFetch;
  }
});


test('Vercel edge config does not cache live public inventory/pricing feed', () => {
  const fs = require('node:fs');
  const config = JSON.parse(fs.readFileSync(require.resolve('../vercel.json'), 'utf8'));
  const route = config.headers.find(item => item.source === '/api/kk-data');
  assert.ok(route, 'missing /api/kk-data cache policy');
  const cache = route.headers.find(item => String(item.key).toLowerCase() === 'cache-control');
  assert.ok(cache, 'missing Cache-Control for /api/kk-data');
  assert.match(cache.value, /no-store/i);
  assert.doesNotMatch(cache.value, /s-maxage|stale-while-revalidate/i);
});


test('public text boundary strips pipe-delimited operational annotations', () => {
  const packageCsv = [
    'package_id,event_id,package_type,model_group,model_display,lens_group,lens_display,price,available_count,package_status,sort_order,web_note,raw_available_count,use_case',
    'PKG-PIPE,EVT-PIPE,phone_only,VIVO_X300_PRO,Vivo X300 Pro,NONE,,890,2,available,10,OWNER_APPROVED_RENTAL_FIT_FALLBACK|PROVISIONAL_NEEDS_PRICE_RECHECK|NOVEMBER_V4_20260929,2,',
  ].join('\n');

  const cleaned = handler._test.sanitizePublicCsv('09_Web_Packages', packageCsv);
  assert.equal(cleaned.redacted, 1);
  assert.doesNotMatch(cleaned.text, /OWNER_APPROVED_RENTAL_FIT_FALLBACK/);
  assert.doesNotMatch(cleaned.text, /PROVISIONAL_NEEDS_PRICE_RECHECK/);
  assert.doesNotMatch(cleaned.text, /NOVEMBER_V4_20260929/);
  assert.match(cleaned.text, /PKG-PIPE,EVT-PIPE,phone_only/);
});


test('public data fails closed when public and private reader Sheet IDs conflict', async () => {
  await withEnv(withoutPrivateCredentials({
    GOOGLE_SHEET_ID:'sheet-public',
    KK_CRM_SHEET_ID:'sheet-private',
    KK_PUBLIC_SHEET_REQUIRE_PRIVATE:undefined,
  }), async () => {
    const res=fakeRes({rejectNonAsciiHeaders:true});
    await handler({method:'GET',query:{sheet:'08_Web_Ready',range:'A4:K'}},res);
    assert.equal(res.statusCode,503);
    assert.equal(res.headers['x-kk-sheet-source'],'sheet-id-config-conflict');
    assert.match(res.body,/configuration conflicts/i);
  });
});


test('public data exposes only non-secret Private Reader readiness classifications', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({ok:true,status:200,text:async()=>[
    'event_id,event_name,event_date_text,venue,poster_image_url,event_note,available_phone_count,available_lens_count,booking_status_for_web,action_for_web,line_message_template',
    'EVT-1,Event,04/10/2026,Siam Paragon,,,2,2,เปิดจอง,show,จอง',
  ].join('\n')});
  try {
    await withEnv(withoutPrivateCredentials({
      GOOGLE_SHEET_ID:'sheet-public',
      KK_PUBLIC_SHEET_REQUIRE_PRIVATE:undefined,
    }), async () => {
      const res=fakeRes({rejectNonAsciiHeaders:true});
      await handler({method:'GET',query:{sheet:'08_Web_Ready',range:'A4:K'}},res);
      assert.equal(res.statusCode,200);
      assert.equal(res.headers['x-kk-private-reader-configured'],'0');
      assert.equal(res.headers['x-kk-private-reader-auth'],'none');
      assert.equal(res.headers['x-kk-private-reader-sheet-state'],'CRM_SHEET_ID_RESOLVED');
      assert.equal(res.headers['x-kk-private-reader-strict'],'0');
      const headerDump=JSON.stringify(res.headers);
      assert.doesNotMatch(headerDump,/BEGIN PRIVATE KEY|reader@|sheet-public/);
    });
  } finally {
    global.fetch=originalFetch;
  }
});


test('public package feed drops malformed generated status/sort rows fail-closed', async () => {
  const originalFetch=global.fetch;
  global.fetch=async()=>({ok:true,status:200,text:async()=>[
    'package_id,event_id,package_type,model_group,model_display,lens_group,lens_display,price,available_count,package_status,sort_order,web_note,raw_available_count,use_case',
    'PKG-GOOD,EVT-1,phone_only,VIVO_X300_PRO,Vivo X300 Pro,NONE,,690,1,available,10,,1,',
    'PKG-BAD-STATUS,EVT-1,lens_only,NONE,,ZEISS_2_35X,Lens Vivo,390,1,1,hidden,,1,',
    'PKG-BAD-COUNT,EVT-1,phone_only,VIVO_X300_PRO,Vivo X300 Pro,NONE,,690,-1,available,10,,1,'
  ].join('\n')});
  try{
    await withEnv(withoutPrivateCredentials({GOOGLE_SHEET_ID:'sheet-test-123'}),async()=>{
      const res=fakeRes({rejectNonAsciiHeaders:true});
      await handler({method:'GET',query:{sheet:'09_Web_Packages',range:'A4:N'}},res);
      assert.equal(res.statusCode,200);
      assert.match(res.body,/PKG-GOOD/);
      assert.doesNotMatch(res.body,/PKG-BAD-STATUS/);
      assert.doesNotMatch(res.body,/PKG-BAD-COUNT/);
      assert.equal(res.headers['x-kk-public-rows-dropped'],'2');
    });
  }finally{global.fetch=originalFetch;}
});


test('public event CSV removes short operational tokens without changing visibility or customer copy',()=>{
 const csv=[
  'event_id,event_name,event_note,action_for_web,line_message_template',
  'HIDDEN,Hidden event,OWNER_HIDDEN 2026-09-29 | owner instruction: hide event,hide,สนใจจองผ่าน LINE',
  'VISIBLE,Visible event,ฟรีประกันเครื่อง ไม่มีมัดจำ,show,จอง vivo X300 Pro + Lens',
  'PIPE,Pipe event,คำแนะนำ|PRICE_LOCKED,show,USB-C พร้อมใช้งาน'
 ].join('\n');
 const out=handler._test.sanitizePublicCsv('08_Web_Ready',csv);
 const rows=handler._test.parseCsvRows(out.text);
 assert.equal(out.redacted,2);
 assert.equal(rows[1][2],'');assert.equal(rows[1][3],'hide');
 assert.equal(rows[2][2],'ฟรีประกันเครื่อง ไม่มีมัดจำ');
 assert.equal(rows[2][4],'จอง vivo X300 Pro + Lens');
 assert.equal(rows[3][2],'');assert.equal(rows[3][4],'USB-C พร้อมใช้งาน');
 assert.doesNotMatch(out.text,/OWNER_HIDDEN|owner instruction|PRICE_LOCKED/);
});
