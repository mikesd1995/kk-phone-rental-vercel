'use strict';

const { execFileSync } = require('node:child_process');

const SAFE_PREVIEW_ONLY_PATTERNS = [
  /^\.github\//,
  /^docs\//,
  /^tests\//,
  // Only two proven ops-only CLI helpers can skip a preview build.
  // Other scripts may run during install/build and must be tested.
  /^scripts\/(?:resolve-current-production|accept-oidc-production)\.js$/,
  /^README(?:\..*)?$/i,
  /^[^/]+\.md$/i
];

function normalizeFiles(files) {
  if (!Array.isArray(files)) return [];
  return files
    .map((file) => String(file || '').trim().replace(/^\.\//, ''))
    .filter(Boolean);
}

function isSafePreviewOnlyPath(file) {
  const normalized = String(file || '').trim().replace(/^\.\//, '');
  if (normalized === 'scripts/vercel-ignore-build.js') return false;
  return SAFE_PREVIEW_ONLY_PATTERNS.some((pattern) => pattern.test(normalized));
}

function decideIgnoredBuild({ branch, previousSha, commitSha, changedFiles }) {
  const ref = String(branch || '').trim();
  const before = String(previousSha || '').trim();
  const after = String(commitSha || '').trim();
  const files = normalizeFiles(changedFiles);

  if (!ref) {
    return { ignore: false, reason: 'UNKNOWN_BRANCH' };
  }
  if (!before || !after) {
    return { ignore: false, reason: 'MISSING_GIT_SHA' };
  }
  if (files.length === 0) {
    return { ignore: false, reason: 'EMPTY_OR_UNKNOWN_DIFF' };
  }

  const buildRequired = files.filter((file) => !isSafePreviewOnlyPath(file));
  if (buildRequired.length > 0) {
    return {
      ignore: false,
      reason: 'RUNTIME_OR_UNKNOWN_CHANGE',
      build_required_files: buildRequired
    };
  }

  return {
    ignore: true,
    reason: 'SAFE_PREVIEW_ONLY_CHANGE',
    ignored_files: files
  };
}

function changedFilesFromGit(previousSha, commitSha) {
  const output = execFileSync(
    'git',
    ['diff', '--name-only', '--diff-filter=ACMRD', previousSha, commitSha],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );

  return normalizeFiles(output.split(/\r?\n/));
}

function runCli(env = process.env) {
  const branch = String(env.VERCEL_GIT_COMMIT_REF || '').trim();
  const previousSha = String(env.VERCEL_GIT_PREVIOUS_SHA || '').trim();
  const commitSha = String(env.VERCEL_GIT_COMMIT_SHA || '').trim();

  if (!branch) {
    const decision = decideIgnoredBuild({ branch, previousSha, commitSha, changedFiles: [] });
    console.log(JSON.stringify(decision));
    return 1;
  }

  if (!previousSha || !commitSha) {
    const decision = decideIgnoredBuild({ branch, previousSha, commitSha, changedFiles: [] });
    console.log(JSON.stringify(decision));
    return 1;
  }

  let changedFiles;
  try {
    changedFiles = changedFilesFromGit(previousSha, commitSha);
  } catch (error) {
    console.error(JSON.stringify({
      ignore: false,
      reason: 'GIT_DIFF_FAILED',
      error: error && error.message ? error.message : String(error)
    }));
    return 1;
  }

  const decision = decideIgnoredBuild({ branch, previousSha, commitSha, changedFiles });
  console.log(JSON.stringify(decision));

  // Vercel Ignored Build Step semantics:
  // exit 0 = skip deployment, exit 1 = continue deployment.
  return decision.ignore ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = runCli();
}

module.exports = {
  SAFE_PREVIEW_ONLY_PATTERNS,
  normalizeFiles,
  isSafePreviewOnlyPath,
  decideIgnoredBuild,
  changedFilesFromGit,
  runCli
};
