const assert = require('node:assert/strict');
const test = require('node:test');

const V = require('../scripts/verify-apps-script-upstream.js');

test('accepts only canonical Apps Script Web App /exec URLs', () => {
  const good = V.validateAppsScriptExecUrl('https://script.google.com/macros/s/AKfycb-test-deployment/exec');
  assert.equal(good.ok, true);
  assert.equal(good.host, 'script.google.com');
  assert.equal(good.path_kind, 'exec');
  assert.match(good.deployment_fingerprint, /^[a-f0-9]{16}$/);
  assert.match(good.url_fingerprint, /^[a-f0-9]{16}$/);

  assert.equal(V.validateAppsScriptExecUrl('https://script.google.com/macros/s/AKfycb-test-deployment/dev').code, 'APPS_SCRIPT_URL_NOT_EXEC');
  assert.equal(V.validateAppsScriptExecUrl('https://docs.google.com/spreadsheets/d/example/edit').code, 'APPS_SCRIPT_URL_WRONG_HOST');
  assert.equal(V.validateAppsScriptExecUrl('http://script.google.com/macros/s/test/exec').code, 'APPS_SCRIPT_URL_NOT_HTTPS');
  assert.equal(V.validateAppsScriptExecUrl('https://user:pass@script.google.com/macros/s/test/exec').code, 'APPS_SCRIPT_URL_HAS_CREDENTIALS');
  assert.equal(V.validateAppsScriptExecUrl('https://script.google.com/macros/s/test/exec?x=1').code, 'APPS_SCRIPT_URL_HAS_QUERY_OR_FRAGMENT');
});

test('validate-only returns fingerprints without echoing the deployment URL', async () => {
  const url = 'https://script.google.com/macros/s/AKfycb-sensitive-deployment-id/exec';
  const report = await V.verifyAppsScriptUpstream({ scriptUrl: url, validateOnly: true });

  assert.equal(report.ok, true);
  assert.equal(report.classification, 'APPS_SCRIPT_EXEC_URL_VALID');
  assert.equal(JSON.stringify(report).includes(url), false);
  assert.equal(JSON.stringify(report).includes('AKfycb-sensitive-deployment-id'), false);
});

test('read-only probe preserves Apps Script 404 as deployment-not-found without leaking body or secret', async () => {
  const secret = 'super-secret-api-key';
  const html = '<html><head><title>Page not found</title></head><body>Not Found sensitive-body</body></html>';
  const report = await V.verifyAppsScriptUpstream({
    scriptUrl: 'https://script.google.com/macros/s/AKfycb-missing/exec',
    apiKey: secret,
    fetchImpl: async (_url, options) => {
      assert.equal(JSON.parse(options.body).action, 'phase1Health');
      assert.equal(JSON.parse(options.body).apiKey, secret);
      return {
        ok: false,
        status: 404,
        headers: { get: () => 'text/html; charset=utf-8' },
        text: async () => html
      };
    }
  });

  assert.equal(report.ok, false);
  assert.equal(report.stage, 'protocol');
  assert.equal(report.classification, 'APPS_SCRIPT_DEPLOYMENT_NOT_FOUND');
  assert.equal(report.upstream_status, 404);
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.includes('sensitive-body'), false);
});

test('healthy JSON probe emits only bounded health metadata and no business payload', async () => {
  const report = await V.verifyAppsScriptUpstream({
    scriptUrl: 'https://script.google.com/macros/s/AKfycb-healthy/exec',
    apiKey: 'key',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json; charset=utf-8' },
      text: async () => JSON.stringify({
        ok: true,
        admin_api_version: 'v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX',
        data: {
          backend_revision: 'v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX',
          customer_name: 'DO_NOT_PRINT',
          bookings: [{ phone: 'DO_NOT_PRINT' }]
        }
      })
    })
  });

  assert.equal(report.ok, true);
  assert.equal(report.classification, 'APPS_SCRIPT_JSON_RESPONSE');
  assert.equal(report.backend_metadata.admin_api_version, 'v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX');
  assert.equal(report.backend_metadata.backend_revision, 'v16.7.0_CRM_PRO_PHASE3_9_5_9_PRICE_INTEGRITY_FIX');
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes('DO_NOT_PRINT'), false);
  assert.equal(serialized.includes('bookings'), false);
});

test('JSON application error stays explicit and body is not copied to report', async () => {
  const report = await V.verifyAppsScriptUpstream({
    scriptUrl: 'https://script.google.com/macros/s/AKfycb-auth/exec',
    apiKey: 'wrong-key',
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({
        ok: false,
        error_code: 'UNAUTHORIZED',
        error: 'secret detail that must not be emitted'
      })
    })
  });

  assert.equal(report.ok, false);
  assert.equal(report.classification, 'APPS_SCRIPT_JSON_APP_ERROR');
  assert.equal(report.error_code, 'UNAUTHORIZED');
  assert.equal(JSON.stringify(report).includes('secret detail'), false);
});
