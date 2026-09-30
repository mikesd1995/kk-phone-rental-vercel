'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const Router=require('../server/kk-agent-task-router.js');

const root=path.join(__dirname,'..');

test('Product UX pre-review classifies the reported 390px filter wrap as P1',async()=>{
  const out=await Router.executeTask('storefront_ux_review',{
    viewport:{width:390,height:844},
    platform:'ios',
    metrics:{filter_rows:3,min_form_control_font_px:16,document_scroll_width_px:390,content_width_px:390}
  });
  assert.deepEqual(out.invoked_agents,['kk-storefront-ux-reviewer']);
  assert.equal(out.result.status,'NEEDS_REFINEMENT');
  assert.ok(out.result.findings.some(x=>x.code==='FILTER_TOOLBAR_WRAPS'&&x.severity==='P1'));
});

test('mobile clear-filter reset owns a contained row and cannot collapse its label',()=>{
  const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
  assert.match(css,/\.filter-clear-btn\s*\{[\s\S]*?white-space:nowrap/);
  assert.match(css,/@media\(max-width:430px\)\s*\{[\s\S]*?\.status-filter-bar \.filter-clear-btn\s*\{[\s\S]*?flex-basis:100%/);
  assert.match(css,/\.status-filter-bar \.filter-clear-btn\s*\{[\s\S]*?width:min\(100%,180px\)/);
  assert.match(css,/\.status-filter-bar \.filter-clear-btn\s*\{[\s\S]*?min-height:40px/);
});

test('post-change Product UX visual QA packet passes at the affected iPhone viewport',async()=>{
  const out=await Router.executeTask('storefront_visual_qa',{
    viewport:{width:390,height:844},
    platform:'ios',
    metrics:{filter_rows:2,min_form_control_font_px:16,document_scroll_width_px:390,content_width_px:390}
  });
  assert.deepEqual(out.invoked_agents,['kk-storefront-ux-reviewer']);
  assert.equal(out.result.pass,true);
  assert.equal(out.result.status,'PASS');
});

test('storefront cache key changes with the responsive fix',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(html,/style\.css\?v=clear-filter-containment-20260930/);
});
