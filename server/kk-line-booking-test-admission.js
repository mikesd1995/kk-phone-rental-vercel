'use strict';

// Pure admission policy. Test identities never authorize a booking quota or replay.
const USER_ID = /^U[0-9a-f]{32}$/;
function invalid() {
  const code = 'LINE_BOOKING_TEST_CONFIG_INVALID';
  throw Object.assign(new Error(code), {code});
}
function configuration(env = {}) {
  const mode = env.KK_LINE_BOOKING_TEST_MODE;
  if (mode === undefined || mode === 'false') {
    return Object.freeze({enabled:false,userIds:Object.freeze([])});
  }
  if (mode !== 'true' || typeof env.KK_LINE_BOOKING_TEST_USER_IDS !== 'string') invalid();
  const userIds = env.KK_LINE_BOOKING_TEST_USER_IDS.split(',').map(value => value.trim());
  if (userIds.length < 1 || userIds.length > 10 ||
      userIds.some(value => !USER_ID.test(value)) || new Set(userIds).size !== userIds.length) invalid();
  return Object.freeze({enabled:true,userIds:Object.freeze(userIds)});
}
function isUserAllowed(userId, policy) {
  return !policy.enabled || (typeof userId === 'string' && USER_ID.test(userId) && policy.userIds.includes(userId));
}
function isEventAllowed(event, policy) {
  return !policy.enabled || Boolean(event && event.source && event.source.type === 'user' &&
    isUserAllowed(event.source.userId, policy));
}
function assertOwnerAllowed(env, policy) {
  if (policy.enabled && (!isUserAllowed(env.KK_OWNER_LINE_USER_ID, policy) ||
      !isUserAllowed(env.KK_OWNER_LINE_TARGET_ID || env.KK_OWNER_LINE_USER_ID, policy))) invalid();
}
module.exports = {configuration,isUserAllowed,isEventAllowed,assertOwnerAllowed};
