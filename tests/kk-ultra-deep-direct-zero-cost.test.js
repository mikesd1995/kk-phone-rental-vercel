'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Direct=require('../server/kk-ultra-deep-direct-zero-cost.js');

test('V22 rejects malformed month before any live provider call',async()=>{
  await assert.rejects(()=>Direct.run({month:'2026-1'}),e=>e&&e.code==='ULTRA_DEEP_MONTH_INVALID');
});

test('V22 direct action stays behind existing admin authentication gate',()=>{
  const src=fs.readFileSync(require.resolve('../api/kk-admin-guard.js'),'utf8');
  const auth=src.indexOf("if(!signedSession&&!legacyPinOk) return reply(res,401");
  const direct=src.indexOf("if(action==='ultraDeepDirectRun')");
  assert.ok(auth>0&&direct>auth,'direct run must execute only after signed-session/PIN authorization');
  assert.match(src,/const commit=payload\.commit===true/);
  assert.match(src,/executeWrites:commit/);
  assert.match(src,/READ_ONLY_WRITE_INVARIANT_BROKEN/);
});

test('V22 direct runtime preserves all governed stages',()=>{
  const src=fs.readFileSync(require.resolve('../server/kk-ultra-deep-direct-zero-cost.js'),'utf8');
  for(const required of ['runMonthlyUltraDeep','verifyBatch','scanBatch','prepareBatch','Production.execute']) assert.ok(src.includes(required),required);
  assert.match(src,/BLOCKED_DISCOVERY_NOT_FULL/);
  assert.match(src,/BLOCKED_NO_VERIFIED_CANDIDATES/);
  assert.match(src,/BLOCKED_NO_COMMERCIAL_CANDIDATES/);
});


test('V23 preflights storefront and full-booking capacity before discovery',()=>{
  const src=fs.readFileSync(require.resolve('../server/kk-ultra-deep-direct-zero-cost.js'),'utf8');
  const preflight=src.indexOf('Production.freshSnapshot');
  const discovery=src.indexOf('Runtime.runMonthlyUltraDeep');
  assert.ok(preflight>0&&discovery>preflight,'fresh storefront SOT must be read before discovery');
  assert.match(src,/full_booking_dates/);
  assert.match(src,/phone_capacity/);
  assert.match(src,/READ_ONLY_ACCEPTANCE/);
});
