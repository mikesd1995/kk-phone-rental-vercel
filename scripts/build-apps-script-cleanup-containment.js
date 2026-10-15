'use strict';

const fs = require('node:fs');
const { buildCandidate: buildDateCandidate, BASE_PATH, BASE_SHA256, sha256 } = require('./build-apps-script-date-hotfix');

// Local candidate only. This intentionally contains cleanup; it does not repair
// the archive transaction or authorize a save to the bound Apps Script editor.
function buildCandidate(source = fs.readFileSync(BASE_PATH, 'utf8')) {
  const dated = buildDateCandidate(source);
  const pattern = /function kkCleanupOldData30Days_\(\) \{[\s\S]*?\n\}/g;
  if ((dated.match(pattern) || []).length !== 1) throw new Error('CLEANUP_HELPER_NOT_UNIQUE');
  return dated.replace(pattern, `function kkCleanupOldData30Days_() {
  const lock = kkAcquireDocumentLock_('write operation', 12000);
  try {
    // Containment only: preflight under the existing lock, never archive or clear.
    // In particular do not run archive setup or increment customer statistics.
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 30);
    threshold.setHours(0, 0, 0, 0);
    const text = value => String(value == null ? '' : value).trim();
    const populated = row => row.some(value => text(value) !== '');
    const read = (name, width) => {
      const sheet = kkSheet_(name);
      const last = sheet.getLastRow();
      return last < 5 ? [] : sheet.getRange(5, 1, last - 4, width).getValues();
    };
    const events = Object.create(null);
    const oldEvents = Object.create(null);
    let bookingCount = 0, eventCount = 0, overrideCount = 0;
    read(KK.events, 9).forEach(row => {
      if (!populated(row)) return;
      const id = text(row[0]);
      if (!id || events[id]) throw new Error('CLEANUP_PREFLIGHT_EVENT_IDENTITY_REQUIRED');
      if (!text(row[2])) throw new Error('CLEANUP_PREFLIGHT_EVENT_DATE_REQUIRED');
      const date = kkDateObj_(row[2]);
      events[id] = { date: date };
      if (date < threshold) { oldEvents[id] = true; eventCount++; }
    });
    const bookingIds = Object.create(null);
    read(KK.bookings, 20).forEach(row => {
      if (!populated(row)) return;
      const id = text(row[0]);
      if (!id || bookingIds[id]) throw new Error('CLEANUP_PREFLIGHT_BOOKING_IDENTITY_REQUIRED');
      bookingIds[id] = true;
      // Identity-only rows and formulas are retained without inferring a booking.
      if (!populated(row.slice(1))) return;
      const eventId = text(row[3]);
      if (!eventId) throw new Error('CLEANUP_PREFLIGHT_BOOKING_EVENT_IDENTITY_REQUIRED');
      if (text(row[1])) kkDateObj_(row[1]);
      // Unresolved orphans are retained; creation time is not an event date.
      if (events[eventId] && events[eventId].date < threshold) bookingCount++;
    });
    read(KK.overrides, 7).forEach(row => {
      if (!populated(row)) return;
      const eventId = text(row[0]);
      if (!eventId) throw new Error('CLEANUP_PREFLIGHT_OVERRIDE_EVENT_IDENTITY_REQUIRED');
      // Multiple packages/overrides for one event are legitimate.
      if (oldEvents[eventId]) overrideCount++;
    });
    if (bookingCount || eventCount || overrideCount) {
      throw new Error('CLEANUP_ARCHIVE_RECONCILIATION_REQUIRED bookings=' + bookingCount +
        ' events=' + eventCount + ' overrides=' + overrideCount);
    }
    return {
      archived_bookings: 0, archived_events: 0, archived_overrides: 0,
      customer_stats_updated: 0, threshold_date: kkApiDate_(threshold)
    };
  } finally {
    lock.releaseLock();
  }
}`);
}

if (require.main === module) {
  const output = process.argv[2];
  if (!output) throw new Error('Usage: node scripts/build-apps-script-cleanup-containment.js <new-output.gs>');
  const candidate = buildCandidate();
  fs.writeFileSync(output, candidate, { flag: 'wx' });
  console.log(JSON.stringify({ status: 'LOCAL_CONTAINMENT_CANDIDATE_ONLY', base_sha256: BASE_SHA256, candidate_sha256: sha256(candidate), output }));
}
module.exports = { buildCandidate, BASE_PATH, BASE_SHA256, sha256 };
