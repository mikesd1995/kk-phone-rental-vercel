'use strict';

// Dependency-free, read-only inventory. Never load .env, network resources,
// business rows or credentials. It is not a penetration test or release gate.
const fs = require('node:fs');
const path = require('node:path');

const VERSION = 1;
const MODULES = Object.freeze([
  { file: 'script.js', area: 'storefront', reviewLines: 2000 },
  { file: 'admin/admin.js', area: 'admin', reviewLines: 3800 },
  { file: 'apps-script/Code.gs', area: 'apps_script', reviewLines: 3400 },
  { file: 'api/kk-data.js', area: 'public_api', reviewLines: 650 },
  { file: 'server/admin-sheet-fallback.js', area: 'admin_data', reviewLines: 550 }
]);
const LEGACY_SERVER_READERS = Object.freeze([
  'api/kk-data.js',
  'server/admin-sheet-fallback.js'
]);

function lineCount(source) {
  if (!source) return 0;
  const normalized = source.replace(/\r\n?/g, '\n');
  const parts = normalized.split('\n');
  return parts.length - (normalized.endsWith('\n') ? 1 : 0);
}
function occurrences(source, re) {
  return (source.match(re) || []).length;
}
function readSource(root, relative, io = fs) {
  // Only hard-coded source paths are read. Do not scan env/config values,
  // GitHub credentials or the Core Sheet, and never print source snippets.
  try {
    const source = io.readFileSync(path.join(root, relative), 'utf8');
    return { exists: true, source };
  } catch (_) {
    return { exists: false, source: '' };
  }
}
function audit(root, io = fs) {
  const fetch = file => readSource(root, file, io);
  const modules = MODULES.map(({ file, area, reviewLines }) => {
    const { exists, source } = fetch(file);
    const lines = exists ? lineCount(source) : null;
    return {
      file, area, present: exists, lines,
      review_threshold_lines: reviewLines,
      needs_modularization_review: exists && lines > reviewLines
    };
  });
  const config = fetch('config.js');
  const storefront = fetch('script.js');
  const packageFile = fetch('package.json');
  const vercelFile = fetch('vercel.json');

  const browserGuard = {
    api_only_configured: config.exists &&
      /disableDirectFallback\s*:\s*true\b/.test(config.source) &&
      /publicDataMode\s*:\s*['"]api-only['"]/.test(config.source),
    direct_sheet_helper_disabled: storefront.exists &&
      /function\s+directSheetUrl\s*\([^)]*\)\s*\{\s*throw\s+new\s+Error\s*\(/.test(storefront.source),
    // Positive regex witnesses provide only source evidence, not browser E2E.
    source_contract_only: true
  };

  const legacyReaders = LEGACY_SERVER_READERS.map(file => {
    const { exists, source } = fetch(file);
    return {
      file,
      present: exists,
      public_gviz_markers: exists ? occurrences(source, /gviz\/tq|out:csv/g) : null,
      status: !exists ? 'UNKNOWN' : /gviz\/tq|out:csv/.test(source) ? 'REVIEW_LEGACY_PATH' : 'NO_MARKER'
    };
  });

  let npmScripts = null;
  let syntaxCheckCharacters = null;
  if (packageFile.exists) {
    try {
      const pkg = JSON.parse(packageFile.source);
      npmScripts = pkg.scripts && typeof pkg.scripts === 'object' ? Object.keys(pkg.scripts).length : 0;
      syntaxCheckCharacters = typeof pkg.scripts?.check === 'string' ? pkg.scripts.check.length : 0;
    } catch (_) { /* Emit no raw parse errors (might contain local file text). */ }
  }
  let previewIgnoreConfigured = null;
  if (vercelFile.exists) {
    try {
      const settings = JSON.parse(vercelFile.source);
      previewIgnoreConfigured = typeof settings.ignoreCommand === 'string' && settings.ignoreCommand.length > 0;
    } catch (_) { /* Unknown is safer than inferring a healthy deployment. */ }
  }

  const criticalGuardRegressions = [
    ...(browserGuard.api_only_configured ? [] : ['BROWSER_API_ONLY_CONFIG_MISSING']),
    ...(browserGuard.direct_sheet_helper_disabled ? [] : ['DIRECT_SHEET_HELPER_NOT_FAIL_CLOSED'])
  ];
  const missingTracked = modules.filter(m => !m.present).map(m => m.file);
  const report = {
    version: VERSION,
    audit_mode: 'STATIC_READ_ONLY',
    safety_scope: 'NO_NETWORK_NO_SECRETS_NO_SHEETS_NO_WRITES',
    modules,
    browser_guard: browserGuard,
    legacy_server_readers: legacyReaders,
    package_metrics: { script_count: npmScripts, syntax_check_characters: syntaxCheckCharacters },
    deployment_metrics: { preview_ignore_command_present: previewIgnoreConfigured },
    summary: {
      tracked_modules: MODULES.length,
      missing_tracked_modules: missingTracked,
      above_review_threshold: modules.filter(m => m.needs_modularization_review).map(m => m.file),
      browser_guard_regressions: criticalGuardRegressions,
      legacy_server_reader_review_count: legacyReaders.filter(m => m.status === 'REVIEW_LEGACY_PATH').length,
      warnings_total: missingTracked.length + modules.filter(m => m.needs_modularization_review).length +
        criticalGuardRegressions.length + legacyReaders.filter(m => m.status === 'REVIEW_LEGACY_PATH').length
    },
    limitations: [
      'Static source markers are not proof of runtime privacy or authentication.',
      'No customer data, GitHub PR states, Drive ACLs, live CI or Production browser tests are read.',
      'Line-count thresholds are review prompts, not build failure limits.'
    ]
  };
  return report;
}
function main(argv = process.argv, io = fs, output = process.stdout, root = path.resolve(__dirname, '..')) {
  // --strict-browser is opt-in. Normal mode documents existing debt without
  // disrupting Codex, preview builds, development or other CI workflows.
  const strictBrowser = argv.includes('--strict-browser');
  const result = audit(root, io);
  output.write(JSON.stringify(result, null, 2) + '\n');
  return strictBrowser && result.summary.browser_guard_regressions.length > 0 ? 2 : 0;
}
if (require.main === module) process.exitCode = main();
module.exports = { VERSION, MODULES, LEGACY_SERVER_READERS, lineCount, occurrences, audit, main };
