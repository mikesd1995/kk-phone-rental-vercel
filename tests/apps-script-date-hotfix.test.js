'use strict';
// Match the bound Apps Script project's calendar timezone in this test worker.
process.env.TZ = 'Asia/Bangkok';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { buildCandidate, BASE_PATH, BASE_SHA256, sha256 } = require('../scripts/build-apps-script-date-hotfix');
const base = fs.readFileSync(BASE_PATH, 'utf8').replace(/\r\n/g, '\n');
const candidate = buildCandidate(base);
function context(source = candidate) {
  const ctx = vm.createContext({ Date });
  vm.runInContext(source, ctx);
  return ctx;
}
function parts(d) { return [d.getFullYear(), d.getMonth() + 1, d.getDate()]; }

test('reproduces deployed failure before the fix', () => {
  assert.throws(() => context(base).kkDateObj_('14/11/2026'), /Invalid date/);
});
for (const [input, expected] of [
  ['14/11/2026', [2026, 11, 14]], ['08/10/2026', [2026, 10, 8]],
  [' 14/11/2026 ', [2026, 11, 14]], ['29/02/2024', [2024, 2, 29]]
]) test(`parses day/month/year ${input}`, () => assert.deepEqual(parts(context().kkDateObj_(input)), expected));
for (const input of ['29/02/2025', '31/11/2026', '00/10/2026', '14/00/2026', '14/13/2026', 'garbage']) {
  test(`rejects invalid date ${input}`, () => assert.throws(() => context().kkDateObj_(input), /Invalid date:/));
}
test('preserves valid native Date identity and rejects invalid Date', () => {
  const ctx = context();
  const d = new Date('2026-10-08T03:00:00Z');
  assert.equal(ctx.kkDateObj_(d), d);
  assert.throws(() => ctx.kkDateObj_(new Date(NaN)), /Invalid date:/);
});
test('preserves existing ISO timestamp and numeric timestamp conversion', () => {
  const ctx = context();
  for (const value of ['2026-10-08T03:00:00Z', 1791428400000]) {
    assert.equal(ctx.kkDateObj_(value).getTime(), new Date(value).getTime());
  }
});
test('builder rejects source drift and preserves everything outside date helper', () => {
  assert.equal(sha256(base), BASE_SHA256);
  assert.throws(() => buildCandidate(base + '\n'), /BASE_SOURCE_MISMATCH/);
  const strip = text => text.replace(/function kkDateObj_\(value\) \{[\s\S]*?\n\}\n/, '<DATE_HELPER>\n');
  assert.equal(strip(candidate), strip(base));
  assert.notEqual(candidate, base);
  new vm.Script(candidate);
});

test('date key uses configured Bangkok timezone', () => {
  const ctx = context();
  ctx.Session = { getScriptTimeZone: () => 'Asia/Bangkok' };
  ctx.Utilities = { formatDate(d, zone, pattern) {
    assert.equal(zone, 'Asia/Bangkok');
    assert.equal(pattern, 'yyyyMMdd');
    const p = new Intl.DateTimeFormat('en-GB', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
    const field = k => p.find(x => x.type === k).value;
    return field('year') + field('month') + field('day');
  } };
  assert.equal(ctx.kkDateKey_('14/11/2026'), '20261114');
});

test('actual cleanup retains future dmy event and releases its lock with zero data writes', () => {
  const ctx = context();
  const nativeDate = Date;
  ctx.Date = class FixedDate extends nativeDate {
    constructor(...args) { super(...(args.length ? args : ['2026-10-08T05:00:00Z'])); }
  };
  let released = 0, flushed = 0;
  ctx.kkEnsureCrmArchiveSheets_ = () => {};
  ctx.kkAcquireDocumentLock_ = () => ({ releaseLock() { released++; } });
  ctx.kkGetValues_ = name => name === '01_Events'
    ? [['EVT-FUTURE', 'Future fixture', '14/11/2026', 'Fixture venue', '', 'open', true, '', '']]
    : [];
  ctx.kkSheet_ = () => new Proxy({}, { get() { throw new Error('Unexpected sheet mutation/read'); } });
  ctx.SpreadsheetApp = { flush() { flushed++; } };
  ctx.kkApiDate_ = d => d.toISOString();
  const result = ctx.kkCleanupOldData30Days_();
  assert.equal(result.archived_events, 0);
  assert.equal(result.archived_bookings, 0);
  assert.equal(result.archived_overrides, 0);
  assert.equal(result.customer_stats_updated, 0);
  assert.equal(released, 1);
  assert.equal(flushed, 1);
});
