'use strict';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const require=createRequire(import.meta.url);
const Reviewer=require('../server/kk-storefront-ux-reviewer.js');

const DEFAULT_HEIGHTS=Object.freeze({
  320:568,
  375:812,
  390:844,
  430:932,
  480:932,
  768:1024,
  1024:768
});

function fail(code,message){
  const error=new Error(message||code);
  error.code=code;
  throw error;
}

function cleanUrl(value,mode){
  let url;
  try{ url=new URL(String(value||'').trim()); }
  catch(_){ fail('TARGET_URL_INVALID','TARGET_URL must be an absolute URL'); }
  const host=url.hostname.toLowerCase();
  if(mode==='local_zero_cost'){
    if(url.protocol!=='http:' || !['127.0.0.1','localhost'].includes(host)){
      fail('LOCAL_TARGET_NOT_LOOPBACK','Local zero-cost mode only accepts an HTTP loopback target');
    }
  }else{
    if(url.protocol!=='https:') fail('TARGET_URL_NOT_HTTPS','Remote TARGET_URL must use HTTPS');
    const allowed=
      host==='kk-phone-rental.vercel.app' ||
      (host.endsWith('.vercel.app') && host.startsWith('kk-phone-rental-vercel-'));
    if(!allowed) fail('TARGET_URL_HOST_NOT_ALLOWED','Target host is outside the KK Phone Rental Vercel allowlist');
  }
  url.hash='';
  return url;
}

function cleanDataSourceUrl(value){
  let url;
  try{ url=new URL(String(value||'').trim()); }
  catch(_){ fail('DATA_SOURCE_URL_INVALID','DATA_SOURCE_URL must be an absolute HTTPS URL'); }
  if(url.protocol!=='https:' || url.hostname.toLowerCase()!=='kk-phone-rental.vercel.app'){
    fail('DATA_SOURCE_URL_NOT_CANONICAL','Zero-cost fixtures may only read the canonical public KK storefront');
  }
  return url;
}

async function fetchCsvFixture(base,sheet,range){
  const url=new URL('/api/kk-data',base);
  url.searchParams.set('sheet',sheet);
  url.searchParams.set('range',range);
  const res=await fetch(url,{headers:{Accept:'text/csv'}});
  if(!res.ok) fail('PUBLIC_DATA_FIXTURE_HTTP_'+res.status,'Public read-only fixture fetch failed for '+sheet);
  const body=await res.text();
  const firstLine=String(body||'').split(/\r?\n/,1)[0].toLowerCase();
  if(sheet==='08_Web_Ready' && (!firstLine.includes('event_id')||!firstLine.includes('action_for_web'))){
    fail('PUBLIC_EVENT_FIXTURE_INVALID','Public event fixture header is invalid');
  }
  if(sheet==='09_Web_Packages' && (!firstLine.includes('package_id')||!firstLine.includes('available_count'))){
    fail('PUBLIC_PACKAGE_FIXTURE_INVALID','Public package fixture header is invalid');
  }
  return body;
}

async function loadPublicFixtures(base){
  const [events,packages]=await Promise.all([
    fetchCsvFixture(base,'08_Web_Ready','A4:K'),
    fetchCsvFixture(base,'09_Web_Packages','A4:N')
  ]);
  return {events,packages};
}

function sha(value){
  const out=String(value||'').trim().toLowerCase();
  if(!/^[0-9a-f]{40}$/.test(out)) fail('APPROVED_SHA_INVALID','APPROVED_SHA must be an exact 40-character commit SHA');
  return out;
}

function numeric(value){
  const n=Number(value);
  return Number.isFinite(n)?n:0;
}

function slug(value){
  return String(value||'')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,'-')
    .replace(/^-+|-+$/g,'')
    .slice(0,80)||'capture';
}

function ensureDir(dir){
  fs.mkdirSync(dir,{recursive:true});
}

function markdownEscape(value){
  return String(value==null?'':value).replace(/\|/g,'\\|').replace(/\n/g,' ');
}

async function main(){
  const mode=String(process.env.TARGET_MODE||'remote').trim().toLowerCase();
  if(!['local_zero_cost','preview','production','remote'].includes(mode)){
    fail('TARGET_MODE_INVALID','TARGET_MODE must be local_zero_cost, preview, production or remote');
  }
  const target=cleanUrl(process.env.TARGET_URL,mode);
  const approvedSha=sha(process.env.APPROVED_SHA);
  const expectedCssMarker=String(process.env.EXPECTED_CSS_MARKER||'').trim();
  const outputDir=path.resolve(process.cwd(),process.env.OUTPUT_DIR||'artifacts/storefront-visual-qa');
  const policy=Reviewer.loadPolicy();
  const widths=[...policy.acceptance_viewports];
  const { chromium }=await import('playwright');
  const dataSource=mode==='local_zero_cost'
    ? cleanDataSourceUrl(process.env.DATA_SOURCE_URL||'https://kk-phone-rental.vercel.app/')
    : null;
  const fixtures=dataSource?await loadPublicFixtures(dataSource):null;

  ensureDir(outputDir);

  const browserChannel=String(process.env.BROWSER_CHANNEL||'').trim();
  const launchOptions={headless:true};
  if(browserChannel) launchOptions.channel=browserChannel;
  const browser=await chromium.launch(launchOptions);
  const results=[];
  const runtimeErrors=[];

  try{
    for(const width of widths){
      const height=DEFAULT_HEIGHTS[width]||Math.max(768,Math.round(width*1.8));
      const bypassSecret=String(process.env.VERCEL_AUTOMATION_BYPASS_SECRET||'').trim();
      const context=await browser.newContext({
        viewport:{width,height},
        deviceScaleFactor:1,
        locale:'th-TH',
        reducedMotion:'reduce',
        extraHTTPHeaders:bypassSecret ? {
          'x-vercel-protection-bypass':bypassSecret,
          'x-vercel-set-bypass-cookie':'true'
        } : {}
      });
      const page=await context.newPage();
      const pageErrors=[];
      page.on('pageerror',error=>pageErrors.push(String(error&&error.message||error)));

      if(fixtures){
        await page.route('**/api/kk-data**',async route=>{
          const requestUrl=new URL(route.request().url());
          const sheet=requestUrl.searchParams.get('sheet');
          const body=sheet==='08_Web_Ready'
            ? fixtures.events
            : sheet==='09_Web_Packages'
              ? fixtures.packages
              : null;
          if(body===null){
            await route.fulfill({status:400,contentType:'text/plain; charset=utf-8',body:'Sheet/range not allowed'});
            return;
          }
          await route.fulfill({
            status:200,
            contentType:'text/csv; charset=utf-8',
            headers:{'cache-control':'no-store'},
            body
          });
        });
      }

      await page.goto(target.href,{waitUntil:'domcontentloaded',timeout:30000});
      if(mode!=='local_zero_cost'){
        await page.waitForLoadState('networkidle',{timeout:8000}).catch(()=>{});
      }
      await page.waitForSelector('.concert-card, .empty-state, .error-box',{timeout:12000});
      if(mode==='local_zero_cost') await page.waitForTimeout(350);

      const errorVisible=await page.locator('.error-box').isVisible().catch(()=>false);
      if(errorVisible){
        const text=await page.locator('.error-box').innerText().catch(()=> '');
        fail('STOREFRONT_ERROR_STATE',`Storefront rendered an error state at ${width}px: ${text.slice(0,220)}`);
      }

      const cards=page.locator('.concert-card');
      const cardCount=await cards.count();
      if(cardCount<1) fail('EVENT_CARDS_NOT_RENDERED',`No event cards rendered at ${width}px`);

      const cssLinks=await page.locator('link[rel="stylesheet"]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')||''));
      if(expectedCssMarker && !cssLinks.some(href=>href.includes(expectedCssMarker))){
        fail('EXPECTED_CSS_MARKER_MISSING',`Expected CSS marker "${expectedCssMarker}" was not present at ${width}px`);
      }

      const topPath=path.join(outputDir,`${width}x${height}-top.jpg`);
      await page.screenshot({path:topPath,type:'jpeg',quality:74,fullPage:false,animations:'disabled'});

      await page.evaluate(()=>{
        const shell=document.querySelector('.browse-controls-shell');
        if(!shell) return;
        const rect=shell.getBoundingClientRect();
        const targetY=Math.max(0,window.scrollY+rect.top+Math.max(80,rect.height));
        window.scrollTo({top:targetY,behavior:'instant'});
      });
      await page.waitForTimeout(250);

      const stickyPath=path.join(outputDir,`${width}x${height}-sticky.jpg`);
      await page.screenshot({path:stickyPath,type:'jpeg',quality:74,fullPage:false,animations:'disabled'});

      const metrics=await page.evaluate(()=>{
        const visible=el=>{
          if(!el) return false;
          const style=getComputedStyle(el);
          const rect=el.getBoundingClientRect();
          return style.display!=='none' && style.visibility!=='hidden' && Number(style.opacity||1)>0 && rect.width>0 && rect.height>0;
        };
        const rect=el=>{
          if(!el||!visible(el)) return null;
          const r=el.getBoundingClientRect();
          return {width:r.width,height:r.height,top:r.top,left:r.left,bottom:r.bottom,right:r.right};
        };
        const px=value=>{
          const m=String(value||'').match(/(-?\d+(?:\.\d+)?)px/);
          return m?Number(m[1]):0;
        };
        const shell=document.querySelector('.browse-controls-shell');
        const cta=document.querySelector('.sticky-line');
        const controls=[
          ['search',document.querySelector('#event-search')],
          ['month',document.querySelector('.month-select')],
          ...Array.from(document.querySelectorAll('.filter-btn')).map((el,index)=>[`filter-${el.dataset.filter||index}`,el]),
          ['follow-x',document.querySelector('.quick-link')],
          ['faq',document.querySelector('.mini-btn')],
          ...Array.from(document.querySelectorAll('.lang-btn')).map((el,index)=>[`lang-${index}`,el]),
          ['line-cta',cta]
        ];
        const tapTargets=controls
          .filter(([,el])=>visible(el))
          .map(([id,el])=>{
            const r=el.getBoundingClientRect();
            return {id,width:r.width,height:r.height};
          });

        const formControls=Array.from(document.querySelectorAll('input,select,textarea'))
          .filter(visible)
          .map(el=>px(getComputedStyle(el).fontSize))
          .filter(v=>v>0);

        const filterItems=[
          document.querySelector('.browse-controls-shell .month-select-wrap'),
          ...Array.from(document.querySelectorAll('.browse-controls-shell .filter-btn'))
        ].filter(visible);
        const rowTops=[...new Set(filterItems.map(el=>Math.round(el.getBoundingClientRect().top/3)*3))];

        const cards=Array.from(document.querySelectorAll('.concert-card')).filter(visible);
        const cardRects=cards.map(el=>el.getBoundingClientRect());
        const firstTop=cardRects.length?Math.round(cardRects[0].top/4)*4:null;
        const firstRow=firstTop===null?[]:cardRects.filter(r=>Math.round(r.top/4)*4===firstTop);
        const visibleAboveFold=cardRects.filter(r=>r.bottom>0&&r.top<window.innerHeight).length;

        let cssText='';
        for(const sheet of Array.from(document.styleSheets)){
          try{
            cssText+='\n'+Array.from(sheet.cssRules||[]).map(rule=>rule.cssText||'').join('\n');
          }catch(_){}
        }

        const shellStyle=shell?getComputedStyle(shell):null;
        const backdrop=shellStyle?(shellStyle.backdropFilter||shellStyle.webkitBackdropFilter||''):'';
        const blurMatch=String(backdrop).match(/blur\((\d+(?:\.\d+)?)px\)/);

        return {
          viewport_width_px:window.innerWidth,
          viewport_height_px:window.innerHeight,
          document_scroll_width_px:document.documentElement.scrollWidth,
          content_width_px:document.documentElement.clientWidth,
          sticky_controls_height_px:rect(shell)?.height||0,
          bottom_cta_height_px:rect(cta)?.height||0,
          bottom_cta_fixed:!!cta && getComputedStyle(cta).position==='fixed' && visible(cta),
          safe_area_bottom_applied:/safe-area-inset-bottom/i.test(cssText),
          min_form_control_font_px:formControls.length?Math.min(...formControls):0,
          filter_rows:rowTops.length,
          card_columns:firstRow.length,
          card_min_width_px:cardRects.length?Math.min(...cardRects.map(r=>r.width)):0,
          visible_event_cards_above_fold:visibleAboveFold,
          backdrop_blur_px:blurMatch?Number(blurMatch[1]):0,
          tap_targets:tapTargets,
          event_card_count:cards.length,
          search_count_text:(document.querySelector('.event-search-count')?.textContent||'').trim()
        };
      });

      const packet={
        platform:width<=768?'ios-contract-via-chromium':'chromium',
        viewport:{width,height},
        metrics
      };
      const qa=Reviewer.validateVisualQa(packet);
      results.push({
        width,
        height,
        target_url:target.href,
        approved_sha:approvedSha,
        css_marker:expectedCssMarker,
        screenshot_top:path.relative(process.cwd(),topPath),
        screenshot_sticky:path.relative(process.cwd(),stickyPath),
        page_errors:pageErrors,
        metrics,
        qa
      });
      runtimeErrors.push(...pageErrors.map(message=>({width,message})));
      await context.close();
    }
  }finally{
    await browser.close();
  }

  const summary={
    schema_version:'KK_STOREFRONT_AUTOMATED_VISUAL_QA_V1',
    generated_at:new Date().toISOString(),
    target_mode:mode,
    target_url:target.href,
    data_source_url:dataSource?dataSource.href:null,
    approved_sha:approvedSha,
    expected_css_marker:expectedCssMarker,
    viewports:results,
    runtime_errors:runtimeErrors,
    pass:results.length===widths.length &&
      results.every(item=>item.qa.pass===true) &&
      runtimeErrors.length===0,
    production_writes:0,
    publishes:0,
    clicks_performed:0,
    forms_submitted:0,
    protection_bypass_used:Boolean(String(process.env.VERCEL_AUTOMATION_BYPASS_SECRET||'').trim()),
    paid_external_service_calls:0,
    zero_cost_path:mode==='local_zero_cost'
  };

  fs.writeFileSync(path.join(outputDir,'manifest.json'),JSON.stringify(summary,null,2)+'\n');

  const lines=[
    '# Storefront Automated Visual QA',
    '',
    `Mode: ${mode}`,
    `Target: ${target.href}`,
    `Data source: ${dataSource?dataSource.href:'target deployment'}`,
    `Approved SHA: ${approvedSha}`,
    `Result: ${summary.pass?'PASS':'FAIL'}`,
    '',
    '| Viewport | Result | Score | P0 | P1 | P2 | Sticky px | Filter rows | Card cols |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'
  ];
  for(const item of results){
    const review=item.qa.review;
    lines.push(
      `| ${item.width}x${item.height} | ${item.qa.status} | ${review.professional_readiness_score} | ${review.finding_counts.P0} | ${review.finding_counts.P1} | ${review.finding_counts.P2} | ${Math.round(numeric(item.metrics.sticky_controls_height_px))} | ${item.metrics.filter_rows} | ${item.metrics.card_columns} |`
    );
  }
  if(runtimeErrors.length){
    lines.push('','','## Runtime errors');
    for(const error of runtimeErrors) lines.push(`- ${error.width}px: ${markdownEscape(error.message)}`);
  }
  fs.writeFileSync(path.join(outputDir,'summary.md'),lines.join('\n')+'\n');

  process.stdout.write(JSON.stringify(summary,null,2)+'\n');
  if(!summary.pass) process.exitCode=1;
}

main().catch(error=>{
  const payload={
    schema_version:'KK_STOREFRONT_AUTOMATED_VISUAL_QA_ERROR_V1',
    status:'BLOCKED',
    error_code:String(error&&error.code||error&&error.name||'VISUAL_QA_FAILED'),
    message:String(error&&error.message||error),
    production_writes:0,
    publishes:0
  };
  process.stderr.write(JSON.stringify(payload,null,2)+'\n');
  process.exitCode=1;
});
