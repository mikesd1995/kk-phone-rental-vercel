'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');

test('storefront day logic is pinned to Asia/Bangkok instead of browser local midnight', () => {
  assert.match(source, /timeZone:"Asia\/Bangkok"/);
  assert.match(source, /var TODAY_TS = bangkokMidnightTs\(bangkokDayKey\(new Date\(\)\)\)/);
  assert.match(source, /function concertTs\(c\)\{ var key=eventDateKey/);
});

test('storefront freshness label describes check time rather than claiming source update time', () => {
  assert.match(source, /updated_prefix:"ตรวจสอบข้อมูลเมื่อ"/);
  assert.match(source, /updated_prefix:"Data checked at"/);
  assert.match(source, /\(Bangkok\)/);
});

test('booking and waitlist LINE messages include event venue', () => {
  const venueRefs = source.match(/tr\("line_venue"\)\+" : "\+lineVal\(c&&c\.venue\)/g) || [];
  assert.equal(venueRefs.length, 2);
});

test('public event_note is mapped and rendered in the package modal', () => {
  assert.match(source, /String\(r\.event_note\|\|r\.web_note\|\|""\)\.trim\(\)/);
  assert.match(source, /modal-event-note/);
  assert.match(source, /eventNoteEl\.textContent=c\.webNote\?"ℹ️ "\+c\.webNote:""/);
});

test('month and availability filter choices can be reflected in the URL', () => {
  assert.match(source, /function syncBrowseUrl\(\)/);
  assert.match(source, /searchParams\.set\("filter",currentFilter\)/);
  assert.match(source, /searchParams\.set\("month",currentMonth\)/);
  assert.match(source, /setFilter\(b\.getAttribute\("data-filter"\)\|\|"all",\{updateUrl:true\}\)/);
});
