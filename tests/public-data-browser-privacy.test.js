'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.join(__dirname, '..');
const configSource = fs.readFileSync(path.join(ROOT, 'config.js'), 'utf8');

test('public config does not expose a Core sheet id and declares API-only mode', () => {
  assert.doesNotMatch(configSource, /sheetId\s*:/);
  assert.match(configSource, /disableDirectFallback:\s*true/);
  assert.match(configSource, /publicDataMode:\s*["']api-only["']/);
});

test('DOMContentLoaded privacy guard overrides every legacy browser direct-sheet path before data loading', async () => {
  let domReadyHandler = null;
  const sandbox = {
    console: { error() {} },
    window: {},
    document: {
      addEventListener(name, fn) {
        if (name === 'DOMContentLoaded') domReadyHandler = fn;
      },
      createElement() { return {}; },
      head: { appendChild() {} },
    },
  };
  sandbox.window.window = sandbox.window;
  sandbox.window.console = sandbox.console;
  sandbox.window.document = sandbox.document;
  vm.createContext(sandbox);
  vm.runInContext(configSource, sandbox, { filename: 'config.js' });

  assert.equal(typeof domReadyHandler, 'function');
  assert.equal(sandbox.window.KK_CONFIG.disableDirectFallback, true);
  assert.equal(sandbox.window.KK_CONFIG.publicDataMode, 'api-only');
  assert.equal('sheetId' in sandbox.window.KK_CONFIG, false);

  let validatedCall = null;
  sandbox.window.SHEET_ID = 'legacy-runtime-value';
  sandbox.window.USE_API = false;
  sandbox.window.apiSheetUrl = (name, range) => `/api/kk-data?sheet=${encodeURIComponent(name)}&range=${encodeURIComponent(range)}`;
  sandbox.window.fetchValidatedSheetCsv = async (...args) => {
    validatedCall = args;
    return 'ok';
  };
  sandbox.window.directSheetUrl = () => 'legacy-direct-url';
  sandbox.window.fetchSheetCsv = async () => 'legacy-direct-result';

  domReadyHandler();

  assert.equal(sandbox.window.SHEET_ID, 'api-only');
  assert.equal(sandbox.window.USE_API, true);
  assert.equal(sandbox.window.__KK_PUBLIC_DATA_GUARD__, 'api-only');
  assert.throws(() => sandbox.window.directSheetUrl('08_Web_Ready', 'A4:K'), /Direct Google Sheets browser access is disabled/);

  const result = await sandbox.window.fetchSheetCsv('09_Web_Packages', 'A4:N', 5000);
  assert.equal(result, 'ok');
  assert.deepEqual(Array.from(validatedCall), [
    '/api/kk-data?sheet=09_Web_Packages&range=A4%3AN',
    '09_Web_Packages',
    'A4:N',
    5000,
    '/api/kk-data',
  ]);
});
