'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
const css = fs.readFileSync(path.join(root,'assets/kk-storefront-v5.css'),'utf8');
const svg = fs.readFileSync(path.join(root,'assets/kk-hero-reference-20261016.svg'),'utf8');
test('hero source uses owner product-only art instead of old promo banner',()=>{
  assert.match(html,/kk-hero-trust/);
  assert.match(html,/kk-hero-art/);
  assert.match(html,/href="#content"/);
  assert.match(html,/href="#booking-journey"/);
  const latest = css.slice(css.indexOf('/* Hero V7'));
  assert.match(latest,/kk-hero-reference-20261016\.svg/);
  assert.doesNotMatch(latest,/kk-brand-hero-final-20260920/);
  assert.doesNotMatch(latest,/auto 235%|auto 215%/);
});
test('art source is an embedded AVIF raster in a valid SVG wrapper',()=>{
  assert.match(svg,/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  const match = svg.match(/data:image\/avif;base64,([A-Za-z0-9+/=]+)/);
  assert.ok(match,'AVIF missing');
  const data = Buffer.from(match[1],'base64');
  assert.ok(data.length > 5000 && data.length < 30000);
  assert.equal(data.toString('ascii',4,12),'ftypavif');
});
test('mobile and both themes preserve access to hero art and actions',()=>{
  const latest = css.slice(css.indexOf('/* Hero V7'));
  assert.match(latest,/@media\(max-width:700px\)/);
  assert.match(latest,/@media\(max-width:359px\)/);
  assert.match(latest,/html\[data-theme="dark"\] \.kk-mock-hero/);
  assert.match(latest,/html\[data-theme="light"\] \.kk-mock-hero/);
  assert.match(latest,/html \.kk-mock-hero \.kk-hero-art\s*\{/);
  assert.match(latest,/html \.kk-mock-hero \.v3-secondary/);
});
