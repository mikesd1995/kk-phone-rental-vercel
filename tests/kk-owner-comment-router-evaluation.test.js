'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const yaml = fs.readFileSync(path.resolve(__dirname, '..', '.github/workflows/kk-owner-comment-command-router.yml'), 'utf8');
const routeSpecs = [
  ['bounded_oidc', 47, '/run-bounded-oidc'],
  ['current_prod_readback', 164, '/verify-current-production 0123456789012345678901234567890123456789'],
  ['phase4_recovery', 213, '/run-phase4-zero-cost-promote dep SHA'],
  ['storefront_v59', 213, '/run-v59-promote dep SHA SHA'],
  ['storefront_v60_prebuilt', 213, '/run-v60-prebuilt 0123456789012345678901234567890123456789'],
  ['storefront_v60_promote', 213, '/run-v60-promote dep SHA SHA'],
  ['ultra_deep_full_loop', 368, '/run-ultra-deep-full-loop 2026-10'],
  ['storefront_screenshot', 213, '/capture-v59-production'],
  ['rental_analytics', 164, '/run-rental-analytics-prebuilt 0123456789012345678901234567890123456789'],
  ['ultra_deep_runtime', 368, '/run-ultra-deep-acceptance']
];

function expressionFor(jobName) {
  const jobs = yaml.split('\njobs:\n');
  assert.equal(jobs.length, 2, 'one jobs stanza');
  const jobStart = '\n  ' + jobName + ':\n';
  const at = ('\n' + jobs[1]).indexOf(jobStart);
  assert.notEqual(at, -1, 'missing job ' + jobName);
  const start = at + jobStart.length;
  const remainder = ('\n' + jobs[1]).slice(start);
  const next = /^  [a-z][a-z0-9_]*:\s*$/m.exec(remainder);
  const block = next ? remainder.slice(0, next.index) : remainder;
  const condition = /\bif:\s*>-\s*\$\{\{([\s\S]*?)\}\}/.exec(block);
  assert.ok(condition, 'missing event admission condition ' + jobName);
  return condition[1].trim();
}

function permit(route, issueNumber, body, actor = 'mikesd1995', association = 'OWNER') {
  const github = {
    repository_owner: 'mikesd1995',
    event: {
      issue: { number: issueNumber },
      comment: { body, user: { login: actor }, author_association: association }
    }
  };
  return vm.runInNewContext(expressionFor(route), {
    github,
    startsWith: (value, prefix) => typeof value === 'string' && value.startsWith(prefix)
  }, { timeout: 100 });
}

function dispatch(issueNumber, body, actor = 'mikesd1995', association = 'OWNER') {
  return routeSpecs.filter(([route]) => permit(route, issueNumber, body, actor, association)).map(([route]) => route);
}

test('YAML-derived router expression gates every valid owner command to precisely one job', () => {
  assert.equal(routeSpecs.length, 10);
  for (const [route, issue, command] of routeSpecs) {
    assert.deepEqual(dispatch(issue, command), [route], route);
    assert.deepEqual(dispatch(issue + 1, command), [], 'wrong issue ' + route);
    assert.deepEqual(dispatch(issue, command, 'other-user'), [], 'wrong actor ' + route);
    assert.deepEqual(dispatch(issue, command, 'mikesd1995', 'COLLABORATOR'), [], 'wrong association ' + route);
    assert.deepEqual(dispatch(issue, command, 'mikesd1995', 'NONE'), [], 'non-owner ' + route);
    assert.deepEqual(dispatch(issue, '/unrelated-command'), [], 'unrelated command ' + route);
  }
});

test('reject malformed Ultra Deep prefixes and preserve documented command forms', () => {
  assert.deepEqual(dispatch(368, '/run-ultra-deep-full-loop'), ['ultra_deep_full_loop']);
  assert.deepEqual(dispatch(368, '/run-ultra-deep-full-loop 2026-10'), ['ultra_deep_full_loop']);
  for (const bad of [
    '/run-ultra-deep-full-loopEVIL',
    '/run-ultra-deep-full-loop--',
    '/run-ultra-deep-acceptanceEVIL',
    '/run-v59-promote',
    '/run-v60-prebuilt',
    '/run-rental-analytics-prebuilt'
  ]) {
    assert.deepEqual(dispatch(368, bad), [], bad);
  }
  for (const [issue, command] of [[47, '/run-bounded-oidc'], [213, '/capture-v59-production']]) {
    assert.deepEqual(dispatch(issue, command + ' EXTRA'), [], 'strict equality for ' + command);
  }
});
