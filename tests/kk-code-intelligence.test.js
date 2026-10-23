'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const vm=require('node:vm');
const {createRequire}=require('node:module');
const os=require('node:os');
const CodeIntel=require('../server/kk-code-intelligence.js');

const root=path.join(__dirname,'..');

test('code context routes reference real checked-in files',()=>{
  const routes=CodeIntel.loadRoutes(root);
  assert.equal(routes.version,'KK_CODE_CONTEXT_ROUTES_V1');
  for(const route of routes.routes){
    for(const rel of [
      ...(route.files||[]),
      ...(route.tests||[]),
      ...(route.skills||[]),
      ...(route.docs||[])
    ]){
      assert.equal(fs.existsSync(path.join(root,rel)),true,route.id+' references missing '+rel);
    }
  }
});

test('Admin sort context stays bounded and includes the known regression',()=>{
  const pack=CodeIntel.contextPack('หลังบ้านรายการ booking ไม่เรียงตามวัน',{root});
  assert.ok(pack.matched_routes.some(x=>x.id==='admin'));
  assert.ok(pack.selected_files.some(x=>x.path==='admin/admin.js'));
  assert.ok(pack.targeted_tests.includes('tests/admin-edit-booking-date-sort-20260926.test.js'));
  assert.ok(pack.selected_files.length<=10);
  assert.ok(pack.estimated_context_tokens<=12000);
  const admin=pack.selected_files.find(x=>x.path==='admin/admin.js');
  assert.equal(admin.read_strategy,'symbols_or_targeted_ranges_first');
  assert.ok(admin.budgeted_tokens<=2500);
});

test('owner visibility task retrieves visibility guard instead of broad repo context',()=>{
  const pack=CodeIntel.contextPack('งานที่ซ่อนแล้วกลับมาโผล่หน้าบ้าน active_on_web',{root});
  assert.ok(pack.matched_routes.some(x=>x.id==='event_visibility'));
  assert.ok(pack.selected_files.some(x=>x.path==='server/event-visibility-owner-guard.js'));
  assert.ok(pack.targeted_tests.includes('tests/event-visibility-reactivation-regression.test.js'));
  assert.ok(pack.estimated_context_tokens<=12000);
});

test('short Latin route keywords do not match inside longer words',()=>{
  assert.equal(CodeIntel.keywordMatches('ready_for_verifier no-drop reconciliation','ci'),false);
  assert.equal(CodeIntel.keywordMatches('ci build failure','ci'),true);
});

test('content task retrieves Content Agent and content regression tests',()=>{
  const pack=CodeIntel.contextPack('ทำ post x ผ่าน content agent และ anti-repeat',{root});
  assert.ok(pack.matched_routes.some(x=>x.id==='content'));
  assert.ok(pack.selected_files.some(x=>x.path==='server/kk-content-agent.js'));
  assert.ok(pack.targeted_tests.includes('tests/kk-content-intelligence.test.js'));
});

test('generic engineering request falls back to compact repo guidance',()=>{
  const pack=CodeIntel.contextPack('refactor a small helper safely',{root});
  assert.equal(pack.matched_routes.length,0);
  assert.ok(pack.selected_files.some(x=>x.path==='AGENTS.md'));
  assert.ok(pack.selected_files.some(x=>x.path==='.agents/skills/kk-code-change/SKILL.md'));
  assert.ok(pack.estimated_context_tokens<=12000);
});

test('repo map resolves relative dependencies and symbols',()=>{
  const map=CodeIntel.buildRepoMap(root);
  const gateway=map.nodes['server/kk-agent-gateway.js'];
  assert.ok(gateway);
  assert.ok(gateway.dependencies.includes('server/kk-content-request-router.js'));
  assert.ok(gateway.dependencies.includes('server/kk-agent-registry.js'));
  assert.ok(gateway.symbols.includes('executeAgentRequest'));
  assert.ok(map.file_count>300);
});

test('targeted test command is derived from routed tests',()=>{
  const pack=CodeIntel.contextPack('supabase RLS runtime ledger migration',{root});
  const command=CodeIntel.targetedTestCommand(pack);
  assert.match(command,/node --test/);
  assert.match(command,/runtime-ledger/);
  assert.equal(pack.full_regression_required,true);
});

test('checked-in retrieval benchmark meets v1 recall and budget floors',()=>{
  const fixture=JSON.parse(fs.readFileSync(path.join(root,'tests','fixtures','kk-code-intelligence-benchmark.json'),'utf8'));
  const repoMap=CodeIntel.buildRepoMap(root);
  let routeHits=0,routeTotal=0,fileHits=0,fileTotal=0;
  for(const item of fixture.cases){
    const pack=CodeIntel.contextPack(item.task,{root,repoMap});
    const routes=new Set(pack.matched_routes.map(x=>x.id));
    const files=new Set([...pack.selected_files.map(x=>x.path),...(pack.targeted_tests||[])]);
    for(const expected of item.expected_routes||[]){
      routeTotal+=1;
      if(routes.has(expected)) routeHits+=1;
    }
    for(const required of item.must_include||[]){
      fileTotal+=1;
      if(files.has(required)) fileHits+=1;
    }
    for(const excluded of item.must_exclude_routes||[]) assert.equal(routes.has(excluded),false,item.task+' retrieved excluded route '+excluded);
    for(const excluded of item.must_exclude||[]) assert.equal(files.has(excluded),false,item.task+' retrieved excluded file '+excluded);
    assert.ok(pack.estimated_context_tokens<=12000,item.task+' exceeded context budget');
    assert.ok(pack.selected_files.length<=10,item.task+' exceeded file budget');
  }
  assert.equal(routeHits,routeTotal);
  assert.ok(fileHits/fileTotal>=0.95,'required file recall below 95%');
});

test('root AGENTS contract makes context-first retrieval mandatory',()=>{
  const text=fs.readFileSync(path.join(root,'AGENTS.md'),'utf8');
  assert.match(text,/npm run code:context/);
  assert.match(text,/12k estimated tokens/);
  assert.match(text,/Do not enable a semantic\/Hugging Face code retriever until it beats this baseline/);
});


test('Unified Inbox task routes to the actual Admin and LINE/X integration surface',()=>{
  const pack=CodeIntel.contextPack('Audit PR 430 Unified Inbox LINE/X webhook conversation PostgREST',{root});
  assert.equal(pack.matched_routes.some(x=>x.id==='unified_inbox'),true);
  const files=pack.selected_files.map(x=>x.path);
  assert.equal(files.includes('server/line-booking-webhook.js'),true);
  assert.equal(files.includes('admin/inbox-preview.js'),true);
  assert.equal(pack.targeted_tests.includes('tests/kk-admin-inbox-preview.test.js'),true);
  assert.equal(pack.targeted_tests.includes('tests/line-booking-inbox-tee.test.js'),true);
});

test('specific owner transport requests retrieve the actual bridge, relay and ACK boundaries within budget',()=>{
  const repoMap=CodeIntel.buildRepoMap(root);
  for(const task of [
    'owner-ledger ACK transport',
    'owner-ledger Supabase database migration ACK',
    'owner-ledger supabase RLS database migration OIDC runtime ledger',
    'ตรวจบัญชีแจ้งเตือนเจ้าของและการตอบรับ',
    'ตรวจตัวส่งแจ้งเตือนเจ้าของ',
    'apps-script/kk-agent/OwnerLedgerBridge.gs',
    'finalizeOwnerLedgerBridgeAck',
    'ownerGate',
    'assertExactOwnerRelay',
    'Make 6176241',
    'Make6176241'
  ]){
    const pack=CodeIntel.contextPack(task,{root,repoMap});
    assert.equal(pack.matched_routes[0]?.id,'owner_ledger_transport',task);
    const files=new Set(pack.selected_files.map(x=>x.path));
    for(const file of [
      'apps-script/kk-agent/OwnerLedgerBridge.gs',
      'scripts/kk-owner-relay-preflight.js',
      'server/kk-make-owner-notify.js',
      'server/make-owner-transport-contract.js',
      'server/make-owner-ledger-bridge.js',
      'supabase/functions/kk-runtime-ledger-oidc-probe/index.ts'
    ]) assert.equal(files.has(file),true,task+' missing '+file);
    for(const file of [
      'tests/kk-agent-owner-ledger-bridge.test.js',
      'tests/kk-agent-owner-ledger-ack.test.js',
      'tests/kk-owner-relay-preflight.test.js',
      'tests/make-owner-transport-contract.test.js'
    ]) assert.equal(pack.targeted_tests.includes(file),true,task+' missing '+file);
    assert.equal(pack.full_regression_required,true,task);
    assert.ok(pack.selected_files.length<=10,task);
    assert.ok(pack.targeted_tests.length<=10,task);
    assert.ok(pack.estimated_context_tokens<=12000,task);
    const edge=pack.selected_files.find(x=>x.path==='supabase/functions/kk-runtime-ledger-oidc-probe/index.ts');
    assert.equal(edge.read_strategy,'symbols_or_targeted_ranges_first',task);
    assert.ok(edge.budgeted_tokens>0,task);
  }
});

test('generic Supabase, Admin, Telegram and ACK requests cannot select the owner transport route',()=>{
  const routes=CodeIntel.loadRoutes(root).routes;
  for(const task of [
    'Supabase RLS database migration',
    'Admin auth snapshot dashboard',
    'Apps Script upstream 404',
    'Telegram',
    'ACK',
    'Telegram webhook ACK',
    'เชื่อมชีตฐานข้อมูล',
    'แจ้งเตือน',
    'ส่ง',
    'แจ้งเตือนเจ้าของ',
    'ส่งแจ้งเตือน LINE',
    'Scanner แจ้งเตือน',
    'owner-hidden visibility guard'
  ]) assert.equal(CodeIntel.routeScores(task,routes).some(x=>x.route.id==='owner_ledger_transport'),false,task);
});

test('explicit route priority keeps owner context ahead of overlapping generic database terms',()=>{
  const hits=CodeIntel.routeScores('owner-ledger Supabase database migration',[
    {id:'database',keywords:['supabase','database','migration']},
    {id:'owner',priority:10,keywords:['owner-ledger']}
  ]);
  assert.deepEqual(hits.map(x=>x.route.id),['owner','database']);
  assert.equal(hits[0].score,4);
  assert.equal(hits[1].score,9);
});

test('missing or invalid priorities retain the existing score and route ID ordering',()=>{
  for(const priority of [undefined,null,'10',NaN,Infinity,-Infinity,[],{}]){
    const hits=CodeIntel.routeScores('owner-ledger Supabase database migration',[
      {id:'owner',priority,keywords:['owner-ledger']},
      {id:'database',keywords:['supabase','database','migration']}
    ]);
    assert.deepEqual(hits.map(x=>x.route.id),['database','owner']);
    assert.deepEqual(hits.map(x=>x.score),[9,4]);
  }
  const hits=CodeIntel.routeScores('helper',[
    {id:'z',keywords:['helper']},
    {id:'a',priority:0,keywords:['helper']}
  ]);
  assert.deepEqual(hits.map(x=>x.route.id),['a','z']);
});

test('benchmark CLI rejects forbidden route and file retrieval instead of reporting a passing recall',()=>{
  const script=path.join(root,'scripts','kk-code-intelligence-benchmark.js');
  const requireScript=createRequire(script);
  for(const exclusions of [
    {must_exclude_routes:['admin']},
    {must_exclude:['admin/admin.js']}
  ]){
    const fixture={cases:[{
      task:'Admin auth snapshot dashboard',
      expected_routes:['admin'],
      must_include:['admin/admin.js'],
      ...exclusions
    }]};
    let result;
    const processState={exitCode:0};
    vm.runInNewContext(fs.readFileSync(script,'utf8'),{
      require:name=>name==='fs'?{readFileSync:()=>JSON.stringify(fixture)}:requireScript(name),
      __dirname:path.dirname(script),
      process:processState,
      console:{log:value=>{result=JSON.parse(value);}}
    },{filename:script});
    assert.equal(result.route_recall,1);
    assert.equal(result.required_file_recall,1);
    assert.equal(result.pass,false);
    assert.equal(processState.exitCode,2);
    assert.equal(result.false_positives,1);
    assert.ok(result.failures.includes('EXCLUDED_CONTEXT_RETRIEVED'));
  }
});

test('candidate priority applies only to matched curated files and invalid values preserve the baseline',()=>{
  const fixtureRoot=fs.mkdtempSync(path.join(os.tmpdir(),'kk-code-context-priority-'));
  const configDir=path.join(fixtureRoot,'config');
  fs.mkdirSync(configDir);
  const fixtureFiles={
    'owner.js':'require("./dependency.js");',
    'database.js':'module.exports={};',
    'dependency.js':'module.exports={};'
  };
  const configFile=path.join(configDir,'kk-code-context-routes.json');
  try{
    for(const [file,text] of Object.entries(fixtureFiles)) fs.writeFileSync(path.join(fixtureRoot,file),text);
    for(const priority of [10,undefined,null,'10','high',NaN,Infinity,-Infinity,[],{}]){
      fs.writeFileSync(configFile,JSON.stringify({routes:[
        {id:'owner',priority,keywords:['owner-ledger'],files:['owner.js']},
        {id:'database',keywords:['supabase','database','migration'],files:['database.js']}
      ]}));
      const pack=CodeIntel.contextPack('owner-ledger Supabase database migration',{root:fixtureRoot,maxFiles:2});
      assert.deepEqual(pack.selected_files.map(x=>x.path),priority===10?['owner.js','database.js']:['database.js','owner.js']);
    }
    const pack=CodeIntel.contextPack('Supabase database migration',{root:fixtureRoot});
    assert.deepEqual(pack.selected_files.map(x=>x.path),['database.js']);
  }finally{
    for(const file of Object.keys(fixtureFiles)) fs.unlinkSync(path.join(fixtureRoot,file));
    if(fs.existsSync(configFile)) fs.unlinkSync(configFile);
    fs.rmdirSync(configDir);
    fs.rmdirSync(fixtureRoot);
  }
});
