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
  assert.match(source, /"📍 "\+tr\("line_venue"\)\+": "\+lineVal\(c&&c\.venue\)/);
  assert.match(source, /tr\("line_venue"\)\+" : "\+lineVal\(c&&c\.venue\)/);
});

test('public event_note is mapped, sanitized, and rendered in the package modal', () => {
  assert.match(source, /String\(r\.event_note\|\|r\.web_note\|\|""\)\.trim\(\)/);
  assert.match(source, /modal-event-note/);
  assert.match(source, /var publicEventNote=sanitizePublicText\(c\.webNote\)/);
  assert.match(source, /eventNoteEl\.textContent=publicEventNote\?"ℹ️ "\+publicEventNote:""/);
});

test('month and availability filter choices can be reflected in the URL', () => {
  assert.match(source, /function syncBrowseUrl\(\)/);
  assert.match(source, /searchParams\.set\("filter",currentFilter\)/);
  assert.match(source, /searchParams\.set\("month",currentMonth\)/);
  assert.match(source, /setFilter\(b\.getAttribute\("data-filter"\)\|\|"all",\{updateUrl:true\}\)/);
});


test('verified promotion can expose inquiry-only events without inventing a price', () => {
  assert.match(source, /\[INQUIRY_ONLY\]/);
  assert.match(source, /if\(inquiryOnly\)\{ price=0; \}/);
  assert.match(source, /if\(price<=0 && !inquiryOnly\) avail = false;/);
  assert.match(source, /badge_inquiry:"สอบถามราคา"/);
  assert.match(source, /inquiry_available:"เช็กคิว \/ สอบถามราคากับร้าน"/);
  assert.match(source, /p\.inquiryOnly\?tr\("ask_this"\):tr\("book_this"\)/);
  assert.match(source, /\(p&&p\.inquiryOnly\)\?tr\("ask_price"\):fmtPriceLine/);
});


test('internal package notes never reach the customer modal', () => {
  assert.match(source, /function looksInternalPublicText\(raw\)/);
  assert.match(source, /capacity\\s\*\(\?:tight\|blocked\|readback\)/);
  assert.match(source, /function sanitizePublicText\(raw\)/);
  assert.match(source, /var publicSubtitle=packagePublicSubtitle\(p\)/);
  assert.doesNotMatch(source, /if\(p\.useCase\)\{var uEl=.*p\.useCase/);
  assert.doesNotMatch(source, /if\(p\.note\)\{var nEl=.*p\.note/);
});

test('package modal has stable public fallback taglines', () => {
  assert.match(source, /pkg_tagline_phone:"เหมาะกับถ่ายเวทีไกล ซูมชัด"/);
  assert.match(source, /pkg_tagline_bundle:"เซ็ตครบ ประหยัดกว่า"/);
  assert.match(source, /if\(p\.type==="phone_only"\)return tr\("pkg_tagline_phone"\)/);
  assert.match(source, /if\(p\.type==="phone_lens_bundle"\)return tr\("pkg_tagline_bundle"\)/);
});

test('internal event notes are filtered before rendering', () => {
  assert.match(source, /var publicEventNote=sanitizePublicText\(c\.webNote\)/);
  assert.match(source, /eventNoteEl\.textContent=publicEventNote\?"ℹ️ "\+publicEventNote:""/);
});


test('all explicitly hidden package rows keep the event online as waitlist', () => {
  assert.match(source, /var pkgMap=\{\}, pkgPresence=\{\};/);
  assert.match(source, /pkgPresence\[id\]=true;/);
  assert.match(source, /var hasPkgSheet = !!pkgPresence\[eventId\];/);
  assert.match(source, /Package visibility and event visibility are separate concerns/);
  assert.doesNotMatch(source, /hiddenByPackages/);
  assert.match(source, /if\(currentFilter==="full"\)\s+return vis\.filter\(function\(c\)\{return availCnt\(c\)===0;\}\);/);
  assert.match(source, /if\(!avail\) track\("waitlist_card_open"/);
  assert.match(source, /showModal\(c\);/);
  assert.doesNotMatch(source, /waitlist_card_click/);
});


test('browser sanitizer blocks observed machine tokens while preserving customer copy', () => {
  const start = source.indexOf('function looksInternalPublicText(raw){');
  const end = source.indexOf('function packagePublicSubtitle(p){', start);
  assert.ok(start >= 0 && end > start);
  const sanitizer = Function(source.slice(start, end) + '; return sanitizePublicText;')();

  for (const token of [
    'OWNER_HIDDEN 2026-09-29 | owner instruction: hide event',
    'คำแนะนำ|PRICE_LOCKED',
    'OWNER_HIDDEN|คำแนะนำ',
    'WEEKDAY_FALLBACK_HIGH_FANDOM_2026-09-28',
    'OWNER_PRICE_ADJUST_2026-09-28_BIG_EVENT_COLLISION',
    'EXACT_EVENT_COMPETITOR_690_2026-09-28',
    'PROVISIONAL_MARKET_BENCHMARK_2026-09-28',
    'PROVISIONAL_BIG_EVENT_COLLISION_2026-09-28',
    'WEEKDAY_FANDOM_TIER_2026-09-28',
  ]) {
    assert.equal(sanitizer(token), '');
  }
  assert.equal(sanitizer('เหมาะกับถ่ายเวทีไกล ซูมชัด'), 'เหมาะกับถ่ายเวทีไกล ซูมชัด');
});


