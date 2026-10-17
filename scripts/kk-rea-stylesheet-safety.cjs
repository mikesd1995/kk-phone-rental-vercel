'use strict';
// Offline static contract for KK's two screen stylesheets; no browser/network or writes.
const REQUIRED_ORDER = Object.freeze(['style.css', '/assets/kk-storefront-v5.css']);

function readAttrs(raw) {
  const attrs = {};
  for (const item of String(raw).matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    attrs[item[1].toLowerCase()] = item[2] ?? item[3] ?? item[4] ?? '';
  }
  return attrs;
}

function inspect(html) {
  const cleaned = String(html || '').replace(/<!--[\s\S]*?-->/g, '');
  const active = [];
  const excluded = [];
  for (const match of cleaned.matchAll(/<link\b((?:"[^"]*"|'[^']*'|[^'">])*)>/gi)) {
    const attrs = readAttrs(match[1]);
    const rel = (attrs.rel || '').toLowerCase().split(/\s+/);
    if (!rel.includes('stylesheet') || !attrs.href) continue;
    const href = attrs.href.split(/[?#]/, 1)[0];
    const primary = href === 'style.css' || href === '/style.css' || href === '/assets/kk-storefront-v5.css';
    if (!primary) continue;
    const isAlternate = rel.includes('alternate');
    const isDisabled = Object.hasOwn(attrs, 'disabled');
    const media = String(attrs.media || '').toLowerCase().trim();
    const screenMedia = !media || media === 'all' || media === 'screen';
    const canonical = href === '/style.css' ? 'style.css' : href;
    if (isAlternate || isDisabled || !screenMedia) {
      excluded.push({href: canonical, reason: isAlternate ? 'ALTERNATE' : isDisabled ? 'DISABLED' : 'NON_SCREEN_OR_AMBIGUOUS_MEDIA'});
    } else active.push(canonical);
  }
  const pass = active.length === REQUIRED_ORDER.length && active.every((href, index) => href === REQUIRED_ORDER[index]);
  return {
    status: pass ? 'PASS' : 'BLOCKED',
    active_screen_stylesheets: active,
    excluded_or_unverified_stylesheets: excluded,
    expectation: REQUIRED_ORDER.slice(),
    limitation: 'Static HTML source only; does not attest network delivery, CSS cascade or computed browser styles.'
  };
}

module.exports = {readAttrs, inspect};
