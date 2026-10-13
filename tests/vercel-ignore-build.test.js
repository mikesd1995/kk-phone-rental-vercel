'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const IgnoreBuild = require('../scripts/vercel-ignore-build.js');

const SHAS = {
  previousSha: '1111111111111111111111111111111111111111',
  commitSha: '2222222222222222222222222222222222222222'
};

function decide(branch, changedFiles, overrides = {}) {
  return IgnoreBuild.decideIgnoredBuild({
    branch,
    changedFiles,
    previousSha: SHAS.previousSha,
    commitSha: SHAS.commitSha,
    ...overrides
  });
}

test('main skips docs-only changes when the exact diff is known', () => {
  const result = decide('main', ['docs/ADMIN.md', '.github/workflows/admin-regression.yml']);
  assert.equal(result.ignore, true);
  assert.equal(result.reason, 'SAFE_PREVIEW_ONLY_CHANGE');
});

test('main still builds for runtime changes', () => {
  const result = decide('main', ['api/kk-data.js', 'docs/ADMIN.md']);
  assert.equal(result.ignore, false);
  assert.deepEqual(result.build_required_files, ['api/kk-data.js']);
});

test('preview skips when every changed file is documentation, tests, or GitHub workflow metadata', () => {
  const result = decide('docs-only-preview', [
    'docs/ADMIN_RECOVERY.md',
    'tests/example.test.js',
    '.github/workflows/admin-regression.yml',
    'README.md',
    'OPERATIONS.md'
  ]);
  assert.equal(result.ignore, true);
  assert.equal(result.reason, 'SAFE_PREVIEW_ONLY_CHANGE');
});

test('preview builds when runtime API changes', () => {
  const result = decide('admin-fix', ['api/kk-admin-snapshot-v5.js', 'tests/snapshot-upstream-error.test.js']);
  assert.equal(result.ignore, false);
  assert.deepEqual(result.build_required_files, ['api/kk-admin-snapshot-v5.js']);
});

test('preview builds when server or admin UI changes', () => {
  assert.equal(decide('server-fix', ['server/admin-proxy.js']).ignore, false);
  assert.equal(decide('ui-fix', ['admin/admin.js']).ignore, false);
});

test('preview builds when package or Vercel configuration changes', () => {
  assert.equal(decide('dependency-fix', ['package.json']).ignore, false);
  assert.equal(decide('vercel-fix', ['vercel.json']).ignore, false);
});

test('preview skips CLI and workflow tooling changes under scripts', () => {
  const result = decide('oidc-tooling', [
    'scripts/resolve-current-production.js',
    'scripts/accept-oidc-production.js'
  ]);
  assert.equal(result.ignore, true);
  assert.equal(result.reason, 'SAFE_PREVIEW_ONLY_CHANGE');
});

test('preview builds when the ignored-build guard itself changes', () => {
  const result = decide('guard-change', ['scripts/vercel-ignore-build.js']);
  assert.equal(result.ignore, false);
  assert.deepEqual(result.build_required_files, ['scripts/vercel-ignore-build.js']);
});

test('preview builds for unknown paths instead of guessing they are safe', () => {
  const result = decide('unknown-change', ['tools/new-runtime-helper.js']);
  assert.equal(result.ignore, false);
  assert.equal(result.reason, 'RUNTIME_OR_UNKNOWN_CHANGE');
});

test('missing Git SHA fails safe by building', () => {
  const result = decide('docs-only-preview', ['docs/ADMIN.md'], { previousSha: '' });
  assert.equal(result.ignore, false);
  assert.equal(result.reason, 'MISSING_GIT_SHA');
});

test('empty or unknown diff fails safe by building', () => {
  const result = decide('docs-only-preview', []);
  assert.equal(result.ignore, false);
  assert.equal(result.reason, 'EMPTY_OR_UNKNOWN_DIFF');
});

test('unknown branch fails safe by building', () => {
  const result = decide('', ['docs/ADMIN.md']);
  assert.equal(result.ignore, false);
  assert.equal(result.reason, 'UNKNOWN_BRANCH');
});

test('build-critical scripts fail closed on main and optional preview decisions', () => {
  for (const branch of ['main', 'release/acceptance']) {
    for (const path of [
      'scripts/storefront-evidence.cjs',
      'scripts/audit-storefront-posters.js',
      'scripts/kk-ci-offline-dependency-gate.js',
      'scripts/new-runtime-helper.js',
      'scripts/vercel-ignore-build.js'
    ]) {
      const result = decide(branch, [path]);
      assert.equal(result.ignore, false, branch + ':' + path);
      assert.equal(result.reason, 'RUNTIME_OR_UNKNOWN_CHANGE', branch + ':' + path);
      assert.deepEqual(result.build_required_files, [path]);
    }
  }
});

test('only explicitly reviewed CLI-only scripts can skip a Git build', () => {
  for (const path of ['scripts/resolve-current-production.js', 'scripts/accept-oidc-production.js']) {
    const result = decide('main', [path]);
    assert.equal(result.ignore, true);
    assert.equal(result.reason, 'SAFE_PREVIEW_ONLY_CHANGE');
  }
  for (const path of [
    'scripts/resolve-current-production.js.map',
    'scripts/accept-oidc-production.js.bak',
    'scripts/resolve-current-production-helper.js',
    'scripts/verify-event-integrity.js'
  ]) {
    assert.equal(decide('main', [path]).ignore, false, path);
  }
});

test('mixed documentation and build-critical script changes cannot skip production', () => {
  const result = decide('main', [
    'docs/RELEASE.md',
    'scripts/storefront-evidence.cjs',
    'tests/vercel-ignore-build.test.js'
  ]);
  assert.equal(result.ignore, false);
  assert.deepEqual(result.build_required_files, ['scripts/storefront-evidence.cjs']);
});
