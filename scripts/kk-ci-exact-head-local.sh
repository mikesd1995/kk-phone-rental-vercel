#!/usr/bin/env bash
# KK Phone Rental: independent LOCAL-ONLY source acceptance; never a GitHub CI status.
set -euo pipefail

EXPECTED_SHA="${1:-}"
if [[ ! "$EXPECTED_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  printf 'BLOCKED_INVALID_EXACT_SHA: require an approved lowercase 40-char Git SHA\n' >&2
  exit 2
fi

for executable in git node npm; do
  if ! command -v "$executable" >/dev/null 2>&1; then
    printf 'BLOCKED_MISSING_EXECUTABLE: %s\n' "$executable" >&2
    exit 2
  fi
done

ROOT="$(git rev-parse --show-toplevel)" || {
  printf 'BLOCKED_NOT_GIT_REPOSITORY\n' >&2
  exit 2
}
cd "$ROOT"
CURRENT_SHA="$(git rev-parse HEAD)"
if [[ "$CURRENT_SHA" != "$EXPECTED_SHA" ]]; then
  printf 'BLOCKED_SHA_MISMATCH expected=%s actual=%s\n' "$EXPECTED_SHA" "$CURRENT_SHA" >&2
  exit 2
fi
if ! git diff --quiet || ! git diff --cached --quiet; then
  printf 'BLOCKED_DIRTY_TRACKED_SOURCE\n' >&2
  exit 2
fi
NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  printf 'BLOCKED_NODE_VERSION: Node >=20 required\n' >&2
  exit 2
fi
if [[ -f package-lock.json || -f npm-shrinkwrap.json ]]; then
  printf 'BLOCKED_DEPENDENCY_MODE_CHANGED: review lockfile policy\n' >&2
  exit 2
fi
for source in \
  scripts/kk-ci-offline-dependency-gate.js \
  tests/kk-ci-offline-dependency-gate.test.js \
  tests/ultra-deep-v2-workflow-contract.test.js \
  tests/kk-ultra-deep-full-loop-v2.test.js; do
  if [[ ! -f "$source" ]]; then
    printf 'BLOCKED_MISSING_SOURCE: %s\n' "$source" >&2
    exit 2
  fi
done

trap 'printf "LOCAL_ONLY_FAIL exact_sha=%s GitHub_actions_pass=false release_ready=false\n" "$EXPECTED_SHA" >&2' ERR
printf 'LOCAL_ONLY_STARTED exact_sha=%s node=%s GitHub_actions_pass=false\n' "$EXPECTED_SHA" "$(node --version)"
node --test tests/kk-ci-offline-dependency-gate.test.js tests/ultra-deep-v2-workflow-contract.test.js
node scripts/kk-ci-offline-dependency-gate.js ultradeep
npm run check
npm run test:ultradeep:recall
node --test tests/kk-ultra-deep-full-loop-v2.test.js
printf 'LOCAL_ONLY_PASS exact_sha=%s GitHub_actions_pass=false release_ready=false production_writes=NOT_MEASURED\n' "$EXPECTED_SHA"
