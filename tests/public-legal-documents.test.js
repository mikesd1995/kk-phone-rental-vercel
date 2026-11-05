'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const publicPaths = ['/privacy/', '/terms/'];
const documentFile = pathname => path.join(root, pathname.slice(1), 'index.html');
const attributes = source => Object.fromEntries(Array.from(source.matchAll(/([\w-]+)\s*=\s*(["'])(.*?)\2/gs), match => [match[1].toLowerCase(), match[3]]));

// Missing, stale or mistyped footer destinations must not strand visitors.
test('homepage footer exposes both public documents as ordinary working links', () => {
  const footer = read('index.html').match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/i)?.[1] || '';
  const links = Array.from(footer.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi), match => ({ ...attributes(match[1]), text: match[2].replace(/<[^>]+>/g, '').trim() }));
  for (const pathname of publicPaths) {
    const link = links.find(candidate => candidate.href === pathname);
    assert.ok(link, `footer must link to ${pathname} without JavaScript`);
    assert.ok(link.text, `${pathname} link needs an accessible name`);
    assert.ok(fs.existsSync(documentFile(pathname)), `${pathname} must have a packaged static document`);
  }
  const integrationLink = links.find(candidate => candidate.href === '/privacy/#google');
  assert.ok(integrationLink, 'ordinary footer use must offer the Google explanation before authorization');
  assert.ok(integrationLink.text, 'Google explanation link needs an accessible name');
  const googleSection = read('privacy/index.html');
  assert.match(googleSection, /\bid="google"/, 'Google explanation link must resolve to a document section');
  const disclosure = footer.match(/<div class="legal-footer-google">([\s\S]*?)<\/div>/)?.[1] || '';
  for (const language of ['th', 'en']) {
    const paragraph = Array.from(disclosure.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/g)).find(match => attributes(match[1]).lang === language);
    assert.ok(paragraph?.[2].replace(/<[^>]+>/g, '').trim(), `${language} explanation must be readable without script-generated text`);
  }
});

// An accidental Admin redirect or source-only route would defeat no-login access.
test('document routes remain outside the actual authenticated middleware matchers', () => {
  const source = read('middleware.ts')
    .replace(/^import \{ rewrite \} from '@vercel\/functions';\s*/m, '')
    .replace('export const config =', 'const config =')
    .replace('export default function middleware(request: Request)', 'function middleware(request)');
  const context = { URL, Response, rewrite: () => { throw new Error('public document must not need an Admin rewrite'); } };
  vm.runInNewContext(source + '\nthis.matcher = config.matcher;', context);
  const rewrites = JSON.parse(read('vercel.json')).rewrites || [];
  for (const pathname of publicPaths) {
    assert.ok(fs.existsSync(documentFile(pathname)), `missing public document ${pathname}`);
    for (const pattern of context.matcher) {
      const base = pattern.replace(/\/:path\*$/, '');
      assert.equal(pathname === base || (pattern.endsWith('/:path*') && pathname.startsWith(base + '/')), false, `${pathname} intercepted by ${pattern}`);
    }
    assert.equal(rewrites.some(rule => rule.source === pathname || rule.source === pathname.slice(0, -1)), false, `${pathname} must use its static document`);
  }
});

for (const pathname of publicPaths) {
  test(`${pathname} provides readable content and working navigation with scripting disabled`, () => {
    assert.ok(fs.existsSync(documentFile(pathname)), `missing public document ${pathname}`);
    const html = fs.readFileSync(documentFile(pathname), 'utf8');
    assert.match(html, /<html\b[^>]*\blang="th"/i);
    assert.match(html, /<meta\b[^>]*\bname="viewport"/i);
    assert.match(html, /<title>[^<]+<\/title>/i);
    assert.equal(Array.from(html.matchAll(/<h1\b/gi)).length, 1);
    assert.match(html, /<main\b[^>]*>[\s\S]*<\/main>/i);
    const links = Array.from(html.matchAll(/<a\b([^>]*)>/gi), match => attributes(match[1]));
    for (const destination of ['/', ...publicPaths.filter(value => value !== pathname)]) {
      assert.ok(links.some(link => link.href === destination), `missing cross-navigation to ${destination}`);
    }
    assert.ok(links.some(link => link.href === 'https://line.me/R/ti/p/%40827blnmo'), 'public rights/contact route must work without scripting');
    const ids = Array.from(html.matchAll(/\bid="([^"]+)"/g), match => match[1]);
    assert.equal(new Set(ids).size, ids.length, 'duplicate anchor IDs');
    for (const link of links) {
      if (link.href?.startsWith('#')) assert.ok(ids.includes(link.href.slice(1)), `broken document anchor ${link.href}`);
    }
  });

  test(`${pathname} loads without tracking, remote resources or new data-collection controls`, () => {
    assert.ok(fs.existsSync(documentFile(pathname)), `missing public document ${pathname}`);
    const html = fs.readFileSync(documentFile(pathname), 'utf8');
    assert.doesNotMatch(html, /<(?:script|iframe|form|input|textarea|select|object|embed)\b/i);
    assert.doesNotMatch(html, /\bon[a-z]+\s*=|javascript:|<meta\b[^>]*http-equiv\s*=\s*["']refresh/i);
    for (const match of html.matchAll(/<(?:link|img|video|audio|source)\b([^>]*)>/gi)) {
      const attr = attributes(match[1]);
      if (attr.rel === 'canonical') continue; // Metadata is not a fetched subresource.
      const resource = attr.href || attr.src;
      if (!resource) continue;
      assert.ok(resource.startsWith('/') && !resource.startsWith('//'), `unexpected third-party resource ${resource}`);
      assert.ok(fs.existsSync(path.join(root, resource.slice(1))), `missing local resource ${resource}`);
    }
    const css = read('assets/kk-legal.css');
    assert.doesNotMatch(css, /@import|url\s*\(/i, 'legal document stylesheet must not fetch remote dependencies');
  });
}
