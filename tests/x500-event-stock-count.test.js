'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');

async function loadFixture(eventCount, packageRows, fallbackPackages = []) {
  const begin = source.indexOf('async function loadData(');
  assert.ok(begin >= 0, 'loadData must exist');
  const end = source.indexOf('\n}', begin);
  assert.ok(end > begin, 'loadData must have a top-level closing brace');

  const eventId = 'EVT-20261125-EXAMPLE-STOCK';
  const eventRows = [{
    event_id: eventId,
    event_name: 'Shared inventory regression',
    event_date_text: '25/11/2026',
    venue: 'Bangkok',
    poster_image_url: '',
    available_phone_count: String(eventCount),
    available_lens_count: '2',
    booking_status_for_web: eventCount ? 'เปิดจอง' : 'เต็มแล้ว',
    action_for_web: 'show'
  }];
  const context = {
    Promise, Number, Math,
    fetchWebRows: async () => eventRows,
    fetchPkgRows: async () => packageRows.map(p => ({...p, event_id: eventId})),
    dedupeWebRowsByEventId: rows => rows,
    isPkgVisible: p => p.package_status !== 'hidden',
    isVisibleWebAction: value => value === 'show' || value === 'show_full',
    storefrontPosterOverride: () => '',
    getImgCandidates: () => [],
    toNum: value => Number(String(value ?? 0).replace(/,/g, '')) || 0,
    fmtDate: date => date,
    buildPackagesFromSheet: rows => rows.map(p => ({
      id: p.package_id,
      type: p.package_type,
      avail: p.package_status === 'available',
      count: Number(p.available_count)
    })),
    buildPackagesFromWebRow: () => fallbackPackages.map(p => ({...p}))
  };
  vm.createContext(context);
  vm.runInContext(source.slice(begin, end + 2), context, {timeout: 3000});
  const result = await context.loadData();
  assert.equal(result.length, 1);
  return result[0];
}

const stock = (type, model, count, suffix = '') => ({
  package_id: 'pkg-' + model + '-' + (suffix || type),
  package_type: type,
  model_group: model,
  available_count: String(count),
  package_status: count > 0 ? 'available' : 'full'
});

test('two different phones yield an event total of two while each model stays at one', async () => {
  const event = await loadFixture(2, [
    stock('phone_only', 'VIVO_X300_PRO', 1),
    stock('phone_lens_bundle', 'VIVO_X300_PRO', 1, '200mm'),
    stock('phone_lens_bundle', 'VIVO_X500_PRO_MAX', 1, '200mm'),
    stock('phone_lens_bundle', 'VIVO_X500_PRO_MAX', 1, '400mm')
  ]);
  assert.equal(event.phoneCnt, 2);
  assert.deepEqual(Array.from(event.packages, p => p.count), [1, 1, 1, 1]);
  assert.ok(Array.from(event.packages).every(p => p.avail));
});

test('Nov 28 onward three physical phones appear as X300 one and X500 two, not three X500s', async () => {
  const event = await loadFixture(3, [
    stock('phone_only', 'VIVO_X300_PRO', 1),
    stock('phone_lens_bundle', 'VIVO_X300_PRO', 1, '200mm'),
    stock('phone_lens_bundle', 'VIVO_X500_PRO_MAX', 2, '200mm'),
    stock('phone_lens_bundle', 'VIVO_X500_PRO_MAX', 1, '400mm')
  ]);
  assert.equal(event.phoneCnt, 3, 'public event availability is capped by the shared physical fleet');
  assert.deepEqual(Array.from(event.packages, p => p.count), [1, 1, 2, 1],
    '200mm and 400mm X500 choices share the two X500 physical units');
  assert.ok(Array.from(event.packages).every(p => p.avail));
});

test('Nov 28 two prior bookings leave one X500, not three available phones', async () => {
  const event = await loadFixture(1, [
    stock('phone_only', 'VIVO_X300_PRO', 0),
    stock('phone_lens_bundle', 'VIVO_X300_PRO', 0, '200mm'),
    stock('phone_lens_bundle', 'VIVO_X500_PRO_MAX', 1, '200mm'),
    stock('phone_lens_bundle', 'VIVO_X500_PRO_MAX', 1, '400mm')
  ]);
  assert.equal(event.phoneCnt, 1);
  assert.deepEqual(Array.from(event.packages, p => p.count), [0, 0, 1, 1]);
  assert.ok(!event.packages[0].avail && !event.packages[1].avail);
  assert.ok(event.packages[2].avail && event.packages[3].avail);
});

test('one reserved X300 cannot reappear when the X500 is available', async () => {
  const event = await loadFixture(1, [
    stock('phone_only', 'VIVO_X300_PRO', 0),
    stock('phone_lens_bundle', 'VIVO_X500_PRO_MAX', 1, '200mm'),
    stock('phone_lens_bundle', 'VIVO_X500_PRO_MAX', 1, '400mm')
  ]);
  assert.deepEqual(Array.from(event.packages, p => p.count), [0, 1, 1]);
  assert.equal(event.packages[0].avail, false);
  assert.equal(event.packages[1].avail, true);
  assert.equal(event.packages[2].avail, true);
});

test('event-level full availability blocks all packages regardless of stale package rows', async () => {
  const event = await loadFixture(0, [
    stock('phone_only', 'VIVO_X300_PRO', 1),
    stock('phone_lens_bundle', 'VIVO_X500_PRO_MAX', 1, '200mm')
  ]);
  assert.deepEqual(Array.from(event.packages, p => p.count), [0, 0]);
  assert.ok(Array.from(event.packages).every(p => !p.avail));
});

test('legacy 08_Web_Ready-only fallback stays available without a package-level count', async () => {
  const event = await loadFixture(1, [], [
    {type: 'phone_only', avail: true},
    {type: 'phone_lens_bundle', avail: true}
  ]);
  assert.deepEqual(Array.from(event.packages, p => p.count), [1, 1]);
  assert.ok(Array.from(event.packages).every(p => p.avail));
});
