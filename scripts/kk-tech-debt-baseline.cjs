'use strict';

// Offline, dependency-free, read-only architecture debt guard. No network,
// credentials, customer data, deployment, or business-state modification.
const fs = require('node:fs');
const path = require('node:path');

const HOTSPOTS = Object.freeze([
  'script.js',
  'admin/admin.js',
  'apps-script/Code.gs'
]);
const LEGACY_PUBLIC_READERS = Object.freeze([
  'api/kk-data.js',
  'server/admin-sheet-fallback.js'
]);
const REQUIRED_FILES = Object.freeze([
  ...HOTSPOTS, ...LEGACY_PUBLIC_READERS,
  'config.js', 'package.json'
]);
const BASELINE_PATH = 'docs/KK_TECH_DEBT_BASELINE_20261028.json';

function matches(text, re) {
  return (String(text).match(re) || []).length;
}
function readText(root, relative) {
  // Only paths in the static allowlist are read; no user-provided file paths.
  return fs.readFileSync(path.join(root, relative), 'utf8');
}
function snapshot(root) {
  const source = {};
  for (const relative of REQUIRED_FILES) source[relative] = readText(root, relative);
  const p = JSON.parse(source['package.json']);
  if (!p || typeof p !== 'object' || Array.isArray(p) ||
      !p.scripts || typeof p.scripts !== 'object' || Array.isArray(p.scripts)) {
    throw new Error('TECH_DEBT_PACKAGE_SCRIPTS_INVALID');
  }
  const size = text => ({
    lines: String(text).split(/\r?\n/).length,
    utf8_bytes: Buffer.byteLength(text, 'utf8')
  });
  const modules = {};
  for (const relative of HOTSPOTS) {
    modules[relative] = {
      ...size(source[relative]),
      inner_html_assignments: matches(source[relative], /\.innerHTML\s*=/g)
    };
  }
  const legacyPublicGviz = {};
  for (const relative of LEGACY_PUBLIC_READERS) {
    legacyPublicGviz[relative] = matches(source[relative], /gviz\/tq/g);
  }
  const config = source['config.js'];
  return {
    schema_version: 1,
    modules,
    legacy_public_gviz: legacyPublicGviz,
    browser: {
      api_only: /publicDataMode:\s*['"]api-only['"]/.test(config),
      direct_fallback_disabled: /disableDirectFallback:\s*true\b/.test(config),
      uses_server_api: /useVercelApi:\s*true\b/.test(config),
      direct_sheets_urls: matches(source['script.js'], /docs\.google\.com\/spreadsheets\/d\//g)
    },
    tooling: {
      npm_scripts: Object.keys(p.scripts).length,
      check_command_chars: String(p.scripts.check || '').length,
      has_test_script: typeof p.scripts.test === 'string' && !!p.scripts.test.trim()
    }
  };
}

function compare(now, baseline) {
  if (!baseline || baseline.schema_version !== 1 ||
      !baseline.snapshot || baseline.snapshot.schema_version !== 1) {
    throw new Error('TECH_DEBT_BASELINE_INVALID');
  }
  const prior = baseline.snapshot;
  const findings = [];
  const add = (id, details) => findings.push({ id, details });
  for (const key of ['api_only', 'direct_fallback_disabled', 'uses_server_api']) {
    if (prior.browser[key] === true && now.browser[key] !== true) {
      add('BROWSER_PRIVATE_DATA_GUARD_REMOVED', key);
    }
  }
  if (now.browser.direct_sheets_urls > prior.browser.direct_sheets_urls) {
    add('BROWSER_DIRECT_SHEETS_URL_ADDED', 'Storefront script must use the server API');
  }
  for (const file of LEGACY_PUBLIC_READERS) {
    if ((now.legacy_public_gviz[file] || 0) > (prior.legacy_public_gviz[file] || 0)) {
      add('LEGACY_PUBLIC_GVIZ_REFERENCE_ADDED', file);
    }
  }
  for (const file of HOTSPOTS) {
    const current = now.modules[file];
    const old = prior.modules[file];
    if (!current || !old || !Number.isFinite(old.lines)) {
      throw new Error('TECH_DEBT_MODULE_BASELINE_INVALID');
    }
    const allowance = Math.max(200, Math.ceil(old.lines * 0.1));
    if (current.lines > old.lines + allowance) {
      add('LARGE_MODULE_GROWTH', file);
    }
    // innerHTML counts are inventory, not a vulnerability assertion.
  }
  if (now.tooling.npm_scripts > prior.tooling.npm_scripts + 10) {
    add('BUILD_SCRIPT_PROLIFERATION', 'package.json');
  }
  if (prior.tooling.has_test_script && !now.tooling.has_test_script) {
    add('TEST_ENTRYPOINT_REMOVED', 'package.json');
  }
  return {
    schema_version: 1,
    status: findings.length ? 'REGRESSION_DETECTED' : 'NO_NEW_REGRESSION',
    ok: findings.length === 0,
    known_open_debt: {
      oversized_modules: HOTSPOTS.filter(file => now.modules[file].lines > 1500),
      legacy_public_gviz_references: Object.values(now.legacy_public_gviz).reduce((a, b) => a + b, 0),
      html_sink_assignments_inventory: HOTSPOTS.reduce((n, file) => n + now.modules[file].inner_html_assignments, 0)
    },
    findings,
    snapshot: now
  };
}

function run(root = path.resolve(__dirname, '..'), argv = process.argv.slice(2)) {
  if (argv.some(a => !['--check', '--json'].includes(a))) {
    throw new Error('TECH_DEBT_UNSUPPORTED_ARGUMENT');
  }
  const baseline = JSON.parse(readText(root, BASELINE_PATH));
  const result = compare(snapshot(root), baseline);
  // Aggregate code metrics only; never print file contents, env or PII.
  process.stdout.write(JSON.stringify(result, null, argv.includes('--json') ? 2 : 0) + '\n');
  if (argv.includes('--check') && !result.ok) process.exitCode = 1;
  return result;
}

if (require.main === module) {
  try { run(); }
  catch (_) {
    // Do not echo arbitrary parser errors, paths, or file contents to CI logs.
    process.stderr.write('TECH_DEBT_AUDIT_UNAVAILABLE\n');
    process.exitCode = 2;
  }
}
module.exports = { HOTSPOTS, LEGACY_PUBLIC_READERS, REQUIRED_FILES, BASELINE_PATH, snapshot, compare, run };
