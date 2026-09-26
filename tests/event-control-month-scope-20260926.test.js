'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('admin/index.html','utf8');
const js=fs.readFileSync('admin/admin.js','utf8');
const css=fs.readFileSync('admin/admin.css','utf8');

test('Event Control Center is month-scoped and persists the operator month',()=>{
  assert.match(html,/id="eventControlMonth"/);
  assert.match(js,/function eventMonthKey\(v\)/);
  assert.match(js,/function ensureEventControlMonth\(rows\)/);
  assert.match(js,/kk_admin_event_control_month/);
  assert.match(js,/months\.includes\(current\) \? current : \(months\[0\]\|\|"all"\)/);
  assert.match(js,/eventMonthLabel\(state\.eventControlMonth\|\|"all"\)/);
});

test('Event Control KPI scope matches month and search before status filtering',()=>{
  assert.match(js,/function scopedEventControlRows\(\)/);
  assert.match(js,/const scoped=scopedEventControlRows\(\)/);
  assert.match(js,/const hidden=scoped\.filter/);
  assert.match(js,/const partial=scoped\.filter/);
  assert.match(js,/const visible=scoped\.filter/);
  assert.match(html,/id="eventControlSummary"/);
});

test('needs-action excludes intentional owner-hidden and fully-visible states',()=>{
  assert.match(js,/needs_action:pkg\.kind==="mixed" \|\| pkg\.kind==="unknown" \|\| String\(effective\.kind\)\.startsWith\("blocked_"\)/);
  assert.match(js,/return r\.needs_action/);
});

test('Event Control uses effective storefront truth instead of active_on_web alone',()=>{
  assert.match(js,/function effectiveStorefrontState\(event,web\)/);
  assert.match(js,/owner_hidden/);
  assert.match(js,/blocked_health/);
  assert.match(js,/blocked_poster/);
  assert.match(js,/blocked_web/);
  assert.match(js,/label:"แสดงจริง"/);
  assert.match(js,/label:"การ์ดจริง"/);
});

test('selection is capped at 12 before batch execution and can be cleared or isolated',()=>{
  assert.match(html,/id="eventControlSelectedOnly"/);
  assert.match(html,/id="eventControlClearSelected"/);
  assert.match(js,/state\.eventControlSelected\.size>=12/);
  assert.match(js,/เลือกได้สูงสุด 12 งานต่อรอบ/);
  assert.match(js,/state\.eventControlSelectedOnly=!state\.eventControlSelectedOnly/);
  assert.match(js,/function clearEventControlSelection/);
});

test('Event Control has sticky batch actions and row-level quick actions',()=>{
  assert.match(html,/id="eventControlStickyActions"/);
  assert.match(html,/data-event-control-batch="hide_packages"/);
  assert.match(js,/data-control-toggle-packages/);
  assert.match(js,/แก้ราคา\/Package/);
  assert.match(js,/data-control-preview-event/);
  assert.match(css,/event-control-sticky-actions/);
});

test('poster label is truthful and date groups are visually separated',()=>{
  assert.match(js,/poster_state:posterUrl \? "web_ready" : \(sourcePoster \? "source_only" : "missing"\)/);
  assert.match(js,/ยังไม่เข้า Web Ready/);
  assert.match(js,/ขาด URL/);
  assert.match(js,/event-date-group-start/);
  assert.match(css,/event-date-group-start/);
});

test('KPI cards are clickable filters and sort is explicit',()=>{
  assert.match(js,/data-control-stat-filter/);
  assert.match(html,/id="eventControlSort"/);
  assert.match(js,/package_attention/);
  assert.match(js,/state\.eventControlFilter=stat\.getAttribute/);
});
