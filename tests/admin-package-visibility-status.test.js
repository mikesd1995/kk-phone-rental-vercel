'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('admin/index.html','utf8');
const js=fs.readFileSync('admin/admin.js','utf8');

test('Admin shows package visibility traffic-light status for selected event',()=>{
  assert.match(html,/id="eventPackageVisibilityStatus"/);
  assert.match(html,/สถานะ 🟢\/🟡\/🔴/);
  assert.match(js,/function packageVisibilityState\(eventId\)/);
  assert.match(js,/function packageVisibilityLabel\(stateInfo\)/);
  assert.match(js,/function renderEventPackageVisibilityStatus\(eventId\)/);
  assert.match(js,/ซ่อนแล้วทุกแพ็กเกจ/);
  assert.match(js,/ซ่อนบางส่วน/);
  assert.match(js,/ยังมีแพ็กเกจแสดง/);
});

test('Event selector annotates package visibility before operator clicks',()=>{
  assert.match(js,/packageMarker=info\.kind==="hidden" \? " · 🟢 ซ่อนแล้ว"/);
  assert.match(js,/🟡 ซ่อน \$\{info\.hidden\}\/\$\{info\.total\}/);
  assert.match(js,/🔴 ยังแสดง/);
});

test('Bulk package buttons prevent redundant hide or show writes',()=>{
  assert.match(js,/hideBtn\.disabled=info\.kind==="none" \|\| info\.kind==="hidden"/);
  assert.match(js,/showBtn\.disabled=info\.kind==="none" \|\| info\.kind==="visible"/);
  assert.match(js,/งานนี้ซ่อนทุกแพ็กเกจอยู่แล้ว — ไม่ส่งคำสั่งซ้ำ/);
  assert.match(js,/งานนี้เปิดทุกแพ็กเกจอยู่แล้ว — ไม่ส่งคำสั่งซ้ำ/);
});

test('Package visibility truth comes from storefront web package status',()=>{
  assert.match(js,/const rows=webPackagesForEvent\(id\)/);
  assert.match(js,/st==="hidden" \|\| st==="hide"/);
  assert.match(html,/smart-ops-v1-20260926/);
});
