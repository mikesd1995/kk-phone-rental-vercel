'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const Ledger=require('../server/kk-agent-invocation-ledger.js');
const VercelBridge=require('../server/runtime-ledger-oidc-bridge.js');
const GithubBridge=require('../server/kk-project-memory-github-oidc-bridge.js');

function row(){
  return {
    invocation_id:'agi_1234567890abcdef',
    request_type:'RELIABILITY_AUDIT',
    intent:'reliability_audit',
    route_id:'reliability_audit',
    required_agents:['kk-reliability-learning'],
    invoked_agents:['kk-reliability-learning'],
    agent_versions:{'kk-reliability-learning':'V1'},
    registry_version:'KK_AGENT_REGISTRY_V29',
    gateway_version:'KK_AGENT_GATEWAY_V5',
    gate_status:'RECORDED',
    blocked_reason:'',
    content_gate:'PASS',
    request_hash:'a'.repeat(64),
    truth_hash:'b'.repeat(64),
    source_commit_sha:'c'.repeat(40),
    owner_review_required:false,
    production_writes:0,
    publishes:0
  };
}

test('production agent ledger uses Vercel OIDC without static Supabase secret',()=>{
  const cfg=Ledger.configState({VERCEL_ENV:'production'});
  assert.equal(cfg.enabled,true);
  assert.equal(cfg.configured,true);
  assert.equal(cfg.direct_configured,false);
  assert.equal(cfg.vercel_oidc_candidate,true);
  assert.equal(cfg.mode,'vercel_oidc');
});

test('governed GitHub agent workflows use GitHub OIDC without static Supabase secret',()=>{
  const cfg=Ledger.configState({
    GITHUB_ACTIONS:'true',
    KK_AGENT_INVOCATION_GITHUB_OIDC_ENABLED:'true'
  });
  assert.equal(cfg.enabled,true);
  assert.equal(cfg.configured,true);
  assert.equal(cfg.github_oidc_candidate,true);
  assert.equal(cfg.mode,'github_oidc');
});

test('explicit disable remains authoritative',()=>{
  const cfg=Ledger.configState({
    VERCEL_ENV:'production',
    KK_AGENT_INVOCATION_LEDGER_ENABLED:'false'
  });
  assert.equal(cfg.enabled,false);
  assert.equal(cfg.configured,false);
  assert.equal(cfg.mode,'disabled');
});

test('recordInvocation delegates to Vercel OIDC in production and preserves zero business writes',async()=>{
  const original=VercelBridge.writeAgentInvocation;
  let captured=null;
  VercelBridge.writeAgentInvocation=async input=>{
    captured=input.row;
    return {ok:true,inserted:true,idempotent_duplicate:false,invocation_id:input.row.invocation_id,audit_writes:1,business_writes:0};
  };
  try{
    const out=await Ledger.recordInvocation({env:{VERCEL_ENV:'production'},row:row()});
    assert.equal(out.ok,true);
    assert.equal(out.mode,'vercel_oidc');
    assert.equal(out.invocation_id,row().invocation_id);
    assert.equal(captured.production_writes,0);
    assert.equal(captured.publishes,0);
  }finally{
    VercelBridge.writeAgentInvocation=original;
  }
});

test('recordInvocation delegates to GitHub OIDC only when explicitly enabled',async()=>{
  const original=GithubBridge.writeAgentInvocation;
  GithubBridge.writeAgentInvocation=async input=>({
    ok:true,inserted:true,idempotent_duplicate:false,invocation_id:input.row.invocation_id,audit_writes:1,business_writes:0
  });
  try{
    const out=await Ledger.recordInvocation({
      env:{GITHUB_ACTIONS:'true',KK_AGENT_INVOCATION_GITHUB_OIDC_ENABLED:'true'},
      row:row()
    });
    assert.equal(out.ok,true);
    assert.equal(out.mode,'github_oidc');
  }finally{
    GithubBridge.writeAgentInvocation=original;
  }
});

test('GitHub chat bridges no longer fabricate local-only invocation persistence',()=>{
  for(const file of ['kk-content-chat-bridge.js','kk-content-batch-chat-bridge.js','kk-x-posting-plan-chat-bridge.js']){
    const source=fs.readFileSync(path.join(__dirname,'..','scripts',file),'utf8');
    assert.match(source,/kk-agent-invocation-ledger\.js/);
    assert.match(source,/AgentLedger\.recordInvocation\(\{row\}\)/);
    assert.doesNotMatch(source,/provider:'github_issue/);
  }
});

test('all governed GitHub agent workflows explicitly enable invocation OIDC',()=>{
  for(const file of ['kk-content-chat-bridge.yml','kk-content-batch-chat-bridge.yml','kk-x-posting-plan-chat-bridge.yml']){
    const source=fs.readFileSync(path.join(__dirname,'..','.github','workflows',file),'utf8');
    assert.match(source,/id-token:\s*write/);
    assert.match(source,/KK_AGENT_INVOCATION_GITHUB_OIDC_ENABLED:\s*'true'/);
  }
});

test('OIDC Edge functions restrict audit writes to invocation ledger and preserve business_writes zero',()=>{
  const files=[
    path.join(__dirname,'..','supabase','functions','kk-runtime-ledger-oidc-probe','index.ts'),
    path.join(__dirname,'..','supabase','functions','kk-project-memory-github-read','index.ts')
  ];
  for(const file of files){
    const source=fs.readFileSync(file,'utf8');
    assert.match(source,/agent-invocation-write/);
    assert.match(source,/kk_agent_invocations/);
    assert.match(source,/business_writes:0|business_writes: 0/);
    assert.match(source,/production_writes:0|production_writes: 0/);
    assert.match(source,/publishes:0|publishes: 0/);
    assert.doesNotMatch(source,/rest\/v1\/(?:00_Master_Booking|01_Events|02_Assets|03_Packages|04_Event_Overrides|08_Web_Ready|09_Web_Packages)/);
  }
});
