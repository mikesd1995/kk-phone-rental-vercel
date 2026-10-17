'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Gate = require('../scripts/kk-rea-readonly-preflight.cjs');

test('REA-supported Node boundaries match documented package engines', () => {
  for (const value of ['v22.19.0', 'v22.21.3', 'v24.11.0', 'v24.12.1', 'v26.0.0', 'v28.1.0'])
    assert.equal(Gate.supportedNode(value), true, value);
  for (const value of ['v20.20.0', 'v22.16.0', 'v22.18.9', 'v23.0.0', 'v24.10.9', 'v25.1.0', 'wrong'])
    assert.equal(Gate.supportedNode(value), false, value);
});

test('target allowlist permits only an unparameterized KK public origin or loopback test', () => {
  assert.equal(Gate.assessTarget('https://kk-phone-rental.vercel.app/').allowed, true);
  assert.equal(Gate.assessTarget('http://localhost:3000/').allowed, true);
  assert.equal(Gate.assessTarget('http://127.0.0.1:3000/').allowed, true);
  for (const url of [
    'https://evil.example/', 'http://kk-phone-rental.vercel.app/',
    'https://kk-phone-rental.vercel.app/admin',
    'https://kk-phone-rental.vercel.app/?token=secret',
    'http://192.168.1.1:3000/', 'https://kk-phone-rental.vercel.app:8443/'
  ]) assert.equal(Gate.assessTarget(url).allowed, false, url);
});

test('source stylesheet order is preserved but not called a proven CSS collision', () => {
  const report = Gate.inspectStyles('<link rel="stylesheet" href="style.css?v=1"><link rel="stylesheet" href="/assets/kk-storefront-v5.css?v=2">');
  assert.deepEqual(report.stylesheet_order, ['style.css', '/assets/kk-storefront-v5.css']);
  assert.equal(report.multiple_kk_stylesheets, true);
  assert.match(report.note, /does not prove/);
});

test('readiness checks local evidence and deployment gate without network or writes', t => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-rea-preflight-'));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const required = [
    'index.html', 'style.css', 'assets/kk-storefront-v5.css', 'scripts/storefront-evidence.cjs',
    'scripts/storefront-visual-acceptance.mjs', 'server/kk-storefront-ux-reviewer.js', 'vercel.json'
  ];
  for (const file of required) {
    fs.mkdirSync(path.dirname(path.join(temp, file)), { recursive: true });
    fs.writeFileSync(path.join(temp, file), file === 'vercel.json'
      ? '{"git":{"deploymentEnabled":{"*":false,"main":true}}}' : file === 'index.html' ? '<link rel="stylesheet" href="style.css"><link rel="stylesheet" href="/assets/kk-storefront-v5.css">' : 'test');
  }
  const result = Gate.preflight({ root: temp, nodeVersion: 'v24.11.0' });
  assert.equal(result.status, 'READY_FOR_SEPARATE_REA_TRIAL');
  assert.equal(result.execution.rea_executed, false);
  assert.equal(result.execution.network_requests, 0);
  assert.equal(result.execution.production_writes, 0);
  assert.equal(result.source_stylesheet_contract.status, 'PASS');
  fs.writeFileSync(path.join(temp, 'index.html'), '<link rel="stylesheet" href="style.css">');
  assert.ok(Gate.preflight({ root: temp, nodeVersion: 'v24.11.0' }).blockers.includes('PRIMARY_STYLESHEET_SOURCE_CONTRACT_FAILED'));
  fs.writeFileSync(path.join(temp, 'index.html'), '<link rel="stylesheet" href="style.css"><link rel="stylesheet" href="/assets/kk-storefront-v5.css">');

  assert.equal(result.git_deployment_source_gate, 'NON_MAIN_AUTO_DEPLOY_DISABLED_IN_SOURCE');
  assert.equal(Gate.preflight({ root: temp, nodeVersion: 'v22.16.0' }).status, 'BLOCKED');
  fs.writeFileSync(path.join(temp, 'vercel.json'), '{}');
  assert.ok(Gate.preflight({ root: temp, nodeVersion: 'v24.11.0' }).blockers.includes('DEPLOYMENT_SOURCE_GATE_UNVERIFIED'));
});


test('stylesheet parsing preserves order regardless of attribute order and ignores comments', () => {
  const source = [
    '<!-- <link rel="stylesheet" href="/assets/kk-storefront-v5.css"> -->',
    '<LINK href="style.css?ver=2#fragment" media="all" REL="StyleSheet">',
    `<link href="/assets/kk-storefront-v5.css?ver=4" rel="alternate stylesheet">`,
    '<link rel="icon" href="/assets/kk-storefront-v5.css">'
  ].join('');
  const report = Gate.inspectStyles(source);
  assert.deepEqual(report.stylesheet_order, ['style.css', '/assets/kk-storefront-v5.css']);
  assert.equal(report.multiple_kk_stylesheets, true);
});

test('required source directories do not pass as regular files', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-rea-dir-guard-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const file of [
    'index.html', 'assets/kk-storefront-v5.css', 'scripts/storefront-evidence.cjs',
    'scripts/storefront-visual-acceptance.mjs', 'server/kk-storefront-ux-reviewer.js', 'vercel.json'
  ]) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    fs.writeFileSync(path.join(dir, file), file === 'vercel.json'
      ? '{"git":{"deploymentEnabled":{"*":false,"main":true}}}' : 'fixture');
  }
  fs.mkdirSync(path.join(dir, 'style.css'));
  const result = Gate.preflight({ root: dir, nodeVersion: 'v24.11.0' });
  assert.ok(result.blockers.includes('LOCAL_REPO_INCOMPLETE'));
  assert.equal(result.file_inventory.find(x => x.path === 'style.css').exists, false);
});


test('symlinks outside repository are not treated as local source files', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-rea-link-guard-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const external = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-rea-external-'));
  t.after(() => fs.rmSync(external, { recursive: true, force: true }));
  fs.writeFileSync(path.join(external, 'index.html'), '<link rel="stylesheet" href="style.css">');
  fs.symlinkSync(path.join(external, 'index.html'), path.join(dir, 'index.html'));
  const result = Gate.preflight({ root: dir, nodeVersion: 'v24.11.0' });
  assert.equal(result.file_inventory.find(x => x.path === 'index.html').exists, false);
  assert.deepEqual(result.source_diagnostics.stylesheet_order, []);
  assert.equal(result.status, 'BLOCKED');
});
