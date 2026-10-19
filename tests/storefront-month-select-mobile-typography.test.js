'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'assets/kk-storefront-v5.css'),'utf8');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');

test('mobile month text is compact while iOS focused select stays 16px',()=>{
  const marker='/* Mobile month selector: compact resting label';
  assert.equal(css.split(marker).length,2,'exactly one mobile month override');
  const override=css.slice(css.indexOf(marker));
  assert.match(override,/@media \(max-width:700px\)\{/);
  assert.match(override,/\.status-filter-bar #month-filter-select\{\s*font-size:14px!important;/);
  assert.match(override,/\.status-filter-bar #month-filter-select:focus\{\s*font-size:16px!important;/);
  const selector=override.match(/\.status-filter-bar #month-filter-select\{([^}]*)\}/)?.[1]||'';
  assert.doesNotMatch(selector,/\b(?:height|min-height|width|min-width):/,'do not shrink the 44px hit area');
});

test('storefront references the revised stylesheet with cache-busting version',()=>{
  assert.match(index,/href="\/assets\/kk-storefront-v5\.css\?v=20261019-month-type-compact-r1"/);
  assert.match(index,/<select class="month-select" id="month-filter-select"/);
});
