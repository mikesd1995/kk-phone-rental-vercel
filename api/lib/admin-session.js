'use strict';

const crypto = require('crypto');

const COOKIE_NAME = '__Host-kk_admin_session';
const SESSION_TTL_SECONDS = 8 * 60 * 60;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const FAILURE_LIMIT = 5;
const BLOCK_MS = 15 * 60 * 1000;
const attempts = new Map();

function secret(){
  return String(process.env.KK_ADMIN_SESSION_SECRET || process.env.KK_ADMIN_PIN || '').trim();
}

function safeEqual(a,b){
  const aa = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if(aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa,bb);
}

function signExpiry(exp){
  const key = secret();
  if(!key) return '';
  return crypto.createHmac('sha256',key).update(`kk-admin:v1:${exp}`).digest('hex');
}

function issueToken(nowMs=Date.now()){
  const exp = Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS;
  return `v1.${exp}.${signExpiry(exp)}`;
}

function verifyToken(token,nowMs=Date.now()){
  const raw = String(token || '').trim();
  const parts = raw.split('.');
  if(parts.length !== 3 || parts[0] !== 'v1') return false;
  const exp = Number(parts[1]);
  if(!Number.isInteger(exp)) return false;
  const now = Math.floor(nowMs / 1000);
  if(exp <= now || exp > now + SESSION_TTL_SECONDS + 60) return false;
  const expected = signExpiry(exp);
  return !!expected && safeEqual(parts[2],expected);
}

function parseCookies(req){
  const header = String(req && req.headers && req.headers.cookie || '');
  const out = {};
  header.split(';').forEach(part=>{
    const i = part.indexOf('=');
    if(i < 0) return;
    const key = part.slice(0,i).trim();
    const value = part.slice(i+1).trim();
    if(key) out[key] = value;
  });
  return out;
}

function hasValidSession(req){
  return verifyToken(parseCookies(req)[COOKIE_NAME]);
}

function hasValidLegacyPin(req){
  const expected = String(process.env.KK_ADMIN_PIN || '').trim();
  const provided = String(req && req.headers && req.headers['x-admin-pin'] || '').trim();
  return !!expected && safeEqual(provided,expected);
}

function clientKey(req){
  const forwarded = String(req && req.headers && req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || String(req && req.headers && req.headers['x-real-ip'] || '').trim() || 'unknown';
}

function cleanEntry(entry,now){
  if(!entry) return null;
  if(entry.blockedUntil && entry.blockedUntil <= now) return null;
  if(!entry.blockedUntil && now - entry.firstFailureAt > FAILURE_WINDOW_MS) return null;
  return entry;
}

function rateState(req,now=Date.now()){
  const key = clientKey(req);
  let entry = cleanEntry(attempts.get(key),now);
  if(!entry){
    attempts.delete(key);
    return {allowed:true,key,retryAfter:0};
  }
  if(entry.blockedUntil && entry.blockedUntil > now){
    return {allowed:false,key,retryAfter:Math.max(1,Math.ceil((entry.blockedUntil-now)/1000))};
  }
  return {allowed:true,key,retryAfter:0};
}

function recordFailure(req,now=Date.now()){
  const key = clientKey(req);
  let entry = cleanEntry(attempts.get(key),now) || {count:0,firstFailureAt:now,blockedUntil:0};
  entry.count += 1;
  if(entry.count >= FAILURE_LIMIT) entry.blockedUntil = now + BLOCK_MS;
  attempts.set(key,entry);
  return rateState(req,now);
}

function clearFailures(req){
  attempts.delete(clientKey(req));
}

function sessionCookie(token){
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}`;
}

function clearSessionCookie(){
  return `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

function noStore(res){
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma','no-cache');
  res.setHeader('X-Content-Type-Options','nosniff');
}

module.exports = {
  COOKIE_NAME,
  SESSION_TTL_SECONDS,
  safeEqual,
  issueToken,
  verifyToken,
  parseCookies,
  hasValidSession,
  hasValidLegacyPin,
  rateState,
  recordFailure,
  clearFailures,
  sessionCookie,
  clearSessionCookie,
  noStore,
  _test:{attempts,clientKey,signExpiry}
};
