'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Ledger=require('../server/kk-project-memory-ledger.js');
const Health=require('../api/kk-intelligence-health.js');

const TOKEN='header.payload.signature';

test('production project memory defaults to OIDC candidate when direct secrets are absent',()=>{
  const cfg=Ledger.configState({VERCEL_ENV:'production'});
  assert.equal(cfg.enabled,true);
  assert.equal(cfg.direct_configured,false);
  assert.equal(cfg.oidc_candidate,true);
  assert.equal(cfg.mode,'oidc');
});

test('explicit project memory disable overrides production OIDC candidate',()=>{
  const cfg=Ledger.configState({VERCEL_ENV:'production',KK_PROJECT_MEMORY_LEDGER_ENABLED:'false'});
  assert.equal(cfg.enabled,false);
  assert.equal(cfg.configured,false);
  assert.equal(cfg.oidc_candidate,false);
  assert.equal(cfg.mode,'disabled');
});

test('project memory list uses OIDC in production and returns normalized rows',async()=>{
  let body;
  const out=await Ledger.listEvents({
    env:{VERCEL_ENV:'production'},
    limit:1,
    domains:['project_memory'],
    getTokenImpl:async()=>TOKEN,
    fetchImpl:async(_url,options)=>{
      body=JSON.parse(options.body);
      return {
        ok:true,status:200,
        async json(){return {
          ok:true,authenticated:true,read_only:true,bounded_limit:1,business_writes:0,
          rows:[{memory_id:'kk:memory:test:health01',occurred_at:'2026-10-02T12:00:00+07:00',kind:'ACCEPTANCE',domain:'project_memory',summary:'Production OIDC project memory readback is verified with bounded read-only access.',evidence_refs:['github:test'],supersedes:null,status:'ACTIVE',source:'test',source_commit_sha:''}]
        };}
      };
    }
  });
  assert.equal(out.ok,true);
  assert.equal(out.mode,'oidc');
  assert.equal(out.rows.length,1);
  assert.deepEqual(out.rows[0].supersedes,[]);
  assert.equal(body.probe,'project-memory');
  assert.equal(body.limit,1);
});

test('secret-safe project memory health reports real OIDC readback without memory content',async()=>{
  const out=await Health._test.projectMemoryRuntimeReadback({
    env:{VERCEL_ENV:'production'},
    getTokenImpl:async()=>TOKEN,
    fetchImpl:async()=>({
      ok:true,status:200,
      async json(){return {
        ok:true,authenticated:true,read_only:true,bounded_limit:1,business_writes:0,
        rows:[{memory_id:'kk:memory:test:health02',occurred_at:'2026-10-02T12:00:00+07:00',kind:'ACCEPTANCE',domain:'project_memory',summary:'This content must not be exposed by the health payload.',evidence_refs:['github:test'],supersedes:null,status:'ACTIVE',source:'test',source_commit_sha:''}]
      };}
    })
  });
  assert.equal(out.status,'READBACK_COMPLETE');
  assert.equal(out.runtime_mode,'oidc');
  assert.equal(out.sampled_rows,1);
  assert.equal(out.durable_memory_present,true);
  assert.equal(out.business_writes,0);
  assert.equal(out.secrets_exposed,false);
  assert.doesNotMatch(JSON.stringify(out),/This content must not be exposed/);
  assert.doesNotMatch(JSON.stringify(out),/header\.payload\.signature/);
});

test('project memory health route selector is narrow',()=>{
  assert.equal(Health._test.projectMemoryProbeRequested({url:'/api/kk-intelligence-health?mode=project-memory'}),true);
  assert.equal(Health._test.projectMemoryProbeRequested({url:'/api/kk-intelligence-health?mode=apps-script-timing'}),false);
});
