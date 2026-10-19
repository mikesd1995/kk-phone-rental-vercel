'use strict';
// Explicit browser regression; intentionally separate from the default Node test glob.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
const Evidence=require('../storefront-evidence.cjs');

async function main(){
  const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
  const report={scope:'LOCAL_SYNTHETIC_BROWSER_REGRESSION',external_requests:0,source:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:path.resolve(__dirname,'../..'),encoding:'utf8'}).trim(),cases:[]};
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
    await context.route('**/*',route=>{report.external_requests++;return route.abort('blockedbyclient');});
    const page=await context.newPage();
    const price='From 1,090฿ · Ask for package availability';
    const cards=Array.from({length:12},(_,i)=>`<article class="concert-card" data-event-id="synthetic-${i}"><div class="poster-img-wrap"></div><div class="poster-info"><div class="pi-name">Exact synthetic event ${i}</div><div class="pi-price">${price}</div></div></article>`).join('');
    await page.setContent(`<style>body{margin:0}.spacer{height:1600px}.grid{display:grid;grid-template-columns:170px 170px;gap:12px;padding:12px}.concert-card{box-sizing:border-box;border:1px solid #000;content-visibility:auto;contain-intrinsic-size:350px}.poster-img-wrap{height:260px}.poster-info{box-sizing:border-box;height:240px;padding:8px}.pi-price{white-space:normal;overflow-wrap:anywhere}</style><div class="spacer"></div><section class="grid">${cards}</section>`);
    await page.locator('.concert-card').evaluateAll(elements=>{
      elements[1].setAttribute('style','');
      elements[2].setAttribute('style','color: rgb(1, 2, 3); content-visibility: auto !important; contain-intrinsic-size: 350px !important;');
      elements[3].setAttribute('style','--regression-token: exact-value; border-color: rgb(4, 5, 6) !important');
    });
    const frames=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const snapshot=()=>page.evaluate(()=>({styles:[...document.querySelectorAll('.concert-card')].map(el=>el.getAttribute('style')),scroll:[scrollX,scrollY],prices:[...document.querySelectorAll('.pi-price')].map(el=>el.textContent)}));
    await page.evaluate(()=>scrollTo({left:0,top:137,behavior:'instant'}));await frames();
    const original=await snapshot();
    const lastBefore=await page.locator('.concert-card').last().evaluate(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,viewport:innerHeight};});
    assert.ok(lastBefore.top>lastBefore.viewport,'negative test card must remain offscreen before inspection');
    const state=await Evidence.inspectState(page);await frames();
    report.before={last_card:lastBefore,styles:original.styles,scroll:original.scroll};
    report.healthy={audited_card_count:state.audited_card_count,escapes:state.escaped_card_elements,restored:await snapshot()};
    assert.equal(state.audited_card_count,12,'every card, including all late cards, must be audited');
    assert.deepEqual(state.escaped_card_elements,[],'intrinsic placeholders must not produce false escapes');
    assert.deepEqual(await snapshot(),original,'success must restore null/empty/nonempty style bytes, priorities, scroll and full price text');
    report.cases.push('all 12 offscreen virtualized cards measured naturally; exact success restoration');

    await page.locator('.concert-card').last().locator('.pi-price').evaluate(el=>{el.style.width='300px';});
    const offscreen=await page.locator('.concert-card').last().evaluate(el=>el.getBoundingClientRect().top>innerHeight);
    assert.equal(offscreen,true,'injected real defect must still be offscreen');
    const defect=await Evidence.inspectState(page);await frames();
    const finding=Evidence.stateFindings(defect,{width:390,name:'last-offscreen-counterexample'}).find(f=>f.code==='CARD_CONTENT_ESCAPES');
    assert.equal(finding?.severity,'P1','a true last-offscreen-card overflow must remain release-blocking');
    assert.ok(defect.escaped_card_elements.some(s=>s.startsWith('pi-price[')));
    assert.deepEqual(await snapshot(),original,'real finding must also restore exact card styles/scroll/price copy');
    report.counterexample={offscreen_before:offscreen,finding,escapes:defect.escaped_card_elements};
    report.cases.push('real last offscreen price overflow remains P1');
    await page.locator('.concert-card').last().locator('.pi-price').evaluate(el=>el.style.removeProperty('width'));
    const healthyAgain=await Evidence.inspectState(page);await frames();
    assert.deepEqual(healthyAgain.escaped_card_elements,[]);

    // Exercise restoration while the viewport is inside the catalogue so intrinsic
    // height changes can trigger real browser scroll anchoring.
    await page.evaluate(()=>scrollTo({left:0,top:2123,behavior:'instant'}));await frames();
    const anchoredOriginal=await snapshot();
    assert.equal(await page.locator('.concert-card').last().evaluate(el=>el.getBoundingClientRect().top>innerHeight),true);
    const anchored=await Evidence.inspectState(page);await frames();
    assert.equal(anchored.audited_card_count,12);
    assert.deepEqual(anchored.escaped_card_elements,[]);
    assert.deepEqual(await snapshot(),anchoredOriginal,'in-catalogue success must restore scroll after intrinsic layout settles');
    report.cases.push('in-catalogue scroll anchoring settles and restores exact success position');

    await page.locator('.concert-card').last().evaluate(el=>{const child=el.querySelector('.pi-price');child.getBoundingClientRect=()=>{throw Error('late-card-measurement-error');};});
    await assert.rejects(Evidence.inspectState(page),/late-card-measurement-error/);await frames();
    assert.deepEqual(await snapshot(),anchoredOriginal,'in-catalogue exception must restore exact card styles/priorities and scroll');
    report.cases.push('late-card measurement error rejects and restores exact styles/scroll');
    report.exception={rejected:true,restored:await snapshot()};
    assert.equal(report.external_requests,0);
    report.status='PASS';
    await context.close();
  }catch(error){report.status='FAIL';report.error=String(error.stack||error);throw error;}
  finally{
    await browser.close();
    if(process.env.KK_CARD_GEOMETRY_REPORT)fs.writeFileSync(process.env.KK_CARD_GEOMETRY_REPORT,JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
