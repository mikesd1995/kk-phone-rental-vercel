'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'assets/kk-storefront-v5.css'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const script=fs.readFileSync(path.join(root,'script.js'),'utf8');

test('mobile selected month label is 14px while native select remains 16px',()=>{
  const marker='/* Mobile month selector: 14px visual label';
  assert.equal(css.split(marker).length,2,'exactly one scoped mobile month override');
  const override=css.slice(css.indexOf(marker));
  assert.match(override,/@media \(max-width:700px\)\{/);
  assert.match(override,/\.status-filter-bar #month-filter-select\{\s*font-size:16px!important;/);
  assert.match(override,/\.status-filter-bar \.month-select-wrap::before\{[\s\S]*?font-size:14px!important;/);
  assert.match(override,/content:attr\(data-month-display\);/);
  assert.match(override,/pointer-events:none;/);
  assert.match(override,/html\[data-theme="dark"\] \.status-filter-bar \.month-select-wrap::before/);
  assert.doesNotMatch(override,/\bheight:\s*(?!44px)/,'preserve original touch height');
});

test('selected and translated option text is mirrored after each render',()=>{
  assert.match(script,/sel\.value=currentMonth;\s*updateMonthDisplay\(sel\);/);
  assert.match(script,/function updateMonthDisplay\(sel\)/);
  assert.match(script,/wrap\.setAttribute\("data-month-display",option\?/);
});

test('live assets are cache busted and initial label is available',()=>{
  assert.match(index,/href="\/assets\/kk-storefront-v5\.css\?v=20261019-stable-v1-month-label"/);
  assert.match(index,/script\.js\?v=20261019-stable-v1-month-label/);
  assert.match(index,/class="month-select-wrap" for="month-filter-select" data-month-display="ทุกเดือน"/);
  assert.match(index,/<select class="month-select" id="month-filter-select"/);
});
