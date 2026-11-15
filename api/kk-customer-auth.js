'use strict';

// Isolated, default-OFF customer auth endpoint. Never reuse Admin sessions or business write paths.
const OAuth = require('../server/kk-customer-line-oauth');
const { createStore } = require('../server/kk-customer-auth-store');
const AcceptOnce = require('../server/kk-customer-accept-once-policy');
const Terms = require('../server/kk-booking-terms-evidence');
const crypto = require('node:crypto');

const MAX_BODY_BYTES = 512;

function runtime(env = process.env) {
  if (env.KK_CUSTOMER_LOGIN_ENABLED !== 'true') return null;
  const required = [
    'KK_LINE_LOGIN_CHANNEL_ID', 'KK_LINE_LOGIN_CHANNEL_SECRET',
    'KK_LINE_LOGIN_PROVIDER_ID', 'KK_LINE_LOGIN_CALLBACK_URL',
    'KK_CUSTOMER_AUTH_SESSION_SECRET', 'KK_CUSTOMER_AUTH_SUPABASE_URL',
    'KK_CUSTOMER_AUTH_SUPABASE_SERVICE_ROLE_KEY'
  ];
  if (env.KK_LINE_LOGIN_PROVIDER_VERIFIED !== 'true' ||
      env.KK_CUSTOMER_AUTH_MIGRATION_VERIFIED !== 'true' ||
      required.some(key => !env[key])) throw new Error('CUSTOMER_AUTH_RELEASE_GATES_UNMET');
  const callback = new URL(env.KK_LINE_LOGIN_CALLBACK_URL);
  if (callback.protocol !== 'https:' || callback.username || callback.password ||
      callback.hash || callback.pathname !== '/api/kk-customer-auth' ||
      callback.search !== '?action=callback') throw new Error('CUSTOMER_AUTH_CALLBACK_INVALID');
  if (!/^\d{6,20}$/.test(env.KK_LINE_LOGIN_CHANNEL_ID) ||
      String(env.KK_CUSTOMER_AUTH_SESSION_SECRET).length < 32) {
    throw new Error('CUSTOMER_AUTH_CONFIG_INVALID');
  }
  return {
    channelId: env.KK_LINE_LOGIN_CHANNEL_ID,
    channelSecret: env.KK_LINE_LOGIN_CHANNEL_SECRET,
    providerId: env.KK_LINE_LOGIN_PROVIDER_ID,
    callbackUrl: callback.href,
    origin: callback.origin,
    host: callback.host,
    secret: env.KK_CUSTOMER_AUTH_SESSION_SECRET,
    store: createStore({
      url: env.KK_CUSTOMER_AUTH_SUPABASE_URL,
      serviceKey: env.KK_CUSTOMER_AUTH_SUPABASE_SERVICE_ROLE_KEY
    })
  };
}

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}
function clearCookie(name) { return OAuth.cookie(name, '', 0); }
function csrfFor(token, secret) {
  return crypto.createHmac('sha256', secret).update('kk-accept:' + Terms.VERSION + ':' + token).digest('base64url');
}
function equal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length > 0 && left.length === right.length && crypto.timingSafeEqual(left, right);
}
function validOrigin(req, config) {
  return typeof req.headers.origin === 'string' && req.headers.origin === config.origin;
}
function csrfValid(req, token, config) {
  return validOrigin(req, config) && equal(req.headers['x-kk-csrf'], csrfFor(token, config.secret));
}
async function readAffirmation(req) {
  let data = req.body;
  if (typeof data === 'undefined') {
    let size = 0;
    const parts = [];
    for await (const part of req) {
      const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part);
      size += chunk.length;
      if (size > MAX_BODY_BYTES) throw new Error('BODY_TOO_LARGE');
      parts.push(chunk);
    }
    data = Buffer.concat(parts).toString('utf8');
  }
  if (typeof data === 'string') {
    if (Buffer.byteLength(data, 'utf8') > MAX_BODY_BYTES) throw new Error('BODY_TOO_LARGE');
    data = JSON.parse(data);
  }
  if (!data || typeof data !== 'object' ||
      Buffer.byteLength(JSON.stringify(data), 'utf8') > MAX_BODY_BYTES ||
      data.accept !== true || data.terms_version !== Terms.VERSION) {
    throw new Error('AFFIRMATION_REQUIRED');
  }
  return true;
}
function noStore(res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
}
async function handler(req, res) {
  noStore(res);
  let config;
  try { config = runtime(); }
  catch (_) { return send(res, 503, {status: 'CUSTOMER_LOGIN_NOT_READY'}); }
  if (!config) return send(res, 404, {status: 'FEATURE_DISABLED'});
  // Enforce the registered exact callback host; no use of untrusted forwarded-host
  // or arbitrary next/return/redirect parameters.
  if (req.headers.host !== config.host) return send(res, 403, {status: 'HOST_NOT_ALLOWED'});
  const url = new URL(req.url || '/', config.origin);
  const action = url.searchParams.get('action');
  const cookies = req.headers.cookie || '';
  const sessionToken = OAuth.readCookie(cookies, OAuth.SESSION_COOKIE);
  const sessionHash = sessionToken && /^[A-Za-z0-9_-]{43,100}$/.test(sessionToken)
    ? OAuth.tokenHash(sessionToken) : '';
  try {
    if (action === 'start' && req.method === 'GET') {
      if (req.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(req.headers['sec-fetch-site'])) {
        return send(res, 403, {status: 'CROSS_SITE_START_DENIED'});
      }
      const begin = OAuth.beginLogin({
        channelId: config.channelId, callbackUrl: config.callbackUrl, secret: config.secret
      });
      res.setHeader('Set-Cookie', begin.flowCookie);
      res.statusCode = 303;
      res.setHeader('Location', begin.url);
      return res.end();
    }
    if (action === 'callback' && req.method === 'GET') {
      res.setHeader('Set-Cookie', clearCookie(OAuth.FLOW_COOKIE));
      const state = url.searchParams.get('state');
      const code = url.searchParams.get('code');
      const flow = OAuth.finishFlow({
        sealed: OAuth.readCookie(cookies, OAuth.FLOW_COOKIE),
        state, secret: config.secret
      });
      if (!flow || typeof code !== 'string' || !code ||
          url.searchParams.has('error')) {
        return send(res, 400, {status: 'LINE_LOGIN_CANCELLED_OR_EXPIRED'});
      }
      const identity = await OAuth.authenticateCode({
        code, verifier: flow.verifier, nonce: flow.nonce,
        channelId: config.channelId, channelSecret: config.channelSecret,
        callbackUrl: config.callbackUrl
      });
      const newToken = OAuth.randomToken(32);
      await config.store.createSession(OAuth.tokenHash(newToken), config.providerId,
        identity.line_user_id, new Date(Date.now() + OAuth.SESSION_TTL_MS).toISOString());
      res.setHeader('Set-Cookie', [
        clearCookie(OAuth.FLOW_COOKIE),
        OAuth.cookie(OAuth.SESSION_COOKIE, newToken, OAuth.SESSION_TTL_MS / 1000)
      ]);
      res.statusCode = 303;
      res.setHeader('Location', '/');
      return res.end();
    }
    if (action === 'session' && req.method === 'GET') {
      if (!sessionHash) return send(res, 200, {
        authenticated: false, terms_version: Terms.VERSION, skip_agreement: false
      });
      const session = await config.store.readSession(sessionHash);
      if (!session || session.provider_id !== config.providerId) {
        res.setHeader('Set-Cookie', clearCookie(OAuth.SESSION_COOKIE));
        return send(res, 200, {
          authenticated: false, terms_version: Terms.VERSION, skip_agreement: false
        });
      }
      const receipt = await config.store.findAcceptance(sessionHash, Terms.VERSION);
      const decision = AcceptOnce.decideAcceptOnce({session, receipt});
      return send(res, 200, {
        authenticated: true, terms_version: decision.terms_version,
        skip_agreement: decision.skip_agreement,
        csrf: csrfFor(sessionToken, config.secret)
      });
    }
    if (action === 'accept' && req.method === 'POST') {
      if (!sessionHash) return send(res, 401, {status: 'LOGIN_REQUIRED'});
      if (!csrfValid(req, sessionToken, config)) return send(res, 403, {status: 'CSRF_REJECTED'});
      await readAffirmation(req);
      const session = await config.store.readSession(sessionHash);
      if (!session || session.provider_id !== config.providerId) return send(res, 401, {status: 'LOGIN_REQUIRED'});
      const record = await config.store.acceptTerms(sessionHash, Terms.VERSION, 'web:' + OAuth.randomToken(32));
      const decision = AcceptOnce.decideAcceptOnce({session, receipt: record});
      if (!decision.skip_agreement) return send(res, 503, {status: 'ACCEPTANCE_NOT_VERIFIED'});
      return send(res, 200, {status: 'ACCEPTED', terms_version: Terms.VERSION, skip_agreement: true});
    }
    if (action === 'logout' && req.method === 'POST') {
      if (!sessionHash) {
        res.setHeader('Set-Cookie', clearCookie(OAuth.SESSION_COOKIE));
        return send(res, 200, {status: 'LOGGED_OUT'});
      }
      if (!csrfValid(req, sessionToken, config)) return send(res, 403, {status: 'CSRF_REJECTED'});
      const revoked = await config.store.revokeSession(sessionHash);
      if (!revoked) return send(res, 503, {status: 'LOGOUT_NOT_VERIFIED'});
      res.setHeader('Set-Cookie', clearCookie(OAuth.SESSION_COOKIE));
      return send(res, 200, {status: 'LOGGED_OUT'});
    }
    return send(res, 405, {status: 'METHOD_OR_ACTION_NOT_SUPPORTED'});
  } catch (_) {
    // Fail closed; never echo raw LINE tokens, customer IDs, upstream errors,
    // service role credentials or submitted form content into API responses/logs.
    return send(res, 503, {status: 'CUSTOMER_AUTH_UNAVAILABLE'});
  }
}
module.exports = handler;
module.exports._test = { runtime, csrfFor, validOrigin, readAffirmation };
