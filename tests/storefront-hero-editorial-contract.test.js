'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/kk-storefront-v5.css'),'utf8');
const script=fs.readFileSync(path.join(root,'script.js'),'utf8');
const marker='V6.32 — 2026-10-12: editorial hero artwork isolation';

test('hero remains live bilingual DOM copy, not a rasterized screenshot',()=>{
 assert.match(html,/<section class="v3-hero kk-stage kk-mock-hero"[^>]*>/);
 assert.match(html,/<h1 id="v2-intro-title">/);
 assert.match(html,/<div class="kk-hero-art" aria-hidden="true"><\/div>/);
 assert.match(script,/heroTitle\.innerHTML=currentLang==="en"/);
 assert.match(script,/setText\("\.v3-hero-copy>p","hero_body"\)/);
});
test('official artwork is isolated in the art panel; stale banner pseudo-element disabled',()=>{
 assert.equal(css.split(marker).length-1,1);
 const finish=css.slice(css.indexOf(marker));
 assert.match(finish,/html \.kk-mock-hero::after\{display:none!important;content:none!important;background:none!important\}/);
 assert.match(finish,/html \.kk-mock-hero \.kk-hero-art\{/);
 assert.match(finish,/kk-brand-hero-final-20260920\.png/);
 assert.match(finish,/background-size:100% 100%,auto 145%!important/);
});
test('mobile first-fold stays compact and CTA stays a 44px touch target',()=>{
 const finish=css.slice(css.indexOf(marker));
 assert.match(finish,/@media \(max-width:700px\)/);
 assert.match(finish,/@media \(max-width:375px\)/);
 assert.match(finish,/html \.kk-mock-hero \.kk-hero-art\{display:none!important\}/);
 assert.match(finish,/min-height:44px!important/);
 assert.match(finish,/prefers-reduced-motion:reduce/);
});
test('booking CTA destinations and accessible nav are not altered by hero redesign',()=>{
 assert.match(html,/<a class="v3-primary" href="#content">/);
 assert.match(html,/<a class="v3-secondary" href="#booking-journey">/);
 assert.match(html,/id="faq-open-btn"/);
 assert.match(html,/id="language-switch"/);
 assert.match(html,/id="theme-toggle"/);
 assert.match(html,/kk-storefront-v5\.css\?v=20261013-v634-mobile-price-wrap/);
});
