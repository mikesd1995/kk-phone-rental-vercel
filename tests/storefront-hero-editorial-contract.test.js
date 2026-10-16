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
 assert.match(html,/kk-storefront-v5\.css\?v=20261017-hero-v10-desktop-geometry/);
});

test('owner reference mobile uses split CTAs and artwork without a second perk strip',()=>{
 const mobile=css.slice(css.indexOf('/* Hero V9'));
 assert.ok(mobile.length>1000);
 assert.ok(mobile.includes('grid-template-areas:'));
 assert.ok(mobile.includes('"actions artwork"!important'));
 assert.ok(mobile.includes('grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important'));
 assert.ok(mobile.includes('grid-area:artwork!important'));
 assert.ok(mobile.includes('grid-area:actions!important'));
 assert.ok(mobile.includes('html .kk-mock-hero .kk-hero-trust{display:none!important}'));
 assert.ok(mobile.includes('min-height:44px!important'));
 assert.ok(mobile.includes('display:contents!important'));
 assert.ok(!mobile.includes('kk-brand-hero-final-20260920.png'));
});
test('very short mobile retains product illustration and both CTAs',()=>{
 const mobile=css.slice(css.indexOf('/* Hero V9'));
 assert.ok(mobile.includes('@media(max-width:340px) and (max-height:620px)'));
 assert.ok(mobile.includes('html .kk-mock-hero .v3-hero-copy>p{'));
 assert.ok(!mobile.includes('html .kk-mock-hero .kk-hero-art{display:none!important}'));
 assert.ok(html.includes('href="#content"'));
 assert.ok(html.includes('href="#booking-journey"'));
});

test('V9.1 adds editorial CTA arrow and readable benefits without rewriting the mobile grid',()=>{
 const latest=css.slice(css.indexOf('/* Hero V9.1'));
 assert.ok(latest.length>500);
 assert.ok(latest.includes('v3-primary span[aria-hidden="true"]'));
 assert.ok(latest.includes('v3-secondary::after'));
 assert.ok(latest.includes('font-size:10.5px!important'));
 assert.ok(latest.includes('min-height:49px!important'));
 assert.ok(!latest.includes('grid-template-columns:'));
 assert.ok(!latest.includes('kk-brand-hero-final-20260920.png'));
});

test('V10 matches owner reference desktop header/card/product landmarks',()=>{
 const v10=css.slice(css.indexOf('/* Hero V10 reference geometry'));
 assert.ok(v10.length>500);
 assert.ok(v10.includes('height:56px!important'));
 assert.ok(v10.includes('height:456px!important'));
 assert.ok(v10.includes('margin-left:-15px!important'));
 assert.ok(v10.includes('grid-template-columns:minmax(0,1fr) minmax(0,564px)!important'));
 assert.ok(v10.includes('height:400px!important'));
 assert.ok(v10.includes('padding:32px 18px 24px 56px!important'));
 assert.ok(html.includes('เลือกงานที่ต้องการ'));
 assert.ok(script.includes('hero_cta:"เลือกงานที่ต้องการ"'));
 assert.ok(html.includes('20261017-hero-v10-desktop-geometry'));
});
