'use strict';

// Non-production owner-intent regression. It cannot mutate Core/Booking/Stock.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const manifest = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'ops', 'owner-curation', 'dec-2026-love-of-siam-bus-waitlist-intent.json'),
  'utf8'
));

test('December owner-intent is staging only and cannot authorize a production write', () => {
  assert.equal(manifest.state, 'NONPRODUCTION_STAGED_HOLD');
  assert.equal(manifest.permitted_business_writes, false);
  assert.equal(manifest.runtime_release_gates.gated_admin_path_required, true);
  assert.equal(manifest.runtime_release_gates.do_not_deploy_without_acceptance, true);
  assert.equal(manifest.runtime_release_gates.do_not_claim_live_until_verified, true);
});

test('Love of Siam dates are separate verified-candidate days and never cover JASP.ER-only 18/19/20', () => {
  const rows = manifest.love_of_siam.tentative_day_cards;
  const expected = ['09','11','12','13','16','17','23','24','25']
    .map(day => '2026-12-' + day);
  assert.deepEqual(rows.map(row => row.date), expected);
  assert.equal(new Set(rows.map(row => row.date)).size, rows.length);
  assert.deepEqual(manifest.prohibited_dates_for_new_love_of_siam,
    ['2026-12-18', '2026-12-19', '2026-12-20']);
  for (const row of rows) {
    assert.ok(/^2026-12-[0-9]{2}$/.test(row.date));
    assert.ok(row.sessions.length > 0);
    assert.ok(row.sessions.every(s => /^(?:[01][0-9]|2[0-3]):[0-5][0-9]$/.test(s)));
    assert.ok(!manifest.prohibited_dates_for_new_love_of_siam.includes(row.date));
  }
  assert.equal(manifest.love_of_siam.source_of_truth_event_id_exists, false);
  assert.equal(manifest.love_of_siam.proposed_state, 'NEW_EVENT_CANDIDATE_ONLY');
  assert.equal(manifest.love_of_siam.booking_enabled, false);
  assert.equal(manifest.love_of_siam.final_price_thb, null);
  assert.equal(manifest.love_of_siam.licensed_correct_2026_poster_file_id, null);
  assert.match(manifest.love_of_siam.recording_rights_status, /UNVERIFIED/);
});

test('BUS dates retain exact existing identities and cannot advertise unavailable phones as bookable', () => {
  const rows = manifest.bus_waitlist.exact_existing_rows;
  assert.deepEqual(rows.map(row => row.date), ['2026-12-05','2026-12-06']);
  assert.deepEqual(rows.map(row => row.core_sheet_row), [71,72]);
  assert.deepEqual(rows.map(row => row.web_ready_row), [71,72]);
  assert.deepEqual(rows.map(row => row.lock_sheet_row), [168,171]);
  for (const row of rows) {
    assert.equal(row.event_id, 'EVT-' + row.date.replaceAll('-', '') + '-HAPPY-BUSDAY-1-2-3');
    assert.deepEqual(row.occupied_phones.slice().sort(), ['PHONE-001','PHONE-002']);
    assert.equal(row.expected_phone_available, 0);
    assert.equal(row.booking_enabled, false);
    assert.equal(row.proposed_web_action, 'show_full');
    assert.equal(row.proposed_web_status, 'เต็มแล้ว');
    assert.equal(row.waitlist_cta, 'สอบถามคิวหลุดผ่าน LINE');
    assert.ok(row.poster_file_id);
  }
  assert.equal(manifest.bus_waitlist.historical_lock_state, 'LOCKED');
  assert.match(manifest.bus_waitlist.explicit_override_scope, /only reopen these two BUS/);
});

test('owner intent must not override shared phone inventory, booked prices, or other owner locks', () => {
  assert.equal(manifest.shared_inventory_rule.max_total_phones_per_calendar_date, 2);
  assert.deepEqual(manifest.shared_inventory_rule.phone_assets,['PHONE-001','PHONE-002']);
  assert.equal(manifest.shared_inventory_rule.no_event_local_phantom_capacity, true);
  for (const field of ['Booking change','event price change','other lock change','stock creation','paid services']) {
    assert.ok(manifest.runtime_release_gates.forbidden_side_effects.includes(field));
  }
  assert.ok(manifest.runtime_release_gates.required_release_readback.some(x=>x.includes('11 confirmed Dec bookings')));
  assert.ok(manifest.runtime_release_gates.required_release_readback.some(x=>x.includes('0 available phones')));
});

test('official 17-show main-run count and separately announced gala remain explicitly unreconciled', () => {
  const love=manifest.love_of_siam;
  assert.equal(love.main_run_official_advertised_performances,17);
  assert.equal(love.gala_date,'2026-12-09');
  assert.equal(love.expected_total_sessions_including_excluded_days,null);
  assert.equal(love.show_count_reconciliation,'UNRESOLVED_PRIMARY_COUNT_VS_SECONDARY_SESSION_MATRIX');
  assert.match(love.session_validation_notes,/validate each exact TTM session\/date before publish/i);
});
