'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const Bridge=require('../server/kk-project-memory-github-oidc-bridge.js');
const Ledger=require('../server/kk-project-memory-ledger.js');

const TOKEN='gh.header.payload.signature';

test('GitHub OIDC memory endpoint is pinned to canonical Supabase function',()=>{
  assert.equal(Bridge.endpoint(),'https://zehlsagzrpromtfqqflt.supabase.co/functions/v1/kk-project-memory-github-read');
  assert.equal(Bridge.MAX_ROWS,80);
});

test('GitHub OIDC token request uses Actions token endpoint and exact audience without leaking request token',async()=>{
  let captured;
  const token=await Bridge.officialGithubOidcToken({
    env:{ACTIONS_ID_TOKEN_REQUEST_URL:'https://actions.example/token?x=1',ACTIONS_ID_TOKEN_REQUEST_TOKEN:'request-secret'},
    fetchImpl:async(url,options)=>{
      captured={url,options};
      return {ok:true,async json(){return {value:TOKEN};}};
    }
  });
  assert.equal(token,TOKEN);
  const u=new URL(captured.url);
  assert.equal(u.searchParams.get('audience'),Bridge.endpoint());
  assert.equal(captured.options.headers.Authorization,'Bearer request-secret');
});

test('GitHub Actions defaults project memory to GitHub OIDC candidate without static Supabase secrets',()=>{
  const cfg=Ledger.configState({GITHUB_ACTIONS:'true',KK_PROJECT_MEMORY_GITHUB_OIDC_ENABLED:'true'});
  assert.equal(cfg.enabled,true);
  assert.equal(cfg.configured,true);
  assert.equal(cfg.github_oidc_candidate,true);
  assert.equal(cfg.mode,'github_oidc');
});

test('GitHub OIDC project memory read is bounded and token-safe',async()=>{
  let captured;
  const out=await Bridge.readProjectMemory({
    env:{GITHUB_ACTIONS:'true',KK_PROJECT_MEMORY_GITHUB_OIDC_ENABLED:'true'},
    domains:['content','agent_orchestration','BAD SPACE'],
    limit:2,
    getTokenImpl:async()=>TOKEN,
    fetchImpl:async(url,options)=>{
      captured={url,options,body:JSON.parse(options.body)};
      return {ok:true,status:200,async json(){return {
        ok:true,authenticated:true,read_only:true,bounded_limit:2,business_writes:0,
        rows:[{memory_id:'kk:memory:test:github01',occurred_at:'2026-10-02T12:00:00+07:00',kind:'ACCEPTANCE',domain:'content',summary:'Governed GitHub Agent runtime loaded durable project memory through OIDC.',evidence_refs:['github:test'],supersedes:null,status:'ACTIVE',source:'test',source_commit_sha:''}]
      };}};
    }
  });
  assert.equal(out.ok,true);
  assert.equal(out.rows.length,1);
  assert.deepEqual(captured.body.domains,['content','agent_orchestration']);
  assert.equal(captured.body.limit,2);
  assert.equal(captured.body.probe,'project-memory');
  assert.doesNotMatch(JSON.stringify(out),/gh\.header\.payload\.signature/);
  assert.equal(out.business_writes,0);
});

test('Supabase GitHub memory reader is exact-workflow, GET-only and bounded',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','supabase','functions','kk-project-memory-github-read','index.ts'),'utf8');
  for(const workflow of ['kk-content-chat-bridge.yml','kk-content-batch-chat-bridge.yml','kk-x-posting-plan-chat-bridge.yml']) assert.match(source,new RegExp(workflow.replaceAll('.','\\.')));
  assert.match(source,/EVENT_NAME="issues"/);
  assert.match(source,/REF="refs\/heads\/main"/);
  assert.match(source,/kk_project_memory_events/);
  assert.match(source,/MAX_ROWS=80/);
  assert.match(source,/method:"GET"/);
  assert.doesNotMatch(source,/method:"(?:PUT|PATCH|DELETE)"/);
  assert.doesNotMatch(source,/rest\/v1\/kk_project_memory_events[\s\S]*method:"POST"/);
});

test('all governed GitHub content workflows request id-token permission',()=>{
  for(const name of ['kk-content-chat-bridge.yml','kk-content-batch-chat-bridge.yml','kk-x-posting-plan-chat-bridge.yml']){
    const workflow=fs.readFileSync(path.join(__dirname,'..','.github','workflows',name),'utf8');
    assert.match(workflow,/id-token:\s*write/);
    assert.match(workflow,/KK_PROJECT_MEMORY_GITHUB_OIDC_ENABLED:\s*'true'/);
  }
});

test('X posting-plan bridge no longer bypasses durable project memory',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','scripts','kk-x-posting-plan-chat-bridge.js'),'utf8');
  assert.doesNotMatch(source,/projectMemoryListFn\s*:/);
});


test('generic GitHub Actions jobs do not activate project memory OIDC',()=>{
  const cfg=Ledger.configState({GITHUB_ACTIONS:'true'});
  assert.equal(cfg.enabled,false);
  assert.equal(cfg.github_oidc_candidate,false);
  assert.equal(cfg.mode,'disabled');
});
