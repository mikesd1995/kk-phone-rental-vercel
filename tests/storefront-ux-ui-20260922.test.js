const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const js=fs.readFileSync(path.join(root,'script.js'),'utf8');
const theme=fs.readFileSync(path.join(root,'assets','kk-concert-blue-theme-20260922.css'),'utf8');

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
  assert.match(theme,/\.pi-avail\.low/);
});

test('very narrow screens switch to a one-column event grid',()=>{
  assert.match(theme,/@media\(max-width:360px\)/);
  assert.match(theme,/\.poster-grid\s*\{\s*grid-template-columns:1fr;/);
  const css=fs.readFileSync(path.join(root,'style.css'),'utf8');
  assert.match(css,/@media\(max-width:340px\)/);
});

test('mobile sticky LINE CTA respects device safe-area',()=>{
  assert.match(theme,/env\(safe-area-inset-bottom\)/);
});

test('new storefront assets are cache-busted',()=>{
  assert.match(html,/kk-storefront-v5\\.css\\?v=20261001-v5/);
  assert.match(html,/script\.js\?v=[A-Za-z0-9][A-Za-z0-9._-]*/);
});
