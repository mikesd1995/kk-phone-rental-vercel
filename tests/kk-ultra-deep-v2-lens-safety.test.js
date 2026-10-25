'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Writer = require('../server/kk-ultra-deep-v2-governed-writer');

const templates = [
  { template_id: 'TPL-VIVO-X300-PRO-PHONE', package_type: 'phone_only', standard_price: 590 },
  { template_id: 'TPL-ZEISS-2-35X-LENS', package_type: 'lens_only', standard_price: 200 },
  { template_id: 'TPL-VIVO-X300-PRO-BUNDLE', package_type: 'phone_lens_bundle', standard_price: 690 }
];
const decision = (extra = {}) => ({
  title: 'Verified Event',
  event_date: '2026-11-26',
  verified_venue: 'Bangkok',
  ...extra
});
const mutation = (price = 590) => ({
  type: 'CREATE_EVENT',
  price,
  poster_url: 'https://example.com/verified-poster.jpg',
  price_basis: 'NOVEMBER_OWNER_MINIMUM'
});
const packages = plan => plan.admin_payload.event_price_overrides;

test('default new event creates a priced phone package but hides both lens packages', () => {
  const plan = Writer.createPlan(decision(), mutation(), templates);
  assert.equal(plan.status, 'READY_FOR_GOVERNED_ADMIN_CREATE');
  const [phone, lens, bundle] = packages(plan);
  assert.equal(phone.override_price, 590);
  assert.equal(phone.active_override, true);
  assert.equal(lens.override_price, 0);
  assert.equal(lens.active_override, false);
  assert.equal(bundle.override_price, 0);
  assert.equal(bundle.active_override, false);
});

test('unverified rule and explicit prohibited rule never unlock a bundle', () => {
  for (const rule of ['UNRESOLVED', 'PROHIBITED', 'UNKNOWN']) {
    const [, , bundle] = packages(Writer.createPlan(
      decision({lens_rule:rule,lens_rule_verified:true}),mutation(),templates
    ));
    assert.equal(bundle.active_override, false);
    assert.equal(bundle.override_price, 0);
  }
});

test('verified organizer approval permits bundle and enforces November minimum 690', () => {
  const [, , bundle] = packages(Writer.createPlan(
    decision({lens_rule:'VERIFIED_ALLOWED',lens_rule_verified:true}),mutation(590),templates
  ));
  assert.equal(bundle.active_override,true);
  assert.equal(bundle.override_price,790);
});

test('lens rule string without independent verification cannot authorize bundle', () => {
  const [, , bundle] = packages(Writer.createPlan(
    decision({lens_rule:'VERIFIED_ALLOWED'}),mutation(),templates
  ));
  assert.equal(bundle.active_override,false);
});

test('November 2026 minimum 590 is fail closed, with explicit owner exception only', () => {
  assert.throws(
    () => Writer.createPlan(decision(),mutation(490),templates),
    {code:'V2_NOVEMBER_PHONE_MINIMUM'}
  );
  const plan=Writer.createPlan(decision({owner_price_exception_verified:true}),mutation(490),templates);
  assert.equal(packages(plan)[0].override_price,490);
  assert.equal(packages(plan)[2].active_override,false);
});

test('different months do not inherit the November floor', () => {
  const plan=Writer.createPlan(decision({event_date:'2026-12-04'}),mutation(490),templates);
  assert.equal(packages(plan)[0].override_price,490);
});

test('booked, owner-hidden or tombstoned dates cannot be recreated', () => {
  for (const blocked of [{booking_count:1},{owner_hidden:true},{tombstone_locked:true}]) {
    assert.throws(
      () => Writer.createPlan(decision(blocked),mutation(),templates),
      {code:'V2_CREATE_OWNER_OR_BOOKING_LOCK'}
    );
  }
});

test('verified prohibition on phone capture blocks new event selling workflow', () => {
  assert.throws(
    () => Writer.createPlan(decision({phone_rule:'NO_PHOTOGRAPHY'}),mutation(),templates),
    {code:'V2_CREATE_PHONE_CAPTURE_PROHIBITED'}
  );
});
