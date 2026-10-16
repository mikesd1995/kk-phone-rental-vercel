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
 assert.match(html,/kk-storefront-v5\.css\?v=20261016-owner-hero-r6/);
});

const referenceMarker='KK HERO REFERENCE 2026-10-15';
test('owner reference revision is unique and follows the legacy hero override',()=>{
 assert.equal(css.split(referenceMarker).length-1,1);
 assert.ok(css.indexOf(referenceMarker)>css.indexOf(marker));
 const patch=css.slice(css.indexOf(referenceMarker));
 assert.match(patch,/grid-template-columns:minmax\(0,1\.04fr\) minmax\(0,\.96fr\)!important/);
 assert.match(patch,/border:1px solid rgba\(46,150,255,\.87\)!important/);
 assert.match(patch,/background-clip:text!important/);
 assert.match(patch,/url\("\/assets\/kk-brand-hero-final-20260920\.png"\)/);
 assert.doesNotMatch(patch,/\/api\/|booking_id|available_count|owner_lock/);
});
test('reference proof row remains accessible, bilingual and independent of business truth',()=>{
 assert.equal((html.match(/class="kk-hero-proof"/g)||[]).length,3);
 assert.match(html,/class="kk-hero-proofs" aria-label="/);
 assert.match(html,/<strong lang="th">เครื่องแท้ 100%<\/strong>/);
 assert.match(html,/<strong lang="en">Genuine phones<\/strong>/);
 const patch=css.slice(css.indexOf(referenceMarker));
 assert.match(patch,/html\[lang="th"\] \.kk-hero-proof-text \[lang="en"\]/);
 assert.match(patch,/html\[lang="en"\] \.kk-hero-proof-text \[lang="th"\]/);
 assert.match(script,/hero_cta:"เลือกงานที่ต้องการ"/);
 assert.match(script,/hero_cta:"Explore events"/);
});
test('responsive reference explicitly protects 320px phones and supports tablet and desktop widths',()=>{
 const patch=css.slice(css.indexOf(referenceMarker));
 for(const range of ['min-width:701px) and (max-width:1100px','max-width:700px','max-width:375px','min-width:376px) and (max-width:480px']){
   assert.ok(patch.includes(range),range);
 }
 assert.match(patch,/html \.kk-mock-hero \.kk-hero-art\{display:none!important\}/);
 assert.match(patch,/html \.kk-mock-hero \.kk-hero-proofs\{display:none!important\}/);
 assert.match(patch,/html \.kk-mock-hero \.v3-secondary\{display:inline-flex!important\}/);
 assert.match(patch,/min-height:44px!important/);
 assert.match(patch,/prefers-reduced-motion:reduce/);
 const policy=require(path.join(root,'config/kk-storefront-ux-policy.json'));
 assert.deepEqual(policy.acceptance_viewports,[320,375,390,430,480,768,1024,1440]);
});

test('R3 mobile patch protects visible prices, narrow cards and business values',()=>{
 const finish=css.slice(css.indexOf('KK hero QA R3'));
 assert.match(finish,/\.poster-grid \.pi-price\{/);
 assert.match(finish,/overflow-wrap:anywhere!important/);
 assert.match(finish,/\.poster-grid \.concert-card\{/);
 assert.match(finish,/height:auto!important/);
 assert.doesNotMatch(finish,/price=|available_count|booking_id|owner_hidden/);
});

test('320px one-column cards never use the 350px offscreen intrinsic placeholder',()=>{
 const finish=css.slice(css.indexOf('KK hero QA R3'));
 assert.match(finish,/content-visibility:visible!important/);
 assert.match(finish,/contain-intrinsic-size:none!important/);
 assert.match(finish,/aspect-ratio:auto!important/);
 assert.match(finish,/grid-auto-rows:auto!important/);
});

test('R4 shifts only short-screen chrome and ensures readable mobile backdrop',()=>{
 const r4=css.slice(css.indexOf('KK hero QA R4'));
 assert.match(r4,/max-width:359px/);
 assert.match(r4,/min-height:50px!important/);
 assert.match(r4,/\.v3-events-heading\{/);
 assert.match(r4,/var\(--v6-bg\) 495px/);
 assert.match(r4,/var\(--v6-bg\) 550px/);
 assert.doesNotMatch(r4,/booking_id|available_count|price_from|action_for_web/);
});

test('R5 mobile visual correction keeps full phone frame and both actions at every width',()=>{
 const patch=css.slice(css.indexOf('KK HERO R5'));
 assert.match(patch,/aspect-ratio:573\/399!important/);
 assert.match(patch,/background-size:100% 100%,contain!important/);
 assert.match(patch,/html \.kk-mock-hero \.v3-secondary\{/);
 assert.match(patch,/grid-template-columns:minmax\(0,1\.6fr\) minmax\(0,\.8fr\)!important/);
 assert.match(patch,/@media \(max-width:359px\)/);
 assert.match(patch,/html \.kk-mock-hero \.kk-hero-art\{display:block!important/);
 assert.doesNotMatch(patch,/booking_id|owner_hidden|action_for_web|price_from/);
});

test('R6 isolates legacy phone subjects instead of shipping whole branded marketing image',()=>{
 const x=css.slice(css.indexOf('KK HERO R6'));
 assert.match(x,/background-size:100% 100%,auto 168%!important/);
 assert.match(x,/background-size:100% 100%,auto 195%!important/);
 assert.match(x,/height:160px!important/);
 assert.match(x,/max-width:359px/);
 assert.match(x,/height:106px!important/);
 assert.doesNotMatch(x,/booking_id|action_for_web|available_count|customer_data/);
});
