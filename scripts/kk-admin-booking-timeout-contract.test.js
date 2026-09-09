'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const source = fs.readFileSync(path.join(__dirname, '..', 'api', 'kk-admin.js'), 'utf8');

// Execute the actual proxy with synthetic transport failures; no live provider.
const vm = require('node:vm');
const { Readable } = require('node:stream');
let passed = 0;
async function invoke(action, fetch, method = 'POST') {
  const sandbox = { module: {exports: {}}, URL, URLSearchParams, AbortController, setTimeout, clearTimeout, fetch,
    process: {env: {KK_ADMIN_PIN: 'synthetic', KK_ADMIN_API_KEY: 'synthetic', KK_ADMIN_SCRIPT_URL: 'https://script.google.com/macros/s/SYNTHETIC/exec', GOOGLE_SHEET_ID: 'SYNTHETIC'}} };
  vm.runInNewContext(source, sandbox, {filename: 'api/kk-admin.js'});
  const req = Readable.from([JSON.stringify({action})]);
  Object.assign(req, {method, url: '/api/kk-admin?action=' + encodeURIComponent(action), headers: {'x-admin-pin': 'synthetic'}});
  const res = {setHeader() {}, end(body) {this.body = JSON.parse(body);}};
  await sandbox.module.exports(req, res);
  return res;
}
async function test(name, fn) {await fn(); passed++; console.log('PASS ' + name);}
const reply = (body, status = 200) => ({ok: status === 200, status, headers: {get: () => 'application/json'}, text: async () => body});
async function main() {
  for (const action of ['createBooking', 'createEvent', 'createPackage', 'addAssets', 'uploadPoster', 'updateBooking', 'unknownWrite']) {
    await test(action + ': lost response after dispatch cannot authorize retry', async () => {
      for (const name of ['AbortError', 'TypeError']) {
        let dispatches = 0;
        const r = await invoke(action, async () => {dispatches++; const e = new Error('sensitive transport details'); e.name = name; throw e;});
        assert.equal(dispatches, 1); assert.equal(r.statusCode, 502);
        assert.equal(r.body.retry_safe, false); assert.equal(r.body.reconciliation_required, true);
        assert.equal(r.body.error_code, action === 'createBooking' ? 'BOOKING_WRITE_AMBIGUOUS_RECONCILE_REQUIRED' : 'WRITE_AMBIGUOUS_RECONCILE_REQUIRED');
        assert.ok(!JSON.stringify(r.body).includes('sensitive'));
      }
    });
  }
  await test('malformed or failed write response requires reconciliation', async () => {
    for (const body of ['<html>Error</html>', 'null', '[]', '{"ok":false,"error":"after partial write"}', '{"ok":"true"}']) {
      const r = await invoke('createEvent', async () => reply(body));
      assert.equal(r.body.retry_safe, false); assert.equal(r.body.reconciliation_required, true);
    }
    assert.equal((await invoke('createEvent', async () => reply('{"ok":true}', 500))).body.reconciliation_required, true);
  });
  await test('response body transport failure is also ambiguous', async () => {
    const r = await invoke('createBooking', async () => ({...reply(''), text: async () => {throw Error('body failed');}}));
    assert.equal(r.body.reconciliation_required, true);
  });
  await test('GET cannot dispatch a mutation', async () => {
    let dispatches = 0;
    const r = await invoke('cleanupOldData', async () => {dispatches++; return reply('{"ok":true}');}, 'GET');
    assert.equal(r.statusCode, 405); assert.equal(dispatches, 0);
  });
  await test('read-only failure may retry without implying a write', async () => {
    const r = await invoke('snapshot', async () => {throw Error('offline');}, 'GET');
    assert.equal(r.body.retry_safe, true); assert.equal(r.body.reconciliation_required, false);
  });
  await test('confirmed writer success is preserved, not retried', async () => {
    let dispatches = 0;
    const r = await invoke('createEvent', async () => {dispatches++; return reply('{"ok":true,"data":{"event_id":"synthetic"}}');});
    assert.equal(dispatches, 1); assert.equal(r.body.ok, true); assert.equal(r.body.data.event_id, 'synthetic');
  });
  console.log(`kk-admin proxy transport simulation: ${passed}/${passed} PASS (not provider evidence)`);
}
main().catch(err => {console.error(err); process.exitCode = 1;});
