'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_PHONE_PRICE,
  DEFAULT_BUNDLE_PRICE,
  resolvePrice,
  resolvePackagePlan,
  classifyCapacity,
  resolvePromotionState
} = require('../server/core-promotion-policy');

test('v4.9.38 defaults are 890 phone and 1090 bundle', () => {
  assert.equal(DEFAULT_PHONE_PRICE, 890);
  assert.equal(DEFAULT_BUNDLE_PRICE, 1090);
});

test('manual locked price has highest authority', () => {
  assert.deepEqual(
    resolvePrice({ manualPrice: 990, marketPrice: 850, marketFresh: true, standardPrice: 890 }),
    { price: 990, source: 'MANUAL_LOCKED' }
  );
});

test('fresh exact market beats configured standard when no manual lock exists', () => {
  assert.deepEqual(
    resolvePrice({ marketPrice: 950, marketFresh: true, standardPrice: 890 }),
    { price: 950, source: 'MARKET_FRESH_EXACT' }
  );
});

test('missing or stale market falls back to configured standard, not inquiry-only', () => {
  assert.deepEqual(
    resolvePrice({ marketPrice: 700, marketFresh: false, standardPrice: 890 }),
    { price: 890, source: 'DEFAULT_STANDARD' }
  );
  assert.deepEqual(
    resolvePrice({ marketPrice: 0, marketFresh: true, standardPrice: 1090 }),
    { price: 1090, source: 'DEFAULT_STANDARD' }
  );
});

test('lens uncertainty does not block the bundle', () => {
  const plan = resolvePackagePlan({ lensRule: 'UNRESOLVED' });
  assert.equal(plan.phone.enabled, true);
  assert.equal(plan.phone.price, 890);
  assert.equal(plan.bundle.enabled, true);
  assert.equal(plan.bundle.price, 1090);
  assert.equal(plan.bundle.lensRuleAdvisory, 'UNRESOLVED');
  assert.equal(plan.lensOnly.enabled, false);
});

test('even an explicit lens prohibition remains advisory for bundle availability', () => {
  const plan = resolvePackagePlan({ lensRule: 'PROHIBITED' });
  assert.equal(plan.phone.enabled, true);
  assert.equal(plan.bundle.enabled, true);
  assert.equal(plan.bundle.price, 1090);
  assert.equal(plan.bundle.lensRuleAdvisory, 'PROHIBITED');
});

test('lens-only is disabled by default even when lens is allowed', () => {
  const plan = resolvePackagePlan({ lensRule: 'VERIFIED_ALLOWED' });
  assert.equal(plan.phone.price, 890);
  assert.equal(plan.bundle.price, 1090);
  assert.equal(plan.lensOnly.enabled, false);
});

test('inquiry-only requires an explicit flag', () => {
  const normal = resolvePackagePlan({ marketFresh: false });
  assert.equal(normal.phone.inquiryOnly, undefined);
  assert.equal(normal.phone.price, 890);

  const explicit = resolvePackagePlan({ explicitInquiryOnly: true });
  assert.equal(explicit.phone.inquiryOnly, true);
  assert.equal(explicit.phone.price, 0);
});

test('zero phone capacity blocks promotion', () => {
  assert.equal(classifyCapacity({ phoneFree: 0, lensFree: 2 }), 'CAPACITY_BLOCKED');
  assert.equal(resolvePromotionState({ verified: true, identityExact: true, phoneFree: 0, lensFree: 2 }), 'BLOCK_CAPACITY');
});

test('verified exact identity with capacity reaches ready state', () => {
  assert.equal(resolvePromotionState({
    verified: true,
    identityExact: true,
    phoneFree: 2,
    lensFree: 2,
    lensRule: 'VERIFIED_ALLOWED'
  }), 'READY_FOR_PROMOTION');
});
