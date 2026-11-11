'use strict';
// Regression contract: never send a duplicate LINE notification on canonical
// replay, and never notify an owner that a customer push succeeded when it failed.
// These tests intentionally use only local mock fetch; no provider or Sheets writes.
const test = require('node:test');
const assert = require('node:assert/strict');
const Approval = require('../server/line-booking-owner-approval');

const env = () => ({
  KK_LINE_BOOKING_AUTOMATION_ENABLED: 'true',
  KK_ADMIN_SCRIPT_URL: 'https://script.google.com/macros/s/TEST/exec',
  KK_ADMIN_API_KEY: 'test-key',
  LINE_CHANNEL_ACCESS_TOKEN: 'test-token',
  LINE_CHANNEL_SECRET: 'test-secret',
  KK_OWNER_LINE_USER_ID: 'UOWNER'
});
const ok = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(body)
});
const event = (bookingId, e) => ({
  type: 'postback',
  replyToken: 'synthetic-owner-reply',
  source: { type: 'user', userId: 'UOWNER' },
  postback: { data: Approval.decisionData('approve', bookingId, e) }
});

test('canonical idempotent replay sends zero LINE messages even with a reply token', async () => {
  const e = env();
  const calls = [];
  const result = await Approval.processOwnerPostback(event('BK-REPLAY', e), e, async (url, options) => {
    calls.push({ url, options });
    assert.match(url, /^https:\/\/script\.google\.com\//);
    return ok({
      ok: true,
      booking_id: 'BK-REPLAY',
      booking_status: 'confirmed',
      decision: 'approve',
      idempotent_replay: true,
      customer_contact: 'UCUSTOMER'
    });
  });
  assert.equal(result.status, 'ALREADY_APPLIED');
  assert.equal(result.customer_notifications, 0);
  assert.equal(result.owner_notifications, 0);
  assert.equal(result.requires_manual_delivery_review, true);
  assert.equal(calls.length, 1);
});

test('customer provider rejection cannot produce owner success reply', async () => {
  const e = env();
  const calls = [];
  await assert.rejects(
    () => Approval.processOwnerPostback(event('BK-PUSH-FAIL', e), e, async (url, options) => {
      calls.push(url);
      if (url.startsWith('https://script.google.com/')) {
        return ok({
          ok: true,
          booking_id: 'BK-PUSH-FAIL',
          booking_status: 'confirmed',
          decision: 'approve',
          idempotent_replay: false,
          customer_contact: 'UCUSTOMER'
        });
      }
      assert.match(url, /\/push$/);
      assert.equal(JSON.parse(options.body).to, 'UCUSTOMER');
      return ok({ message: 'untrusted provider detail' }, 503);
    }),
    err => err && err.code === 'LINE_SEND_FAILED' &&
      err.status === 503 && !String(err.message).includes('untrusted provider detail')
  );
  assert.equal(calls.length, 2);
  assert.equal(calls.some(url => /\/reply$/.test(url)), false);
});

test('canonical decision response must include boolean replay evidence before any send', async () => {
  const e = env();
  let sends = 0;
  await assert.rejects(
    () => Approval.processOwnerPostback(event('BK-REPLAY-UNKNOWN', e), e, async url => {
      if (url.startsWith('https://script.google.com/')) {
        return ok({
          ok: true,
          booking_id: 'BK-REPLAY-UNKNOWN',
          booking_status: 'confirmed',
          decision: 'approve',
          idempotent_replay: 'false',
          customer_contact: 'UCUSTOMER'
        });
      }
      sends++;
      return ok({ ok: true });
    }),
    err => err && err.code === 'LINE_OWNER_DECISION_REPLAY_READBACK_REQUIRED'
  );
  assert.equal(sends, 0);
});
