'use strict';
// Read-only real-browser first-visit Terms QA. Never reaches LINE or sends a booking.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

async function addSyntheticBooking(page){
  await page.evaluate(()=>{
    window.__kkQaApproved=0;
    const a=document.createElement('a');
    a.id='kk-qa-book-pill';
    a.className='book-pill';
    a.href='https://line.me/R/oaMessage/%40827blnmo/?qa-only';
    a.textContent='Synthetic booking';
    a.addEventListener('click',e=>{e.preventDefault();window.__kkQaApproved++;});
    document.body.appendChild(a);
  });
}
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
    assert.equal(r?.status(),200);
    const gate=page.locator('#kk-booking-agreement');
    const check=page.locator('#kk-booking-terms-check');
    const confirm=page.locator('#kk-booking-terms-continue');
    assert.equal(await gate.isVisible(),true,'first entry must prompt before checkout');
    assert.equal(await check.isChecked(),false);
    assert.equal(await confirm.isDisabled(),true);
    assert.equal(await page.locator('#kk-booking-agreement a[href="/terms/"]').count(),1);
    assert.equal(await page.locator('#kk-booking-agreement a[href="/privacy/"]').count(),1);
    const box=await page.locator('.kk-booking-agreement-card').evaluate(el=>{
      const rect=el.getBoundingClientRect();
      return {width:rect.width,height:rect.height,viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth};
    });
    assert.ok(box.width>0&&box.height>0);
    assert.ok(box.width<=box.viewport,'first-visit dialog must fit viewport');
    assert.ok(box.scrollWidth<=box.viewport+1,'must not cause horizontal overflow');
    const firstShot='booking-terms-'+width+'-'+scheme+'-first.jpg';
    await page.screenshot({path:path.join(out,firstShot),type:'jpeg',quality:78,animations:'disabled'});
    screenshots.push(firstShot);

    await addSyntheticBooking(page);
    // Programmatic link click cannot bypass the unconfirmed entry dialog.
    await page.evaluate(()=>document.querySelector('#kk-qa-book-pill').click());
    assert.equal(await page.evaluate(()=>window.__kkQaApproved),0,'no LINE handoff before agreement');
    await page.keyboard.press('Escape');
    assert.equal(await gate.isVisible(),true,'Escape must not bypass first-visit confirmation');

    await check.check();
    assert.equal(await confirm.isEnabled(),true);
    await confirm.click();
    assert.equal(await gate.isVisible(),false,'one-time entry dialog closes after confirmation');
    assert.equal(await page.evaluate(()=>window.__kkQaApproved),0,'confirmation must never open LINE itself');
    await page.locator('#kk-qa-book-pill').click();
    await page.locator('#kk-qa-book-pill').click();
    assert.equal(await gate.isVisible(),false,'booking and repeat booking must never re-prompt');
    assert.equal(await page.evaluate(()=>window.__kkQaApproved),2);
    assert.equal(await page.evaluate(()=>localStorage.getItem('kk_booking_terms_prompt_version')),'KK-TERMS-2026-11-06');
    assert.match(await page.evaluate(()=>document.cookie),/kk_booking_terms_prompt_version=KK-TERMS-2026-11-06/);

    await page.reload({waitUntil:'domcontentloaded'});
    assert.equal(await gate.isVisible(),false,'same-browser visit must skip dialog');
    await addSyntheticBooking(page);
    await page.locator('#kk-qa-book-pill').click();
    assert.equal(await page.evaluate(()=>window.__kkQaApproved),1);

    const nextTab=await context.newPage();
    try {
      await nextTab.addInitScript(()=>{
        Object.defineProperty(window,'localStorage',{configurable:true,get(){throw Error('localStorage denied');}});
      });
      const second=await nextTab.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
      assert.equal(second?.status(),200);
      assert.equal(await nextTab.locator('#kk-booking-agreement').isVisible(),false,'cookie must bypass repeat entry when localStorage denied');
      await addSyntheticBooking(nextTab);
      await nextTab.locator('#kk-qa-book-pill').click();
      assert.equal(await nextTab.evaluate(()=>window.__kkQaApproved),1);
    } finally {await nextTab.close();}

    // Changed Terms revision must ask on page ENTRY, before any booking click.
    await page.locator('#language-switch [data-lang="en"]').click();
    await page.evaluate(()=>{
      localStorage.setItem('kk_booking_terms_prompt_version','KK-TERMS-2026-11-05');
      document.cookie='kk_booking_terms_prompt_version=KK-TERMS-2026-11-05; Path=/; SameSite=Lax; Secure';
    });
    await page.reload({waitUntil:'domcontentloaded'});
    assert.equal(await gate.isVisible(),true,'stale-version prompt must occur on entry');
    assert.equal(await check.isChecked(),false);
    assert.equal(await confirm.isDisabled(),true);
    assert.equal((await page.locator('#kk-booking-agreement-title').textContent()).trim(),'Review rental terms');
    assert.equal(await page.locator('#kk-booking-agreement .kk-booking-agreement-check a').nth(0).getAttribute('href'),'/en/terms/');
    assert.equal(await page.locator('#kk-booking-agreement .kk-booking-agreement-check a').nth(1).getAttribute('href'),'/en/privacy/');
    assert.equal((await confirm.textContent()).trim(),'Confirm and browse events');
    const enShot='booking-terms-'+width+'-'+scheme+'-stale-en.jpg';
    await page.screenshot({path:path.join(out,enShot),type:'jpeg',quality:78,animations:'disabled'});
    screenshots.push(enShot);
    assert.equal(externalRequests.length,0,'QA must never reach LINE');
    return {width,scheme,acknowledgment:'PASS',no_provider_request:true,box,screenshots};
  } finally {await context.close();}
}
async function main(){
  const {chromium}=require('playwright');
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  let results;
  try {
    results=[];
    for(const width of [320,375,390,430,480,768,1024,1440]){
      results.push(await runViewport(browser,width,width<=430?'dark':'light'));
    }
  } finally {await browser.close();}
  const out=path.resolve(process.env.OUTPUT_DIR||'artifacts/storefront-visual-qa');
  fs.mkdirSync(out,{recursive:true});
  fs.writeFileSync(path.join(out,'booking-agreement-qa.json'),JSON.stringify({read_only:true,results},null,2)+'\n');
  process.stdout.write('BOOKING_AGREEMENT_QA_PASS '+JSON.stringify(results)+'\n');
}
main().catch(err=>{console.error('BOOKING_AGREEMENT_QA_FAILED',err);process.exitCode=1;});
