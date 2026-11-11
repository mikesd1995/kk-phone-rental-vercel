'use strict';
// Local read-only browser acceptance for booking acknowledgement. Never sends a LINE request.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

async function runViewport(browser,width,scheme){
  const context=await browser.newContext({viewport:{width,height:width<600?844:900},colorScheme:scheme,reducedMotion:'reduce'});
  const page=await context.newPage();
  const externalRequests=[];
  const out=path.resolve(process.env.OUTPUT_DIR||'artifacts/storefront-visual-qa');
  fs.mkdirSync(out,{recursive:true});
  const screenshots=[];
  await page.route('https://line.me/**',route=>{
    externalRequests.push(route.request().url());
    return route.abort();
  });
  try{
    const r=await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded',timeout:30000});
    assert.equal(r?.status(),200,'storefront must be accessible on local server');
    await page.locator('#kk-booking-agreement').waitFor({state:'attached'});
    await page.evaluate(()=>{
      window.__kkQaApproved=0;
      const a=document.createElement('a');
      a.id='kk-qa-book-pill';
      a.className='book-pill';
      a.href='https://line.me/R/oaMessage/%40827blnmo/?testonly';
      a.textContent='QA booking action';
      a.addEventListener('click',event=>{
        event.preventDefault(); // approved replay must never navigate to the real provider
        window.__kkQaApproved++;
      });
      document.body.appendChild(a);
    });
    const trigger=page.locator('#kk-qa-book-pill');
    const gate=page.locator('#kk-booking-agreement');
    const check=page.locator('#kk-booking-terms-check');
    const confirm=page.locator('#kk-booking-terms-continue');
    await trigger.click();
    assert.equal(await gate.isVisible(),true,'booking must be gated');
    assert.equal(await check.isChecked(),false,'acknowledgement cannot be prechecked');
    assert.equal(await confirm.isDisabled(),true,'continue must be disabled until acknowledged');
    assert.equal(await page.evaluate(()=>window.__kkQaApproved),0,'no provider handoff before acknowledgement');
    assert.equal(await page.locator('#kk-booking-agreement a[href="/terms/"]').count(),1);
    assert.equal(await page.locator('#kk-booking-agreement a[href="/privacy/"]').count(),1);
    // Measure the actual visible dialog, not the 0x0 hidden element after Escape.
    const box=await page.locator('.kk-booking-agreement-card').evaluate(el=>{
      const r=el.getBoundingClientRect();
      return {width:r.width,height:r.height,viewport:innerWidth,
        scrollWidth:document.documentElement.scrollWidth};
    });
    assert.ok(box.width>0&&box.height>0,'visible Terms dialog must have non-zero dimensions');
    assert.ok(box.width<=box.viewport,'visible Terms dialog must fit viewport');
    assert.ok(box.scrollWidth<=box.viewport+1,'Terms dialog must not cause horizontal overflow');
    const thShot='booking-terms-'+width+'-'+scheme+'-first.jpg';
    await page.screenshot({path:path.join(out,thShot),type:'jpeg',quality:78,animations:'disabled'});
    screenshots.push(thShot);
    await page.locator('#kk-booking-terms-cancel').click();
    assert.equal(await gate.isVisible(),false,'cancel closes without handoff');
    assert.equal(await page.evaluate(()=>window.__kkQaApproved),0);
    await trigger.click();
    await check.check();
    assert.equal(await confirm.isEnabled(),true);
    await confirm.click();
    assert.equal(await gate.isVisible(),false,'success closes gate');
    assert.equal(await page.evaluate(()=>window.__kkQaApproved),1,'approved click replays only once');
    await trigger.click();
    assert.equal(await gate.isVisible(),false,'current-version same-browser repeat must skip the popup');
    assert.equal(await page.evaluate(()=>window.__kkQaApproved),2,'repeat booking still opens the original LINE link');
    assert.equal(await page.evaluate(()=>localStorage.getItem('kk_booking_terms_prompt_version')),'KK-TERMS-2026-11-06');
    assert.match(await page.evaluate(()=>document.cookie),/kk_booking_terms_prompt_version=KK-TERMS-2026-11-06/,'first-party cookie should remember the version');

    // Revisit in the same browser: the preference must survive a real page reload.
    await page.reload({waitUntil:'domcontentloaded'});
    await page.evaluate(()=>{
      window.__kkQaApproved=0;
      const a=document.createElement('a');
      a.id='kk-qa-book-pill';
      a.className='book-pill';
      a.href='https://line.me/R/oaMessage/%40827blnmo/?testonly';
      a.textContent='QA repeat booking after reload';
      a.addEventListener('click',event=>{event.preventDefault();window.__kkQaApproved++;});
      document.body.appendChild(a);
    });
    await page.locator('#kk-qa-book-pill').click();
    assert.equal(await gate.isVisible(),false,'same-browser reload must not show Terms repeatedly');
    assert.equal(await page.evaluate(()=>window.__kkQaApproved),1);

    // With localStorage forcibly denied on a fresh tab, first-party cookie
    // must still suppress the repeat prompt within this browser context.
    const nextTab=await context.newPage();
    try{
      await nextTab.addInitScript(()=>{
        Object.defineProperty(window,'localStorage',{configurable:true,get(){throw Error('localStorage denied');}});
      });
      const second=await nextTab.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
      assert.equal(second?.status(),200);
      await nextTab.locator('#kk-booking-agreement').waitFor({state:'attached'});
      await nextTab.evaluate(()=>{
        window.__kkQaApproved=0;
        const a=document.createElement('a');
        a.id='kk-qa-book-pill';
        a.className='book-pill';
        a.href='https://line.me/R/oaMessage/%40827blnmo/?testonly';
        a.textContent='QA cookie fallback';
        a.addEventListener('click',event=>{event.preventDefault();window.__kkQaApproved++;});
        document.body.appendChild(a);
      });
      await nextTab.locator('#kk-qa-book-pill').click();
      assert.equal(await nextTab.locator('#kk-booking-agreement').isVisible(),false,
        'new tab with localStorage denied should use existing first-party cookie');
      assert.equal(await nextTab.evaluate(()=>window.__kkQaApproved),1);
    } finally { await nextTab.close(); }

    // English from the existing homepage switch must translate the real checkout
    // dialog and link to English documents. Simulate an old Terms version
    // so the updated-version prompt is visible for accessibility checks.
    await page.locator('#language-switch [data-lang="en"]').click();
    assert.equal(await page.locator('#kk-footer-terms-link').getAttribute('href'),'/en/terms/');
    assert.equal(await page.locator('#kk-footer-privacy-link').getAttribute('href'),'/en/privacy/');
    assert.equal((await page.locator('#kk-footer-customer-title').textContent()).trim(),'Customer support');
    await page.evaluate(()=>localStorage.setItem('kk_booking_terms_prompt_version','KK-TERMS-2026-11-05'));
    await trigger.click();
    assert.equal(await gate.isVisible(),true,'stale version must show English prompt');
    assert.equal(await check.isChecked(),false,'new-version English checkout must be unchecked');
    assert.equal(await confirm.isDisabled(),true,'new-version English continue must not be enabled');
    assert.equal((await page.locator('#kk-booking-agreement-title').textContent()).trim(),'Review rental terms');
    assert.equal(await page.locator('#kk-booking-agreement .kk-booking-agreement-check a').nth(0).getAttribute('href'),'/en/terms/');
    assert.equal(await page.locator('#kk-booking-agreement .kk-booking-agreement-check a').nth(1).getAttribute('href'),'/en/privacy/');
    assert.equal((await confirm.textContent()).trim(),'Accept and open LINE');
    const enShot='booking-terms-'+width+'-'+scheme+'-stale-en.jpg';
    await page.screenshot({path:path.join(out,enShot),type:'jpeg',quality:78,animations:'disabled'});
    screenshots.push(enShot);
    await page.keyboard.press('Escape');
    assert.equal(await gate.isVisible(),false);
    // Return to Thai; policy destinations must follow the selected language.
    await page.locator('#language-switch [data-lang="th"]').click();
    assert.equal(await page.locator('#kk-footer-terms-link').getAttribute('href'),'/terms/');
    assert.equal(await page.locator('#kk-footer-privacy-link').getAttribute('href'),'/privacy/');
    assert.equal(await page.evaluate(()=>window.__kkQaApproved),2);
    assert.equal(externalRequests.length,0,'QA must not reach LINE');
    return {width,scheme,acknowledgment:'PASS',no_provider_request:true,box,screenshots};
  }finally{
    await context.close();
  }
}

async function main(){
  const {chromium}=require('playwright');
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  let results;
  try{
    // Every required responsive width: check the actual Terms dialog geometry,
    // version-aware return booking and explicit customer-sent LINE boundary.
    const widths=[320,375,390,430,480,768,1024,1440];
    results=[];
    for(const width of widths) {
      results.push(await runViewport(browser,width,width<=430?'dark':'light'));
    }
  }finally{
    await browser.close();
  }
  const out=path.resolve(process.env.OUTPUT_DIR||'artifacts/storefront-visual-qa');
  fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'booking-agreement-qa.json'),JSON.stringify({read_only:true,results},null,2)+'\n');
  process.stdout.write('BOOKING_AGREEMENT_QA_PASS '+JSON.stringify(results)+'\n');
}
main().catch(err=>{console.error('BOOKING_AGREEMENT_QA_FAILED',err);process.exitCode=1;});
