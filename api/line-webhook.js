'use strict';

const lineBookingWebhook = require('../server/line-booking-webhook');
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

async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      req.rawBody = await readRawBody(req);
    } catch (err) {
      console.error('[line-webhook-raw-body]', err && err.message ? err.message : 'read failed');
      res.statusCode = err && err.code === 'LINE_WEBHOOK_BODY_TOO_LARGE' ? 413 : 400;
      return res.end(res.statusCode === 413 ? 'Request body too large' : 'Invalid request body');
    }
  }
  return lineBookingWebhook(req, res);
}

module.exports = handler;
// LINE signs the exact request bytes. Vercel's JSON body helper parses application/json,
// which cannot be re-serialized safely for signature verification. Keep parsing disabled.
module.exports.config = { api: { bodyParser: false } };
module.exports._test = { readRawBody, assertBodySize, MAX_LINE_WEBHOOK_BYTES };
