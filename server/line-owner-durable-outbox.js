'use strict';

// Booking owner decisions use a canonical Apps Script outbox in the SAME
// spreadsheet/document lock as their booking transition. This dispatcher does
// not send anything unless that outbox granted a one-time durable claim.
const crypto = require('node:crypto');
const LineMessaging = require('./kk-line-messaging-api');

const VERSION = 'KK_LINE_OWNER_OUTBOX_V1';
const OUTBOX_ID = /^LINE_OWNER_V1_[a-f0-9]{48}$/;
const LINE_USER = /^U[A-Za-z0-9_-]{20,}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const val = v => String(v === undefined || v === null ? '' : v).trim();

function status(bookingId, state, extras = {}) {
  return Object.assign({
    handled: true, booking_id: bookingId, status: state,
    customer_notifications: 0, requires_manual_delivery_review: state === 'DELIVERY_REVIEW_REQUIRED'
  }, extras);
}
function consistent(value, bookingId, decision, outboxId) {
  return !!value && val(value.booking_id) === bookingId
    && val(value.decision) === decision
    && val(value.outbox_id) === outboxId
    && val(value.outbox_mode) === VERSION;
}
function extract(response) {
  return response && response.data || response || {};
}

// Any uncertainty after an outbox claim is treated as a MANUAL REVIEW state:
// never create a second retry key or blindly retry a possibly accepted push.
// Source and provider exceptions are never propagated to webhook error logs.
async function deliverDecision(context = {}, deps = {}) {
  const data = context.data || {};
  const bookingId = val(context.bookingId), decision = val(context.decision);
  const expected = decision === 'approve' ? 'confirmed' : 'cancelled';
  const outboxId = val(data.outbox_id);
  if (!['approve', 'reject'].includes(decision) || !bookingId
      || data.outbox_mode !== VERSION || !OUTBOX_ID.test(outboxId)) {
    const err = new Error('Canonical owner notification outbox unavailable');
    err.code = 'LINE_OWNER_OUTBOX_READBACK_REQUIRED';
    throw err;
  }
  if (val(data.booking_id) !== bookingId || val(data.decision) !== decision
      || val(data.booking_status).toLowerCase() !== expected) {
    const err = new Error('Canonical owner notification identity mismatch');
    err.code = 'LINE_OWNER_OUTBOX_IDENTITY_MISMATCH';
    throw err;
  }
  if (data.outbox_state === 'SENT') {
    return status(bookingId, 'ALREADY_NOTIFIED', {delivery_status: 'SENT'});
  }
  if (data.outbox_state !== 'READY') {
    return status(bookingId, 'DELIVERY_REVIEW_REQUIRED',
      {delivery_status: val(data.outbox_state) || 'UNKNOWN'});
  }
  if (typeof deps.appsScriptCall !== 'function'
      || !deps.lineToken || !/^[A-Za-z0-9_-]{32,128}$/.test(val(deps.dispatchSecret))
      || typeof deps.fetchImpl !== 'function') {
    const err = new Error('Durable owner notification transport unavailable');
    err.code = 'LINE_OWNER_OUTBOX_DEPENDENCIES_MISSING';
    throw err;
  }
  const retryKey = crypto.randomUUID();
  // Apps Script must commit CLAIMED + exact retry key BEFORE this reaches LINE.
  let claim;
  try {
    claim = extract(await deps.appsScriptCall({
      action: 'claimLineBookingDecisionDelivery',
      booking_id: bookingId, decision, outbox_id: outboxId, retry_key: retryKey,
      outbox_dispatch_key: deps.dispatchSecret
    }));
  } catch (_) {
    return status(bookingId, 'DELIVERY_REVIEW_REQUIRED', {delivery_status: 'CLAIM_UNCERTAIN'});
  }
  if (!claim || claim.claimed !== true) {
    return status(bookingId, 'DELIVERY_REVIEW_REQUIRED',
      {delivery_status: val(claim && claim.outbox_state) || 'NOT_CLAIMED'});
  }
  if (!consistent(claim, bookingId, decision, outboxId)
      || claim.outbox_state !== 'CLAIMED' || !UUID.test(val(claim.retry_key))
      || val(claim.retry_key) !== retryKey || !LINE_USER.test(val(claim.customer_contact))) {
    // A malformed claim may nevertheless have been committed. Do not send.
    return status(bookingId, 'DELIVERY_REVIEW_REQUIRED', {delivery_status: 'CLAIM_READBACK_INVALID'});
  }
  const settle = async (deliveryState, providerMessageId) => {
    const ack = extract(await deps.appsScriptCall({
      action: 'settleLineBookingDecisionDelivery',
      booking_id: bookingId, decision, outbox_id: outboxId,
      retry_key: retryKey, delivery_state: deliveryState,
      provider_message_id: providerMessageId || '',outbox_dispatch_key:deps.dispatchSecret
    }));
    if (!consistent(ack, bookingId, decision, outboxId) || ack.outbox_state !== deliveryState
        || (deliveryState === 'SENT' && val(ack.provider_message_id) !== providerMessageId)) {
      throw new Error('Canonical owner outbox settlement readback missing');
    }
  };
  let receipt;
  try {
    if (!context.customerMessage || context.customerMessage.type !== 'text'
        || !val(context.customerMessage.text)) throw Error('Invalid customer decision content');
    receipt = await LineMessaging.pushText({
      to: val(claim.customer_contact), text: context.customerMessage.text
    }, {
      token: deps.lineToken, retryKey, fetchImpl: deps.fetchImpl
    });
    if (receipt.provider_confirmed !== true || !val(receipt.external_message_id))
      throw new Error('LINE provider receipt missing');
  } catch (_) {
    try { await settle('UNCERTAIN', ''); } catch (_) {}
    return status(bookingId, 'DELIVERY_REVIEW_REQUIRED', {delivery_status: 'UNCERTAIN'});
  }
  try {
    await settle('SENT', val(receipt.external_message_id));
  } catch (_) {
    // Provider accepted a delivery but canonical acknowledgement was uncertain.
    // A repeat owner webhook MUST not claim the same outbox again.
    return status(bookingId, 'DELIVERY_REVIEW_REQUIRED', {delivery_status: 'SETTLEMENT_UNCERTAIN'});
  }
  if (typeof deps.replyOwner === 'function') {
    try { await deps.replyOwner(); }
    catch (_) {
      return status(bookingId, 'CUSTOMER_SENT_OWNER_REPLY_FAILED',
        {customer_notifications: 1, delivery_status: 'SENT', provider_receipt: true});
    }
  }
  return status(bookingId, expected.toUpperCase(),
    {customer_notifications: 1, delivery_status: 'SENT', provider_receipt: true});
}
module.exports = {VERSION, deliverDecision};
