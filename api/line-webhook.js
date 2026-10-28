'use strict';

const lineBookingWebhook = require('../server/line-booking-webhook');
const crypto = require('node:crypto');
const MAX_LINE_WEBHOOK_BYTES = 1024 * 1024;

function assertBodySize(size) {
  if (Number(size || 0) <= MAX_LINE_WEBHOOK_BYTES) return;
  const err = new Error('LINE webhook request body too large');
  err.code = 'LINE_WEBHOOK_BODY_TOO_LARGE';
  throw err;
}

async function readRawBody(req) {
  if (Buffer.isBuffer(req.rawBody)) {
    assertBodySize(req.rawBody.length);
    return req.rawBody;
  }
  if (typeof req.rawBody === 'string') {
    const buf=Buffer.from(req.rawBody, 'utf8');
    assertBodySize(buf.length);
    return buf;
  }
  const chunks = [];
  let total=0;
  for await (const chunk of req) {
    const buf=Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total+=buf.length;
    assertBodySize(total);
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

// The booking handler verifies signatures again. This early, bounded preflight
// protects its JSON shape assumption without altering the Codex-owned handler.
// Never parse or trust unauthenticated LINE bodies.
function signedEnvelopePreflight(rawBody, signature, channelSecret) {
  const secret=String(channelSecret||'').trim();
  if(!secret) return {ok:false,statusCode:503,message:'LINE Messaging API is not configured'};
  const supplied=String(signature||'');
  const expected=crypto.createHmac('sha256',secret).update(rawBody).digest('base64');
  const a=Buffer.from(expected,'utf8'),b=Buffer.from(supplied,'utf8');
  if(a.length!==b.length || !crypto.timingSafeEqual(a,b)){
    return {ok:false,statusCode:401,message:'Invalid signature'};
  }
  let payload;
  try{payload=JSON.parse(rawBody.toString('utf8'));}
  catch(_){return {ok:false,statusCode:400,message:'Invalid JSON'};}
  if(!payload || typeof payload!=='object' || Array.isArray(payload) || !Array.isArray(payload.events)){
    return {ok:false,statusCode:400,message:'Invalid LINE events'};
  }
  return {ok:true};
}

async function handler(req, res) {
  // Authentication and malformed-envelope responses must not be cached.
  // Keep this at the public entrypoint because early returns never reach the
  // booking handler's security headers.
  if (typeof res.setHeader === 'function') {
    res.setHeader('Cache-Control','no-store');
    res.setHeader('X-Content-Type-Options','nosniff');
  }
  if (req.method === 'POST') {
    try {
      req.rawBody = await readRawBody(req);
    } catch (err) {
      console.error('[line-webhook-raw-body]', err && err.code === 'LINE_WEBHOOK_BODY_TOO_LARGE' ? 'size-limit' : 'read-failed');
      res.statusCode = err && err.code === 'LINE_WEBHOOK_BODY_TOO_LARGE' ? 413 : 400;
      return res.end(res.statusCode === 413 ? 'Request body too large' : 'Invalid request body');
    }
    // Preserve the existing 503 config error from the booking handler. A
    // missing secret/token must not be reported as a customer signature error.
    if(String(process.env.LINE_CHANNEL_SECRET||'').trim() && String(process.env.LINE_CHANNEL_ACCESS_TOKEN||'').trim()){
      const signature=req.headers && (req.headers['x-line-signature']||req.headers['X-Line-Signature']);
      const admission=signedEnvelopePreflight(req.rawBody,signature,process.env.LINE_CHANNEL_SECRET);
      if(!admission.ok){res.statusCode=admission.statusCode;return res.end(admission.message);}
    }
  }
  return lineBookingWebhook(req, res);
}

module.exports = handler;
// LINE signs the exact request bytes. Vercel's JSON body helper parses application/json,
// which cannot be re-serialized safely for signature verification. Keep parsing disabled.
module.exports.config = { api: { bodyParser: false } };
module.exports._test = { readRawBody, assertBodySize, MAX_LINE_WEBHOOK_BYTES, signedEnvelopePreflight };
