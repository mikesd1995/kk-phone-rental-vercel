'use strict';
// Synthetic local regressions only; no network or provider operations.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const root = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '../lib');
const market = require(path.join(root, 'kk-competitor-current-market.js'));
const { bindCreative } = require(path.join(root, 'kk-creative-binding-guard.js'));
const { authorizeXPublish } = require(path.join(root, 'kk-x-publish-guard.js'));
const now = '2026-09-07T10:00:00+07:00';
const options = { now, event_key: 'AUDIT_SYNTH_EVENT', package_key: 'AUDIT_SYNTH_PACKAGE' };
const hash = s => crypto.createHash('sha256').update(s).digest('hex');
function offer(overrides = {}) {
  return { event_key: options.event_key, competitor_account: 'AUDIT_SYNTH_SHOP', package_key: options.package_key,
    bundle_price: 100, last_checked: '2026-09-07T09:00:00+07:00', fresh_until: '2026-09-07T12:00:00+07:00',
    freshness: 'FRESH', source_evidence_row: 2, queue_status: 'OPEN', ...overrides };
}
function publishFixture() {
  const content = { status: 'APPROVED', version_id: 'AUDIT_SYNTH_V1', approval_fingerprint: hash('AUDIT_SYNTH_APPROVAL'),
    selected_body: 'AUDIT SYNTHETIC BODY A', external_send_authorized: true, production_publish_authorized: true };
  const asset = { content_version_id: content.version_id, approval_fingerprint: content.approval_fingerprint,
    selected_body_sha256: hash(content.selected_body), source_authority: 'OFFICIAL_EVENT',
    source_asset_ref: 'AUDIT_SYNTH_SOURCE', source_asset_hash: hash('AUDIT_SYNTH_SOURCE'),
    creative_hash: hash('AUDIT_SYNTH_CREATIVE'), canva_design_id: 'AUDIT_SYNTH_CANVA',
    source_evidence_ref: 'AUDIT_SYNTH_EVIDENCE' };
  return { content, input: { content, creative_binding: bindCreative({ approved_content: content, creative_asset: asset }),
    idempotency_key: 'AUDIT_SYNTH_NO_SEND', prior_publish_records: [] } };
}
const cases = [];
const test = (name, run) => cases.push([name, run]);
test('projection identity survives producer-to-consumer round trip', () => {
  const projection = market.resolveCurrentProjection([offer()], { now });
  assert.equal(projection.length, 1);
  assert.equal(market.assessCurrentExactMarket(projection, options).independent_competitor_count, 1);
});
test('projection readback detects another competitor key', () => {
  const [projection] = market.resolveCurrentProjection([offer()], { now });
  const result = market.assertProjectionReadback(projection, { ...projection, competitor_key: 'wrong_shop' });
  assert.equal(result.ok, false);
  assert(result.mismatches.includes('competitor_key'));
});
test('canonical business identity retains precedence over projection alias', () => {
  assert.equal(market.canonicalIdentity(offer({ competitor_business_id: ' Canonical ', competitor_key: 'projection' })).competitor_key, 'canonical');
});
for (const status of ['UNAVAILABLE', 'SEP19_UNAVAILABLE|SEP20_FULL', 'CLOSED', 'PAUSED']) {
  test('queue rejects ' + status, () => assert.equal(market.queueIsBookable({ queue_status: status }), false));
}
for (const status of ['OPEN', 'AVAILABLE', 'REOPENED', 'SEP19_VIVO_FULL|SEP20_AVAILABLE', 'SEP19_UNAVAILABLE|SEP20_OPEN']) {
  test('queue preserves ' + status, () => assert.equal(market.queueIsBookable({ queue_status: status }), true));
}
for (const [label, fields] of [
  ['stale', { freshness: 'STALE' }],
  ['conflict-held', { freshness: 'CONFLICT_HOLD' }],
  ['expired', { fresh_until: now }],
  ['unavailable', { queue_status: 'UNAVAILABLE' }],
  ['invalid-price', { bundle_price: 0 }]
]) {
  test('newest ' + label + ' offer never revives older fresh price in either order', () => {
    const rows = [offer(), offer({ bundle_price: 200, last_checked: '2026-09-07T09:30:00+07:00', source_evidence_row: 3, ...fields })];
    for (const ordered of [rows, rows.slice().reverse()]) {
      const result = market.assessCurrentExactMarket(ordered, options);
      assert.equal(result.independent_competitor_count, 0);
      assert.equal(result.market_range, null);
    }
  });
}
test('conflicting newest offers fail closed in either order', () => {
  const rows = [offer(), offer({ bundle_price: 200, source_evidence_row: 3 })];
  for (const ordered of [rows, rows.slice().reverse()]) {
    const result = market.assessCurrentExactMarket(ordered, options);
    assert.equal(result.independent_competitor_count, 0);
    assert(result.rejected.some(r => r.reasons.includes('AMBIGUOUS_LATEST_OBSERVATION')));
  }
});
test('identical repeated current row still counts once', () => {
  assert.equal(market.assessCurrentExactMarket([offer(), offer()], options).independent_competitor_count, 1);
});
test('valid newest offer counts once with the latest price', () => {
  const result = market.assessCurrentExactMarket([offer(), offer({ bundle_price: 200, last_checked: '2026-09-07T09:30:00+07:00', source_evidence_row: 3 })], options);
  assert.equal(result.independent_competitor_count, 1);
  assert.equal(result.accepted[0].bundle_price, 200);
});
test('missing competitor identity keeps its rejection reason', () => {
  const result = market.assessCurrentExactMarket([offer({ competitor_account: '' })], options);
  assert.equal(result.independent_competitor_count, 0);
  assert(result.rejected.some(r => r.reasons.includes('MISSING_COMPETITOR_IDENTITY')));
});
test('own shop exclusion works on projection output', () => {
  const rows = market.resolveCurrentProjection([offer()], { now });
  const result = market.assessCurrentExactMarket(rows, { ...options, own_competitor_ids: ['AUDIT_SYNTH_SHOP'] });
  assert.equal(result.independent_competitor_count, 0);
  assert(result.rejected.some(r => r.reasons.includes('OWN_SHOP_EXCLUDED')));
});
test('range and median use independent projected businesses', () => {
  const rows = market.resolveCurrentProjection([offer(), offer({ competitor_account: 'AUDIT_SHOP_B', bundle_price: 200 }),
    offer({ competitor_account: 'AUDIT_SHOP_C', bundle_price: 300 })], { now });
  const two = market.assessCurrentExactMarket(rows.slice(0, 2), options);
  assert.equal(two.exact_range_eligible, true);
  assert.equal(two.median, null);
  const three = market.assessCurrentExactMarket(rows, options);
  assert.deepEqual(three.market_range, { min: 100, max: 300 });
  assert.equal(three.median, 200);
});
test('changed approved body requires a matching creative binding', () => {
  const f = publishFixture();
  assert.throws(() => authorizeXPublish({ ...f.input, content: { ...f.content, selected_body: 'AUDIT SYNTHETIC BODY B' } }), /creative\/content exact body hash mismatch/);
});
for (const value of [undefined, '', 'not-a-hash', hash('WRONG_BODY')]) {
  test('missing malformed or mismatched selected-body hash rejects: ' + String(value), () => {
    const f = publishFixture();
    assert.throws(() => authorizeXPublish({ ...f.input, creative_binding: { ...f.input.creative_binding, selected_body_sha256: value } }), /creative\/content exact body hash mismatch/);
  });
}
test('matching real binding remains locally authorized', () => {
  const f = publishFixture();
  assert.equal(authorizeXPublish(f.input).decision, 'PUBLISH_AUTHORIZED');
});
test('uppercase matching SHA-256 remains accepted', () => {
  const f = publishFixture();
  f.input.creative_binding.selected_body_sha256 = f.input.creative_binding.selected_body_sha256.toUpperCase();
  assert.equal(authorizeXPublish(f.input).decision, 'PUBLISH_AUTHORIZED');
});
test('same-scope receipt still suppresses repeat publication', () => {
  const f = publishFixture();
  const request = authorizeXPublish(f.input);
  const prior = { idempotency_key: f.input.idempotency_key, publish_scope_fingerprint: request.publish_scope_fingerprint,
    post_id: 'SYNTHETIC', post_url: 'https://x.com/AUDIT_SYNTH/status/SYNTHETIC', provider_evidence_ref: 'SYNTHETIC_TEST_ONLY' };
  assert.equal(authorizeXPublish({ ...f.input, prior_publish_records: [prior] }).decision, 'DUPLICATE_NO_PUBLISH');
});
let failed = 0;
for (const [name, run] of cases) {
  try { run(); console.log('CHECK_OK ' + name); }
  catch (error) { failed++; console.log('CHECK_FAILED ' + name + ': ' + error.message); }
}
console.log(JSON.stringify({ cases: cases.length, passed: cases.length - failed, failed, evidence_class: 'LOCAL_SYNTHETIC',
  synthetic: true, provider_calls: 0, production_writes: 0 }));
if (failed) process.exitCode = 1;
