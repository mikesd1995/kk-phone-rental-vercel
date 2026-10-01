'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const Registry=require('../server/kk-agent-registry.js');
const Router=require('../server/kk-agent-task-router.js');
const Ux=require('../server/kk-storefront-ux-reviewer.js');

test('repository engineering contract mandates UX agent pre-review and post-change visual QA',()=>{
  const guide=fs.readFileSync(path.join(__dirname,'..','AGENTS.md'),'utf8');
  assert.match(guide,/Mandatory Product \/ UX \/ UI gate/);
  assert.match(guide,/storefront_ux_review/);
  assert.match(guide,/storefront_visual_qa/);
  assert.match(guide,/P0\/P1 findings as release-blocking/);
  assert.match(guide,/Admin\/product-flow/);
});

test('registered UX routes require the real storefront UX reviewer',()=>{
  for(const intent of ['storefront_ux_review','storefront_visual_qa']){
    const route=Registry.routeForIntent(intent);
    assert.ok(route);
    assert.equal(route.required_agents.includes('kk-storefront-ux-reviewer'),true);
    assert.equal(route.runtime_available,true);
    assert.equal(route.persistent_invocation_evidence_required,true);
  }
});

test('mobile filter wrapping is a release-blocking UX finding',()=>{
  const review=Ux.auditStorefront({
    viewport:{width:390,height:844},
    platform:'ios',
    metrics:{filter_rows:3,min_form_control_font_px:16,document_scroll_width_px:390,content_width_px:390}
  });
  assert.equal(review.status,'NEEDS_REFINEMENT');
  assert.ok(review.findings.some(x=>x.code==='FILTER_TOOLBAR_WRAPS'&&x.severity==='P1'));
  const qa=Ux.validateVisualQa({
    viewport:{width:390,height:844},
    platform:'ios',
    metrics:{filter_rows:3,min_form_control_font_px:16,document_scroll_width_px:390,content_width_px:390}
  });
  assert.equal(qa.pass,false);
  assert.equal(qa.status,'FAIL');
});

test('task router invokes UX reviewer rather than returning an ungoverned placeholder',async()=>{
  const out=await Router.executeTask('storefront_ux_review',{
    viewport:{width:390,height:844},platform:'ios',
    metrics:{filter_rows:1,min_form_control_font_px:16,document_scroll_width_px:390,content_width_px:390}
  });
  assert.deepEqual(out.invoked_agents,['kk-storefront-ux-reviewer']);
  assert.equal(out.result.agent,'kk-storefront-ux-reviewer');
});
