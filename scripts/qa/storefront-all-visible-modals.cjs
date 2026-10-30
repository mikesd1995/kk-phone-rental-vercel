'use strict';
// Read-only browser acceptance for every currently visible KK Phone Rental event.
// Uses the canonical PUBLIC CSV as a fixture against exact checked-out storefront JS.
// Never submits a LINE link, writes a booking, or sends POST/PUT/PATCH/DELETE.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

function csvRows(raw){
  const result=[]; let row=[],field='',quoted=false;
  const s=String(raw||'');
  for(let i=0;i<s.length;i++){
    const char=s[i];
    if(char==='"'){
      if(quoted&&s[i+1]==='"'){field+='"';i++;}
      else quoted=!quoted;
    }else if(char===','&&!quoted){row.push(field);field='';}
    else if((char==='\n'||char==='\r')&&!quoted){
      if(char==='\r'&&s[i+1]==='\n')i++;
      row.push(field);field='';
      if(row.some(x=>x.length))result.push(row);
      row=[];
    }else field+=char;
  }
  if(field||row.length){row.push(field);if(row.some(x=>x.length))result.push(row);}
  if(quoted)throw new Error('UNCLOSED_CSV_QUOTE');
  return result;
}
function csvObjects(raw){
  const rows=csvRows(raw);
  const headers=(rows.shift()||[]).map(s=>s.trim());
  return rows.map(cells=>Object.fromEntries(headers.map((key,i)=>[key,cells[i]||''])));
}
async function publicCsv(base,sheet,range){
  const u=new URL('/api/kk-data',base);
  u.searchParams.set('sheet',sheet);
  u.searchParams.set('range',range);
  const res=await fetch(u,{headers:{Accept:'text/csv'},signal:AbortSignal.timeout(25000)});
  if(!res.ok)throw new Error('PUBLIC_CSV_HTTP_'+res.status+'_'+sheet);
  return res.text();
}
function assertCanonical(url){
  const u=new URL(url);
  assert.equal(u.origin,'https://kk-phone-rental.vercel.app','PUBLIC_FEED_ONLY');
  return u.origin;
}
async function inspectViewport(browser,{width,height,lang},fixtures,knownVisibleIds){
  const context=await browser.newContext({
    viewport:{width,height},locale:lang==='en'?'en-US':'th-TH',
    deviceScaleFactor:1,reducedMotion:'reduce'
  });
  const page=await context.newPage();
  const pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(String(e.message||e)));
  // Read-only: no booking requests, analytics POSTs or external navigation.
  await page.route('**/*',async route=>{
    const req=route.request();
    if(!['GET','HEAD'].includes(req.method()))return route.abort('blockedbyclient');
    if(req.resourceType()==='image')return route.abort('blockedbyclient');
    if(new URL(req.url()).pathname==='/api/kk-data'){
      const url=new URL(req.url()), sheet=url.searchParams.get('sheet');
      const body=sheet==='08_Web_Ready'?fixtures.events:sheet==='09_Web_Packages'?fixtures.packages:null;
      if(body===null)return route.fulfill({status:400,body:'Unknown sheet'});
      return route.fulfill({status:200,contentType:'text/csv; charset=utf-8',headers:{'cache-control':'no-store'},body});
    }
    return route.continue();
  });
  try{
    await page.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded',timeout:30000});
    await page.locator('#content .concert-card:not(.skeleton-card)').first().waitFor({state:'visible',timeout:30000});
    const result=await page.evaluate(({lang})=>{
      if(!Array.isArray(concertsData))throw new Error('CATALOGUE_MISSING');
      applyLanguage(lang,{save:false,updateUrl:false});
      currentMonth='all';currentFilter='all';currentSearch='';
      const visible=filtered(concertsData);
      browseLimit=Math.max(visible.length,1000);
      renderConcerts(concertsData);
      const rows=[];
      for(const event of visible){
        const failures=[];
        const card=Array.from(document.querySelectorAll('#content .concert-card:not(.skeleton-card)'))
          .find(c=>c.dataset.eventId===String(event.id));
        if(!card){rows.push({event_id:event.id,pass:false,failures:['CARD_NOT_RENDERED']});continue;}
        card.click(); // Click the actual card handler, not a direct showModal invocation.
        const overlay=document.getElementById('overlay');
        const title=document.getElementById('modal-title');
        const date=document.getElementById('modal-date');
        const venue=document.getElementById('modal-venue');
        const content=document.getElementById('phone-list');
        if(!overlay?.classList.contains('active'))failures.push('MODAL_NOT_OPEN');
        if(title?.textContent!==event.name)failures.push('NAME_MISMATCH');
        if(!date?.textContent.endsWith(event.date||''))failures.push('DATE_MISMATCH');
        if(!venue?.textContent.endsWith(event.venue||''))failures.push('VENUE_MISMATCH');
        if(!event.name?.trim()||!event.date?.trim()||!event.venue?.trim())failures.push('REQUIRED_FIELD_MISSING');
        const modal=overlay?.querySelector('.modal');
        if(modal?.querySelector('#modal-event-note,.modal-note,.modal-share,.ph-note,.ph-spec'))
          failures.push('EXTRANEOUS_DESCRIPTION_VISIBLE');
        if((modal?.textContent||'').includes('OFFICIAL=https://') ||
           (modal?.textContent||'').includes('POLICY_MIRROR=https://'))
          failures.push('RAW_SOURCE_EVIDENCE_LEAK');
        const expected=availPkgs(event);
        const packages=Array.from(content?.querySelectorAll('.phone-row')||[]);
        if(packages.length!==expected.length)failures.push('PACKAGE_COUNT_MISMATCH');
        for(let i=0;i<expected.length;i++){
          const pkg=expected[i],row=packages[i],btn=row?.querySelector('a.book-pill');
          if(row?.querySelector('.ph-model')?.textContent!==pkg.model)failures.push('PACKAGE_MODEL_'+i);
          if(!row?.querySelector('.ph-price')?.textContent.trim())failures.push('PACKAGE_PRICE_'+i);
          if(!btn||btn.getAttribute('href')!==getBookingUrl(event,pkg))failures.push('BOOKING_HREF_'+i);
          if(btn&&!btn.href.startsWith('https://line.me/'))failures.push('BOOKING_DESTINATION_'+i);
        }
        if(!expected.length){
          const wait=content?.querySelector('a.waitlist-line-btn');
          if(!wait||wait.getAttribute('href')!==getWaitlistUrl(event,null))
            failures.push('WAITLIST_HREF');
        }
        document.getElementById('modal-close').click();
        if(overlay?.classList.contains('active'))failures.push('MODAL_NOT_CLOSED');
        rows.push({event_id:event.id,pass:failures.length===0,failures,package_count:expected.length});
      }
      return {lang,visible_count:visible.length,rows};
    },{lang});
    const ids=new Set(result.rows.map(x=>x.event_id));
    const missing=[...knownVisibleIds].filter(id=>!ids.has(id));
    const unexpected=[...ids].filter(id=>!knownVisibleIds.has(id));
    const failures=result.rows.filter(r=>!r.pass);
    if(missing.length)failures.push({pass:false,failures:['EXPECTED_VISIBLE_EVENT_NOT_RENDERED'],event_ids:missing});
    if(unexpected.length)failures.push({pass:false,failures:['UNEXPECTED_VISIBLE_EVENT'],event_ids:unexpected});
    if(pageErrors.length)failures.push({pass:false,failures:['BROWSER_RUNTIME_ERRORS'],errors:pageErrors.slice(0,10)});
    return {
      viewport:width+'x'+height,language:lang,
      canonical_visible_feed_count:knownVisibleIds.size,
      checked_events:result.rows.length,
      passed_events:result.rows.filter(r=>r.pass).length,
      failed_events:failures.length,
      modal_pass:failures.length===0,
      failures,
      event_results:result.rows
    };
  }finally{await context.close();}
}
async function main(){
  const source=assertCanonical(process.env.DATA_SOURCE_URL||'https://kk-phone-rental.vercel.app/');
  const {chromium}=require('playwright');
  const fixtures={
    events:await publicCsv(source,'08_Web_Ready','A4:K'),
    packages:await publicCsv(source,'09_Web_Packages','A4:N')
  };
  const shown=csvObjects(fixtures.events).filter(r=>['show','show_full'].includes(String(r.action_for_web||'').trim().toLowerCase()));
  const ids=new Set(shown.map(r=>String(r.event_id||'').trim()));
  assert.ok(ids.size>0,'NO_VISIBLE_EVENTS_IN_PUBLIC_FEED');
  assert.equal(ids.size,shown.length,'DUPLICATE_VISIBLE_EVENT_ID');
  const packageRows=csvObjects(fixtures.packages);
  const eventWithPkg=new Set(packageRows.map(r=>r.event_id));
  for(const id of ids)assert.ok(eventWithPkg.has(id),'PACKAGE_FEED_MISSING_'+id);
  const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'chrome'});
  let reports;
  try{
    reports=await Promise.all([
      inspectViewport(browser,{width:390,height:844,lang:'th'},fixtures,ids),
      inspectViewport(browser,{width:1440,height:900,lang:'en'},fixtures,ids)
    ]);
  }finally{await browser.close();}
  const report={
    audit:'storefront-all-visible-event-modals/v1',read_only:true,
    source_sha:process.env.APPROVED_SHA||null,canonical_source:source,
    checked_at:new Date().toISOString(),public_feed_events:shown.length,
    public_package_rows:packageRows.length,
    reports,
    pass:reports.every(r=>r.modal_pass)
  };
  const dir=path.resolve(process.env.OUTPUT_DIR||'artifacts/storefront-visual-qa');
  fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'all-visible-event-modals.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({audit:report.audit,source_sha:report.source_sha,public_feed_events:report.public_feed_events,public_package_rows:report.public_package_rows,viewports:reports.map(r=>({viewport:r.viewport,language:r.language,checked:r.checked_events,pass:r.passed_events,failed:r.failed_events})),pass:report.pass},null,2));
  if(!report.pass)process.exitCode=1;
}
main().catch(error=>{console.error('ALL_EVENT_MODAL_AUDIT_FAILED',error);process.exitCode=1;});
