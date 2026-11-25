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
  assert.equal(report.version, 2);
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

test('each of eight fixed source paths is read once per audit', () => {
  const f = fixture();
  const reads = new Map();
  const original = f.io.readFileSync;
  f.io.readFileSync = (abs, enc) => {
    reads.set(abs, (reads.get(abs) || 0) + 1);
    return original(abs, enc);
  };
  Debt.audit(f.root, f.io);
  assert.equal(reads.size, 8);
  assert.ok([...reads.values()].every(count => count === 1));
});
test('malformed JSON and wrong root or scripts shape are unknown, not zero', () => {
  for (const source of ['{', 'null', '[]', '{"scripts":[]}', '{"scripts":{"check":true}}']) {
    const f = fixture({'package.json': source});
    const out = Debt.audit(f.root, f.io);
    assert.equal(out.package_metrics.script_count, null);
    assert.equal(out.package_metrics.syntax_check_characters, null);
    assert.ok(out.summary.inventory_findings.includes('PACKAGE_SCRIPTS_UNKNOWN'));
  }
});
test('blank or malformed ignoreCommand is not a positive deployment witness', () => {
  for (const [source, expected] of [['{}', false], ['{"ignoreCommand":"  "}', false], ['{"ignoreCommand":true}', null], ['[]', null]]) {
    const f = fixture({'vercel.json': source});
    assert.equal(Debt.audit(f.root, f.io).deployment_metrics.preview_ignore_command_present, expected);
  }
});
test('literal check chain counts duplicate commands and only fixed missing paths', () => {
  const f = fixture({'package.json': JSON.stringify({scripts:{check:'node --check script.js && node --check ./script.js && node --check api/kk-data.js'}})});
  const out = Debt.audit(f.root, f.io);
  assert.deepEqual(out.package_metrics.syntax_check_chain, {
    explicit_command_count: 3, unique_target_count: 2, duplicate_command_count: 1,
    unrecognized_segment_count: 0, tracked_js_missing_explicit_check: ['admin/admin.js','server/admin-sheet-fallback.js']
  });
  assert.ok(out.summary.inventory_findings.includes('SYNTAX_CHECK_DUPLICATE_TARGETS'));
});
test('complex shell syntax is partial evidence; no arbitrary path read or raw command output', () => {
  const secret = 'SYNTHETIC_SECRET_20261126';
  const f = fixture({'package.json': JSON.stringify({scripts:{check:`node --check script.js && echo ${secret} && node --check ../../secret.js`}})});
  const out = Debt.audit(f.root, f.io);
  assert.equal(out.package_metrics.syntax_check_chain.unrecognized_segment_count, 2);
  assert.equal(out.package_metrics.syntax_check_chain.tracked_js_missing_explicit_check, null);
  assert.ok(out.summary.inventory_findings.includes('SYNTAX_CHECK_PARTIAL_COVERAGE_UNKNOWN'));
  assert.doesNotMatch(JSON.stringify(out), /SYNTHETIC_SECRET|secret\.js/);
});
test('default exit remains advisory; opt-in inventory exit is distinct from browser exit', () => {
  const f = fixture({'package.json': '{}'});
  const out = {write:()=>{}};
  assert.equal(Debt.main(['node','audit.cjs'], f.io, out, f.root), 0);
  assert.equal(Debt.main(['node','audit.cjs','--strict-inventory'], f.io, out, f.root), 3);
  const good = fixture({'package.json': JSON.stringify({scripts:{check:'node --check script.js && node --check admin/admin.js && node --check api/kk-data.js && node --check server/admin-sheet-fallback.js'}})});
  assert.equal(Debt.main(['node','audit.cjs','--strict-inventory'], good.io, out, good.root), 0);
  const bad = fixture({'config.js':null, 'package.json':'{}'});
  assert.equal(Debt.main(['node','audit.cjs','--strict-inventory','--strict-browser'], bad.io, out, bad.root), 2);
});
