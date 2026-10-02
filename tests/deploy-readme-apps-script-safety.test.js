const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const deployReadme = fs.readFileSync(path.join(root, 'DEPLOY_README.txt'), 'utf8');
const codeGs = fs.readFileSync(path.join(root, 'apps-script', 'Code.gs'), 'utf8');

test('deploy instructions fail closed while repo Apps Script trails production', () => {
  assert.match(
    codeGs,
    /v16\.7\.0_CRM_PRO_PHASE3_9_5_8_SNAPSHOT_TIMEOUT_STABILITY_FIX/,
    'guard must be revisited when repository Apps Script version changes'
  );

  assert.match(deployReadme, /Production audit reports v16\.7\.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX/);
  assert.match(deployReadme, /DO NOT replace the production Apps Script Code\.gs with apps-script\/Code\.gs/);
  assert.match(deployReadme, /issue #9/i);
  assert.match(deployReadme, /exact source recovery or independently proven source equivalence/i);

  assert.doesNotMatch(
    deployReadme,
    /^\s*2\.\s*Replace Code\.gs with apps-script\/Code\.gs from this package\.\s*$/m,
    'retired destructive deployment instruction must not return'
  );
});

test('repository Apps Script deployment remains fail-closed pending production equivalence', () => {
  // Canonical source is newer than the recovered production provenance artifact. Keep deployment fail-closed
  // until authenticated production source-equivalence acceptance proves the candidate safe.
  assert.doesNotMatch(codeGs, /function\s+runKKLineMonitor\s*\(/,
    'repository unexpectedly gained the production LINE consumer; re-run Issue #9 source provenance review');

  const createBookingStart = codeGs.indexOf('function kkApiCreateBooking_');
  const updateBookingStart = codeGs.indexOf('function kkApiUpdateBooking_');
  const snapshotStart = codeGs.indexOf('function kkApiSnapshot_');
  const createEventStart = codeGs.indexOf('function kkApiCreateEvent_');
  assert.ok(createBookingStart >= 0 && updateBookingStart > createBookingStart && snapshotStart >= 0 && createEventStart >= 0);

  const createBooking = codeGs.slice(createBookingStart, updateBookingStart);
  const updateBookingEnd = codeGs.indexOf('\nfunction ', updateBookingStart + 10);
  const updateBooking = codeGs.slice(updateBookingStart, updateBookingEnd);
  const snapshotEnd = codeGs.indexOf('\nfunction ', snapshotStart + 10);
  const snapshot = codeGs.slice(snapshotStart, snapshotEnd);
  const createEventEnd = codeGs.indexOf('\nfunction ', createEventStart + 10);
  const createEvent = codeGs.slice(createEventStart, createEventEnd);

  assert.doesNotMatch(createBooking, /payload\.return_time/,
    'return_time persistence appeared in stale source; require provenance/equivalence review before deployment');
  assert.doesNotMatch(updateBooking, /payload\.return_time/,
    'return_time update appeared in stale source; require provenance/equivalence review before deployment');
  assert.doesNotMatch(snapshot, /return_time\s*:/,
    'snapshot return_time appeared in stale source; require end-to-end acceptance before enabling Admin timing UI');
  assert.doesNotMatch(createEvent, /EVENT_DUPLICATE|findDuplicate|duplicate event/i,
    'backend duplicate protection appeared in stale source; require exact lock-scoped implementation review');
});
