'use strict';
// Local read-only browser acceptance for booking acknowledgement. Never sends a LINE request.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

async function runViewport(browser,width,scheme){
  const context=await browser.newContext({viewport:{width,height:width<600?844:900},colorScheme:scheme,reducedMotion:'reduce'});
  const page=await context.newPage();
  const externalRequests=[];
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
    assert.equal(await check.isChecked(),false,'every new request requires a fresh tick');
    await page.keyboard.press('Escape');
    assert.equal(await gate.isVisible(),false,'Escape cancels');
    assert.equal(await page.evaluate(()=>window.__kkQaApproved),1);
    // English from the existing homepage switch must translate the real checkout
    // dialog and link to English documents while keeping the checkbox unchecked.
    await page.locator('#language-switch [data-lang="en"]').click();
    assert.equal(await page.locator('#kk-footer-terms-link').getAttribute('href'),'/en/terms/');
    assert.equal(await page.locator('#kk-footer-privacy-link').getAttribute('href'),'/en/privacy/');
    assert.equal((await page.locator('#kk-footer-customer-title').textContent()).trim(),'Customer support');
    await trigger.click();
    assert.equal(await check.isChecked(),false,'English checkout must still require a fresh tick');
    assert.equal(await confirm.isDisabled(),true,'English continue must not bypass acceptance');
    assert.equal((await page.locator('#kk-booking-agreement-title').textContent()).trim(),'Review rental terms');
    assert.equal(await page.locator('#kk-booking-agreement .kk-booking-agreement-check a').nth(0).getAttribute('href'),'/en/terms/');
    assert.equal(await page.locator('#kk-booking-agreement .kk-booking-agreement-check a').nth(1).getAttribute('href'),'/en/privacy/');
    assert.equal((await confirm.textContent()).trim(),'Accept and open LINE');
    await page.keyboard.press('Escape');
    assert.equal(await gate.isVisible(),false);
    // Return to Thai; policy destinations must follow the selected language.
    await page.locator('#language-switch [data-lang="th"]').click();
    assert.equal(await page.locator('#kk-footer-terms-link').getAttribute('href'),'/terms/');
    assert.equal(await page.locator('#kk-footer-privacy-link').getAttribute('href'),'/privacy/');
    assert.equal(await page.evaluate(()=>window.__kkQaApproved),1);
    const box=await page.locator('.kk-booking-agreement-card').evaluate(el=>({
      width:el.getBoundingClientRect().width,
      viewport:innerWidth,
      scrollWidth:document.documentElement.scrollWidth,
      height:el.getBoundingClientRect().height
    }));
    assert.ok(box.width<=box.viewport,'confirmation must fit phone width');
    assert.ok(box.scrollWidth<=box.viewport+1,'confirmation must not create horizontal overflow');
    assert.equal(externalRequests.length,0,'QA must not reach LINE');
    return {width,scheme,acknowledgment:'PASS',no_provider_request:true,box};
  }finally{
    await context.close();
  }
}

async function main(){
  const {chromium}=require('playwright');
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  let results;
  try{
    results=[
      await runViewport(browser,390,'dark'),
      await runViewport(browser,1440,'light')
    ];
  }finally{
    await browser.close();
  }
  const out=path.resolve(process.env.OUTPUT_DIR||'artifacts/storefront-visual-qa');
  fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'booking-agreement-qa.json'),JSON.stringify({read_only:true,results},null,2)+'\n');
  process.stdout.write('BOOKING_AGREEMENT_QA_PASS '+JSON.stringify(results)+'\n');
}
main().catch(err=>{console.error('BOOKING_AGREEMENT_QA_FAILED',err);process.exitCode=1;});
