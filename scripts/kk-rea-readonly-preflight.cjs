#!/usr/bin/env node
'use strict';
// KK REA pilot: local, offline, read-only. No REA invocation, browser launch, network or writes.
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OFFICIAL_REA = 'https://github.com/morluto/rea';
const REQUIRED = [
  'index.html', 'style.css', 'assets/kk-storefront-v5.css',
  'scripts/storefront-evidence.cjs', 'scripts/storefront-visual-acceptance.mjs',
  'server/kk-storefront-ux-reviewer.js', 'vercel.json'
];

function supportedNode(value) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:\+.*)?$/.exec(String(value || ''));
  if (!match) return false;
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  return (major === 22 && (minor > 19 || (minor === 19 && patch >= 0))) ||
    (major === 24 && (minor > 11 || (minor === 11 && patch >= 0))) || major >= 26;
}

function assessTarget(value) {
  let url;
  try { url = new URL(value); } catch { return { allowed: false, reason: 'INVALID_URL' }; }
  const remote = url.protocol === 'https:' && url.hostname === 'kk-phone-rental.vercel.app';
  const local = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
  if (!remote && !local) return { allowed: false, reason: 'TARGET_NOT_ALLOWLISTED' };
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    return { allowed: false, reason: 'TARGET_MUST_BE_BARE_ORIGIN' };
  }
  if (remote && url.port) return { allowed: false, reason: 'REMOTE_PORT_NOT_ALLOWED' };
  return { allowed: true, kind: remote ? 'public-production-read-only' : 'local-test', origin: url.origin };
}

function inspectStyles(html) {
  // Attribute order is not significant in HTML. Ignore commented-out links.
  const uncommented = String(html).replace(/<!--[\s\S]*?-->/g, '');
  const links = [...uncommented.matchAll(/<link\b([^<>]*)>/gi)];
  const found = links.flatMap(match => {
    const attributes = {};
    for (const token of match[1].matchAll(/([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
      attributes[token[1].toLowerCase()] = token[2] ?? token[3] ?? token[4];
    }
    if (!(attributes.rel || '').toLowerCase().split(/\s+/).includes('stylesheet') || !attributes.href) return [];
    return [attributes.href.split(/[?#]/, 1)[0]];
  });
  const css = found.filter(url => url === 'style.css' || url === '/style.css' || url === '/assets/kk-storefront-v5.css');
  return {
    stylesheet_order: css,
    multiple_kk_stylesheets: css.length > 1,
    note: css.length > 1 ? 'Cascade-order review candidate only; this does not prove a conflicting computed style.' : 'No multi-stylesheet candidate from recognized paths.'
  };
}

function regularFile(file) {
  try { return fs.lstatSync(file).isFile(); } catch { return false; }
}

function preflight({ root = ROOT, nodeVersion = process.version, targetUrl = 'http://127.0.0.1:3000/' } = {}) {
  const target = assessTarget(targetUrl);
  const files = REQUIRED.map(relative => ({ path: relative, exists: regularFile(path.join(root, relative)) }));
  let gitDeploymentGate = 'UNKNOWN';
  try {
    const configPath = path.join(root, 'vercel.json');
    if (!regularFile(configPath)) throw Error('VERCEL_CONFIG_NOT_REGULAR_FILE');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    gitDeploymentGate = config?.git?.deploymentEnabled?.['*'] === false && config?.git?.deploymentEnabled?.main === true
      ? 'NON_MAIN_AUTO_DEPLOY_DISABLED_IN_SOURCE' : 'NOT_CONFIRMED';
  } catch { gitDeploymentGate = 'UNREADABLE'; }
  let html = '';
  try {
    const htmlPath = path.join(root, 'index.html');
    if (regularFile(htmlPath)) html = fs.readFileSync(htmlPath, 'utf8');
  } catch {}
  const nodeCompatible = supportedNode(nodeVersion);
  const blockers = [];
  if (!nodeCompatible) blockers.push('REA_NODE_RUNTIME_NOT_SUPPORTED');
  if (!target.allowed) blockers.push(target.reason);
  if (files.some(f => !f.exists)) blockers.push('LOCAL_REPO_INCOMPLETE');
  if (gitDeploymentGate !== 'NON_MAIN_AUTO_DEPLOY_DISABLED_IN_SOURCE') blockers.push('DEPLOYMENT_SOURCE_GATE_UNVERIFIED');
  return {
    version: 'KK_REA_READONLY_PREFLIGHT_V1',
    status: blockers.length ? 'BLOCKED' : 'READY_FOR_SEPARATE_REA_TRIAL',
    blockers,
    execution: { network_requests: 0, rea_executed: false, browser_launched: false, production_writes: 0 },
    tool: { official_repo: OFFICIAL_REA, required_runtime: 'Node ^22.19.0 || ^24.11.0 || >=26.0.0', inspected_node: nodeVersion, compatible: nodeCompatible },
    target,
    git_deployment_source_gate: gitDeploymentGate,
    file_inventory: files,
    source_diagnostics: inspectStyles(html),
    limitation: 'Static preflight only. Not a REA result, browser capture, deployed build attestation or end-to-end acceptance.'
  };
}

if (require.main === module) {
  const arg = process.argv.find(x => x.startsWith('--target='));
  const targetUrl = arg ? arg.slice('--target='.length) : 'http://127.0.0.1:3000/';
  const result = preflight({ targetUrl });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (result.status === 'BLOCKED') process.exitCode = 2;
}
module.exports = { supportedNode, assessTarget, inspectStyles, preflight };
