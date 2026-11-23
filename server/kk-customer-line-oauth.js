'use strict';

const crypto = require('node:crypto');

const FLOW_COOKIE = '__Host-kk_line_flow';
const SESSION_COOKIE = '__Host-kk_customer_session';
const FLOW_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const AUTH_URL = 'https://access.line.me/oauth2/v2.1/authorize';
const TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token';
const VERIFY_URL = 'https://api.line.me/oauth2/v2.1/verify';
const LINE_ID = /^U[0-9a-f]{32}$/;

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}
function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex');
}
function keyFromSecret(secret) {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('CUSTOMER_SESSION_SECRET_REQUIRED');
  return crypto.createHmac('sha256', secret).update('kk-line-flow-key-v1').digest();
}
function sealFlow(flow, secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyFromSecret(secret), iv);
  cipher.setAAD(Buffer.from('kk-line-oauth-flow-v1'));
  const body = Buffer.concat([cipher.update(JSON.stringify(flow), 'utf8'), cipher.final()]);
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), body.toString('base64url')].join('.');
}
function unsealFlow(value, secret) {
  if (typeof value !== 'string' || value.length > 1500) return null;
  const parts = value.split('.');
  if (parts.length !== 3) return null;
  try {
    const iv = Buffer.from(parts[0], 'base64url');
    const tag = Buffer.from(parts[1], 'base64url');
    const body = Buffer.from(parts[2], 'base64url');
    if (iv.length !== 12 || tag.length !== 16 || body.length > 1000) return null;
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyFromSecret(secret), iv);
    decipher.setAAD(Buffer.from('kk-line-oauth-flow-v1'));
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8'));
  } catch (_) { return null; }
}
function constantTimeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length > 0 && left.length === right.length && crypto.timingSafeEqual(left, right);
}
function cookie(name, value, maxAgeSeconds) {
  if (!/^[A-Za-z0-9_-]+$/.test(name)) throw new Error('INVALID_COOKIE');
  if (value && !/^[A-Za-z0-9._-]+$/.test(value)) throw new Error('INVALID_COOKIE_VALUE');
  return name + '=' + value + '; Path=/; Max-Age=' + Math.max(0, Math.floor(maxAgeSeconds)) +
    '; HttpOnly; Secure; SameSite=Lax';
}
function readCookie(header, name) {
  if (typeof header !== 'string' || header.length > 8192) return '';
  for (const item of header.split(';')) {
    const i = item.indexOf('=');
    if (i > 0 && item.slice(0, i).trim() === name) return item.slice(i + 1).trim();
  }
  return '';
}
function beginLogin({ channelId, callbackUrl, secret, nowMs = Date.now() }) {
  if (!/^\d{6,20}$/.test(String(channelId || ''))) throw new Error('LINE_CHANNEL_ID_INVALID');
  if (!Number.isFinite(nowMs)) throw new Error('CLOCK_INVALID');
  const callback = new URL(callbackUrl);
  if (callback.protocol !== 'https:' || callback.username || callback.password || callback.hash) throw new Error('CALLBACK_INVALID');
  const flow = { state: randomToken(), nonce: randomToken(), verifier: randomToken(48), issued: nowMs };
  const challenge = crypto.createHash('sha256').update(flow.verifier).digest('base64url');
  const url = new URL(AUTH_URL);
  const params = url.searchParams;
  params.set('response_type', 'code');
  params.set('client_id', String(channelId));
  params.set('redirect_uri', callback.href);
  params.set('state', flow.state);
  params.set('scope', 'openid');
  params.set('nonce', flow.nonce);
  params.set('code_challenge', challenge);
  params.set('code_challenge_method', 'S256');
  return { url: url.href, flowCookie: cookie(FLOW_COOKIE, sealFlow(flow, secret), FLOW_TTL_MS / 1000) };
}
function finishFlow({ sealed, state, secret, nowMs = Date.now() }) {
  const flow = unsealFlow(sealed, secret);
  if (!flow || !Number.isFinite(nowMs) || !Number.isFinite(flow.issued) ||
      flow.issued > nowMs || nowMs - flow.issued > FLOW_TTL_MS ||
      !constantTimeEqual(flow.state, state) ||
      !/^[A-Za-z0-9_-]{43,128}$/.test(flow.verifier) ||
      !/^[A-Za-z0-9_-]{30,100}$/.test(flow.nonce)) return null;
  return { nonce: flow.nonce, verifier: flow.verifier };
}
async function postForm(url, values, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);
  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams(values).toString(),
      signal: controller.signal
    });
    if (!response || !response.ok) throw new Error('LINE_IDENTITY_PROVIDER_UNAVAILABLE');
    const result = await response.json();
    if (!result || typeof result !== 'object') throw new Error('LINE_IDENTITY_PROVIDER_INVALID');
    return result;
  } finally { clearTimeout(timeout); }
}
async function authenticateCode({ code, verifier, nonce, channelId, channelSecret, callbackUrl, fetchImpl = fetch, nowMs = Date.now() }) {
  if (typeof code !== 'string' || code.length < 4 || code.length > 2048 ||
      !/^[A-Za-z0-9_-]{43,128}$/.test(verifier) ||
      !/^[A-Za-z0-9_-]{30,100}$/.test(nonce)) throw new Error('LINE_AUTH_RESPONSE_INVALID');
  const token = await postForm(TOKEN_URL, {
    grant_type: 'authorization_code', code, redirect_uri: callbackUrl, client_id: channelId,
    client_secret: channelSecret, code_verifier: verifier
  }, fetchImpl);
  if (typeof token.id_token !== 'string' || token.id_token.length > 8192) throw new Error('LINE_ID_TOKEN_MISSING');
  const claims = await postForm(VERIFY_URL, {
    id_token: token.id_token, client_id: channelId, nonce
  }, fetchImpl);
  const seconds = Math.floor(nowMs / 1000);
  if (claims.iss !== 'https://access.line.me' ||
      String(claims.aud) !== String(channelId) ||
      !LINE_ID.test(String(claims.sub || '')) ||
      !constantTimeEqual(String(claims.nonce || ''), nonce) ||
      !Number.isFinite(claims.exp) || claims.exp <= seconds ||
      !Number.isFinite(claims.iat) || claims.iat > seconds + 60) {
    throw new Error('LINE_ID_TOKEN_CLAIMS_INVALID');
  }
  return { line_user_id: claims.sub, authentication: 'LINE_ID_TOKEN_SERVER_VERIFIED' };
}
module.exports = {
  FLOW_COOKIE, SESSION_COOKIE, FLOW_TTL_MS, SESSION_TTL_MS, randomToken,
  tokenHash, cookie, readCookie, beginLogin, finishFlow, authenticateCode
};
