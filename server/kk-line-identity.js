'use strict';

// Provider-issued LINE identity syntax. It does NOT prove channel ownership,
// consent, friendship or provider delivery; those have separate safety gates.
// Reused at inbound booking, owner approval and the durable delivery outbox.
const USER_ID = /^U[0-9a-f]{32}$/;
const PUSH_TARGET_ID = /^[UCR][0-9a-f]{32}$/;
function isUserId(value) {
  return typeof value === 'string' && USER_ID.test(value.trim());
}
function isPushTarget(value) {
  return typeof value === 'string' && PUSH_TARGET_ID.test(value.trim());
}
module.exports = {isUserId, isPushTarget};
