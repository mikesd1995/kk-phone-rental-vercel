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
  assert.match(v5,/@media\(max-width:350px\)/);
  assert.match(v5,/\.poster-grid\s*\{\s*grid-template-columns:1fr!important/);
  const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
  assert.match(css,/@media\(max-width:340px\)/);
});

test('V5 intentionally removes the floating sticky LINE CTA',()=>{
  assert.match(v5,/\.sticky-line\{display:none!important\}/);
});

test('new storefront assets are cache-busted',()=>{
  assert.ok(html.includes('/assets/kk-storefront-v5.css?v=20261001-v57-soft-concert'));
  assert.ok(html.includes('script.js?v=storefront-v54-audit4-20261001'));
  assert.doesNotMatch(html,/rel="preload" as="image" href="\/assets\/kk-brand-hero-final-20260920\.png"/);
  assert.match(html,/<meta name="theme-color" content="#eef6ff">/);
});


test('V5 language switch binds the active hero, proof and event-discovery DOM',()=>{
  assert.match(js,/hero_body:"Rent a vivo X300 Pro \+ Lens/);
  assert.match(js,/setText\("\.v3-hero-copy>p","hero_body"\)/);
  assert.match(js,/querySelectorAll\("\.v3-proof>div:not\(\.kk-proof-label\)"\)/);
  assert.match(js,/eventHeading\.innerHTML/);
  assert.match(js,/eventBody\.innerHTML=esc\(tr\("events_body"\)\)/);
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
