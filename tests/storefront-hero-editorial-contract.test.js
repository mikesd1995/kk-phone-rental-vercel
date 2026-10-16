'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/kk-storefront-v5.css'),'utf8');
const script=fs.readFileSync(path.join(root,'script.js'),'utf8');
const svg=fs.readFileSync(path.join(root,'assets/kk-hero-reference-20261016.svg'),'utf8');
const marker='/* Hero V7';
const finalHero=css.slice(css.indexOf(marker));

test('hero remains bilingual live DOM copy, not an embedded promotional screenshot',()=>{
 assert.match(html,/<section class="v3-hero kk-stage kk-mock-hero"[^>]*>/);
 assert.match(html,/<h1 id="v2-intro-title">/);
 assert.match(html,/<div class="kk-hero-art" aria-hidden="true"><\/div>/);
 assert.match(script,/heroTitle\.innerHTML=currentLang==="en"/);
 assert.match(script,/setText\("\.v3-hero-copy>p","hero_body"\)/);
});
test('owner reference art is isolated; legacy banner is no longer a hero background',()=>{
 assert.ok(css.includes(marker));
 assert.match(finalHero,/html \.kk-mock-hero::before,html \.kk-mock-hero::after/);
 assert.match(finalHero,/display:none!important;content:none!important;background:none!important/);
 assert.match(finalHero,/html \.kk-mock-hero \.kk-hero-art\{/);
 assert.match(finalHero,/kk-hero-reference-20261016\.svg/);
 assert.doesNotMatch(finalHero,/kk-brand-hero-final-20260920\.png/);
 assert.match(svg,/data:image\/avif;base64,/);
});
test('mobile hero is responsive and keeps both CTA touch targets visible',()=>{
 assert.match(finalHero,/@media\(max-width:700px\)/);
 assert.match(finalHero,/@media\(max-width:359px\)/);
 assert.match(finalHero,/html \.kk-mock-hero \.kk-hero-art\{/);
 assert.match(finalHero,/min-height:44px!important/);
 assert.match(finalHero,/display:inline-flex!important/);
 assert.match(finalHero,/grid-template-columns:minmax\(0,1fr\)!important/);
});
test('booking CTA destinations and accessible navigation remain unchanged',()=>{
 assert.match(html,/<a class="v3-primary" href="#content">/);
 assert.match(html,/<a class="v3-secondary" href="#booking-journey">/);
 assert.match(html,/id="faq-open-btn"/);
 assert.match(html,/id="language-switch"/);
 assert.match(html,/id="theme-toggle"/);
 assert.match(html,/kk-storefront-v5\.css\?v=20261016-hero-v81-mobile-split/);
});

test('owner screenshot mobile composes side-by-side actions and phone artwork, not a long stacked banner',()=>{
 const mobile=css.slice(css.indexOf('/* Hero V8.1'));
 assert.ok(mobile.length>1000);
 assert.match(mobile,/grid-template-areas:"eyebrow eyebrow" "headline headline" "description description" "actions artwork" "trust trust"!important/);
 assert.match(mobile,/grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)!important/);
 assert.match(mobile,/grid-area:artwork!important/);
 assert.match(mobile,/grid-area:actions!important/);
 assert.match(mobile,/grid-area:trust!important/);
 assert.match(mobile,/display:contents!important/);
 assert.match(mobile,/min-height:44px!important/);
 assert.doesNotMatch(mobile,/kk-brand-hero-final-20260920\.png/);
});
