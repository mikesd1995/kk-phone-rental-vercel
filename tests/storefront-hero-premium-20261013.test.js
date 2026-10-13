'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
const css = fs.readFileSync(path.join(root,'assets/kk-hero-premium-20261013.css'),'utf8');
const art = fs.readFileSync(path.join(root,'assets/kk-hero-product-20261013.webp'));

test('premium hero stylesheet is loaded after the storefront authoritative CSS exactly once',()=>{
  const old = html.indexOf('/assets/kk-storefront-v5.css?v=');
  const next = html.indexOf('/assets/kk-hero-premium-20261013.css?v=20261013-hero-premium-a2');
  assert.ok(old > 0 && next > old);
  assert.equal(html.split('kk-hero-premium-20261013.css').length-1,1);
});
test('new product asset is a complete compact WEBP and contains no flattened UI',()=>{
  assert.equal(art.toString('ascii',0,4),'RIFF');
  assert.equal(art.toString('ascii',8,12),'WEBP');
  assert.equal(art.readUInt32LE(4),art.length-8,'asset must not be truncated');
  assert.ok(art.length>1000 && art.length<30000);
});
test('premium hero uses the dedicated product crop with no old banner text overlay',()=>{
  assert.match(css,/background-image:url\('\/assets\/kk-hero-product-20261013\.webp'\)!important/);
  assert.doesNotMatch(css,/kk-brand-hero-final-20260920/);
  assert.match(html,/<div class="kk-hero-art" aria-hidden="true"><\/div>/);
  assert.match(html,/<h1 id="v2-intro-title">/);
});
test('bookable actions and language/theme controls remain live DOM links',()=>{
  assert.match(html,/<a class="v3-primary" href="#content">/);
  assert.match(html,/<a class="v3-secondary" href="#booking-journey">/);
  assert.match(html,/id="theme-toggle"/);
  assert.match(html,/id="language-switch"/);
});
test('mobile viewport accommodations and 44px hit-target floor stay enabled',()=>{
  assert.match(css,/@media\(max-width:700px\)/);
  assert.match(css,/@media\(min-width:376px\) and \(max-width:480px\)/);
  assert.match(css,/@media\(max-width:375px\)/);
  assert.match(css,/min-height:44px!important/);
  assert.match(css,/html \.kk-mock-hero \.kk-hero-art\{display:none!important\}/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});

test('mobile 376–540 legacy stacked fallback remains intact underneath compact override',()=>{
  const mobile = css.slice(css.indexOf('Mobile typography fix — 2026-10-13'));
  assert.ok(mobile.length>500,'scoped mobile override must exist');
  assert.match(mobile,/@media \(min-width:376px\) and \(max-width:540px\)/);
  assert.match(mobile,/grid-template-columns:minmax\(0,1fr\)!important/);
  assert.match(mobile,/html \.kk-mock-hero \.kk-hero-art\{/);
  assert.match(mobile,/width:100%!important/);
  assert.match(mobile,/word-break:normal!important/);
});

test('tablet 541–700 prevents the headline orphan while retaining split artwork',()=>{
  const tablet=css.slice(css.indexOf('Intermediate tablet 541–700px'));
  assert.ok(tablet.length>200,'tablet rule must be present');
  assert.match(tablet,/@media \(min-width:541px\) and \(max-width:700px\)/);
  assert.match(tablet,/font-size:clamp\(27px,5vw,33px\)!important/);
  assert.match(tablet,/font-size:\.81em!important/);
});

test('visual QA mobile P1 correction keeps first-fold Hero compact and live two-column',()=>{
 const finish=css.slice(css.indexOf('Compact mobile hero — 2026-10-13 visual QA P1 fix.'));
 assert.ok(finish.length>800,'compact override must be appended last');
 assert.match(finish,/@media \(min-width:376px\) and \(max-width:540px\)/);
 assert.match(finish,/grid-template-columns:minmax\(0,1fr\) minmax\(112px,\.56fr\)!important/);
 assert.match(finish,/font-size:\.79em!important/);
 assert.match(finish,/aspect-ratio:\.75!important/);
 assert.match(finish,/min-height:44px!important/);
 assert.match(finish,/background-size:auto 100%!important/);
});
