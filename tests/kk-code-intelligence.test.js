'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
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
  let routeHits=0,routeTotal=0,fileHits=0,fileTotal=0;
  for(const item of fixture.cases){
    const pack=CodeIntel.contextPack(item.task,{root});
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

test('canonical KK contracts and domain skills are routed into relevant context packs',()=>{
  const storefront=CodeIntel.contextPack('ปรับ UX หน้าบ้าน mobile search poster',{root});
  assert.ok(storefront.skills.includes('skills/storefront-ux/SKILL.md'));
  assert.ok(storefront.skills.includes('skills/visual-qa/SKILL.md'));
  assert.ok(storefront.docs.includes('DESIGN.md'));
  assert.ok(storefront.docs.includes('ACCEPTANCE.md'));

  const pricing=CodeIntel.contextPack('ตรวจ pricing package ราคา',{root});
  assert.ok(pricing.skills.includes('skills/pricing/SKILL.md'));
  assert.ok(pricing.docs.includes('ARCHITECTURE.md'));
  assert.ok(pricing.docs.includes('ACCEPTANCE.md'));

  const incident=CodeIntel.contextPack('debug production incident regression',{root});
  assert.ok(incident.skills.includes('skills/incident-debugger/SKILL.md'));
  assert.ok(incident.skills.includes('skills/learning-review/SKILL.md'));
  assert.ok(incident.docs.includes('RUNBOOK.md'));
});
