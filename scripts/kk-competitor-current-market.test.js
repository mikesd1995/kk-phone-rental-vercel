'use strict';

const assert = require('assert');
const {
  normalizeCompetitor,
  currentEligibility,
  queueIsBookable,
  resolveCurrentProjection,
  assessCurrentExactMarket,
  assertProjectionReadback
} = require('../lib/kk-competitor-current-market');

let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log('PASS ' + name);
}

const NOW = '2026-09-05T18:30:00+07:00';
const FUTURE = '2026-09-06T18:30:00+07:00';

function row(overrides = {}) {
  return Object.assign({
    event_key: 'EVENT|demo|20261001',
    competitor_account: 'ShopA',
    package_key: 'VIVO_X300_PRO+LENS',
    current_bundle_price: 1000,
    last_checked: '2026-09-05T18:00:00+07:00',
    fresh_until: FUTURE,
    freshness: 'FRESH',
    queue_status: 'OPEN',
    source_evidence_row: 100
  }, overrides);
}

test('normalizes competitor account identity', () => {
  assert.strictEqual(normalizeCompetitor('  @Shop A  '), 'shopa');
});

test('fresh row with lineage is eligible', () => {
  assert.strictEqual(currentEligibility(row(), { now: NOW }).eligible, true);
});

test('expired TTL is rejected', () => {
  const result = currentEligibility(row({ fresh_until: '2026-09-05T18:29:59+07:00' }), { now: NOW });
  assert(result.reasons.includes('TTL_EXPIRED'));
});

test('conflict hold cannot count as fresh current market', () => {
  const result = currentEligibility(row({ freshness: 'CONFLICT_HOLD' }), { now: NOW });
  assert(result.reasons.includes('NOT_FRESH'));
});

test('missing source evidence lineage is rejected', () => {
  const result = currentEligibility(row({ source_evidence_row: '' }), { now: NOW });
  assert(result.reasons.includes('MISSING_SOURCE_LINEAGE'));
});

test('future last-checked timestamp is rejected', () => {
  const result = currentEligibility(row({ last_checked: '2026-09-05T18:31:00+07:00' }), { now: NOW });
  assert(result.reasons.includes('FUTURE_LAST_CHECKED'));
});

test('OPEN queue is bookable', () => {
  assert.strictEqual(queueIsBookable(row({ queue_status: 'OPEN' })), true);
});

test('FULL queue is not bookable by default', () => {
  assert.strictEqual(queueIsBookable(row({ queue_status: 'FULL' })), false);
});

test('mixed showset availability requires exact show evidence rather than ANY available substring', () => {
  assert.strictEqual(queueIsBookable(row({ queue_status: 'SEP19_VIVO_FULL|SEP20_AVAILABLE' })), false);
});

test('latest valid observation wins current projection', () => {
  const projection = resolveCurrentProjection([
    row({ current_bundle_price: 1200, last_checked: '2026-09-05T16:00:00+07:00', source_evidence_row: 90 }),
    row({ current_bundle_price: 990, last_checked: '2026-09-05T18:00:00+07:00', source_evidence_row: 100 })
  ], { now: NOW });
  assert.strictEqual(projection.length, 1);
  assert.strictEqual(projection[0].current_bundle_price, 990);
  assert.strictEqual(projection[0].source_evidence_row, 100);
});

test('projection carries previous price and delta from history', () => {
  const projection = resolveCurrentProjection([
    row({ current_bundle_price: 1200, last_checked: '2026-09-05T16:00:00+07:00', source_evidence_row: 90 }),
    row({ current_bundle_price: 990, last_checked: '2026-09-05T18:00:00+07:00', source_evidence_row: 100 })
  ], { now: NOW });
  assert.strictEqual(projection[0].previous_bundle_price, 1200);
  assert.strictEqual(projection[0].price_change, -210);
});

test('stale history is not promoted into current projection', () => {
  const projection = resolveCurrentProjection([
    row({ freshness: 'STALE', fresh_until: '2026-09-05T17:00:00+07:00' })
  ], { now: NOW });
  assert.strictEqual(projection.length, 0);
});

test('newest conflict-held observation supersedes older fresh history', () => {
  const projection = resolveCurrentProjection([
    row({ current_bundle_price: 1200, last_checked: '2026-09-05T17:00:00+07:00', fresh_until: FUTURE, source_evidence_row: 90 }),
    row({ current_bundle_price: 990, last_checked: '2026-09-05T18:00:00+07:00', freshness: 'CONFLICT_HOLD', source_evidence_row: 100 })
  ], { now: NOW });
  assert.strictEqual(projection.length, 0);
});

test('newest expired observation cannot resurrect older still-fresh history', () => {
  const projection = resolveCurrentProjection([
    row({ current_bundle_price: 1200, last_checked: '2026-09-05T16:00:00+07:00', fresh_until: FUTURE, source_evidence_row: 90 }),
    row({ current_bundle_price: 990, last_checked: '2026-09-05T18:00:00+07:00', fresh_until: '2026-09-05T18:20:00+07:00', source_evidence_row: 100 })
  ], { now: NOW });
  assert.strictEqual(projection.length, 0);
});

test('ambiguous same-time latest observations fail closed', () => {
  const projection = resolveCurrentProjection([
    row({ current_bundle_price: 990, last_checked: '2026-09-05T18:00:00+07:00', source_evidence_row: 100 }),
    row({ current_bundle_price: 1090, last_checked: '2026-09-05T18:00:00+07:00', source_evidence_row: 101 })
  ], { now: NOW });
  assert.strictEqual(projection.length, 0);
});

test('event identity is isolated', () => {
  const result = assessCurrentExactMarket([
    row({ competitor_account: 'A' }),
    row({ event_key: 'EVENT|other|20261001', competitor_account: 'B', current_bundle_price: 900 })
  ], { now: NOW, event_key: 'EVENT|demo|20261001', package_key: 'VIVO_X300_PRO+LENS' });
  assert.strictEqual(result.independent_competitor_count, 1);
});

test('package identity is isolated', () => {
  const result = assessCurrentExactMarket([
    row({ competitor_account: 'A' }),
    row({ competitor_account: 'B', package_key: 'VIVO_X300_PRO+LENS_200MM', current_bundle_price: 900 })
  ], { now: NOW, event_key: 'EVENT|demo|20261001', package_key: 'VIVO_X300_PRO+LENS' });
  assert.strictEqual(result.independent_competitor_count, 1);
});

test('same normalized competitor counts once', () => {
  const result = assessCurrentExactMarket([
    row({ competitor_account: '@ShopA', current_bundle_price: 1000 }),
    row({ competitor_account: ' shopa ', current_bundle_price: 900, last_checked: '2026-09-05T18:10:00+07:00', source_evidence_row: 101 })
  ], { now: NOW, event_key: 'EVENT|demo|20261001', package_key: 'VIVO_X300_PRO+LENS' });
  assert.strictEqual(result.independent_competitor_count, 1);
  assert.strictEqual(result.accepted[0].current_bundle_price, 900);
});

test('own shop is excluded when supplied by authority', () => {
  const result = assessCurrentExactMarket([
    row({ competitor_account: 'KKPhoneRental' }),
    row({ competitor_account: 'OtherShop', current_bundle_price: 1100, source_evidence_row: 101 })
  ], {
    now: NOW,
    event_key: 'EVENT|demo|20261001',
    package_key: 'VIVO_X300_PRO+LENS',
    own_competitor_ids: ['kkphonerental']
  });
  assert.strictEqual(result.independent_competitor_count, 1);
  assert(result.rejected.some(x => x.reasons.includes('OWN_SHOP_EXCLUDED')));
});

test('two independent fresh shops allow exact range but not median', () => {
  const result = assessCurrentExactMarket([
    row({ competitor_account: 'A', current_bundle_price: 900 }),
    row({ competitor_account: 'B', current_bundle_price: 1100, source_evidence_row: 101 })
  ], { now: NOW, event_key: 'EVENT|demo|20261001', package_key: 'VIVO_X300_PRO+LENS' });
  assert.strictEqual(result.exact_range_eligible, true);
  assert.strictEqual(result.exact_median_eligible, false);
  assert.deepStrictEqual(result.market_range, { min: 900, max: 1100 });
  assert.strictEqual(result.median, null);
});

test('three independent fresh shops allow median', () => {
  const result = assessCurrentExactMarket([
    row({ competitor_account: 'A', current_bundle_price: 900 }),
    row({ competitor_account: 'B', current_bundle_price: 1100, source_evidence_row: 101 }),
    row({ competitor_account: 'C', current_bundle_price: 1000, source_evidence_row: 102 })
  ], { now: NOW, event_key: 'EVENT|demo|20261001', package_key: 'VIVO_X300_PRO+LENS' });
  assert.strictEqual(result.exact_median_eligible, true);
  assert.strictEqual(result.median, 1000);
});

test('non-bookable current offer is excluded from active market stats', () => {
  const result = assessCurrentExactMarket([
    row({ competitor_account: 'A', queue_status: 'FULL' }),
    row({ competitor_account: 'B', current_bundle_price: 1100, source_evidence_row: 101 })
  ], { now: NOW, event_key: 'EVENT|demo|20261001', package_key: 'VIVO_X300_PRO+LENS' });
  assert.strictEqual(result.independent_competitor_count, 1);
  assert(result.rejected.some(x => x.reasons.includes('QUEUE_NOT_BOOKABLE')));
});

test('exact projection readback succeeds only when lineage fields match', () => {
  const intended = row();
  const actual = Object.assign({}, intended);
  assert.strictEqual(assertProjectionReadback(intended, actual).ok, true);
});

test('projection readback detects price mismatch', () => {
  const result = assertProjectionReadback(row(), row({ current_bundle_price: 999 }));
  assert.strictEqual(result.ok, false);
  assert(result.mismatches.includes('current_bundle_price'));
});

test('projection readback detects source-lineage mismatch', () => {
  const result = assertProjectionReadback(row(), row({ source_evidence_row: 999 }));
  assert.strictEqual(result.ok, false);
  assert(result.mismatches.includes('source_evidence_row'));
});

console.log(`\n${passed}/${passed} competitor current-market assertions PASS`);
