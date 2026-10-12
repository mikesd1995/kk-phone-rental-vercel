'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const rules = fs.readFileSync(path.join(root, '.vercelignore'), 'utf8')
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(line => line && !line.startsWith('#'));

test('deployment excludes only approved repository-only directories and reports', () => {
  for (const entry of ['docs/', '.github/', '.agents/', 'skills/', 'apps-script/', 'supabase/']) {
    assert.ok(rules.includes(entry), 'missing safe exclusion ' + entry);
  }
  assert.ok(rules.includes('README_AUDIT.md'));
  assert.ok(rules.includes('DEPLOY_README.txt'));
});

test('deployment retains real runtime, assets, scanner, CI test and postinstall inputs', () => {
  const protectedPaths = [
    'api/', 'admin/', 'assets/', 'server/', 'config/', 'scripts/',
    'tests/', 'index.html', 'script.js', 'style.css', 'middleware.ts',
    'package.json', 'vercel.json', '.vercelignore'
  ];
  for (const target of protectedPaths) {
    assert.ok(!rules.includes(target), 'deployment must retain ' + target);
    assert.ok(fs.existsSync(path.join(root, target)), 'missing runtime source ' + target);
  }
  assert.ok(!rules.includes('/*'), 'dangerous default-deny build packaging');
});

test('existing Vercel production policy and postinstall acceptance remain intact', () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(vercel.git.deploymentEnabled.main, true);
  // Vercel documents minimatch rules: when both '*' false and main true match,
  // true wins; only main receives an automatic Git deployment.
  assert.equal(vercel.git.deploymentEnabled['*'], false,
    'Hobby quota requires unapproved Preview auto-deployments to stay disabled');
  assert.deepEqual(Object.keys(vercel.git.deploymentEnabled).sort(), ['*', 'main'],
    'No uncontrolled branch-specific automatic Preview exceptions');
  assert.match(vercel.ignoreCommand, /vercel-ignore-build\.js/);
  assert.match(pkg.scripts.postinstall, /test:ultradeep:recall/);
  assert.match(pkg.scripts.postinstall, /test:siam-halloween:poster/);
  assert.ok(rules.every(rule => !rule.includes('*') && !rule.startsWith('!')),
    'new deployment exclusions must remain explicit');
});
