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
  assert.match(src,/executeWrites:true/);
});

test('V22 direct runtime preserves all governed stages',()=>{
  const src=fs.readFileSync(require.resolve('../server/kk-ultra-deep-direct-zero-cost.js'),'utf8');
  for(const required of ['runMonthlyUltraDeep','verifyBatch','scanBatch','prepareBatch','Production.execute']) assert.ok(src.includes(required),required);
  assert.match(src,/BLOCKED_DISCOVERY_NOT_FULL/);
  assert.match(src,/BLOCKED_NO_VERIFIED_CANDIDATES/);
  assert.match(src,/BLOCKED_NO_COMMERCIAL_CANDIDATES/);
});
