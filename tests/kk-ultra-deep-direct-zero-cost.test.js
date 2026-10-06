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


test('V23 preflights storefront and active-booking dates before discovery',()=>{
  const src=fs.readFileSync(require.resolve('../server/kk-ultra-deep-direct-zero-cost.js'),'utf8');
  const preflight=src.indexOf('Production.freshSnapshot');
  const discovery=src.indexOf('Runtime.runMonthlyUltraDeep');
  assert.ok(preflight>0&&discovery>preflight,'fresh storefront SOT must be read before discovery');
  assert.match(src,/active_booking_dates/);
  assert.match(src,/full_booking_dates/);
  assert.match(src,/phone_capacity/);
  assert.match(src,/READ_ONLY_ACCEPTANCE/);
});


test('V25 Vercel-native path requires authenticated production OIDC control before Full Loop',()=>{
  const src=fs.readFileSync(path.join(__dirname,'..','api','kk-admin-guard.js'),'utf8');
  const start=src.indexOf("if(action==='ultraDeepVercelNativeRun')");
  assert.ok(start>0);
  const block=src.slice(start,start+2600);
  assert.ok(block.indexOf('AdminWriteControl.health()')>=0);
  assert.ok(block.indexOf("authenticated===true")>=0);
  assert.ok(block.indexOf('UltraDeepDirect.run')>block.indexOf('AdminWriteControl.health()'));
  assert.ok(block.indexOf('executeWrites:commit')>=0);
  assert.ok(block.indexOf('READ_ONLY_WRITE_INVARIANT_BROKEN')>=0);
  assert.ok(block.indexOf("execution_path:'VERCEL_PRODUCTION_OIDC'")>=0);
});


test('V26 machine ingress is authorization-queue gated and cannot accept arbitrary month or commit',()=>{
  const source=fs.readFileSync(path.join(ROOT,'api','kk-scanner-dispatch.js'),'utf8');
  assert.match(source,/ultraDeepMachineRun/);
  assert.match(source,/commandClaim/);
  assert.match(source,/claim\.command\.month/);
  assert.match(source,/claim\.command\.commit/);
  assert.doesNotMatch(source,/machineInput\.month/);
  assert.doesNotMatch(source,/machineInput\.commit/);
  assert.match(source,/commandComplete/);
  assert.match(source,/READ_ONLY_WRITE_INVARIANT_BROKEN/);
});


test('scanner ingress GET acceptance is queue-authorized and permanently read-only',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','api','kk-scanner-dispatch.js'),'utf8');
  assert.match(source,/readonly_command_id/);
  assert.match(source,/commandClaim/);
  assert.match(source,/GET_COMMIT_FORBIDDEN/);
  assert.match(source,/executeWrites:false/);
  assert.match(source,/READ_ONLY_WRITE_INVARIANT_BROKEN/);
  assert.match(source,/ULTRA_DEEP_MACHINE_V26_READ_ONLY_GET/);
});

test('Smart Loop exposes one authenticated operational action without weakening write guards',()=>{
  const src=fs.readFileSync(require.resolve('../api/kk-admin-guard.js'),'utf8');
  const auth=src.indexOf("if(!signedSession&&!legacyPinOk) return reply(res,401");
  const smart=src.indexOf("if(action==='smartLoopRun')");
  assert.ok(auth>0&&smart>auth,'Smart Loop must remain behind existing Admin authentication');
  assert.match(src,/ULTRA_DEEP_ACTIONS = new Set\(\[[^\]]*'smartLoopRun'/);
  assert.match(src,/ULTRA_DEEP_ACTIONS = new Set\(\[[^\]]*'ultraDeepDirectRun'/);
  const block=src.slice(smart,smart+2600);
  assert.match(block,/operational:true/);
  assert.match(block,/executeWrites:commit/);
  assert.match(block,/READ_ONLY_WRITE_INVARIANT_BROKEN/);
  assert.match(block,/audit_blocking:false/);
  assert.match(block,/V2_READ_ONLY_READY/);
});


test('canonical phone baseline is wired into final pricing fallback',()=>{
  const src=fs.readFileSync(require.resolve('../server/kk-ultra-deep-direct-zero-cost.js'),'utf8');
  assert.match(src,/package_type\)\.toLowerCase\(\)==='phone_only'/);
  assert.match(src,/store_baseline_prices:baselinePrices/);
  assert.match(src,/approved:true/);
});

test('direct runtime passes active booking dates into discovery and filters booked dates before verifier',()=>{
  const src=fs.readFileSync(require.resolve('../server/kk-ultra-deep-direct-zero-cost.js'),'utf8');
  assert.match(src,/active_booking_dates:preflight\.active_booking_dates/);
  assert.match(src,/const blockedDates=new Set\(preflight\.active_booking_dates\|\|\[\]\)/);
  assert.match(src,/bookingDateExcludedCandidates/);
  const filter=src.indexOf('const eligibleCandidates=');
  const verifier=src.indexOf('Verifier.verifyBatch');
  assert.ok(filter>0&&verifier>filter);
});
