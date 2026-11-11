'use strict';

// Identity-to-Terms boundary for signed LINE Messaging API events.
// A browser checkbox/localStorage value is never evidence of a specific user.
// The real webhook must validate x-line-signature before invoking this helper.
const Terms = require('./kk-booking-terms-evidence');
const Policy = require('./kk-customer-accept-once-policy');
const {createStore} = require('./kk-customer-auth-store');
const LINE_ID = /^U[0-9a-f]{32}$/;

function configured(env={}) {
  return env.KK_CUSTOMER_LOGIN_ENABLED === 'true' &&
    env.KK_LINE_LOGIN_PROVIDER_VERIFIED === 'true' &&
    env.KK_CUSTOMER_AUTH_MIGRATION_VERIFIED === 'true' &&
    typeof env.KK_LINE_LOGIN_PROVIDER_ID === 'string' &&
    env.KK_LINE_LOGIN_PROVIDER_ID.length > 0 &&
    env.KK_LINE_LOGIN_PROVIDER_ID.length <= 128 &&
    Boolean(env.KK_CUSTOMER_AUTH_SUPABASE_URL) &&
    Boolean(env.KK_CUSTOMER_AUTH_SUPABASE_SERVICE_ROLE_KEY);
}

async function lookupSignedLineAcceptance(event, env=process.env, fetchImpl=fetch,
                                           {signatureVerified=false}={}) {
  // This flag is supplied ONLY by the authenticated LINE webhook handler,
  // never parsed from the customer text, the event JSON or a request header.
  if (signatureVerified !== true) return {accepted:false,status:'SIGNED_WEBHOOK_REQUIRED'};
  if (!configured(env)) return {accepted:false,status:'IDENTITY_RECEIPT_NOT_CONFIGURED'};
  const userId=event && event.source && event.source.type === 'user' &&
    event.source.userId;
  if (typeof userId !== 'string' || !LINE_ID.test(userId)) {
    return {accepted:false,status:'SIGNED_LINE_USER_REQUIRED'};
  }
  try {
    const store=createStore({
      url:env.KK_CUSTOMER_AUTH_SUPABASE_URL,
      serviceKey:env.KK_CUSTOMER_AUTH_SUPABASE_SERVICE_ROLE_KEY,
      fetchImpl,timeoutMs:1200
    });
    const receipt=await store.findAcceptanceForLineUser(
      env.KK_LINE_LOGIN_PROVIDER_ID,userId,Terms.VERSION
    );
    return Policy.decideSignedWebhookAcceptance({
      providerId:env.KK_LINE_LOGIN_PROVIDER_ID,
      lineUserId:userId,receipt
    });
  } catch (_) {
    // Never reveal user IDs, tokens, provider error bodies or private SQL data.
    return {accepted:false,status:'IDENTITY_RECEIPT_UNAVAILABLE'};
  }
}

module.exports={configured,lookupSignedLineAcceptance};
