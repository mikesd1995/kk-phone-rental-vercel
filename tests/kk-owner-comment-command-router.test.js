'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const WORKFLOWS = path.join(ROOT, '.github', 'workflows');
const ROUTER_NAME = 'kk-owner-comment-command-router.yml';
const read = (name) => fs.readFileSync(path.join(WORKFLOWS, name), 'utf8');

const ROUTES = [
  { id: 'bounded_oidc', issue: 47, command: '/run-bounded-oidc', prefix: false, workflow: 'bounded-oidc-production-acceptance.yml', permissions: ['contents: read'], manual: true },
  { id: 'current_prod_readback', issue: 164, command: '/verify-current-production ', prefix: true, workflow: 'current-production-readback.yml', permissions: ['contents: read', 'issues: read'] },
  { id: 'phase4_recovery', issue: 213, command: '/run-phase4-zero-cost-promote ', prefix: true, workflow: 'phase4-zero-cost-existing-preview-recovery.yml', permissions: ['contents: read', 'issues: write', 'pull-requests: write'] },
  { id: 'storefront_v59', issue: 213, command: '/run-v59-promote ', prefix: true, workflow: 'storefront-v59-zero-cost-promote.yml', permissions: ['contents: read'] },
  { id: 'storefront_v60_prebuilt', issue: 213, command: '/run-v60-prebuilt ', prefix: true, workflow: 'storefront-v60-prebuilt-production.yml', permissions: ['contents: read'] },
  { id: 'storefront_v60_promote', issue: 213, command: '/run-v60-promote ', prefix: true, workflow: 'storefront-v60-zero-cost-promote.yml', permissions: ['contents: read'] },
  { id: 'ultra_deep_full_loop', issue: 368, command: '/run-ultra-deep-full-loop', prefix: true, workflow: 'ultra-deep-full-loop.yml', permissions: ['contents: read', 'issues: write', 'id-token: write'], manual: true, labeled: true },
  { id: 'storefront_screenshot', issue: 213, command: '/capture-v59-production', prefix: false, workflow: 'storefront-production-screenshot-capture.yml', permissions: ['contents: read', 'issues: write'] },
  { id: 'rental_analytics', issue: 164, command: '/run-rental-analytics-prebuilt ', prefix: true, workflow: 'rental-analytics-prebuilt-production-recovery.yml', permissions: ['contents: read', 'issues: write', 'pull-requests: write'], manual: true },
  { id: 'ultra_deep_runtime', issue: 368, command: '/run-ultra-deep-acceptance', prefix: false, workflow: 'ultra-deep-runtime-acceptance.yml', permissions: ['contents: read', 'issues: read'], manual: true }
];

function jobBlock(source, id) {
  const needle = '\n  ' + id + ':\n';
  const begin = source.indexOf(needle);
  assert.notEqual(begin, -1, 'missing router job ' + id);
  const later = source.slice(begin + needle.length);
  const nextJob = /^  [a-z][a-z0-9_]*:\s*$/gm.exec(later);
  const end = nextJob ? begin + needle.length + nextJob.index : undefined;
  return source.slice(begin + 1, end);
}

test('issue comments have exactly one repository-level workflow listener', () => {
  const matched = fs.readdirSync(WORKFLOWS).filter((file) => /\.ya?ml$/.test(file))
    .filter((name) => /^  issue_comment:\s*$/m.test(read(name)));
  assert.deepEqual(matched, [ROUTER_NAME]);
  assert.match(read(ROUTER_NAME), /on:\s*\n  issue_comment:\s*\n    types: \[created\]/);
});

test('router has exactly ten strictly owner-gated target jobs with least privilege', () => {
  const source = read(ROUTER_NAME);
  assert.equal((source.match(/^    uses: \.\/\.github\/workflows\//gm) || []).length, ROUTES.length);
  assert.doesNotMatch(source, /vercel\s+(?:deploy|build)|actions\/checkout|curl .*api\.vercel\.com/i);
  for (const route of ROUTES) {
    const block = jobBlock(source, route.id);
    const check = route.id === 'ultra_deep_full_loop'
      ? "startsWith(github.event.comment.body, '/run-ultra-deep-full-loop ')"
      : route.prefix
        ? "startsWith(github.event.comment.body, '" + route.command + "')"
        : "github.event.comment.body == '" + route.command + "'";
    assert.ok(block.includes('github.event.issue.number == ' + route.issue), route.id + ' issue gate');
    assert.ok(block.includes('github.event.comment.user.login == github.repository_owner'), route.id + ' owner gate');
    assert.ok(block.includes("github.event.comment.author_association == 'OWNER'"), route.id + ' association');
    assert.ok(block.includes(check), route.id + ' command gate');
    if (route.id === 'ultra_deep_full_loop') {
      assert.ok(block.includes("github.event.comment.body == '/run-ultra-deep-full-loop'"),
        'Ultra Deep no-argument form remains allowed');
      assert.ok(!block.includes("startsWith(github.event.comment.body, '/run-ultra-deep-full-loop')"),
        'Malformed command suffix must never start the expensive full-loop job');
    }
    assert.ok(block.includes('uses: ./.github/workflows/' + route.workflow), route.id + ' exact target');
    assert.ok(!block.includes('secrets: inherit'), route.id + ' must not inherit all secrets');
    const needsVercelToken = route.workflow !== 'storefront-production-screenshot-capture.yml' &&
      route.workflow !== 'ultra-deep-runtime-acceptance.yml';
    if (needsVercelToken) {
      assert.ok(block.includes('VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}'), route.id + ' restricted token');
      assert.ok(read(route.workflow).includes('  workflow_call:\n    secrets:\n      VERCEL_TOKEN:\n        required: false'),
        route.id + ' declares exact reusable token');
    } else {
      assert.ok(!block.includes('secrets:'), route.id + ' must not forward any secrets');
    }
    for (const permission of route.permissions) {
      assert.ok(block.includes('      ' + permission), route.id + ' permission ' + permission);
    }
    assert.ok(!block.includes('actions: write'), route.id + ' must not dispatch via API');
  }
});

test('called workflows keep command authorization, manual/labeled entry points and existing jobs', () => {
  for (const route of ROUTES) {
    const source = read(route.workflow);
    assert.match(source, /^  workflow_call:\s*$/m, route.workflow + ' reusable trigger');
    assert.doesNotMatch(source, /^  issue_comment:\s*$/m, route.workflow + ' no direct fanout');
    assert.ok(source.includes("github.event_name == 'issue_comment'") ||
      source.includes('github.event.issue.number == ' + route.issue),
      route.workflow + ' original command guard retained');
    if (route.manual) assert.match(source, /^  workflow_dispatch:\s*$/m, route.workflow + ' manual retained');
    if (route.labeled) assert.match(source, /^  issues:\s*$/m, route.workflow + ' labeled retained');
  }
});
