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
  assert.match(html,/admin\.js\?v=visibility-control-center-v1-20260925/);
});

test('Hidden open future events remain selectable in Edit Event and Package Override',()=>{
  assert.match(js,/\.filter\(e=>!isEditEvent \|\| \(isEventOpen\(e\) && isTodayOrFuture\(e\.event_date\)\)\)/);
  assert.match(js,/\.filter\(e=>!isOverride \|\| \(isEventOpen\(e\) && isTodayOrFuture\(e\.event_date\)\)\)/);
  assert.doesNotMatch(js,/\.filter\(e=>!isEditEvent \|\| \(isActiveEvent\(e\) && isTodayOrFuture\(e\.event_date\)\)\)/);
  assert.match(js,/ซ่อนเว็บ/);
});

test('visibility toggle changes only active_on_web through updateEvent',()=>{
  assert.match(js,/const nextActive=event\.active_on_web===false/);
  assert.match(js,/await api\("updateEvent",\{event_id:eventId,active_on_web:nextActive\}\)/);
  assert.match(js,/การ์ดงานจะหายจากหน้าบ้าน แต่ข้อมูล Event, ราคา Package, Booking และ Stock จะไม่ถูกลบหรือแก้/);
  assert.match(js,/btn\.textContent=hidden \? "เปิดงานบนหน้าบ้าน" : "ซ่อนงานจากหน้าบ้าน"/);
  assert.match(js,/การ์ดงานจะหายจากหน้าบ้านทั้งหมด แต่ Package, ราคา, Booking และ Stock จะไม่ถูกลบหรือแก้/);
});
