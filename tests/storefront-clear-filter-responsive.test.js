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

test('mobile clear-filter reset is separated from the single-row status toolbar',()=>{
  const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
  assert.match(css,/\.filter-clear-btn\s*\{[\s\S]*?white-space:nowrap/);
  assert.match(css,/\.filter-clear-row\{display:flex;justify-content:center;width:100%/);
  assert.match(css,/@media\(max-width:430px\)\{[\s\S]*?\.status-filter-bar\{flex-wrap:nowrap;overflow-x:auto/);
  assert.match(css,/\.filter-clear-btn\{min-width:0;min-height:44px/);
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(html,/<\/div>\s*<div class="filter-clear-row">\s*<button class="filter-clear-btn" id="clear-browse-btn"/);
});

test('post-change Product UX visual QA packet passes at the affected iPhone viewport',async()=>{
  const out=await Router.executeTask('storefront_visual_qa',{
    viewport:{width:390,height:844},
    platform:'ios',
    metrics:{filter_rows:1,min_form_control_font_px:16,document_scroll_width_px:390,content_width_px:390}
  });
  assert.deepEqual(out.invoked_agents,['kk-storefront-ux-reviewer']);
  assert.equal(out.result.pass,true);
  assert.equal(out.result.status,'PASS');
});

test('short-phone sticky chrome has a dedicated compact acceptance state',()=>{
  const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
  assert.match(css,/@media\(max-width:430px\) and \(max-height:600px\)/);
  assert.match(css,/\.browse-controls-shell \.event-search-count\{display:none;\}/);
  assert.match(css,/\.browse-controls-shell \.event-search\{min-height:44px/);
  assert.match(css,/\.browse-controls-shell \.filter-btn,[\s\S]*?min-height:44px/);
});

test('storefront cache key changes with the responsive fix',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(html,/style\.css\?v=clear-filter-containment-20260930/);
});
