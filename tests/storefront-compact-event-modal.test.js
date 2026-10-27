'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets', 'kk-storefront-v5.css'), 'utf8');

test('event details are kept but collapsed instead of rendering a long paragraph', () => {
  assert.match(js, /eventNoteEl=document\.createElement\("details"\)/);
  assert.match(js, /var publicEventNote=sanitizePublicText\(c\.webNote\)/);
  assert.match(js, /eventNoteEl\.replaceChildren\(\)/);
  assert.match(js, /eventNoteEl\.hidden=!publicEventNote/);
  assert.match(js, /eventNoteEl\.open=false/);
  assert.match(js, /eventCopy\.textContent=publicEventNote/);
  assert.match(js, /eventSummary\.textContent=tr\("modal_more_details"\)/);
  assert.doesNotMatch(js, /eventNoteEl\.textContent=publicEventNote/);
});

test('only explicit package notes get optional detail; no default marketing tagline clutter', () => {
  assert.match(js, /var publicSubtitle=packagePublicSubtitle\(p\)/);
  assert.match(js, /var explicitSubtitle=sanitizePublicText\(p\.useCase\)\|\|sanitizePublicText\(p\.note\)/);
  assert.match(js, /if\(publicSubtitle&&explicitSubtitle&&!isGenericPackageMarketingText\(publicSubtitle\)\)/);
  assert.match(js, /packageExtra=document\.createElement\("details"\)/);
  assert.match(js, /packageSummary\.textContent=tr\("modal_package_details"\)/);
  assert.match(js, /nEl\.textContent=publicSubtitle/);
  assert.match(js, /String\(specText\)\.trim\(\)\.toLowerCase\(\)!==String\(p\.model\|\|""\)\.trim\(\)\.toLowerCase\(\)/);
});

test('generic price/promotional package notes do not add extra disclosure rows', () => {
  assert.match(js, /function isGenericPackageMarketingText\(raw\)/);
  assert.match(js, /เหมาะกับถ่ายเวทีไกล ซูมชัด/);
  assert.match(js, /เลนส์เสริมสำหรับซูมไกล/);
  assert.match(js, /เซ็ตครบ ประหยัดกว่า/);
});

test('core rental and sold-out actions remain intact', () => {
  assert.match(js, /bookBtn\.href=getBookingUrl\(c,p\)/);
  assert.match(js, /priceEl\.textContent=toNum\(p\.price\)\.toLocaleString\(numberLocale\(\)\)/);
  assert.match(js, /waitBtn\.href=getWaitlistUrl\(c,null\)/);
  assert.match(html, /id="event-share-btn"/);
  assert.match(html, /id="modal-close"/);
});

test('TH EN copy, modal semantics and cache-busted assets reflect the change', () => {
  assert.match(js, /modal_note_strong:"เลือกแพ็กเกจ"/);
  assert.match(js, /modal_note_strong:"Choose a package"/);
  assert.match(js, /modal_more_details:"ดูรายละเอียดงาน"/);
  assert.match(js, /modal_more_details:"Event details"/);
  assert.match(html, /aria-describedby="modal-date modal-venue modal-note"/);
  assert.match(html, /<strong>เลือกแพ็กเกจ<\/strong>/);
  assert.match(html, /kk-storefront-v5\.css\?v=20261027-compact-event-modal/);
  assert.match(html, /script\.js\?v=storefront-compact-event-modal-20261027/);
});

test('compact modal CSS stays scoped and details remain accessible', () => {
  assert.match(css, /V6\.34 — compact event-package modal/);
  assert.match(css, /#overlay #modal-event-note\[hidden\]\{display:none!important\}/);
  assert.match(css, /#overlay \.modal-note\{/);
  assert.match(css, /#overlay \.ph-extra summary/);
  assert.match(css, /min-height:44px!important/);
  assert.match(css, /summary:focus-visible/);
});
