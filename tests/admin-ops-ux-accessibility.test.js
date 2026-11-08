'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const css=fs.readFileSync(path.join(root,'admin/operations-dashboard.css'),'utf8');
const html=fs.readFileSync(path.join(root,'admin/operations-dashboard.html'),'utf8');

test('Admin filter inputs remain iOS font 16px and 44px accessible targets',()=>{
 assert.match(css,/\.filters input,\.filters select\s*\{\s*min-height:44px;\s*font-size:16px\s*\}/);
});
test('Admin primary action targets have 44px touch height',()=>{
 assert.match(css,/\.btn,\.tab,\.mini-btn,\.calendar \.cal-day button,\.qa-box button\s*\{\s*min-height:44px/);
});
test('Admin table provides mobile scroll affordance and visible details action',()=>{
 assert.match(css,/\.tablewrap th:last-child,\.tablewrap td:last-child\s*\{\s*position:sticky;right:0/);
 assert.match(html,/<p class="table-hint">ตารางเลื่อนซ้าย–ขวาได้/);
});
test('Admin mobile table remains deliberately contained for independent scrolling',()=>{
 assert.match(css,/\.tablewrap\{overflow:auto\}/);
 assert.match(html,/<div class="tablewrap"><table>/);
});
