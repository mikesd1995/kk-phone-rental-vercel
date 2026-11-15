'use strict';

// Read-only, server-side decision helper for future authenticated checkout.
// This module does NOT perform OAuth, issue sessions or persist customer evidence.
const TermsEvidence = require('./kk-booking-terms-evidence');

const POLICY_VERSION = 'KK_ACCEPT_ONCE_POLICY_V1';
const LINE_USER_ID = /^U[0-9a-f]{32}$/;
const VERIFIED_SOURCES = new Set(['SIGNED_LINE_WEBHOOK', 'AUTHENTICATED_WEB_ACTION']);
const TERMS_EARLIEST_AT = Date.parse('2026-11-06T00:00:00+07:00');

function isVerifiedSession(session) {
  return Boolean(
    session &&
    session.authentication === 'LINE_ID_TOKEN_SERVER_VERIFIED' &&
    typeof session.provider_id === 'string' &&
    session.provider_id.length > 0 &&
    session.provider_id.length <= 128 &&
    typeof session.line_user_id === 'string' &&
    LINE_USER_ID.test(session.line_user_id)
  );
}

function isCurrentEvidence(session, receipt, nowMs) {
  if (!receipt || typeof receipt !== 'object') return false;
  if (receipt.provider_id !== session.provider_id ||
      receipt.line_user_id !== session.line_user_id ||
      receipt.terms_version !== TermsEvidence.VERSION ||
      receipt.evidence_verified !== true ||
      !VERIFIED_SOURCES.has(receipt.evidence_source)) return false;
  // A reference to a real, persisted, server-verified witness is required;
  // neither a checkbox, a browser flag nor an unsent LINE draft qualifies.
  if (typeof receipt.evidence_reference !== 'string' ||
      !/^[A-Za-z0-9:_-]{12,160}$/.test(receipt.evidence_reference)) return false;
  if (typeof receipt.accepted_at !== 'string') return false;
  const acceptedAt = Date.parse(receipt.accepted_at);
  return Number.isFinite(acceptedAt) &&
    acceptedAt >= TERMS_EARLIEST_AT &&
    acceptedAt <= nowMs;
}

function decideAcceptOnce({session, receipt, nowMs = Date.now()} = {}) {
  const base = { policy_version: POLICY_VERSION, terms_version: TermsEvidence.VERSION };
  if (!isVerifiedSession(session)) {
    return { ...base, status: 'LOGIN_REQUIRED', skip_agreement: false };
  }
  // This decision must never be called with a client-supplied session or
  // client-supplied receipt. The future authenticated API owns both objects.
  if (!Number.isFinite(nowMs) || !isCurrentEvidence(session, receipt, nowMs)) {
    return { ...base, status: 'CURRENT_ACCEPTANCE_REQUIRED', skip_agreement: false };
  }
  return { ...base, status: 'CURRENT_ACCEPTANCE_VERIFIED', skip_agreement: true };
}

// A signed Messaging API webhook proves the LINE sender, not an OAuth web
// session. Validate against the SAME provider and persisted evidence, without
// fabricating an OAuth session or trusting a browser cookie.
function decideSignedWebhookAcceptance({providerId, lineUserId, receipt, nowMs = Date.now()} = {}) {
  const identity = {provider_id:providerId, line_user_id:lineUserId};
  const accepted = typeof providerId === 'string' && providerId.length > 0 &&
    providerId.length <= 128 && LINE_USER_ID.test(String(lineUserId || '')) &&
    Number.isFinite(nowMs) && isCurrentEvidence(identity, receipt, nowMs);
  return {
    terms_version:TermsEvidence.VERSION,
    status:accepted?'VERIFIED_LINE_IDENTITY_TERMS_ACCEPTED':'TERMS_EVIDENCE_REQUIRED',
    accepted:Boolean(accepted)
  };
}

module.exports = { POLICY_VERSION, decideAcceptOnce, decideSignedWebhookAcceptance };
