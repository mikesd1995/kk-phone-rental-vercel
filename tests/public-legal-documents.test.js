'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const publicPaths = ['/privacy/', '/terms/'];
const allPublicPaths = [...publicPaths, '/en/privacy/', '/en/terms/'];
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
  for (const pathname of allPublicPaths) {
    assert.ok(fs.existsSync(documentFile(pathname)), `missing public document ${pathname}`);
    for (const pattern of context.matcher) {
      const base = pattern.replace(/\/:path\*$/, '');
      assert.equal(pathname === base || (pattern.endsWith('/:path*') && pathname.startsWith(base + '/')), false, `${pathname} intercepted by ${pattern}`);
    }
    assert.equal(rewrites.some(rule => rule.source === pathname || rule.source === pathname.slice(0, -1)), false, `${pathname} must use its static document`);
  }
});

for (const pathname of allPublicPaths) {
  test(`${pathname} provides readable content and working navigation with scripting disabled`, () => {
    assert.ok(fs.existsSync(documentFile(pathname)), `missing public document ${pathname}`);
    const html = fs.readFileSync(documentFile(pathname), 'utf8');
    const locale = pathname.startsWith("/en/") ? "en" : "th";
    assert.match(html, new RegExp('<html\\b[^>]*\\blang="'+locale+'"', "i"));
    assert.match(html, /<meta\b[^>]*\bname="viewport"/i);
    assert.match(html, /<title>[^<]+<\/title>/i);
    assert.equal(Array.from(html.matchAll(/<h1\b/gi)).length, 1);
    assert.match(html, /<main\b[^>]*>[\s\S]*<\/main>/i);
    const links = Array.from(html.matchAll(/<a\b([^>]*)>/gi), match => attributes(match[1]));
    const routePrefix = locale === "en" ? "/en" : "";
    const home = locale === "en" ? "/?lang=en" : "/?lang=th";
    assert.ok(links.some(link => link.href === home), `missing language-preserving home link ${home}`);
    const sibling = pathname.includes("/terms/") ? routePrefix + "/privacy/" : routePrefix + "/terms/";
    assert.ok(links.some(link => link.href === sibling), `missing same-language policy link ${sibling}`);
    const counterpart = locale === "en" ? pathname.replace(/^\/en/, "") : "/en" + pathname;
    assert.ok(links.some(link => link.href === counterpart), `missing TH/EN switch link ${counterpart}`);
    const switcherStart = html.indexOf('<span class="legal-lang-switch"'); const switcher = switcherStart < 0 ? '' : html.slice(switcherStart, html.indexOf('</nav>', switcherStart));
    assert.match(switcher, /href="[^"]+"[^>]*>TH<\/a>/);
    assert.match(switcher, /href="[^"]+"[^>]*>EN<\/a>/);
    assert.match(html, new RegExp('rel="alternate" hreflang="'+locale+'"'));
    assert.match(html, new RegExp('rel="alternate" hreflang="'+(locale === "en" ? "th" : "en")+'"'));
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
      if (attr.rel === 'alternate' && ['en','th'].includes(attr.hreflang)) {
        assert.match(attr.href || '', /^https:\/\/kk-phone-rental\.vercel\.app\/(?:en\/)?(?:privacy|terms)\/$/);
        continue; // Same-domain hreflang metadata is not a fetched resource.
      }
      const resource = attr.href || attr.src;
      if (!resource) continue;
      assert.ok(resource.startsWith('/') && !resource.startsWith('//'), `unexpected third-party resource ${resource}`);
      assert.ok(fs.existsSync(path.join(root, resource.slice(1))), `missing local resource ${resource}`);
    }
    const css = read('assets/kk-legal.css');
    assert.doesNotMatch(css, /@import|url\s*\(/i, 'legal document stylesheet must not fetch remote dependencies');
  });
}

test('legal pages use storefront brand tokens and business contact wording', () => {
  const css = read('assets/kk-legal.css');
  const privacy = read('privacy/index.html');
  assert.match(css, /--kk-legal-blue:\s*#1378f3/i);
  assert.match(css, /--kk-legal-bg:\s*#f7f7f4/i);
  assert.match(css, /@media\s*\(prefers-color-scheme:\s*dark\)/i);
  assert.match(css, /\.legal-section\s*\{/);
  assert.match(css, /\.legal-contact\s*\{/);
  assert.match(privacy, /บริการนี้ดำเนินการภายใต้ชื่อ/);
  assert.match(privacy, /<strong>KK Phone Rental<\/strong>/);
  assert.match(privacy, /@827blnmo/);
});

test('public policies omit owner-system internals while preserving customer privacy rights', () => {
  const privacy = read('privacy/index.html');
  const terms = read('terms/index.html');
  const homepage = read('index.html');
  const contact = privacy.match(/<section class="legal-section" id="contact">([\s\S]*?)<\/section>/)?.[1] || '';
  assert.match(contact, /KK Phone Rental/);
  assert.match(contact, /@827blnmo/);
  for (const html of [privacy, terms]) {
    assert.doesNotMatch(html, /https:\/\/www\.googleapis\.com\/auth\//);
    assert.doesNotMatch(html, /\b(?:Supabase|Telegram|Make)\b/);
    assert.doesNotMatch(html, /\b(?:client_secret|private_key|api_key|consumerBearer)\b/i);
  }
  const footer = homepage.match(/<div class="legal-footer-google">([\s\S]*?)<\/div>/)?.[1] || '';
  assert.match(footer, /href="\/privacy\/#google"/);
  assert.doesNotMatch(footer, /Apps Script|Google Sheets|เจ้าของร้าน|ผู้ดูแลร้าน/);
  assert.match(privacy, /id="rights"/);
  assert.match(privacy, /id="retention"/);
  assert.match(privacy, /Google API Services User Data Policy/);
});

test('English policy pages are complete, same-version public translations without owner identifiers', () => {
  const thTerms = read('terms/index.html');
  const enTerms = read('en/terms/index.html');
  const enPrivacy = read('en/privacy/index.html');
  for (const id of ['booking','price','handover','changes','equipment','files','privacy','contact']) {
    assert.match(thTerms, new RegExp('id="'+id+'"'));
    assert.match(enTerms, new RegExp('id="'+id+'"'));
  }
  for (const id of ['contact','data','purposes','google','providers','browser','retention','rights','changes']) {
    assert.match(enPrivacy, new RegExp('id="'+id+'"'));
  }
  assert.match(enTerms, /KK-TERMS-2026-11-06/);
  assert.match(enTerms, /<time datetime="2026-11-06">6 November 2026<\/time>/);
  assert.match(enTerms, /does not process a payment/);
  assert.match(enTerms, /not a LINE customer-specific acceptance receipt/);
  assert.match(enPrivacy, /Google API Services User Data Policy/);
  assert.match(enPrivacy, /Limited Use/);
  assert.match(enPrivacy, /rights and how to submit a request/i);
  assert.match(enPrivacy, /@827blnmo/);
  for (const text of [enTerms,enPrivacy]) {
    assert.doesNotMatch(text, /\b(?:Supabase|Telegram|Make)\b/);
    assert.doesNotMatch(text, /client_secret|private_key/i);
  }
});

test('homepage language selection translates legal footer and agreement without changing checkbox safety', () => {
  const html = read('index.html');
  const script = read('script.js');
  for (const id of ['kk-footer-customer-title','kk-footer-policies-title','kk-footer-terms-link','kk-footer-privacy-link','kk-booking-terms-check']) {
    assert.match(html, new RegExp('id="'+id+'"'));
  }
  assert.match(script, /function applyPublicLegalLanguage\(\)/);
  assert.match(script, /applyPublicLegalLanguage\(\);/);
  assert.match(script, /currentLang==="en"/);
  assert.match(script, /isEn\?"\/en\/terms\/"\:"\/terms\/"/);
  assert.match(script, /isEn\?"\/en\/privacy\/"\:"\/privacy\/"/);
  assert.match(script, /"I have read and accept "/);
  assert.match(script, /"Confirm and browse events"/);
  assert.match(script, /"TERMS_ACK:"|KK-TERMS-2026-11-06/);
  assert.doesNotMatch(html, /id="kk-booking-terms-check"[^>]*checked/);
});
