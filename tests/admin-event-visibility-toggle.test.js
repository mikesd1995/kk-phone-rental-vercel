'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('admin/index.html','utf8');
const js=fs.readFileSync('admin/admin.js','utf8');

test('Admin colocates event storefront visibility with package visibility controls',()=>{
  assert.match(html,/id="eventVisibilityToggleBtn"/);
  assert.match(html,/จัดการหน้าบ้านของงานนี้/);
  assert.match(html,/<b>ซ่อนงาน<\/b> = การ์ดงานหายจากหน้าบ้าน/);
  assert.match(html,/<b>ซ่อนแพ็กเกจ<\/b> = ซ่อนตัวเลือกแพ็กเกจ/);
  assert.match(html,/admin\.js\?v=diagnostic-evidence-authority-20261013/);
});

test('Hidden open future events remain selectable in Edit Event and Package Override',()=>{
  assert.match(js,/\.filter\(e=>!isEditEvent \|\| \(isEventOpen\(e\) && isTodayOrFuture\(e\.event_date\)\)\)/);
  assert.match(js,/\.filter\(e=>!isOverride \|\| \(isEventOpen\(e\) && isTodayOrFuture\(e\.event_date\)\)\)/);
  assert.doesNotMatch(js,/\.filter\(e=>!isEditEvent \|\| \(isActiveEvent\(e\) && isTodayOrFuture\(e\.event_date\)\)\)/);
  assert.match(js,/ซ่อนเว็บ/);
});

test('visibility toggle preserves owner intent and marks explicit re-open actions',()=>{
  assert.match(js,/function eventVisibilityPayload\(eventId,nextActive\)/);
  assert.match(js,/visibility_owner_intent='explicit_owner_reopen'/);
  assert.match(js,/const nextActive=event\.active_on_web===false/);
  assert.match(js,/await api\("updateEvent",eventVisibilityPayload\(eventId,nextActive\)\)/);
  assert.match(js,/api\("updateEvent",eventVisibilityPayload\(id,next\)\)/);
  assert.match(js,/await api\("updateEvent",eventVisibilityPayload\(id,kind==="show_events"\)\)/);
  assert.match(js,/btn\.textContent=hidden \? "เปิดงานบนหน้าบ้าน" : "ซ่อนงานจากหน้าบ้าน"/);
  assert.match(js,/การ์ดงานจะหายจากหน้าบ้านทั้งหมด แต่ Package, ราคา, Booking และ Stock จะไม่ถูกลบหรือแก้/);
});

test('Edit Event only adds owner reopen intent when a hidden event is deliberately set visible',()=>{
  assert.match(js,/currentEvent && currentEvent\.active_on_web===false/);
  assert.match(js,/p\.visibility_owner_intent="explicit_owner_reopen"/);
});


test('Admin storage bootstrap is safe when localStorage is unavailable',()=>{
  assert.match(js,/function safeLocalGet\(key\)/);
  assert.match(js,/function safeLocalSet\(key,value\)/);
  assert.match(js,/const compact=safeLocalGet\("kk_admin_compact_mode"\)==="1"/);
  assert.doesNotMatch(js,/const compact=localStorage\.getItem/);
  assert.doesNotMatch(js,/const current=localStorage\.getItem/);
});

test('Admin Overview surfaces actionable health and reversible actions',()=>{
  assert.match(html,/id="operationalAttention"/);
  assert.match(html,/id="adminUndoBar"/);
  assert.match(js,/function renderOperationalAttention\(\)/);
  assert.match(js,/function setAdminUndo\(label,undo\)/);
  assert.match(js,/function runAdminUndo\(\)/);
});

test('large event selectors get search without changing form payload semantics',()=>{
  assert.match(js,/function ensureEventSelectSearch\(sel,rows,labelFor\)/);
  assert.match(js,/ค้นหางานก่อนเลือก/);
  assert.match(js,/ensureEventSelectSearch\(sel,rows,labelFor\)/);
});
