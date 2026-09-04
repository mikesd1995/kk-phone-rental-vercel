'use strict';
const assert = require('assert');
const { buildProjection } = require('../lib/kk-crm-projection');

const CRM_EVENT = 'EVT-20261016-OH-MY-FOURTH-CONCERT';
const NOW = Date.parse('2026-09-04T11:45:00+07:00');

function fixture(overrides = {}) {
  return {
    crosswalk: {
      identity_verified: true,
      machine_show_id: 'CRMSET|OH-MY-FOURTH|20261016',
      crm_event_id: CRM_EVENT,
      identity_evidence: ['event_name=OH MY FOURTH CONCERT', 'event_date=16/10/2026', 'venue=BITEC LIVE']
    },
    web_ready_rows: [{
      event_id: CRM_EVENT,
      available_phone_count: '2',
      available_lens_count: '2',
      booking_status_for_web: 'เปิดจอง',
      action_for_web: 'show',
      customer_name: 'MUST_NOT_LEAK',
      phone: '0999999999'
    }],
    package_rows: [
      { event_id: CRM_EVENT, package_type: 'phone_only', available_qty: '2', status: 'available' },
      { event_id: CRM_EVENT, package_type: 'lens_only', available_qty: '2', status: 'available' },
      { event_id: CRM_EVENT, package_type: 'phone_lens_bundle', available_qty: '2', status: 'available' }
    ],
    asset_rows: [
      { asset_id: 'PHONE-001', asset_type: 'phone', model_group: 'VIVO_X300_PRO', rentable_now: true },
      { asset_id: 'PHONE-002', asset_type: 'phone', model_group: 'VIVO_X300_PRO', rentable_now: 'TRUE' },
      { asset_id: 'LENS-001', asset_type: 'lens', model_group: 'ZEISS_2_35X', rentable_now: true },
      { asset_id: 'LENS-004', asset_type: 'lens', model_group: 'ZEISS_2_35X', rentable_now: 'TRUE' },
      { asset_id: 'LENS-002', asset_type: 'lens', model_group: 'G2', rentable_now: false }
    ],
    source_checked_at: '2026-09-04T11:43:00+07:00',
    now_ms: NOW,
    max_age_ms: 15 * 60 * 1000,
    ...overrides
  };
}

(function currentProjectionPasses() {
  const out = buildProjection(fixture());
  assert.equal(out.freshness, 'CURRENT');
  assert.equal(out.phone_available, 2);
  assert.equal(out.lens_available, 2);
  assert.equal(out.g1_rentable, 2);
  assert.equal(out.g2_rentable, 0);
  assert.equal(out.bundle_available, 2);
  assert.equal(out.bundle_status, 'available');
  assert.equal(out.write_boundary, 'READ_ONLY_CRM_PROJECTION');
  const serialized = JSON.stringify(out);
  assert(!serialized.includes('MUST_NOT_LEAK'));
  assert(!serialized.includes('0999999999'));
})();

(function staleIsNotCurrent() {
  const out = buildProjection(fixture({ source_checked_at: '2026-09-04T10:00:00+07:00' }));
  assert.equal(out.freshness, 'STALE');
})();

(function explicitCrosswalkRequired() {
  const x = fixture();
  x.crosswalk = { ...x.crosswalk, identity_verified: false };
  assert.throws(() => buildProjection(x), /identity_verified=true required/);
})();

(function exactIdRequired() {
  const x = fixture();
  x.crosswalk = { ...x.crosswalk, crm_event_id: 'EVT-WRONG' };
  assert.throws(() => buildProjection(x), /expected exactly one row, got 0/);
})();

(function negativeCountsFailClosed() {
  const x = fixture();
  x.web_ready_rows[0].available_phone_count = '-1';
  assert.throws(() => buildProjection(x), /expected non-negative integer/);
})();

(function impossibleBundleFailsClosed() {
  const x = fixture();
  x.package_rows.find(r => r.package_type === 'phone_lens_bundle').available_qty = '3';
  assert.throws(() => buildProjection(x), /bundle availability exceeds phone\/lens pair capacity/);
})();

(function fullMeansZero() {
  const x = fixture();
  const b = x.package_rows.find(r => r.package_type === 'phone_lens_bundle');
  b.status = 'full';
  b.available_qty = '1';
  assert.throws(() => buildProjection(x), /full status with nonzero quantity/);
})();

console.log('kk-crm-projection: 7/7 PASS');
