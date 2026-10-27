'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
function sourceBetween(start, end) {
  const a = src.indexOf(start);
  const b = src.indexOf(end, a + start.length);
  assert.ok(a !== -1 && b > a, 'function boundary: ' + start);
  return src.slice(a, b);
}

const isolatedSource = [
  sourceBetween('function looksInternalPublicText(raw){', 'function dedupePackageRows('),
  sourceBetween('function packageSpecForLanguage(p){', 'function buildBookingMsg('),
  sourceBetween('function showModal(c,options){', 'var PACKAGE_CLOSE_SELECTOR')
].join('\n');

function modalHarness(lang) {
  const nodes = Object.create(null);
  class FakeElement {
    constructor(tagName) {
      this.tagName = tagName;
      this.children = [];
      this.hidden = false;
      this.open = false;
      this.textContent = '';
      this.className = '';
      this._innerHTML = '';
    }
    set innerHTML(value) { this._innerHTML = String(value); this.children = []; }
    get innerHTML() { return this._innerHTML; }
    appendChild(node) { this.children.push(node); return node; }
    replaceChildren(...children) { this.children = children; }
    insertAdjacentElement(_location, node) { nodes[node.id] = node; return node; }
    setAttribute(name, value) { this[name] = value; }
  }
  ['modal-title', 'modal-date', 'modal-venue', 'phone-list'].forEach(function(id) {
    nodes[id] = new FakeElement('div');
  });
  const document = {
    getElementById(id) { return nodes[id] || null; },
    createElement(tagName) { return new FakeElement(tagName); },
    querySelectorAll() { return []; }
  };
  const dictionaries = {
    th: {
      modal_more_details: 'ดูรายละเอียดงาน',
      modal_package_details: 'รายละเอียดแพ็กเกจ',
      pkg_phone_only: 'เฉพาะมือถือ',
      pkg_lens_only: 'เลนส์เสริม',
      pkg_bundle: 'มือถือ + เลนส์',
      pkg_tagline_phone: 'เหมาะกับถ่ายเวทีไกล ซูมชัด',
      pkg_tagline_lens: 'เลนส์เสริม',
      pkg_tagline_bundle: 'เซ็ตครบ ประหยัดกว่า',
      per_day: ' บาท/วัน',
      book_this: 'จองเลย',
      waitlist_line: 'จองคิวหลุด'
    },
    en: {
      modal_more_details: 'Event details',
      modal_package_details: 'Package details',
      pkg_phone_only: 'Phone only',
      pkg_lens_only: 'Lens',
      pkg_bundle: 'Phone + lens',
      pkg_tagline_phone: 'Good for concerts',
      pkg_tagline_lens: 'Lens upgrade',
      pkg_tagline_bundle: 'Bundle',
      per_day: '/day',
      book_this: 'Book now',
      waitlist_line: 'Join waitlist'
    }
  };
  const context = {
    document,
    currentLang: lang || 'th',
    tr: function(k) { return dictionaries[lang || 'th'][k] || k; },
    numberLocale: function() { return 'en-US'; },
    updateMetaForEvent: function() {},
    setEventUrl: function() {},
    openModal: function() { context.openCount++; },
    openCount: 0,
    track: function() {},
    availCnt: function(c) { return (c.packages || []).filter(p => p.avail).length; },
    availPkgs: function(c) { return (c.packages || []).filter(p => p.avail); },
    getWaitlistUrl: function(c) { return 'https://line.example/wait/' + c.id; },
    getBookingUrl: function(c, p) { return 'https://line.example/book/' + c.id + '/' + p.model; },
    toNum: function(v) { return Number(v) || 0; },
    esc: function(s) { return String(s); },
    activeModalEvent: null
  };
  vm.createContext(context);
  vm.runInContext(isolatedSource, context);
  return { render: context.showModal, nodes, context };
}

function event(id, name, note, packages) {
  return {
    id,
    name,
    date: '04/12/2026',
    venue: 'Volume Livehouse, Bangkok',
    webNote: note || '',
    packages: packages || []
  };
}
function pkg(model, price, useCase, type, lensDisp) {
  return { model, price, useCase: useCase || '', type: type || 'phone_only', lensDisp: lensDisp || '', avail: true };
}

test('all long-note events use same collapsed layout, with untouched price and booking links', () => {
  const h = modalHarness('th');
  const notes = [
    'ℹ️ Album Launch วัน 4 ธ.ค. 18:00–23:00 น. มีโชว์และกิจกรรมจัดตามรอบ การถ่ายภาพหรือวิดีโอขึ้นอยู่กับกฎผู้จัด',
    'Entry condition: bring valid ticket; return at the agreed time. All organizer restrictions apply.'
  ];
  for (let i = 0; i < 25; i++) {
    const n = notes[i % notes.length];
    const model = 'Vivo X300 Pro';
    const e = event('EVT-' + i, 'Live event ' + i, n, [pkg(model, 590 + i, 'โปรดทำตามกฎของงาน')]);
    h.render(e);
    const details = h.nodes['modal-event-note'];
    const row = h.nodes['phone-list'].children[0];
    const info = row.children[1];
    const right = row.children[2];
    assert.equal(details.tagName, 'details');
    assert.equal(details.open, false);
    assert.equal(details.hidden, false);
    assert.equal(details.children[0].tagName, 'summary');
    assert.equal(details.children[1].textContent, n);
    assert.equal(h.nodes['modal-title'].textContent, e.name);
    assert.equal(info.children[0].textContent, model);
    assert.equal(right.children[0].textContent, String(590 + i));
    assert.equal(right.children[1].href, 'https://line.example/book/' + e.id + '/' + model);
    assert.equal(info.children[2].tagName, 'details');
    assert.equal(info.children[2].open, false);
    assert.equal(info.children[2].children[1].textContent, 'โปรดทำตามกฎของงาน');
  }
  assert.equal(h.context.openCount, 25);
});

test('BTS-like empty-note event after verbose ZATO-like event has no stale disclosure', () => {
  const h = modalHarness('th');
  h.render(event('ZATO', 'ZATO Album Launch', 'Long event detail for disclosure', [pkg('Vivo X300 Pro', 590)]));
  assert.equal(h.nodes['modal-event-note'].hidden, false);
  h.render(event('BTS', 'BTS World Tour Arrirang', '', [pkg('Lens Vivo', 390, '', 'lens_only', 'Lens Vivo')]));
  assert.equal(h.nodes['modal-event-note'].hidden, true);
  assert.equal(h.nodes['modal-event-note'].children.length, 0);
  assert.equal(h.nodes['phone-list'].children.length, 1);
  const info = h.nodes['phone-list'].children[0].children[1];
  assert.equal(info.children.length, 1, 'duplicate lens spec and default marketing line both suppressed');
  assert.equal(info.children[0].textContent, 'Lens Vivo');
});

test('empty or internal notes are not shown, while full event metadata remains', () => {
  const h = modalHarness('th');
  h.render(event('TEST', 'An Event With A Very Long Official Name', 'OWNER_PRICE_ADJUST_2026-09-28_BIG_EVENT_COLLISION',
    [pkg('Phone', 690, 'WEEKDAY_FANDOM_TIER_2026-09-28')]));
  assert.equal(h.nodes['modal-event-note'].hidden, true);
  assert.equal(h.nodes['modal-date'].textContent, 'วันที่: 04/12/2026');
  assert.equal(h.nodes['modal-venue'].textContent, 'สถานที่: Volume Livehouse, Bangkok');
  assert.equal(h.nodes['phone-list'].children[0].children[1].children.length, 2,
    'model + phone-only specification, no internal note disclosure');
});

test('common marketing copy is not rendered as a disclosure in any month', () => {
  const h = modalHarness('th');
  for (const [month, copy, kind] of [
    ['10', 'เหมาะกับถ่ายเวทีไกล ซูมชัด', 'phone_only'],
    ['11', 'เซ็ตครบ ประหยัดกว่า', 'phone_lens_bundle'],
    ['12', 'เลนส์เสริมสำหรับซูมไกล', 'lens_only'],
    ['01', 'เหมาะกับเก็บโมเมนต์คอนเสิร์ต', 'phone_only']
  ]) {
    h.render(event('2026-' + month + '-CLEAN', 'Sample event', '', [pkg('Vivo X300 Pro', 590, copy, kind)]));
    const info = h.nodes['phone-list'].children[0].children[1];
    assert.equal(info.children.some(node => node.tagName === 'details'), false, 'unexpected disclosure for ' + month);
    assert.equal(h.nodes['modal-event-note'].hidden, true);
  }
});

test('fully booked event retains waitlist link and has no fake bookable package', () => {
  const h = modalHarness('th');
  h.render(event('SOLDOUT', 'Sold-out show', '', []));
  const list = h.nodes['phone-list'].children;
  assert.equal(list.length, 1);
  assert.equal(list[0].className, 'full-booked-box waitlist-box');
  assert.equal(list[0].children[0].href, 'https://line.example/wait/SOLDOUT');
  assert.equal(h.context.openCount, 1);
});

test('English localization and multiple package types preserve options and price', () => {
  const h = modalHarness('en');
  h.render(event('MIX', 'Multi-package concert', 'Attendees must follow venue policies', [
    pkg('Vivo X300 Pro', 790, '', 'phone_only'),
    pkg('Vivo X300 Pro + Lens', 990, 'Lens use subject to policy', 'phone_lens_bundle'),
    pkg('Lens Vivo', 290, '', 'lens_only', 'Lens Vivo')
  ]));
  assert.equal(h.nodes['modal-event-note'].children[0].textContent, 'Event details');
  const rows = h.nodes['phone-list'].children;
  assert.equal(rows.length, 3);
  assert.equal(rows[0].children[1].children.length, 2, 'no fallback tagline by default');
  assert.equal(rows[1].children[1].children[2].children[0].textContent, 'Package details');
  assert.equal(rows[1].children[2].children[0].textContent, '990');
  assert.equal(rows[2].children[1].children.length, 1, 'no duplicate Lens type');
});
