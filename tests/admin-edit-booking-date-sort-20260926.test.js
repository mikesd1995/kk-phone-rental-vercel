'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const js=fs.readFileSync('admin/admin.js','utf8');
const html=fs.readFileSync('admin/index.html','utf8');

test('Edit Booking selector owns a deterministic event-date sorter',()=>{
  assert.match(js,/function editBookingDateSortValue\(b\)/);
  assert.match(js,/function compareEditBookingsByEventDate\(a,b\)/);
  assert.match(js,/function sortedEditableBookings\(bookings\)/);
  assert.match(js,/editBookingDateSortValue\(a\)-editBookingDateSortValue\(b\)/);
  assert.match(js,/textValue\(a && \(a\.event_name\|\|a\.event_id\)\).*localeCompare/s);
  assert.match(js,/textValue\(a && a\.customer_name\).*localeCompare/s);
  assert.match(js,/Number\(a && a\.row_number/s);
});

test('Edit Booking selector is no longer coupled to report bookingsSort',()=>{
  const start=js.indexOf('function populateBookingEditForm()');
  const end=js.indexOf('function directPhase1ActionAvailable',start);
  assert.ok(start>0 && end>start);
  const block=js.slice(start,end);
  assert.match(block,/sortedEditableBookings\(\(state\.data\.bookings\|\|\[\]\)\.filter\(shouldShowInEditBooking\)\)/);
  assert.doesNotMatch(block,/sortedBookings\(/);
  assert.doesNotMatch(block,/bookingsSort/);
});

test('Edit Booking selector groups chronologically sorted rows by Thai month',()=>{
  assert.match(js,/function editBookingMonthKey\(v\)/);
  assert.match(js,/function editBookingMonthLabel\(v\)/);
  assert.match(js,/function renderEditBookingOptions\(rows\)/);
  assert.match(js,/<optgroup label="\$\{esc\(editBookingMonthLabel\(b\.event_date\)\)\}">/);
  assert.match(js,/if\(openGroup\) html\+="<\/optgroup>"/);
  assert.match(js,/html\+=opt\(b\.row_number, bookingLabel\(b\)\)/);
});

test('invalid event dates sort last instead of jumping above real dates',()=>{
  assert.match(js,/return t \|\| Number\.MAX_SAFE_INTEGER/);
});

test('Edit Booking help text explains date ordering and final-status exclusion',()=>{
  assert.match(html,/เรียงตามวันงานใกล้สุดและแยกเป็นรายเดือน/);
  assert.match(html,/completed\/cancelled\/no_show จะถูกซ่อน/);
});

test('Edit Booking Admin JS uses a dedicated cache key',()=>{
  assert.match(html,/admin\.js\?v=edit-booking-date-sort-20260926/);
});
