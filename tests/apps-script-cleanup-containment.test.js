'use strict';
process.env.TZ = 'Asia/Bangkok';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const dateBuilder = require('../scripts/build-apps-script-date-hotfix');
const { buildCandidate } = require('../scripts/build-apps-script-cleanup-containment');
const base = fs.readFileSync(dateBuilder.BASE_PATH, 'utf8').replace(/\r\n/g, '\n');
const candidate = buildCandidate(base);
function event(id, date = '14/11/2026') { return [id, 'Fixture', date, 'Venue', '', 'open', true, '', '']; }
function booking(id, eventId) { return [id, '2026-08-01', 'completed', eventId, 'Fixture']; }
function harness({ events = [], bookings = [], overrides = [], lockError, readError } = {}) {
  const calls = { writes: [], reads: [], unlocks: 0, alerts: [] };
  class FixedDate extends Date { constructor(...args) { super(...(args.length ? args : ['2026-10-13T05:00:00Z'])); } }
  const ctx = vm.createContext({ Date: FixedDate });
  vm.runInContext(candidate, ctx);
  const forbidden = name => () => { calls.writes.push(name); throw Error('UNEXPECTED_WRITE:' + name); };
  ctx.kkEnsureCrmArchiveSheets_ = forbidden('setup');
  ctx.kkUpsertCustomerStat_ = forbidden('stats');
  ctx.kkAcquireDocumentLock_ = () => { if (lockError) throw Error('LOCK_FAILED'); return { releaseLock() { calls.unlocks++; } }; };
  ctx.kkSheet_ = name => {
    calls.reads.push(name); if (readError) throw Error('READ_FAILED');
    const rows = ({ '01_Events': events, '00_Master_Booking': bookings, '04_Event_Overrides': overrides })[name];
    assert.ok(rows, 'Only read the three operational sheets');
    return { getLastRow: () => rows.length + 4, getRange(start, col, count, width) {
      assert.equal(start, 5); assert.equal(col, 1); assert.equal(count, rows.length);
      assert.equal(width, name === '01_Events' ? 9 : name === '00_Master_Booking' ? 20 : 7);
      return { getValues: () => rows, setValues: forbidden('setValues'), clearContent: forbidden('clearContent') };
    }, getRangeList: forbidden('rangeList') };
  };
  ctx.kkApiDate_ = date => date.toISOString().slice(0, 10);
  const ui = { ButtonSet: { YES_NO: 'YES_NO' }, Button: { YES: 'YES' }, alert(...args) { calls.alerts.push(args.join('\n')); return 'YES'; } };
  ctx.SpreadsheetApp = { flush: forbidden('flush'), getUi: () => ui };
  return { ctx, calls };
}
test('current-shaped 2 booking, 14 event, 39 override effect set is blocked without any writes', () => {
  const events = Array.from({ length: 14 }, (_, i) => event('EVT-' + i, '12/09/2026'));
  const h = harness({ events, bookings: [booking('BK-1', 'EVT-0'), booking('BK-2', 'EVT-0')], overrides: Array.from({ length: 39 }, (_, i) => ['EVT-' + i % 14, 'PACK-' + i]) });
  assert.throws(() => h.ctx.kkCleanupOldData30Days_(), /CLEANUP_ARCHIVE_RECONCILIATION_REQUIRED.*bookings=2.*events=14.*overrides=39/);
  assert.deepEqual(h.calls.writes, []); assert.equal(h.calls.unlocks, 1);
});
test('future-only rows and unresolved orphan booking are retained, with zero writes', () => {
  const h = harness({ events: [event('FUTURE')], bookings: [booking('ORPHAN', 'MISSING'), ['GHOST']] });
  const result = h.ctx.kkCleanupOldData30Days_();
  for (const key of ['archived_events', 'archived_bookings', 'archived_overrides', 'customer_stats_updated']) assert.equal(result[key], 0);
  assert.deepEqual(h.calls.writes, []); assert.equal(h.calls.unlocks, 1);
});
test('invalid late date is preflighted even after an archivable event', () => {
  const h = harness({ events: [event('OLD', '12/09/2026'), event('BAD', '31/11/2026')] });
  assert.throws(() => h.ctx.kkCleanupOldData30Days_(), /Invalid date:/);
  assert.deepEqual(h.calls.writes, []); assert.equal(h.calls.unlocks, 1);
});
for (const fixture of [
  { events: [event('')] }, { events: [event('DUP'), event('DUP')] },
  { bookings: [booking('', 'EVT')] }, { bookings: [booking('DUP', 'EVT'), booking('DUP', 'EVT2')] },
  { bookings: [booking('BK', '')] }, { overrides: [['', 'PACK']] },
  { events: [event('NODATE', '')] }
]) test('ambiguous or missing identity/date fails closed: ' + JSON.stringify(fixture), () => {
  const h = harness(fixture);
  assert.throws(() => h.ctx.kkCleanupOldData30Days_(), /CLEANUP_PREFLIGHT_/);
  assert.deepEqual(h.calls.writes, []); assert.equal(h.calls.unlocks, 1);
});
test('lock failure happens before setup, reads, and unlock', () => {
  const h = harness({ lockError: true });
  assert.throws(() => h.ctx.kkCleanupOldData30Days_(), /LOCK_FAILED/);
  assert.deepEqual(h.calls.writes, []); assert.deepEqual(h.calls.reads, []); assert.equal(h.calls.unlocks, 0);
});
test('read exceptions release acquired lock', () => {
  const h = harness({ readError: true });
  assert.throws(() => h.ctx.kkCleanupOldData30Days_(), /READ_FAILED/);
  assert.equal(h.calls.unlocks, 1); assert.deepEqual(h.calls.writes, []);
});
test('retrying a blocked cleanup remains non-mutating', () => {
  const rows = [booking('BK-OLD', 'OLD')];
  const snapshot = JSON.stringify(rows);
  const h = harness({ events: [event('OLD', '12/09/2026')], bookings: rows });
  for (let attempt = 0; attempt < 2; attempt++) assert.throws(() => h.ctx.kkCleanupOldData30Days_(), /CLEANUP_ARCHIVE_RECONCILIATION_REQUIRED/);
  assert.equal(JSON.stringify(rows), snapshot); assert.equal(h.calls.unlocks, 2); assert.deepEqual(h.calls.writes, []);
});
test('threshold day is retained and invalid orphan creation date is not silently ignored', () => {
  const h = harness({ events: [event('BOUNDARY', '13/09/2026')] });
  assert.equal(h.ctx.kkCleanupOldData30Days_().archived_events, 0);
  const orphan = booking('ORPHAN', 'MISSING'); orphan[1] = '31/11/2026';
  const invalid = harness({ bookings: [orphan] });
  assert.throws(() => invalid.ctx.kkCleanupOldData30Days_(), /Invalid date:/);
  assert.deepEqual(invalid.calls.writes, []); assert.equal(invalid.calls.unlocks, 1);
});
test('reads trailing payload even when the first three booking cells are empty', () => {
  const h = harness({ bookings: [['', '', '', 'EVT', 'Fixture']] });
  assert.throws(() => h.ctx.kkCleanupOldData30Days_(), /CLEANUP_PREFLIGHT_BOOKING_IDENTITY_REQUIRED/);
  assert.deepEqual(h.calls.writes, []);
});
test('manual, automatic and API wrappers propagate containment and never announce completion', () => {
  for (const method of ['kkCleanupOldData30Days', 'kkCleanupOldData30DaysAuto', 'kkApiCleanupOldData_']) {
    const h = harness({ events: [event('OLD', '12/09/2026')] });
    assert.throws(() => h.ctx[method](), /CLEANUP_ARCHIVE_RECONCILIATION_REQUIRED/);
    assert.ok(h.calls.alerts.every(text => !text.includes('Cleanup completed')));
    assert.deepEqual(h.calls.writes, []);
  }
});
test('builder rejects drift and changes only date helper and cleanup function', () => {
  assert.throws(() => buildCandidate(base + '\n'), /BASE_SOURCE_MISMATCH/);
  const strip = text => text.replace(/function kkDateObj_\(value\) \{[\s\S]*?\n\}/, '<DATE>').replace(/function kkCleanupOldData30Days_\(\) \{[\s\S]*?\n\}/, '<CLEANUP>');
  assert.equal(strip(candidate), strip(base));
  assert.notEqual(candidate, dateBuilder.buildCandidate(base));
  new vm.Script(candidate);
});
