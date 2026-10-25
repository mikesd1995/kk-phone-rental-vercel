'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_PHONE_PRICE,
  DEFAULT_BUNDLE_PRICE,
  resolvePrice,
  resolvePackagePlan,
  hasUsablePoster,
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

test('unresolved or missing official lens policy disables lens bundle without blocking phone', () => {
  for (const input of [{}, { lensRule: 'UNRESOLVED' }, { lensRule: 'VERIFIED_ALLOWED' }]) {
    const plan = resolvePackagePlan(input);
    assert.equal(plan.phone.enabled, true);
    assert.equal(plan.phone.price, 890);
    assert.equal(plan.bundle.enabled, false);
    assert.equal(plan.bundle.reason, 'LENS_PERMISSION_NOT_VERIFIED');
    assert.equal(plan.lensOnly.enabled, false);
  }
});

test('explicit lens prohibition blocks bundle even if verifier flag was supplied', () => {
  const plan = resolvePackagePlan({ lensRule: 'PROHIBITED', lensPermissionVerified: true });
  assert.equal(plan.phone.enabled, true);
  assert.equal(plan.bundle.enabled, false);
  assert.equal(plan.bundle.reason, 'LENS_PERMISSION_NOT_VERIFIED');
});

test('verified organizer permission enables bundle without changing approved prices', () => {
  const plan = resolvePackagePlan({
    lensRule: 'VERIFIED_ALLOWED',
    lensPermissionVerified: true,
    manualPhonePrice: 590,
    manualBundlePrice: 690
  });
  assert.equal(plan.phone.enabled, true);
  assert.equal(plan.phone.price, 590);
  assert.equal(plan.bundle.enabled, true);
  assert.equal(plan.bundle.price, 690);
  assert.equal(plan.bundle.source, 'MANUAL_LOCKED');
  assert.equal(plan.lensRuleAdvisory, undefined);
});

test('lens-only is disabled by default even when lens is allowed', () => {
  const plan = resolvePackagePlan({ lensRule: 'VERIFIED_ALLOWED', lensPermissionVerified: true });
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
  assert.equal(resolvePromotionState({
    verified: true,
    identityExact: true,
    phoneFree: 0,
    lensFree: 2,
    posterUrl: 'https://example.com/poster.jpg'
  }), 'BLOCK_CAPACITY');
});

test('poster URL is required before promotion can reach ready state', () => {
  assert.equal(hasUsablePoster('https://example.com/poster.jpg'), true);
  assert.equal(hasUsablePoster(''), false);
  assert.equal(hasUsablePoster('not-a-url'), false);
  assert.equal(resolvePromotionState({
    verified: true,
    identityExact: true,
    phoneFree: 2,
    lensFree: 2,
    posterUrl: ''
  }), 'POSTER_MISSING_DEBT');
});

test('verified exact identity with poster and capacity reaches ready state', () => {
  assert.equal(resolvePromotionState({
    verified: true,
    identityExact: true,
    phoneFree: 2,
    lensFree: 2,
    lensRule: 'VERIFIED_ALLOWED',
    posterUrl: 'https://example.com/poster.jpg'
  }), 'READY_FOR_PROMOTION');
});
