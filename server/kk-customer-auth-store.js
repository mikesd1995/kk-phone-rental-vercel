'use strict';

// Dedicated, server-only PostgREST adapter. No browser credentials or direct table endpoints.
const RPC_BASE = '/rest/v1/rpc/';
const ID = /^U[0-9a-f]{32}$/;

function createStore({ url, serviceKey, fetchImpl = fetch, timeoutMs = 6000 } = {}) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 500 || timeoutMs > 6000) throw new Error('CUSTOMER_STORE_TIMEOUT_INVALID');
  const base = String(url || '').replace(/\/+$/, '');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(base)) throw new Error('CUSTOMER_STORE_URL_INVALID');
  if (typeof serviceKey !== 'string' || serviceKey.length < 20) throw new Error('CUSTOMER_STORE_KEY_REQUIRED');
  async function rpc(name, values) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(base + RPC_BASE + name, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json', Accept: 'application/json',
          apikey: serviceKey, Authorization: 'Bearer ' + serviceKey
        },
        body: JSON.stringify(values),
        signal: controller.signal
      });
      if (!res || !res.ok) throw new Error('CUSTOMER_STORE_UNAVAILABLE');
      return await res.json();
    } finally { clearTimeout(timeout); }
  }
  function one(result) { return Array.isArray(result) ? (result[0] || null) : null; }

  return Object.freeze({
    async createSession(tokenHash, providerId, lineUserId, expiresAt) {
      if (!/^[0-9a-f]{64}$/.test(tokenHash) || !ID.test(lineUserId)) throw new Error('CUSTOMER_SESSION_INPUT_INVALID');
      const result = await rpc('kk_customer_session_create', {
        p_token_hash: tokenHash, p_provider_id: providerId,
        p_line_user_id: lineUserId, p_expires_at: expiresAt
      });
      if (result !== true) throw new Error('CUSTOMER_SESSION_WRITE_UNVERIFIED');
      return true;
    },
    async readSession(tokenHash) {
      if (!/^[0-9a-f]{64}$/.test(tokenHash)) return null;
      const row = one(await rpc('kk_customer_session_lookup', { p_token_hash: tokenHash }));
      return row && ID.test(row.line_user_id) && typeof row.provider_id === 'string' ? {
        provider_id: row.provider_id, line_user_id: row.line_user_id,
        authentication: 'LINE_ID_TOKEN_SERVER_VERIFIED'
      } : null;
    },
    async revokeSession(tokenHash) {
      if (!/^[0-9a-f]{64}$/.test(tokenHash)) return false;
      return (await rpc('kk_customer_session_revoke', { p_token_hash: tokenHash })) === true;
    },
    async findAcceptance(tokenHash, termsVersion) {
      if (!/^[0-9a-f]{64}$/.test(tokenHash)) return null;
      return one(await rpc('kk_customer_terms_lookup', {
        p_token_hash: tokenHash, p_terms_version: termsVersion
      }));
    },
    // Server-side only: the caller must have independently verified the
    // Messaging API webhook signature before supplying its event.source.userId.
    // This RPC cannot be called by anon/authenticated roles in the schema.
    async findAcceptanceForLineUser(providerId, lineUserId, termsVersion) {
      if(typeof providerId !== 'string' || providerId.length === 0 ||
         providerId.length > 128 || !ID.test(String(lineUserId || '')) ||
         !/^KK-TERMS-\d{4}-\d{2}-\d{2}$/.test(String(termsVersion || ''))) {
        return null;
      }
      return one(await rpc('kk_customer_terms_lookup_for_line_webhook', {
        p_provider_id:providerId,
        p_line_user_id:lineUserId,
        p_terms_version:termsVersion
      }));
    },
    async acceptTerms(tokenHash, termsVersion, evidenceReference) {
      if (!/^[0-9a-f]{64}$/.test(tokenHash) ||
          !/^web:[A-Za-z0-9_-]{20,128}$/.test(evidenceReference)) throw new Error('CUSTOMER_ACCEPT_INPUT_INVALID');
      const row = one(await rpc('kk_customer_terms_accept', {
        p_token_hash: tokenHash, p_terms_version: termsVersion,
        p_evidence_reference: evidenceReference
      }));
      if (!row) throw new Error('CUSTOMER_ACCEPT_WRITE_UNVERIFIED');
      return row;
    }
  });
}
module.exports = { createStore };
