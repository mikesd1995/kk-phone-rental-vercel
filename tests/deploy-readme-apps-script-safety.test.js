const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const deployReadme = fs.readFileSync(path.join(root, 'DEPLOY_README.txt'), 'utf8');
const codeGs = fs.readFileSync(path.join(root, 'apps-script', 'Code.gs'), 'utf8');

function fn(name){
  const start=codeGs.indexOf('function '+name);
  assert.ok(start>=0,'missing function '+name);
  const end=codeGs.indexOf('\nfunction ',start+10);
  return codeGs.slice(start,end<0?codeGs.length:end);
}

test('review branch is based on recovered production 9_5_9 source but remains deploy fail-closed', () => {
  assert.match(codeGs,/v16\.7\.0_CRM_PRO_PHASE3_9_5_11_TIMEZONE_GUARD_CANDIDATE/);
  assert.doesNotMatch(codeGs,/v16\.7\.0_CRM_PRO_PHASE3_9_5_8_SNAPSHOT_TIMEOUT_STABILITY_FIX/);

  assert.match(deployReadme,/9_5_9/i);
  assert.match(deployReadme,/recovered/i);
  assert.match(deployReadme,/DO NOT deploy/i);
  assert.match(deployReadme,/owner-authenticated/i);
  assert.match(deployReadme,/controlled acceptance/i);
  assert.match(deployReadme,/issue #9/i);
});

test('recovered Apps Script now persists and exposes return_time end to end', () => {
  const createBooking=fn('kkApiCreateBooking_');
  const updateBooking=fn('kkApiUpdateBooking_');
  const snapshot=fn('kkApiSnapshot_');

  assert.match(createBooking,/payload\.return_time/);
  assert.match(createBooking,/pickupTime, returnTime, paymentStatus/);
  assert.match(createBooking,/kkAssertBookingAssetsNotDoubleBooked_\(0, proposed, bookingStatus\)/);

  assert.match(updateBooking,/payload\.return_time/);
  assert.match(updateBooking,/next\[12\]/);
  assert.match(updateBooking,/getRange\(row, 12, 1, 2\)\.setValues/);
  assert.match(updateBooking,/kkAssertBookingAssetsNotDoubleBooked_\(row, next, nextStatus\)/);

  assert.match(snapshot,/return_time:\s*r\[12\]/);
});

test('Apps Script reservation collision is window-aware and Bangkok-pinned', () => {
  assert.match(codeGs,/KK_BUSINESS_TIME_ZONE\s*=\s*'Asia\/Bangkok'/);
  assert.match(codeGs,/KK_RESERVATION_FALLBACK_END_HOUR\s*=\s*6/);
  assert.match(codeGs,/function\s+kkBookingReservationWindow_\s*\(/);
  assert.match(codeGs,/function\s+kkBookingWindowsOverlap_\s*\(/);
  assert.match(codeGs,/function\s+kkBookedAssetIdsForWindow_\s*\(/);
  assert.match(codeGs,/picked-up-open-ended/);
  assert.match(codeGs,/fallback-next-day-06:00/);

  const collision=fn('kkAssertBookingAssetsNotDoubleBooked_');
  assert.match(collision,/kkBookedAssetIdsForWindow_/);
  assert.doesNotMatch(collision,/kkBookedAssetIdsForDate_/);
});

test('quick booking also passes the reservation-window guard', () => {
  const quick=fn('kkAddQuickBookingFromDashboard');
  assert.match(quick,/const proposed = new Array\(20\)\.fill\(''\)/);
  assert.match(quick,/kkFindAvailableAsset_\([^\n]+proposed, 0\)/);
  assert.match(quick,/kkAssertBookingAssetsNotDoubleBooked_\(0, proposed, bookingStatus\)/);
});


test('recovered Apps Script source parses under the repository Node syntax baseline', () => {
  assert.doesNotThrow(() => new Function(codeGs));
});

test('Admin UI and edit population expose return_time in the staged flow', () => {
  const html=fs.readFileSync(path.join(root,'admin','index.html'),'utf8');
  const adminJs=fs.readFileSync(path.join(root,'admin','admin.js'),'utf8');
  const fields=[...html.matchAll(/name="return_time"/g)];
  assert.ok(fields.length>=2,'create and edit booking forms must both expose return_time');
  assert.match(adminJs,/set\("return_time",\s*fmtPickupTime\(b\.return_time\)\)/);
  assert.match(adminJs,/\["booking_status"[^\]]*"return_time"/);
});

test('Apps Script diagnostics expose timezone and installed-trigger inventory without secrets', () => {
  assert.match(codeGs,/function\s+kkTimeZoneDiagnostics_\s*\(/);
  assert.match(codeGs,/Session\.getScriptTimeZone\(\)/);
  assert.match(codeGs,/getSpreadsheetTimeZone\(\)/);
  assert.match(codeGs,/function\s+kkProjectTriggerDiagnostics_\s*\(/);
  assert.match(codeGs,/ScriptApp\.getProjectTriggers\(\)/);
  assert.match(codeGs,/cleanup_handler_count/);
  assert.match(codeGs,/schedule_hour_verifiable:\s*false/);

  const phase=fn('kkPhase1Diagnostics_');
  assert.match(phase,/script_time_zone/);
  assert.match(phase,/spreadsheet_time_zone/);
  assert.match(phase,/time_zone_aligned/);
  assert.match(phase,/project_triggers/);
  assert.doesNotMatch(phase,/KK_ADMIN_API_KEY[^\n]*getProperty[^\n]*\)/,
    'phase1Health must report key presence only, not return a secret value');
});

test('Apps Script mutations fail closed when timezone alignment is not proven', () => {
  assert.match(codeGs,/function\s+kkAssertWriteTimeZonesAligned_\s*\(/);
  assert.match(codeGs,/TIMEZONE_ALIGNMENT_REQUIRED/);
  const post=fn('doPost');
  const guard=post.indexOf("kkAssertWriteTimeZonesAligned_()");
  const dispatch=post.indexOf("switch (action)");
  assert.ok(guard>=0 && dispatch>guard,'timezone guard must execute before write dispatch');
  assert.match(post,/action !== 'snapshot'/);
  assert.match(post,/action !== 'phase1Health'/);
});

test('Vercel System Health surfaces timezone and trigger evidence', () => {
  const proxy=fs.readFileSync(path.join(root,'server','admin-proxy.js'),'utf8');
  assert.match(proxy,/time_zone_alignment/);
  assert.match(proxy,/cleanup_trigger_inventory/);
  assert.match(proxy,/apps_script_time_zone/);
  assert.match(proxy,/spreadsheet_time_zone/);
  assert.match(proxy,/Expected exactly one kkCleanupOldData30DaysAuto installed trigger/);
});

test('production-only capabilities are not invented by source recovery', () => {
  assert.doesNotMatch(codeGs,/function\s+runKKLineMonitor\s*\(/,
    'source recovery must not invent a LINE consumer that is absent from recovered 9_5_9');
});
