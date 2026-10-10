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
  const result = decide('preview/docs-only-preview', [
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
  const result = decide('preview/admin-fix', ['api/kk-admin-snapshot-v5.js', 'tests/snapshot-upstream-error.test.js']);
  assert.equal(result.ignore, false);
  assert.deepEqual(result.build_required_files, ['api/kk-admin-snapshot-v5.js']);
});

test('preview builds when server or admin UI changes', () => {
  assert.equal(decide('preview/server-fix', ['server/admin-proxy.js']).ignore, false);
  assert.equal(decide('preview/ui-fix', ['admin/admin.js']).ignore, false);
});

test('preview builds when package or Vercel configuration changes', () => {
  assert.equal(decide('preview/dependency-fix', ['package.json']).ignore, false);
  assert.equal(decide('preview/vercel-fix', ['vercel.json']).ignore, false);
});

test('preview skips CLI and workflow tooling changes under scripts', () => {
  const result = decide('preview/oidc-tooling', [
    'scripts/resolve-current-production.js',
    'scripts/accept-oidc-production.js'
  ]);
  assert.equal(result.ignore, true);
  assert.equal(result.reason, 'SAFE_PREVIEW_ONLY_CHANGE');
});

test('preview builds when the ignored-build guard itself changes', () => {
  const result = decide('preview/guard-change', ['scripts/vercel-ignore-build.js']);
  assert.equal(result.ignore, false);
  assert.deepEqual(result.build_required_files, ['scripts/vercel-ignore-build.js']);
});

test('preview builds for unknown paths instead of guessing they are safe', () => {
  const result = decide('preview/unknown-change', ['tools/new-runtime-helper.js']);
  assert.equal(result.ignore, false);
  assert.equal(result.reason, 'RUNTIME_OR_UNKNOWN_CHANGE');
});

test('missing Git SHA fails safe by building', () => {
  const result = decide('preview/docs-only-preview', ['docs/ADMIN.md'], { previousSha: '' });
  assert.equal(result.ignore, false);
  assert.equal(result.reason, 'MISSING_GIT_SHA');
});

test('empty or unknown diff fails safe by building', () => {
  const result = decide('preview/docs-only-preview', []);
  assert.equal(result.ignore, false);
  assert.equal(result.reason, 'EMPTY_OR_UNKNOWN_DIFF');
});

test('unknown branch fails safe by building', () => {
  const result = decide('', ['docs/ADMIN.md']);
  assert.equal(result.ignore, false);
  assert.equal(result.reason, 'UNKNOWN_BRANCH');
});

test('Hobby budget: default feature branches do not create Vercel preview builds', () => {
  for (const branch of [
    'fix/vercel-hobby-storage-preview-gate-20261011',
    'fix/unified-inbox-private-line-images-20261010',
    'feat/new-event',
    'chore/docs',
    'codex/sandbox',
    'admin-fix'
  ]) {
    const result = decide(branch, ['api/kk-data.js']);
    assert.equal(result.ignore, true, branch);
    assert.equal(result.reason, 'PREVIEW_OPT_IN_REQUIRED', branch);
    assert.equal(result.branch, branch);
  }
});

test('only explicitly named preview/ and release/ branches opt in', () => {
  assert.equal(IgnoreBuild.isOptInPreviewBranch('preview/acceptance'), true);
  assert.equal(IgnoreBuild.isOptInPreviewBranch('release/storefront'), true);
  assert.equal(IgnoreBuild.isOptInPreviewBranch('main'), false);
  assert.equal(IgnoreBuild.isOptInPreviewBranch('fix/storefront'), false);
  assert.equal(IgnoreBuild.isOptInPreviewBranch('preview/'), false);
  assert.equal(decide('release/storefront', ['api/kk-data.js']).ignore, false);
});

test('unrequested previews skip even with missing SHAs; production still builds', () => {
  const missing = { previousSha: '', commitSha: '' };
  assert.equal(decide('fix/experimental', [], missing).reason, 'PREVIEW_OPT_IN_REQUIRED');
  assert.equal(decide('fix/experimental', [], missing).ignore, true);
  assert.equal(decide('main', ['api/kk-data.js'], missing).ignore, false);
  assert.equal(decide('main', ['api/kk-data.js'], missing).reason, 'MISSING_GIT_SHA');
  assert.equal(decide('preview/acceptance', [], missing).reason, 'MISSING_GIT_SHA');
});

test('Vercel CLI exits zero for unrequested preview without calling git', () => {
  assert.equal(IgnoreBuild.runCli({
    VERCEL_GIT_COMMIT_REF: 'fix/first-commit',
    VERCEL_GIT_PREVIOUS_SHA: '',
    VERCEL_GIT_COMMIT_SHA: ''
  }), 0);
});
