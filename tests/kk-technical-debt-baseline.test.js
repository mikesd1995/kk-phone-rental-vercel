'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Debt = require('../scripts/kk-technical-debt-baseline.cjs');

function fixture(overrides = {}) {
  const data = {
    'script.js': 'function directSheetUrl(){ throw new Error("API only"); }\n',
    'admin/admin.js': 'const admin = true;\n',
    'apps-script/Code.gs': 'function doGet() {return null;}\n',
    'api/kk-data.js': 'const legacy = "gviz/tq";\n',
    'server/admin-sheet-fallback.js': 'const legacy = "out:csv";\n',
    'config.js': 'window.KK_CONFIG = {disableDirectFallback: true, publicDataMode: "api-only"};\n',
    'package.json': JSON.stringify({scripts: {check: 'node --check script.js', test: 'node --test tests/*.test.js'}}),
    'vercel.json': JSON.stringify({ignoreCommand: 'node scripts/vercel-ignore-build.js'})
  };
  Object.assign(data, overrides);
  const root = path.resolve('/synthetic-repo');
  const io = { readFileSync(abs, enc) {
    assert.equal(enc, 'utf8');
    const rel = path.relative(root, abs).replace(/\\/g, '/');
    if (!Object.hasOwn(data, rel) || data[rel] === null) throw Object.assign(new Error('not present'), {code:'ENOENT'});
    return data[rel];
  }};
  return {root, io};
}

test('source-only inventory remains deterministic and has no network or business data', () => {
  const f = fixture();
  const report = Debt.audit(f.root, f.io);
  assert.equal(report.version, 1);
  assert.equal(report.audit_mode, 'STATIC_READ_ONLY');
  assert.equal(report.summary.tracked_modules, 5);
  assert.deepEqual(report.summary.browser_guard_regressions, []);
  assert.equal(report.summary.legacy_server_reader_review_count, 2);
  assert.equal(report.package_metrics.script_count, 2);
  assert.equal(report.deployment_metrics.preview_ignore_command_present, true);
  assert.doesNotMatch(JSON.stringify(report), /doGet\(|directSheetUrl\(/);
});
test('missing API-only config and missing direct helper are reported with constant codes', () => {
  const f = fixture({'config.js': 'window.KK_CONFIG = {disableDirectFallback:false};', 'script.js': 'function directSheetUrl() { return "bad"; }'});
  const out = Debt.audit(f.root, f.io);
  assert.deepEqual(out.summary.browser_guard_regressions, [
    'BROWSER_API_ONLY_CONFIG_MISSING', 'DIRECT_SHEET_HELPER_NOT_FAIL_CLOSED'
  ]);
});
test('missing modules report UNKNOWN rather than falsely passing', () => {
  const f = fixture({'apps-script/Code.gs': null, 'api/kk-data.js': null, 'package.json':null, 'vercel.json':null});
  const out = Debt.audit(f.root, f.io);
  assert.equal(out.modules.find(m => m.file === 'apps-script/Code.gs').present, false);
  assert.equal(out.legacy_server_readers[0].status, 'UNKNOWN');
  assert.equal(out.package_metrics.script_count, null);
  assert.equal(out.deployment_metrics.preview_ignore_command_present, null);
});
test('line counts support CRLF and final newlines without off-by-one', () => {
  assert.equal(Debt.lineCount(''), 0);
  assert.equal(Debt.lineCount('a\n'), 1);
  assert.equal(Debt.lineCount('a\r\nb\r\n'), 2);
  assert.equal(Debt.lineCount('a\rb'), 2);
  assert.equal(Debt.lineCount('single'), 1);
});
test('large module produces review warning, not a false security failure', () => {
  const f = fixture({'script.js': 'function directSheetUrl(){throw new Error("guard")}' + '\n'.repeat(2105)});
  const out = Debt.audit(f.root, f.io);
  assert.ok(out.summary.above_review_threshold.includes('script.js'));
  assert.deepEqual(out.summary.browser_guard_regressions, []);
});
test('no source fragments, fixture contacts or pasted secrets appear in a report', () => {
  const marker = 'SYNTHETIC_PRIVATE_CUSTOMER_TOKEN_987654321';
  const f = fixture({
    'api/kk-data.js': '// ' + marker + "\n; const legacy = 'gviz/tq'",
    'admin/admin.js': marker,
    'package.json': JSON.stringify({private:marker})
  });
  assert.doesNotMatch(JSON.stringify(Debt.audit(f.root, f.io)), new RegExp(marker));
});
test('legacy public server markers are reported for review, not asserted exploitable', () => {
  const f = fixture({'api/kk-data.js': '// no legacy path', 'server/admin-sheet-fallback.js':'// empty'});
  const result = Debt.audit(f.root, f.io);
  assert.equal(result.summary.legacy_server_reader_review_count, 0);
  assert.equal(result.legacy_server_readers[0].status, 'NO_MARKER');
});
test('strict browser option returns 2 for regressions and zero for guarded fixture', () => {
  const okay = fixture();
  const broken = fixture({'config.js': null});
  let normalOutput = '';
  let strictOutput = '';
  assert.equal(Debt.main(['node', 'audit.cjs'], okay.io, {write:x=>{normalOutput += x;}}, okay.root), 0);
  assert.equal(Debt.main(['node', 'audit.cjs', '--strict-browser'], broken.io, {write:x=>{strictOutput += x;}}, broken.root), 2);
  assert.deepEqual(JSON.parse(normalOutput).summary.browser_guard_regressions, []);
  assert.deepEqual(JSON.parse(strictOutput).summary.browser_guard_regressions, ['BROWSER_API_ONLY_CONFIG_MISSING']);
});
