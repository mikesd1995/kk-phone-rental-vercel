'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const canonical = fs.readFileSync(path.join(root, 'apps-script', 'Code.gs'), 'utf8');
const candidate = fs.readFileSync(
  path.join(root, 'apps-script', 'candidates', 'Code_9_5_12_GATE2_RECONCILED_RETURN_TIME_TIMEZONE_TOMBSTONE_2026-09-30.gs'),
  'utf8'
);

function fn(source, name) {
  const start = source.indexOf('function ' + name);
  assert.ok(start >= 0, 'missing function ' + name);
  const next = source.indexOf('\nfunction ', start + 10);
  return source.slice(start, next < 0 ? source.length : next);
}

test('Gate 2 candidate is isolated from canonical Apps Script', () => {
  assert.match(canonical, /v16\.7\.0_CRM_PRO_PHASE3_9_5_8_SNAPSHOT_TIMEOUT_STABILITY_FIX/);
  assert.doesNotMatch(canonical, /9_5_12_GATE2_RECONCILED_CANDIDATE/);
  assert.match(candidate, /9_5_12_GATE2_RECONCILED_CANDIDATE/);
  assert.notEqual(candidate, canonical);
});

test('candidate preserves current-main tombstone and explicit owner-reopen protections', () => {
  assert.match(candidate, /EVENT_VISIBILITY_TOMBSTONE_LOCKED/);
  assert.match(candidate, /explicit_owner_reopen/);
  assert.match(candidate, /kkFindVisibilityHistory_/);
  assert.match(candidate, /kkUpsertVisibilityLock_/);
});

test('candidate persists and exposes return_time end to end inside Apps Script', () => {
  const createBooking = fn(candidate, 'kkApiCreateBooking_');
  const updateBooking = fn(candidate, 'kkApiUpdateBooking_');
  const snapshot = fn(candidate, 'kkApiSnapshot_');

  assert.match(createBooking, /kkValidateBookingClock_\(payload\.return_time/);
  assert.match(createBooking, /pickupTime, returnTime, paymentStatus/);
  assert.match(createBooking, /kkAssertBookingAssetsNotDoubleBooked_\(0, proposed, bookingStatus\)/);

  assert.match(updateBooking, /payload\.return_time/);
  assert.match(updateBooking, /next\[12\]/);
  assert.match(updateBooking, /getRange\(row, 12, 1, 2\)\.setValues/);

  assert.match(snapshot, /return_time:\s*r\[12\]/);
});

test('candidate reservation collision is Bangkok-pinned and window-aware', () => {
  assert.match(candidate, /KK_BUSINESS_TIME_ZONE\s*=\s*'Asia\/Bangkok'/);
  assert.match(candidate, /KK_RESERVATION_FALLBACK_END_HOUR\s*=\s*6/);
  assert.match(candidate, /function\s+kkBookingReservationWindow_\s*\(/);
  assert.match(candidate, /function\s+kkBookingWindowsOverlap_\s*\(/);
  assert.match(candidate, /function\s+kkBookedAssetIdsForWindow_\s*\(/);
  assert.match(candidate, /picked-up-open-ended/);
  assert.match(candidate, /fallback-next-day-06:00/);

  const collision = fn(candidate, 'kkAssertBookingAssetsNotDoubleBooked_');
  assert.match(collision, /kkBookedAssetIdsForWindow_/);
  assert.doesNotMatch(collision, /kkBookedAssetIdsForDate_/);
});

test('candidate exposes read-only timezone and trigger diagnostics and gates mutations', () => {
  assert.match(candidate, /function\s+kkTimeZoneDiagnostics_\s*\(/);
  assert.match(candidate, /Session\.getScriptTimeZone\(\)/);
  assert.match(candidate, /getSpreadsheetTimeZone\(\)/);
  assert.match(candidate, /function\s+kkProjectTriggerDiagnostics_\s*\(/);
  assert.match(candidate, /ScriptApp\.getProjectTriggers\(\)/);
  assert.match(candidate, /schedule_hour_verifiable:\s*false/);
  assert.match(candidate, /TIMEZONE_ALIGNMENT_REQUIRED/);

  const post = fn(candidate, 'doPost');
  const gate = post.indexOf('kkAssertWriteTimeZonesAligned_()');
  const dispatch = post.indexOf('switch (action)');
  assert.ok(gate >= 0 && dispatch > gate, 'timezone guard must run before mutation dispatch');
  assert.match(post, /action !== 'snapshot'/);
  assert.match(post, /action !== 'phase1Health'/);
});

test('candidate quick booking uses reservation-window collision guard', () => {
  const quick = fn(candidate, 'kkAddQuickBookingFromDashboard');
  assert.match(quick, /const proposed = new Array\(20\)\.fill\(''\)/);
  assert.match(quick, /kkFindAvailableAsset_\([^\n]+proposed, 0\)/);
  assert.match(quick, /kkAssertBookingAssetsNotDoubleBooked_\(0, proposed, bookingStatus\)/);
});

test('candidate parses under repository Node syntax baseline', () => {
  assert.doesNotThrow(() => new Function(candidate));
});
