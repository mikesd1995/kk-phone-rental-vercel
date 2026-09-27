'use strict';

const Gateway = require('../server/kk-agent-gateway.js');
const Ledger = require('../server/kk-agent-invocation-ledger.js');
const Registry = require('../server/kk-agent-registry.js');

const MAX_BODY_BYTES = 64 * 1024;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body || {}));
}

function auth(req) {
  const expected = String(process.env.KK_ADMIN_PIN || '').trim();
  const provided = String(req && req.headers && req.headers['x-admin-pin'] || '').trim();
  if (!expected) return { ok: false, status: 500, error: 'KK_ADMIN_PIN is not configured' };
  if (provided !== expected) return { ok: false, status: 401, error: 'Invalid admin PIN' };
  return { ok: true };
}

function parseBody(req) {
  const length = Number(req && req.headers && req.headers['content-length'] || 0);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    throw Object.assign(new Error('request body too large'), { code: 'BODY_TOO_LARGE' });
  }
  const body = req && req.body;
  if (body && typeof body === 'object' && !Buffer.isBuffer(body)) return body;
  if (Buffer.isBuffer(body)) {
    if (body.length > MAX_BODY_BYTES) throw Object.assign(new Error('request body too large'), { code: 'BODY_TOO_LARGE' });
    return JSON.parse(body.toString('utf8'));
  }
  if (typeof body === 'string') {
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) throw Object.assign(new Error('request body too large'), { code: 'BODY_TOO_LARGE' });
    return JSON.parse(body);
  }
  return {};
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  const a = auth(req);
  if (!a.ok) return json(res, a.status, { ok: false, error: a.error });

  if (req.method === 'GET') {
    return json(res, 200, {
      ok: true,
      data: {
        gateway_version: Gateway.GATEWAY_VERSION,
        registry: Registry.publicRegistry(),
        ledger: Ledger.configState(),
        production_writes: 0,
        publishes: 0
      }
    });
  }

  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });

  let body;
  try {
    body = parseBody(req);
  } catch (error) {
    return json(res, error && error.code === 'BODY_TOO_LARGE' ? 413 : 400, {
      ok: false,
      error: error && error.code || 'INVALID_JSON'
    });
  }

  if (!String(body.message || '').trim()) {
    return json(res, 400, { ok: false, error: 'message is required' });
  }

  const result = await Gateway.executeAgentRequest(body, {
    ledgerFn: row => Ledger.recordInvocation({ row })
  });

  if (result.status === 'BLOCKED_LEDGER_UNAVAILABLE') {
    return json(res, 503, { ok: false, data: result });
  }
  if (String(result.status || '').startsWith('BLOCKED_')) {
    return json(res, 409, { ok: false, data: result });
  }
  return json(res, 200, { ok: true, data: result });
};

module.exports._test = { auth, parseBody, MAX_BODY_BYTES };
