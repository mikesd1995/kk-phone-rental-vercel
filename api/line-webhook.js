'use strict';

const lineBookingWebhook = require('../server/line-booking-webhook');

async function readRawBody(req) {
  if (Buffer.isBuffer(req.rawBody)) return req.rawBody;
  if (typeof req.rawBody === 'string') return Buffer.from(req.rawBody, 'utf8');
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

async function handler(req, res) {
  if (req.method === 'POST') {
    try {
      req.rawBody = await readRawBody(req);
    } catch (err) {
      console.error('[line-webhook-raw-body]', err && err.message ? err.message : 'read failed');
      res.statusCode = 400;
      return res.end('Invalid request body');
    }
  }
  return lineBookingWebhook(req, res);
}

module.exports = handler;
// LINE signs the exact request bytes. Vercel's JSON body helper parses application/json,
// which cannot be re-serialized safely for signature verification. Keep parsing disabled.
module.exports.config = { api: { bodyParser: false } };
module.exports._test = { readRawBody };
