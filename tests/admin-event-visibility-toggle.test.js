'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const html=fs.readFileSync('admin/index.html','utf8');
const js=fs.readFileSync('admin/admin.js','utf8');

test('Admin exposes an explicit event storefront visibility toggle',()=>{
  assert.match(html,/id="eventVisibilityToggleBtn"/);
  assert.match(html,/ซ่อนเฉพาะการ์ดงาน/);
  assert.match(html,/งานที่ซ่อนยังเลือกกลับมาเปิดได้/);
  assert.match(html,/admin\\.js\\?v=package-visibility-smart-v1-20260925/);
});

test('Edit Event keeps hidden open future events selectable',()=>{
  assert.match(js,/\.filter\(e=>!isEditEvent \|\| \(isEventOpen\(e\) && isTodayOrFuture\(e\.event_date\)\)\)/);
  assert.doesNotMatch(js,/\.filter\(e=>!isEditEvent \|\| \(isActiveEvent\(e\) && isTodayOrFuture\(e\.event_date\)\)\)/);
  assert.match(js,/ซ่อนเว็บ/);
});

test('visibility toggle changes only active_on_web through updateEvent',()=>{
  assert.match(js,/const nextActive=event\.active_on_web===false/);
  assert.match(js,/await api\("updateEvent",\{event_id:eventId,active_on_web:nextActive\}\)/);
  assert.match(js,/การ์ดงานจะหายจากหน้าบ้าน แต่ข้อมูล Event, ราคา Package, Booking และ Stock จะไม่ถูกลบหรือแก้/);
  assert.match(js,/toggle\.textContent=hidden \? "เปิดงานบนหน้าบ้าน" : "ซ่อนงานจากหน้าบ้าน"/);
});
