'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const {chromium}=require(path.join(root,'node_modules/playwright'));
const E=require(path.join(root,'scripts/storefront-evidence.cjs'));
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const results=[];
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const cards=Array.from({length:8},(_,i)=>`<div class="concert-card" data-event-id="${i}" data-event-name="Exact Event"><div class="poster-img-wrap"></div><div class="poster-info"><div class="pi-name">Exact Event</div><div class="pi-price">From 1,090฿ · Ask for package availability</div></div></div>`).join('');
  await page.setContent(`<style>.concert-card{width:170px;margin:10px;content-visibility:auto;contain-intrinsic-size:350px}.poster-img-wrap{height:250px}.poster-info{height:180px}.pi-price{white-space:normal}.concert-card:last-child{content-visibility:auto!important}</style>${cards}`);
  const before=await page.locator('.concert-card').evaluateAll(es=>es.map(e=>e.getAttribute('style')));
  let state=await E.inspectState(page);
  assert.equal(state.audited_card_count,8);
  assert.deepEqual(state.escaped_card_elements,[]);
  assert.deepEqual(await page.locator('.concert-card').evaluateAll(es=>es.map(e=>e.getAttribute('style'))),before);
  await page.locator('.concert-card').last().locator('.pi-price').evaluate(e=>e.style.width='300px');
  state=await E.inspectState(page);
  assert.ok(state.escaped_card_elements.includes('pi-price'),'a real later offscreen defect must still be detected');
  results.push('all eight offscreen cards audited; real late-card escape detected; exact inline styles restored');
  await page.locator('.concert-card').last().locator('.pi-price').evaluate(e=>e.style.removeProperty('width'));
  await page.locator('.concert-card').last().evaluate(e=>{e.querySelectorAll=()=>{throw Error('injected-measurement-error');};});
  await assert.rejects(E.inspectState(page),/injected-measurement-error/);
  assert.deepEqual(await page.locator('.concert-card').evaluateAll(es=>es.map(e=>e.getAttribute('style'))),before);
  results.push('inline styles restored after injected measurement error');
  const svg='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="100"><rect width="400" height="100" fill="blue"/></svg>');
  await page.setContent(`<style>.concert-card{width:170px}.poster-img-wrap,.poster-placeholder-event{width:170px;height:240px}.poster-placeholder-event{position:relative}.poster-placeholder-brand-art{width:100%;height:70%;object-fit:contain}</style><div class="concert-card" data-event-name="Exact Event"><div class="poster-img-wrap"><div class="poster-placeholder-event"><img class="poster-placeholder-brand-art" src="${svg}"><span class="poster-placeholder-kicker">TEMPORARY EVENT ART</span><span class="poster-placeholder-title">Exact Event</span><span class="poster-placeholder-meta">14/11/2026 · Bangkok</span></div></div><div class="pi-date">14/11/2026</div><div class="pi-venue">Bangkok</div></div>`);
  await page.locator('img').evaluate(img=>img.decode());
  state=await E.inspectState(page);
  assert.deepEqual(state.poster_treatment_issues,[]);
  assert.deepEqual(state.temporary_artwork_issues,[]);
  await page.locator('.poster-placeholder-kicker').evaluate(e=>e.textContent='OFFICIAL POSTER');
  assert.equal((await E.inspectState(page)).temporary_artwork_issues.length,1,'a misleading official-poster label must block');
  await page.locator('.poster-placeholder-kicker').evaluate(e=>e.textContent='TEMPORARY EVENT ART');
  await page.locator('.poster-placeholder-meta').evaluate(e=>e.textContent='WRONG VENUE AND DATE');
  assert.equal((await E.inspectState(page)).temporary_artwork_issues.length,1,'wrong event metadata must block');
  await page.locator('.poster-placeholder-meta').evaluate(e=>e.textContent='14/11/2026 · Bangkok');
  await page.locator('img').evaluate(e=>e.style.width='300px');
  assert.equal((await E.inspectState(page)).temporary_artwork_issues.length,1,'escaped decorative art must block');
  await page.locator('img').evaluate(e=>e.style.removeProperty('width'));
  await page.locator('.poster-placeholder-kicker').evaluate(e=>e.remove());
  assert.equal((await E.inspectState(page)).temporary_artwork_issues.length,1);
  await page.setContent(`<style>.concert-card{width:170px}.poster-img-wrap{width:170px;height:240px}img{width:100%;height:100%;object-fit:contain}</style><div class="concert-card"><div class="poster-img-wrap"><img src="${svg}"></div></div>`);
  await page.locator('img').evaluate(img=>img.decode());
  assert.equal((await E.inspectState(page)).poster_treatment_issues.length,1);
  results.push('bounded decorative art passes; misleading/missing temporary label, wrong metadata, escaped art and untreated direct poster remain blocking');
  for(const width of [320,375,390,430,480]){
   await page.setViewportSize({width,height:932});
   const cardWidth=width<359?width-24:(width-44)/2;
   await page.setContent(`<style>${fs.readFileSync(path.join(root,'assets/kk-storefront-v5.css'),'utf8')} .concert-card{display:block!important;width:${cardWidth}px!important;content-visibility:visible!important}.poster-info{display:block!important;width:100%!important;box-sizing:border-box!important}</style><div class="concert-card"><div class="poster-info"><div class="pi-price">From 1,090฿ · Ask for package availability</div></div></div>`);
   const measured=await page.locator('.pi-price').evaluate(e=>({scroll:e.scrollWidth,width:e.clientWidth,text:e.textContent,whiteSpace:getComputedStyle(e).whiteSpace}));
   assert.ok(measured.scroll<=measured.width+1,`${width}px price overflows: ${JSON.stringify(measured)}`);
   assert.equal(measured.text,'From 1,090฿ · Ask for package availability');
   results.push(`${width}px full English price wraps without overflow`);
  }
  console.log(JSON.stringify({status:'PASS',results},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
