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

test('main always builds even for docs-only changes', () => {
  const result = decide('main', ['docs/ADMIN.md']);
  assert.equal(result.ignore, false);
  assert.equal(result.reason, 'MAIN_ALWAYS_BUILDS');
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

test('preview builds for unknown paths instead of guessing they are safe', () => {
  const result = decide('unknown-change', ['scripts/new-runtime-helper.js']);
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
