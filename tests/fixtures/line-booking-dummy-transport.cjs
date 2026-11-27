'use strict';
// Test-only, process-local controls for trusted audited code, not an OS sandbox.
const assert = require('node:assert/strict');
function createDummyTransport({routes = []} = {}) {
  const calls = [], denials = [], counts = new Map();
  let pending = 0;
  function deny(code) {
    denials.push(code);
    throw Object.assign(new Error(code), {code});
  }
  const fetch = async (url, options = {}) => {
    if (typeof url !== 'string') return deny('FIXTURE_URL_TYPE');
    let request, headers;
    try {
      if (options === null || typeof options !== 'object' || Array.isArray(options)) throw new TypeError();
      request = {...options};
      if (request.method !== undefined && typeof request.method !== 'string') throw new TypeError();
      if (request.redirect !== undefined && typeof request.redirect !== 'string') throw new TypeError();
      headers = new Headers(request.headers);
      request.headers = headers;
    } catch (_) { return deny('FIXTURE_REQUEST_INVALID'); }
    if (request.redirect !== undefined && request.redirect !== 'error') return deny('FIXTURE_REDIRECT');
    const method = request.method || 'GET';
    const route = routes.find(r => r.url === url && r.method === method &&
      Object.entries(r.headers || {}).every(([key, value]) => headers.get(key) === value));
    if (!route) return deny('FIXTURE_ROUTE_UNKNOWN');
    const n = counts.get(route.id) || 0;
    if (n >= route.max) return deny('FIXTURE_EXHAUSTED');
    try { if (route.validate) route.validate(request, n); }
    catch (_) { return deny('FIXTURE_PAYLOAD'); }
    counts.set(route.id, n + 1);
    calls.push(route.id); pending++;
    try {
      const response = await route.respond(request, n);
      if (!response || (response.status >= 300 && response.status < 400) || response.redirected === true)
        return deny('FIXTURE_REDIRECT_RESPONSE');
      return response;
    } finally { pending--; }
  };
  function assertComplete() {
    assert.equal(denials.length, 0, 'FIXTURE_DENIAL');
    assert.equal(pending, 0, 'FIXTURE_PENDING');
    for (const route of routes) assert.ok((counts.get(route.id) || 0) >= (route.min || 0), 'FIXTURE_MISSING_' + route.id);
  }
  return {fetch, calls, denials, get pending() {return pending;},
    counters: () => Object.fromEntries(counts), assertComplete};
}

function installNetworkGuards() {
  assert.equal(process.argv[1] && require('node:path').basename(process.argv[1]), 'line-booking-dummy-child.cjs', 'child only');
  const blockedAttempts = [], installed = [];
  function blocked(id) {
    blockedAttempts.push(id);
    throw Object.assign(new Error('S1_EGRESS_BLOCKED'), {code: 'S1_EGRESS_BLOCKED'});
  }
  function patch(object, key, id) {
    if (typeof object[key] !== 'function') return;
    Object.defineProperty(object, key, {configurable: true, writable: true,
      value: function () {return blocked(id);}});
    installed.push(id);
  }
  // Load built-ins before patching; never retain or expose the original methods.
  const http = require('node:http'), https = require('node:https'), net = require('node:net');
  const tls = require('node:tls'), http2 = require('node:http2'), dns = require('node:dns');
  const dgram = require('node:dgram'), cp = require('node:child_process'), workers = require('node:worker_threads');
  const udpPrototype = dgram.Socket.prototype;
  for (const key of ['send','bind','connect']) patch(udpPrototype, key, 'dgram.Socket.' + key);
  for (const [name, object, keys] of [
    ['http',http,['request','get','createServer']], ['https',https,['request','get','createServer']],
    ['net',net,['connect','createConnection']], ['tls',tls,['connect','createSecureContext','TLSSocket','createServer']],
    ['http2',http2,['connect','createServer','createSecureServer']],
    ['dgram',dgram,['createSocket','Socket']], ['child_process',cp,['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork']],
    ['worker_threads',workers,['Worker']]
  ]) for (const key of keys) patch(object, key, name + '.' + key);
  dgram.Socket.prototype = udpPrototype;
  udpPrototype.constructor = dgram.Socket;
  patch(net.Socket.prototype, 'connect', 'net.Socket.connect');
  patch(net.Server.prototype, 'listen', 'net.Server.listen');
  for (const key of Object.keys(dns)) if (/^(lookup|resolve|reverse)/.test(key)) patch(dns, key, 'dns.' + key);
  for (const key of Object.keys(dns.promises)) if (/^(lookup|resolve|reverse)/.test(key)) patch(dns.promises, key, 'dns.promises.' + key);
  for (const prototype of [dns.Resolver.prototype, dns.promises.Resolver.prototype])
    for (const key of Object.getOwnPropertyNames(prototype)) if (/^(resolve|reverse)/.test(key)) patch(prototype, key, 'dns.Resolver.' + key);
  global.fetch = async () => blocked('fetch'); installed.push('fetch');
  for (const key of ['WebSocket','EventSource']) patch(global, key, key);

  // Do not permit ambient dotenv/credential reads through the common fs APIs.
  const fs = require('node:fs'), path = require('node:path');
  function sensitive(file) {
    if (typeof file === 'number') return false; // Audited code may read its existing stdio fd.
    let p;
    try { p = file instanceof URL ? require('node:url').fileURLToPath(file) : String(file); }
    catch (_) { return true; }
    const normalized = p.replace(/\\/g, '/');
    return /^\.env(?:\.|$)/i.test(path.basename(normalized)) ||
      /(?:^|\/)(?:\.aws|\.ssh)\//i.test(normalized) ||
      /(?:^|\/)(?:\.codex|\.cursor)\/(?:auth|credentials)(?:\.|\/|$)/i.test(normalized) ||
      /(?:^|\/)(?:credentials|service[-_]account|token)[^/]*\.json$/i.test(normalized);
  }
  for (const [object, keys] of [[fs,['readFile','readFileSync','open','openSync','createReadStream']],
    [fs.promises,['readFile','open']]]) for (const key of keys) {
    const original = object[key];
    object[key] = function (file, ...args) {
      if (sensitive(file)) return blocked('fs.sensitive');
      return Reflect.apply(original, this, [file, ...args]);
    };
  }
  require('node:module').syncBuiltinESMExports();
  assert.ok(installed.length >= 45, 'guard installation incomplete');
  return {installed, blockedAttempts, isSensitiveFile: sensitive, assertNoUnexpectedEgress() {
    assert.equal(blockedAttempts.length, 0, 'UNEXPECTED_EGRESS');
  }};
}
module.exports = {createDummyTransport, installNetworkGuards};
