const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
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
  assert.ok(html.includes('/assets/kk-storefront-v5.css?v=20261007-v631-exhaustive-ux-polish'));
  assert.ok(html.includes('script.js?v=storefront-v627-poster-framing-20261007'));
  assert.doesNotMatch(html,/rel="preload" as="image" href="\/assets\/kk-brand-hero-final-20260920\.png"/);
  assert.match(html,/<meta name="theme-color" content="#f4f6f8">/);
});


test('V5 language switch binds hero, benefits and event-discovery DOM',()=>{
  assert.match(js,/hero_body:"Phone rental for concerts and fan meetings/);
  assert.match(js,/hero_secondary:"How to rent"/);
  assert.match(js,/benefit_insurance:"Book with less hassle · Free insurance, no deposit"/);
  assert.match(js,/benefit_discount:"New customer −฿40 · Returning review −฿100"/);
  assert.match(js,/setText\("\.v3-hero-copy>p","hero_body"\)/);
  assert.match(js,/setText\("\.v3-secondary","hero_secondary"\)/);
  assert.match(js,/querySelectorAll\("\.kk-benefit-grid>div>span:last-child"\)/);
  assert.match(js,/eventHeading\.innerHTML/);
  assert.match(js,/eventBody\.textContent=tr\("events_body"\)/);
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


test('modal locking preserves position across nested overlays and restores drift on final close',()=>{
  const start=js.indexOf('var modalScrollY=0;');
  const end=js.indexOf('function homeUrl()',start);
  assert.ok(start>=0&&end>start,'scroll-lock implementation must be present');
  const active=new Set(['overlay']);
  const calls=[];
  const document={
    body:{dataset:{},style:{}},documentElement:{style:{}},
    getElementById:id=>({classList:{contains:()=>active.has(id)}})
  };
  const window={scrollX:17,scrollY:840,scrollTo:(x,y)=>{calls.push([x,y]);window.scrollX=x;window.scrollY=y;}};
  const ctx=vm.createContext({document,window});
  vm.runInContext(js.slice(start,end),ctx);
  ctx.lockBody();
  assert.equal(document.body.dataset.modalLocked,'1');
  assert.equal(document.body.style.overflow,'hidden');
  assert.equal(document.documentElement.style.overflow,'hidden');
  assert.notEqual(document.body.style.position,'fixed');
  active.add('faqOverlay');
  window.scrollY=0;
  ctx.lockBody(); // A nested open must not overwrite the original position.
  active.delete('overlay');
  ctx.unlockBodyIfNoModal();
  assert.equal(document.body.dataset.modalLocked,'1');
  assert.equal(calls.length,0);
  active.clear();
  ctx.unlockBodyIfNoModal();
  assert.deepEqual(calls,[[17,840]]);
  assert.equal(document.body.dataset.modalLocked,undefined);
  assert.equal(document.body.style.overflow,'');
  assert.equal(document.documentElement.style.overflow,'');
  assert.equal(document.body.style.touchAction,'');
  ctx.unlockBodyIfNoModal();
  assert.equal(calls.length,1,'repeated close must not jump again');
  ctx.lockBody();ctx.unlockBodyIfNoModal();
  assert.equal(calls.length,1,'no drift must not cause a redundant scroll');
});


test('V6.7 lower-page finish keeps event-card details visible and removes legacy footer/CTA copy',()=>{
  assert.match(v5,/V6\.7 lower-page professional finish/);
  assert.match(v5,/V6\.7 lower-page professional finish[\s\S]*\.concert-card\{[\s\S]*height:100%!important;[\s\S]*align-self:stretch!important/);
  assert.match(v5,/\.poster-info\{flex:1 1 auto!important\}/);
  assert.match(v5,/\.kk-booking-journey\{[\s\S]*border-radius:20px!important;[\s\S]*background:var\(--v6-paper\)!important/);
  assert.match(v5,/\.line-btn\{[\s\S]*width:min\(100%,520px\)!important;[\s\S]*min-height:52px!important/);
  assert.match(js,/card_price_from:"เริ่ม \{price\}฿"/);
  assert.match(js,/card_price_from:"From ฿\{price\}"/);
  assert.match(js,/load_more:"ดูงานเพิ่มเติมอีก \{count\} งาน"/);
  assert.match(js,/load_more:"View \{count\} more events"/);
  assert.match(js,/journey_3_title:"จองผ่าน LINE"/);
  assert.match(js,/journey_3_title:"Book via LINE"/);
  assert.match(js,/footer_tagline:"เช่ามือถือสำหรับคอนเสิร์ตและแฟนมีต"/);
  assert.match(js,/footer_tagline:"Phone rental for concerts and fan meetings"/);
  assert.doesNotMatch(html,/เช่าเถอะ อยากให้ชัด/);
  assert.doesNotMatch(js,/Rent it\. Capture it clearly/);
  assert.doesNotMatch(js,/empty-emoji[^\n]*💙/);
});


test('V6.7 structured FAQ and static fallback contain no retired rental wording',()=>{
  assert.match(html,/"name":"เช่ามือถือยังไง\?"/);
  assert.match(html,/"text":"เลือกงาน ดูแพ็กเกจและคิวว่าง แล้วจองผ่าน LINE OA เพื่อให้ร้านยืนยันคิว"/);
  assert.match(html,/"name":"รับและคืนมือถือที่ไหน\?"/);
  assert.match(html,/"name":"ต้องวางมัดจำหรือมีค่าประกันเครื่องไหม\?"/);
  assert.match(html,/"name":"ต้องใช้เอกสารอะไรในการเช่า\?"/);
  assert.match(js,/faq_q6:"Q: ต้องใช้เอกสารอะไรในการเช่า\?"/);
  assert.doesNotMatch(html,/กดดูรุ่นมือถือที่ว่าง/);
  assert.doesNotMatch(html,/เพื่อให้ร้านคอนเฟิร์ม/);
  assert.doesNotMatch(html,/รับเครื่อง และส่งเครื่องคืนที่ไหน/);
  assert.doesNotMatch(html,/ต้องจ่ายมัดจำเครื่องและประกันเครื่องไหม/);
  assert.doesNotMatch(html,/อุปกรณ์ที่เช่ายืม/);
  assert.doesNotMatch(js,/อุปกรณ์ที่เช่ายืม/);
});
