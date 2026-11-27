'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Terms = require('../server/kk-booking-terms-evidence');
const Policy = require('../server/kk-customer-accept-once-policy');

const NOW = Date.parse('2026-11-10T00:00:00+07:00');
const LINE_USER = 'U' + 'a'.repeat(32);
const OTHER_USER = 'U' + 'b'.repeat(32);
const SESSION = Object.freeze({
  authentication: 'LINE_ID_TOKEN_SERVER_VERIFIED',
  provider_id: 'line-provider-kk',
  line_user_id: LINE_USER
});
const RECEIPT = Object.freeze({
  provider_id: SESSION.provider_id,
  line_user_id: LINE_USER,
  terms_version: Terms.VERSION,
  accepted_at: '2026-11-07T12:40:00+07:00',
  evidence_source: 'SIGNED_LINE_WEBHOOK',
  evidence_verified: true,
  evidence_reference: 'line:sample-valid-ref-0001'
});
const decision = (session = SESSION, receipt = RECEIPT) =>
  Policy.decideAcceptOnce({session, receipt, nowMs: NOW});

test('current verified durable LINE evidence for the same provider permits skipping repeated Terms UX', () => {
  assert.deepEqual(decision(), {
    policy_version: 'KK_ACCEPT_ONCE_POLICY_V1',
    terms_version: Terms.VERSION,
    status: 'CURRENT_ACCEPTANCE_VERIFIED',
    skip_agreement: true
  });
});

test('a first-time customer must explicitly accept the current Terms', () => {
  assert.equal(decision(SESSION, null).status, 'CURRENT_ACCEPTANCE_REQUIRED');
  assert.equal(decision(SESSION, null).skip_agreement, false);
});

test('missing, invalid or forged client-side identity cannot skip Terms', () => {
  for (const session of [
    null, {}, { ...SESSION, authentication: 'LOCAL_STORAGE' },
    { ...SESSION, authentication: undefined },
    { ...SESSION, line_user_id: 'fake' },
    { ...SESSION, provider_id: '' },
    { ...SESSION, line_user_id: OTHER_USER, authentication: 'CLIENT_ASSERTED' }
  ]) {
    assert.deepEqual(decision(session), {
      policy_version: 'KK_ACCEPT_ONCE_POLICY_V1',
      terms_version: Terms.VERSION,
      status: 'LOGIN_REQUIRED',
      skip_agreement: false
    });
  }
});

test('never conflate LINE identities across providers or accounts', () => {
  for (const receipt of [
    { ...RECEIPT, provider_id: 'different-line-provider' },
    { ...RECEIPT, line_user_id: OTHER_USER }
  ]) assert.equal(decision(SESSION, receipt).skip_agreement, false);
});

test('old Terms versions and fabricated timestamps do not confer current acceptance', () => {
  for (const receipt of [
    { ...RECEIPT, terms_version: 'KK-TERMS-2026-11-05' },
    { ...RECEIPT, accepted_at: '2026-11-01T00:00:00+07:00' },
    { ...RECEIPT, accepted_at: '2026-12-01T00:00:00+07:00' },
    { ...RECEIPT, accepted_at: 'not-a-timestamp' }
  ]) assert.equal(decision(SESSION, receipt).status, 'CURRENT_ACCEPTANCE_REQUIRED');
});

test('local checkbox, unsent LINE draft and unverified evidence are insufficient', () => {
  for (const receipt of [
    { ...RECEIPT, evidence_source: 'LOCAL_STORAGE' },
    { ...RECEIPT, evidence_source: 'UNSENT_LINE_DRAFT' },
    { ...RECEIPT, evidence_verified: false },
    { ...RECEIPT, evidence_reference: '' },
    { ...RECEIPT, evidence_reference: 'abc' },
    { ...RECEIPT, evidence_reference: 'https://example.com/unsafe?customer=123' }
  ]) assert.equal(decision(SESSION, receipt).skip_agreement, false);
});

test('web-origin evidence can be considered only when independently server verified and persisted', () => {
  const valid = { ...RECEIPT, evidence_source: 'AUTHENTICATED_WEB_ACTION', evidence_reference: 'server:terms-accept-0001' };
  assert.equal(decision(SESSION, valid).skip_agreement, true);
  assert.equal(decision(SESSION, { ...valid, evidence_verified: false }).skip_agreement, false);
});

test('unknown clock or expired/unknown verification state fails closed', () => {
  assert.equal(Policy.decideAcceptOnce({session: SESSION, receipt: RECEIPT, nowMs: NaN}).skip_agreement, false);
  assert.equal(Policy.decideAcceptOnce().skip_agreement, false);
  assert.equal(Policy.decideAcceptOnce({session: SESSION, receipt: RECEIPT, nowMs: 0}).skip_agreement, false);
});
