'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const FIXTURE=require('../server/kk-admin-ops-preview-fixture.js');
const PROJ=require('../server/kk-admin-ops-projection.js');
const UI=require('../admin/operations-dashboard.js');

const BRANCH='feat/ops-preview-fixture-uat-20261109';
const preview=()=>({
  VERCEL_ENV:'preview',KK_ADMIN_OPS_PREVIEW_FIXTURE:'1',
  KK_ADMIN_OPS_PREVIEW_FIXTURE_BRANCH:BRANCH,
  VERCEL_GIT_COMMIT_REF:BRANCH
});

test('preview fixture requires an exact branch-scoped flag and never enables in production',()=>{
  assert.equal(FIXTURE.enabled(preview()),true);
  const e=preview();
  for(const changed of [
    {VERCEL_ENV:'production'},
    {VERCEL_ENV:'development'},
    {KK_ADMIN_OPS_PREVIEW_FIXTURE:'false'},
    {KK_ADMIN_OPS_PREVIEW_FIXTURE:''},
    {KK_ADMIN_OPS_PREVIEW_FIXTURE_BRANCH:'main'},
    {VERCEL_GIT_COMMIT_REF:'main'},
    {VERCEL_GIT_COMMIT_REF:'feat/ops-unrelated'},
    {KK_ADMIN_OPS_PREVIEW_FIXTURE_BRANCH:''}
  ])assert.equal(FIXTURE.enabled({...e,...changed}),false,JSON.stringify(changed));
  assert.equal(FIXTURE.enabled({}),false);
  assert.equal(FIXTURE.enabled(null),false);
});

test('synthetic fixture is schema-valid, has only artificial event IDs, and never claims real stock',()=>{
  const now=new Date('2026-11-09T05:30:00.000Z');
  const raw=FIXTURE.snapshot(now);
  assert.equal(raw.ok,true);
  assert.equal(raw.data.snapshot_source,FIXTURE.SOURCE);
  assert.equal(raw.data.generated_at,now.toISOString());
  assert.equal(raw.data.events.length,2);
  assert.ok(raw.data.events.every(e=>e.event_id.includes('PREVIEW-FIXTURE')&&e.event_name.startsWith('SYNTHETIC')));
  const sanitized=PROJ.project(raw,size=>Buffer.alloc(size,9));
  const wire=JSON.stringify(sanitized);
  for(const secret of ['SYNTHETIC_PRIVATE_MARKER_NOT_REAL','SYNTHETIC-BOOKING-ID-NOT-REAL','customer_name'])
    assert.equal(wire.includes(secret),false,secret);
  assert.equal(sanitized.data.projection_version,PROJ.VERSION);
  assert.equal(sanitized.data.bookings.length,1);
  const normalized=UI.normalize(sanitized,now);
  assert.equal(normalized.meta.syntheticPreview,true);
  assert.equal(normalized.meta.fresh,true);
  assert.equal(normalized.records.length,2);
  assert.equal(normalized.records[1].web,'show_full');
  assert.equal(normalized.records[1].stock,0);
  assert.equal(normalized.records[1].phoneReady,false);
  assert.ok(normalized.records.every(x=>x.gate.some(g=>g.includes('ข้อมูล Preview จำลอง'))));
});

function harness(env,signed=true){
  const calls={upstream:0};
  const fakeV5=async(_req,res)=>{
    calls.upstream++;
    res.statusCode=200;
    res.end(JSON.stringify(FIXTURE.snapshot(new Date('2026-11-09T05:30:00.000Z'))));
  };
  const authorized={
    gateMode:()=>'',authorizeApi:()=>true,hasValidSession:()=>signed
  };
  const mocks={
    '../server/runtime-warning-tracer':{installRuntimeWarningTracer:()=>{}},
    '../server/legacy/kk-admin-snapshot-v5.js':fakeV5,
    '../server/admin-session.js':authorized,
    '../server/admin-make-gate.js':{},
    '../server/admin-write-control-oidc.js':{},
    './lib/admin-google-sheets-writer.js':{},
    '../server/kk-admin-ops-projection.js':PROJ,
    '../server/kk-admin-ops-preview-fixture.js':FIXTURE
  };
  const mod={exports:{}};
  const loader=s=>{assert.ok(Object.hasOwn(mocks,s),'unexpected require '+s);return mocks[s];};
  const source=fs.readFileSync(path.resolve(__dirname,'..','api','kk-admin-snapshot-v6.js'),'utf8');
  vm.runInNewContext(source,{
    module:mod,exports:mod.exports,require:loader,
    URL,Promise,JSON,String,Number,Object,Array,Buffer,process:{env}
  },{filename:'api/kk-admin-snapshot-v6.js'});
  const req={method:'GET',url:'/api/kk-admin?action=operationsSnapshot',headers:{cookie:signed?'signed-fixture':'legacy-pin-only'}};
  const res={
    statusCode:200,headers:{},body:'',
    setHeader(k,v){this.headers[String(k).toLowerCase()]=v;},
    end(v){this.body=String(v??'');return this.body;}
  };
  return {req,res,calls,call:()=>mod.exports(req,res)};
}

test('signed Preview fixture goes through allowlist but bypasses all upstream live readers',async()=>{
  const h=harness(preview());
  await h.call();
  assert.equal(h.calls.upstream,0);
  assert.equal(h.res.statusCode,200);
  assert.equal(h.res.headers['x-kk-ops-data-class'],'synthetic-preview-only');
  assert.match(h.res.headers['cache-control'],/no-store/);
  assert.equal(h.res.headers['x-kk-ops-projection-version'],PROJ.VERSION);
  assert.ok(!h.res.body.includes('SYNTHETIC_PRIVATE_MARKER_NOT_REAL'));
  assert.equal(JSON.parse(h.res.body).data.snapshot_source,FIXTURE.SOURCE);
});

test('unsigned synthetic Preview is denied before any fixture data or upstream read',async()=>{
  const h=harness(preview(),false);
  await h.call();
  assert.equal(h.res.statusCode,401);
  assert.equal(JSON.parse(h.res.body).error_code,'OPS_SESSION_REQUIRED');
  assert.equal(h.calls.upstream,0);
  assert.equal(h.res.headers['x-kk-ops-data-class'],undefined);
});

test('a Production flag can never enable the fixture; actual V5 source path is preserved',async()=>{
  const h=harness({...preview(),VERCEL_ENV:'production'});
  await h.call();
  assert.equal(h.res.statusCode,200);
  assert.equal(h.calls.upstream,1);
  assert.equal(h.res.headers['x-kk-ops-data-class'],undefined);
});

test('a Preview branch mismatch never enables the fixture and preserves V5 path',async()=>{
  const h=harness({...preview(),VERCEL_GIT_COMMIT_REF:'feat/ops-unrelated'});
  await h.call();
  assert.equal(h.calls.upstream,1);
  assert.equal(h.res.headers['x-kk-ops-data-class'],undefined);
});
