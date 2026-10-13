'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '..', '.github', 'workflows', 'ultra-deep-v2-acceptance.yml'),
  'utf8'
);

test('Ultra Deep V2 CI uses a least-privilege, explicit checkout', () => {
  assert.match(source, /^permissions:\s*\n\s+contents: read/m);
  assert.match(source, /APPROVED_SHA: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
  assert.match(source, /ref: \$\{\{ env\.APPROVED_SHA \}\}/);
  assert.match(source, /persist-credentials: false/);
  assert.match(source, /test "\$\(git rev-parse HEAD\)" = "\$APPROVED_SHA"/);
});

test('outdated PR checks are cancelled without skipping the latest candidate', () => {
  assert.match(source, /^concurrency:\s*\n\s+group: kk-ultra-deep-v2-\$\{\{ github\.event\.pull_request\.number \|\| github\.ref \}\}\s*\n\s+cancel-in-progress: true/m);
  assert.match(source, /^\s+pull_request:\s*$/m);
  assert.match(source, /^\s+workflow_dispatch:\s*$/m);
  assert.doesNotMatch(source, /^\s+continue-on-error:\s*true\s*$/m);
});

test('the same exact-head run retains syntax, V2, and workflow contract tests', () => {
  assert.match(source, /run: npm ci/);
  assert.match(source, /run: npm run check/);
  assert.match(source, /node --test tests\/kk-ultra-deep-full-loop-v2\.test\.js tests\/ultra-deep-v2-workflow-contract\.test\.js/);
  assert.match(source, /'\.github\/workflows\/ultra-deep-v2-acceptance\.yml'/);
  assert.match(source, /'tests\/ultra-deep-v2-workflow-contract\.test\.js'/);
});
