const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'script.js'),'utf8');
const v5=fs.readFileSync(path.join(root,'assets','kk-storefront-v5.css'),'utf8');

test('storefront exposes an explicit clear-filter control',()=>{
  assert.match(html,/id="clear-browse-btn"/);
  assert.match(js,/function clearBrowseFilters\(\)/);
  assert.match(js,/syncBrowseUrl\(\)/);
});

test('event cards expose venue and starting package price before modal open',()=>{
  assert.match(js,/function startingPriceFor\(c\)/);
  assert.match(js,/className="pi-venue"/);
  assert.match(js,/className="pi-price"/);
  assert.match(js,/card_price_from/);
});

test('result count remains visible outside search-only mode',()=>{
  assert.match(js,/browse_results/);
  assert.match(js,/updateBrowseChrome\(vis\.length\)/);
});

test('one-unit availability has a dedicated low-stock visual state',()=>{
  assert.match(js,/lowStock=avail&&cnt===1/);
  assert.match(js,/low-stock-card/);
  assert.match(v5,/\.pi-avail\.low/);
});

test('very narrow screens switch to a one-column event grid',()=>{
  assert.match(v5,/@media\(max-width:359px\)/);
  assert.match(v5,/\.poster-grid\s*\{\s*grid-template-columns:1fr!important/);
  const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
  assert.match(css,/@media\(max-width:340px\)/);
});

test('V5 intentionally removes the floating sticky LINE CTA',()=>{
  assert.match(v5,/\.sticky-line\{display:none!important\}/);
});

test('new storefront assets are cache-busted',()=>{
  assert.ok(html.includes('/assets/kk-storefront-v5.css?v=20261003-v66-generic-phone-i18n'));
  assert.ok(html.includes('script.js?v=storefront-v66-generic-phone-i18n-20261003'));
  assert.doesNotMatch(html,/rel="preload" as="image" href="\/assets\/kk-brand-hero-final-20260920\.png"/);
  assert.match(html,/<meta name="theme-color" content="#f4f6f8">/);
});


test('V5 language switch binds hero, benefits and event-discovery DOM',()=>{
  assert.match(js,/hero_body:"Phone rental for concerts and fan meetings/);
  assert.match(js,/hero_secondary:"How it works"/);
  assert.match(js,/benefit_insurance:"Free insurance · No deposit"/);
  assert.match(js,/benefit_discount:"New customer −฿40 · Returning review −฿100"/);
  assert.match(js,/setText\("\.v3-hero-copy>p","hero_body"\)/);
  assert.match(js,/setText\("\.v3-secondary","hero_secondary"\)/);
  assert.match(js,/querySelectorAll\("\.kk-benefit-grid>div>span:last-child"\)/);
  assert.match(js,/eventHeading\.innerHTML/);
  assert.match(js,/eventBody\.innerHTML=esc\(tr\("events_body"\)\)/);
});


test('brand-level storefront copy is model-agnostic and accessibility labels localize with language',()=>{
  assert.doesNotMatch(html,/VIVO X300 PRO \+ LENS/i);
  assert.doesNotMatch(html,/เช่า vivo X300 Pro \+ Lens/i);
  assert.match(html,/PHONE RENTAL<br><span>EVENT PICKUP<\/span>/);
  assert.match(js,/brand_subtitle:"Concert Phone Rental"/);
  assert.match(js,/meta_title:"KK Phone Rental \| Phone Rental for Concerts and Events"/);
  assert.match(js,/skip_link:"Skip to events"/);
  assert.match(js,/theme_to_light_aria:"Switch to light theme"/);
  assert.match(js,/benefit_group_aria:"Service benefits"/);
  assert.match(js,/browse_group_aria:"Search and filter events"/);
  assert.match(js,/journey_aria:"How to book"/);
  assert.match(js,/setText\("\.skip-link","skip_link"\)/);
  assert.match(js,/setAttr\("#language-switch","aria-label","language_aria"\)/);
  assert.match(js,/setAttr\("\.kk-benefit-grid","aria-label","benefit_group_aria"\)/);
  assert.match(js,/setAttr\("\.browse-controls-shell","aria-label","browse_group_aria"\)/);
  assert.match(js,/setAttr\("#booking-journey","aria-label","journey_aria"\)/);
  assert.match(js,/tr\(next==="dark"\?"theme_to_light_aria":"theme_to_dark_aria"\)/);
  assert.doesNotMatch(js,/eventBody\.innerHTML=esc\(tr\("events_body"\)\)\+'<br><strong>vivo X300 Pro \+ Lens<\/strong>'/);
});

test('package and async-error surfaces expose assistive semantics',()=>{
  assert.match(html,/aria-labelledby="modal-title" aria-describedby="modal-note"/);
  assert.match(html,/class="modal-note" id="modal-note"/);
  assert.match(js,/error-state" role="alert" aria-live="assertive"/);
});


test('mobile modal scroll lock is valid source and restores the captured position',()=>{
  assert.match(js,/var modalScrollY=0;\s*function lockBody\(\)/);
  assert.match(js,/document\.body\.style\.position="fixed"/);
  assert.match(js,/window\.scrollTo\(0,modalScrollY\)/);
  assert.doesNotMatch(js,/modalScrollY=0;\\nfunction lockBody/);
});
