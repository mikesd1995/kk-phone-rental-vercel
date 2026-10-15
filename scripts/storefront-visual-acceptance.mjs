'use strict';

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const require=createRequire(import.meta.url);
const Reviewer=require('../server/kk-storefront-ux-reviewer.js');
const ArtDirector=require('../server/kk-storefront-art-director.js');
const VisualCritic=require('../server/kk-storefront-visual-critic.js');
const DesignCouncil=require('../server/kk-storefront-design-council.js');
const OpenAiAgents=require('../server/kk-openai-agent-adapters.js');
const OpenAiPlatform=require('../server/kk-openai-platform.js');
const Evidence=require('./storefront-evidence.cjs');

const DEFAULT_HEIGHTS=Object.freeze({
  320:568,
  375:812,
  390:844,
  430:932,
  480:932,
  768:1024,
  1024:768,
  1440:900
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
  const openAiConfig=OpenAiPlatform.configState(process.env);
  const requestedAiWidths=String(process.env.KK_OPENAI_STOREFRONT_AI_VIEWPORTS||'390,1024')
    .split(',').map(value=>Number(value.trim())).filter(Number.isFinite);
  const openAiWidths=new Set(requestedAiWidths.filter(width=>widths.includes(width)));
  const { chromium }=await import('playwright');
  const dataSource=mode==='local_zero_cost'
    ? cleanDataSourceUrl(process.env.DATA_SOURCE_URL||'https://kk-phone-rental.vercel.app/')
    : null;
  const fixtures=dataSource?await loadPublicFixtures(dataSource):null;

  ensureDir(outputDir);
  if(fixtures){
    fs.writeFileSync(path.join(outputDir,'public-events.csv'),fixtures.events);
    fs.writeFileSync(path.join(outputDir,'public-packages.csv'),fixtures.packages);
  }
  const identity=Evidence.frontendIdentity();
  const checkoutSha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  if(checkoutSha!==approvedSha) fail('CHECKOUT_SHA_MISMATCH');
  const sourceDirty=Boolean(execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim());
  const invocationOptions={outputDir,sourceSha:approvedSha,identity};

  const browserChannel=String(process.env.BROWSER_CHANNEL||'').trim();
  const launchOptions={headless:true};
  if(browserChannel) launchOptions.channel=browserChannel;
  const browser=await chromium.launch(launchOptions);
  const results=[];
  const runtimeErrors=[];
  let openAiProviderRequests=0;
  const imageCache=Evidence.imageResponseCache();

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
      page.on('response',async response=>{
        try{
          if(response.request().resourceType()==='image')imageCache.remember(response.url(),response.status(),response.headers(),await response.body());
        }catch(_){} // A failed response is never cached or exempted from readiness checks.
      });
      await page.route('**/*',route=>{
        if(!['GET','HEAD'].includes(route.request().method()))return route.abort('blockedbyclient');
        const cached=route.request().resourceType()==='image'?imageCache.get(route.request().url()):null;
        return cached?route.fulfill({status:200,contentType:cached.contentType,body:cached.body}):route.continue();
      });

      if(fixtures){
        // The checked-out config installs an API-only fetch guard before app code runs.
        // Route both absolute localhost requests and any matching API request to the
        // already-fetched canonical read-only fixture so QA never falls through to
        // a missing local /api implementation or direct Google fallback.
        await page.route(url=>url.pathname==='/api/kk-data',async route=>{
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
      if(fixtures){
        await page.waitForFunction(()=>window.__KK_PUBLIC_DATA_GUARD__==='api-only',{timeout:5000}).catch(()=>{});
      }
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

      // Wait for the real catalogue, not the initial skeleton. Interaction acceptance must
      // never race the asynchronous fixture/API render or mistake skeleton cards for events.
      try{
        await page.locator('#content .skeleton-grid').waitFor({state:'detached',timeout:15000});
        await page.locator('#content .concert-card:not(.skeleton-card)').first().waitFor({state:'visible',timeout:15000});
      }catch(error){
        const readiness=await page.evaluate(()=>({
          skeletons:document.querySelectorAll('#content .skeleton-card').length,
          real_cards:document.querySelectorAll('#content .concert-card:not(.skeleton-card)').length,
          error_visible:Boolean(document.querySelector('#content .error-box')),
          content_text:String(document.querySelector('#content')?.textContent||'').trim().slice(0,240)
        }));
        fail('STOREFRONT_DATA_NOT_READY',`Real event catalogue was not ready at ${width}px before interaction QA: ${JSON.stringify(readiness)}`);
      }

      const cards=page.locator('#content .concert-card:not(.skeleton-card)');
      const cardCount=await cards.count();
      if(cardCount<1) fail('EVENT_CARDS_NOT_RENDERED',`No real event cards rendered at ${width}px`);
      await Evidence.settle(page);

      // Exercise read-only storefront interactions so a geometry-only PASS cannot mask broken UX.
      // Never click LINE/external booking links and never submit forms.
      const interactionChecks=[];
      const recordInteraction=(name,pass,detail='')=>interactionChecks.push({name,pass:Boolean(pass),detail:String(detail||'')});
      // Detect overlaps within the header: document.scrollWidth alone misses
      // an over-wide FAQ/theme/TH/EN row clipped by a responsive container.
      // Probe actual browser geometry for every accepted viewport.
      const headerGeometry=await page.evaluate(()=>{
        const header=document.querySelector('.v3-header');
        const brand=header?.querySelector('.v3-brand');
        const actions=header?.querySelector('.v3-header-actions');
        const faq=document.querySelector('#faq-open-btn');
        const theme=document.querySelector('#theme-toggle');
        const langs=Array.from(document.querySelectorAll('.v3-header .lang-btn'));
        const rect=element=>{
          if(!element || getComputedStyle(element).display==='none')return null;
          const r=element.getBoundingClientRect();
          return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};
        };
        const h=rect(header),b=rect(brand),a=rect(actions);
        const targets=[faq,theme,...langs].map(rect);
        const contained=Boolean(h && b && a && targets.length===4 && targets.every(Boolean)) &&
          b.left>=h.left-1 && b.right<=a.left+1 &&
          a.right<=h.right+1 && a.left>=h.left-1 &&
          targets.every(r=>r.left>=h.left-1 && r.right<=h.right+1 &&
            r.top>=h.top-1 && r.bottom<=h.bottom+1 && r.width>=43.5 && r.height>=43.5);
        return {contained,viewport:innerWidth,header:h,brand:b,actions:a,targets};
      });
      recordInteraction('header_controls_contained',headerGeometry.contained,JSON.stringify(headerGeometry));
      try{
        const search=page.locator('#event-search');
        await search.fill('__kk_visual_qa_no_match__');
        await page.waitForTimeout(80);
        recordInteraction('search_empty_state',await page.locator('.empty-state').isVisible().catch(()=>false));
        await search.fill('');
        await page.waitForTimeout(80);
        recordInteraction('search_restore',await page.locator('#content .concert-card:not(.skeleton-card)').count()>0);
        const months=await page.locator('#month-filter-select option').evaluateAll(nodes=>nodes.map(x=>x.value));
        if(months.length>1){
          await page.locator('#month-filter-select').selectOption(months[1]);
          recordInteraction('month_filter_selected',await page.locator('#month-filter-select').inputValue()===months[1]);
          await page.locator('#clear-browse-btn').click();
          recordInteraction('clear_filters',await page.locator('#month-filter-select').inputValue()==='all');
        }

        const available=page.locator('.filter-btn[data-filter="available"]');
        await available.click();
        await page.waitForTimeout(60);
        recordInteraction('status_filter_pressed',(await available.getAttribute('aria-pressed'))==='true');
        await page.locator('.filter-btn[data-filter="all"]').click();
        await page.waitForTimeout(60);

        const faqButton=page.locator('#faq-open-btn:visible,[data-open-faq]:visible').first();
        if(await faqButton.isVisible().catch(()=>false)){
          await faqButton.click();
          recordInteraction('faq_open',await page.locator('#faqOverlay').isVisible().catch(()=>false));
          await page.keyboard.press('Escape');
          recordInteraction('faq_escape_close',!(await page.locator('#faqOverlay').isVisible().catch(()=>true)));
        }else{
          // FAQ is a required primary UX feature at 320px as well as desktop.
          // Previously the QA silently skipped it when CSS hid the only entry.
          recordInteraction('faq_entry_missing',false,'No visible FAQ entry point at this viewport');
        }

        const firstCard=page.locator('#content .concert-card:not(.skeleton-card)').first();
        await firstCard.click();
        recordInteraction('event_modal_open',await page.locator('#overlay').isVisible().catch(()=>false));
        await page.keyboard.press('Escape');
        recordInteraction('event_modal_escape_close',!(await page.locator('#overlay').isVisible().catch(()=>true)));

        const en=page.locator('.lang-btn[data-lang="en"]');
        const th=page.locator('.lang-btn[data-lang="th"]');
        await en.click();
        recordInteraction('language_en_pressed',(await en.getAttribute('aria-pressed'))==='true');
        await th.click();
        recordInteraction('language_th_restore',(await th.getAttribute('aria-pressed'))==='true');
      }catch(error){
        recordInteraction('interaction_runtime',false,error&&error.message||error);
      }
      const failedInteractions=interactionChecks.filter(item=>!item.pass);
      if(failedInteractions.length){
        fail('STOREFRONT_INTERACTION_FAILED',`Read-only interaction checks failed at ${width}px: ${JSON.stringify(failedInteractions).slice(0,900)}`);
      }

      const cssLinks=await page.locator('link[rel="stylesheet"]').evaluateAll(nodes=>nodes.map(node=>node.getAttribute('href')||''));
      if(expectedCssMarker && !cssLinks.some(href=>href.includes(expectedCssMarker))){
        fail('EXPECTED_CSS_MARKER_MISSING',`Expected CSS marker "${expectedCssMarker}" was not present at ${width}px`);
      }

      const topPath=path.join(outputDir,`${width}x${height}-top.jpg`);
      const stateEvidence=[];
      const stateObservations=[];
      const screenshots=[];
      const captureState=async(name,file)=>{
        const broken=await Evidence.settle(page);
        const state=await Evidence.inspectState(page);
        const findings=Evidence.stateFindings(state,{width,name});
        if(broken.length) findings.push({code:'VISIBLE_IMAGE_NOT_READY',severity:'P1',evidence:broken.join(', '),action:'Resolve visible image delivery before acceptance.'});
        if(state.failed_posters){
          const posterDetails=state.failed_poster_details||[];
          const unresolved=posterDetails.filter(item=>item.fallback_mode!=='event-summary'||item.fallback_visible!==true);
          const recovered=posterDetails.filter(item=>item.fallback_mode==='event-summary'&&item.fallback_visible===true);
          if(unresolved.length) findings.push({code:'POSTER_DELIVERY_FAILED',severity:'P1',evidence:JSON.stringify(unresolved),action:'Verify image provider delivery or render the exact-event fallback.'});
          if(recovered.length) findings.push({code:'POSTER_SOURCE_DEGRADED_FALLBACK_RENDERED',severity:'P2',evidence:JSON.stringify(recovered),action:'Restore a verified exact-event poster source; the customer-facing exact-event fallback is rendering safely in the meantime.'});
        }
        await page.screenshot({path:file,type:'jpeg',quality:74,fullPage:false,animations:'disabled'});
        stateEvidence.push({name,...state,broken_visible_images:broken,findings});
        stateObservations.push(...findings);
        screenshots.push({width,state:name,path:path.relative(outputDir,file),sha256:Evidence.hash(fs.readFileSync(file))});
        return state;
      };
      await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
      const firstFold=await captureState('top',topPath);

      await page.evaluate(()=>{
        const shell=document.querySelector('.browse-controls-shell');
        if(!shell) return;
        const rect=shell.getBoundingClientRect();
        const targetY=Math.max(0,window.scrollY+rect.top+Math.max(80,rect.height));
        window.scrollTo({top:targetY,behavior:'instant'});
      });
      await page.waitForTimeout(250);

      const stickyPath=path.join(outputDir,`${width}x${height}-sticky.jpg`);
      await captureState('catalogue',stickyPath);

      // Inspect the lower-page composition, English, both themes and actual package sheet.
      await page.locator('footer').scrollIntoViewIfNeeded();
      await captureState('footer',path.join(outputDir,`${width}x${height}-footer.jpg`));
      await page.locator('.lang-btn[data-lang="en"]').click();
      await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
      await captureState('english',path.join(outputDir,`${width}x${height}-english.jpg`));
      const modalCard=page.locator('#content .concert-card:not(.skeleton-card)').first();
      await modalCard.click();
      await captureState('english-modal',path.join(outputDir,`${width}x${height}-english-modal.jpg`));
      await page.keyboard.press('Escape');
      recordInteraction('modal_focus_restored',await modalCard.evaluate(el=>el===document.activeElement));
      await page.locator('.lang-btn[data-lang="th"]').click();
      await page.locator('#theme-toggle').click();
      await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
      await captureState('dark',path.join(outputDir,`${width}x${height}-dark.jpg`));
      await page.locator('#content .concert-card:not(.skeleton-card)').first().click();
      await captureState('dark-modal',path.join(outputDir,`${width}x${height}-dark-modal.jpg`));
      await page.keyboard.press('Escape');
      // Cross-product coverage: earlier matrix captured EN/light and TH/dark
      // but silently omitted EN/dark, including its package modal.
      await page.locator('.lang-btn[data-lang="en"]').click();
      recordInteraction('english_dark_selected',
        (await page.locator('.lang-btn[data-lang="en"]').getAttribute('aria-pressed'))==='true' &&
        (await page.locator('html').getAttribute('data-theme'))==='dark');
      await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
      await captureState('english-dark',path.join(outputDir,`${width}x${height}-english-dark.jpg`));
      await page.locator('#content .concert-card:not(.skeleton-card)').first().click();
      await captureState('english-dark-modal',path.join(outputDir,`${width}x${height}-english-dark-modal.jpg`));
      await page.keyboard.press('Escape');
      await page.locator('.lang-btn[data-lang="th"]').click();
      await page.locator('#theme-toggle').click();
      await page.locator('#content .concert-card:not(.skeleton-card)').first().click();
      await captureState('modal',path.join(outputDir,`${width}x${height}-modal.jpg`));
      const focusables=page.locator('#overlay .modal button:visible,#overlay .modal a[href]:visible');
      await focusables.last().focus();await page.keyboard.press('Tab');
      recordInteraction('modal_tab_wrap',await focusables.first().evaluate(el=>el===document.activeElement));
      await focusables.first().focus();await page.keyboard.press('Shift+Tab');
      recordInteraction('modal_shift_tab_wrap',await focusables.last().evaluate(el=>el===document.activeElement));
      await page.keyboard.press('Escape');
      await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
      await Evidence.settle(page);

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
          ['theme',document.querySelector('#theme-toggle')],
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
        const filterTops=filterItems.map(el=>el.getBoundingClientRect().top).sort((a,b)=>a-b);
        const rowTops=filterTops.filter((top,index)=>index===0 || top-filterTops[index-1]>4);

        const hero=document.querySelector('.v4-hero,.v3-hero');
        const preEventSurfaces=[document.querySelector('.v4-header,.v3-header'),hero,document.querySelector('.v3-social-proof'),document.querySelector('.browse-controls-shell')].filter(visible);
        const cards=Array.from(document.querySelectorAll('.concert-card')).filter(visible);
        const cardRects=cards.map(el=>{const r=el.getBoundingClientRect();return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};});
        const visibleAboveFold=cardRects.filter(r=>r.bottom>0&&r.top<window.innerHeight).length;

        let cssText='';
        for(const sheet of Array.from(document.styleSheets)){
          try{
            cssText+='\n'+Array.from(sheet.cssRules||[]).map(rule=>rule.cssText||'').join('\n');
          }catch(_){}
        }

        const overflowElements=Array.from(document.querySelectorAll('body *')).map(el=>{const r=el.getBoundingClientRect();const style=getComputedStyle(el);return {tag:el.tagName.toLowerCase(),id:el.id||'',class_name:String(el.className||'').slice(0,120),display:style.display,visibility:style.visibility,left:r.left,right:r.right,width:r.width,scroll_width:el.scrollWidth,client_width:el.clientWidth};}).filter(item=>item.left < -1 || item.right > window.innerWidth+1 || item.scroll_width > item.client_width+1).sort((a,b)=>Math.max(b.right-window.innerWidth,b.scroll_width-b.client_width)-Math.max(a.right-window.innerWidth,a.scroll_width-a.client_width)).slice(0,20);

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
          filter_item_geometry:filterItems.map(el=>{const r=el.getBoundingClientRect();return {class_name:String(el.className||''),top:r.top,left:r.left,width:r.width,height:r.height};}),
          card_rects:cardRects,
          card_columns:0,
          card_min_width_px:cardRects.length?Math.min(...cardRects.map(r=>r.width)):0,
          visible_event_cards_above_fold:visibleAboveFold,
          first_event_top_px:cardRects.length?cardRects[0].top+window.scrollY:0,
          hero_height_px:rect(hero)?.height||0,
          pre_event_surface_count:preEventSurfaces.length,
          backdrop_blur_px:blurMatch?Number(blurMatch[1]):0,
          tap_targets:tapTargets,
          event_card_count:cards.length,
          search_count_text:(document.querySelector('.event-search-count')?.textContent||'').trim(),
          overflow_elements:overflowElements
        };
      });

      const cardGeometry=Evidence.cardColumnGeometry(metrics.card_rects||[]);
      metrics.card_columns=cardGeometry.card_columns;
      metrics.card_column_widths=cardGeometry.column_widths;
      delete metrics.card_rects;
      const pageText=(await page.locator('body').innerText()).slice(0,40000);
      const rawI18nKeys=[...new Set((pageText.match(/\b(?:journey|proof|events|filter|footer|modal|faq|hero|card|search)_[a-z0-9_]+\b/gi)||[]).map(x=>x.toLowerCase()))];
      metrics.raw_i18n_key_count=rawI18nKeys.length;
      metrics.raw_i18n_keys=rawI18nKeys.slice(0,20);
      metrics.visible_event_cards_above_fold=firstFold.visible_event_cards_above_fold;
      const packet={
        platform:width<=768?'ios-contract-via-chromium':'chromium',
        viewport:{width,height},
        metrics,
        page_text:pageText,
        screenshot_artifacts:screenshots.map(x=>x.path),
        broken_visible_images:stateEvidence.flatMap(x=>x.broken_visible_images),
        observations:stateObservations,
        screenshot_observations:[...stateObservations,...(rawI18nKeys.length?[{
          code:'RAW_I18N_KEY_VISIBLE',
          severity:'P0',
          evidence:'Visible untranslated keys: '+rawI18nKeys.slice(0,8).join(', '),
          action:'Repair localization binding before release.'
        }]:[])]
      };
      const uxInvocation=await Evidence.invokeWithEvidence('storefront_ux_review',packet,invocationOptions);
      const qaInvocation=await Evidence.invokeWithEvidence('storefront_visual_qa',packet,invocationOptions);
      const qa=qaInvocation.result;
      const visualCritique=VisualCritic.critique(packet);
      // Gateway executes DesignCouncil.runCouncil and persists the actual seven outputs.
      const councilInvocation=await Evidence.invokeWithEvidence('storefront_design_council',{packet},invocationOptions);
      const designCouncil=councilInvocation.result;
      const councilBlockingFindings=designCouncil.reviews.flatMap(r=>Array.isArray(r.findings)?r.findings:[]).filter(f=>['P0','P1'].includes(String(f&&f.severity||'').toUpperCase()));
      let openAiVisualReview={
        version:'KK_OPENAI_AGENT_ADAPTERS_V1',
        agent:'kk-openai-storefront-reviewer',
        status:'NOT_REQUESTED_FOR_VIEWPORT',
        production_writes:0,
        publishes:0,
        auto_merge:false,
        auto_deploy:false
      };
      if(openAiConfig.enabled&&openAiWidths.has(width)){
        if(openAiConfig.api_key_present) openAiProviderRequests+=1;
        const imageUrls=[
          'data:image/jpeg;base64,'+fs.readFileSync(topPath).toString('base64'),
          'data:image/jpeg;base64,'+fs.readFileSync(stickyPath).toString('base64')
        ];
        openAiVisualReview=await OpenAiAgents.reviewStorefront({
          target:'KK Phone Rental storefront visual acceptance',
          metrics,
          design_council:designCouncil,
          page_text:pageText,
          owner_observations:'Automated screenshot evidence only. Owner visual acceptance remains separate.',
          image_urls:imageUrls
        },{env:process.env,fetchImpl:global.fetch});
      }
      results.push({
        width,
        height,
        target_url:target.href,
        approved_sha:approvedSha,
        css_marker:expectedCssMarker,
        screenshot_top:path.relative(process.cwd(),topPath),
        screenshot_sticky:path.relative(process.cwd(),stickyPath),
        page_errors:pageErrors,
        interaction_checks:interactionChecks,
        states:stateEvidence,
        screenshots,
        gateway_receipts:[uxInvocation.ledger,qaInvocation.ledger,councilInvocation.ledger],
        metrics,
        qa,
        visual_critique:visualCritique,
        design_council:designCouncil,
        design_council_blockers:councilBlockingFindings,
        openai_visual_review:openAiVisualReview
      });
      runtimeErrors.push(...pageErrors.map(message=>({width,message})));
      await context.close();
    }
  }finally{
    await browser.close();
  }

  const openAiReviewRows=results.filter(item=>openAiWidths.has(item.width));
  const openAiReviewPass=!openAiConfig.enabled || (
    openAiWidths.size>0 &&
    openAiReviewRows.length===openAiWidths.size &&
    openAiReviewRows.every(item=>{
      const review=item.openai_visual_review||{};
      if(review.status!=='READY_FOR_DESIGN_SYNTHESIS') return false;
      const findings=Array.isArray(review.review&&review.review.findings)?review.review.findings:[];
      return !findings.some(f=>['P0','P1'].includes(String(f&&f.severity||'').toUpperCase()));
    })
  );

  const summary={
    schema_version:'KK_STOREFRONT_AUTOMATED_VISUAL_QA_V1',
    generated_at:new Date().toISOString(),
    target_mode:mode,
    target_url:target.href,
    data_source_url:dataSource?dataSource.href:null,
    fixture_hashes:fixtures?{events:Evidence.hash(fixtures.events),packages:Evidence.hash(fixtures.packages)}:null,
    image_delivery_evidence:imageCache.evidence(),
    approved_sha:approvedSha,
    frontend_identity:identity,
    source_dirty:sourceDirty,
    expected_css_marker:expectedCssMarker,
    viewports:results,
    runtime_errors:runtimeErrors,
    pass:results.length===widths.length &&
      results.every(item=>item.qa.pass===true && item.visual_critique.status==='PASS' && item.design_council_blockers.length===0 && item.design_council.technical_status==='PASS' && item.interaction_checks.every(check=>check.pass===true)) &&
      runtimeErrors.length===0 &&
      openAiReviewPass,
    production_writes:0,
    publishes:0,
    clicks_performed:results.reduce((sum,item)=>sum+(item.interaction_checks||[]).filter(check=>/filter|faq|modal|language/.test(check.name)).length,0),
    forms_submitted:0,
    technical_visual_pass:results.length===widths.length && results.every(item=>item.qa.pass===true && item.visual_critique.status==='PASS' && item.design_council_blockers.length===0 && item.design_council.technical_status==='PASS' && item.interaction_checks.every(check=>check.pass===true)) && runtimeErrors.length===0 && openAiReviewPass,
    deterministic_design_council_agents:[...new Set(results.flatMap(item=>item.design_council?.invoked_agents||[]))],
    openai_visual_review_requested:openAiConfig.requested,
    paid_external_ai_allowed:openAiConfig.paid_external_ai_allowed,
    zero_cost_mode:openAiConfig.zero_cost_mode,
    openai_visual_review_enabled:openAiConfig.enabled,
    openai_visual_review_viewports:[...openAiWidths],
    openai_visual_review_pass:openAiReviewPass,
    openai_provider_requests:openAiProviderRequests,
    invoked_agents:[...new Set(results.flatMap(item=>item.design_council?.invoked_agents||[]))],
    interaction_pass:results.length===widths.length && results.every(item=>(item.interaction_checks||[]).every(check=>check.pass===true)),
    protection_bypass_used:Boolean(String(process.env.VERCEL_AUTOMATION_BYPASS_SECRET||'').trim()),
    paid_external_service_calls:openAiProviderRequests,
    zero_cost_path:mode==='local_zero_cost' && openAiProviderRequests===0
  };

  const reviewPath=path.join(process.cwd(),'config','kk-storefront-v5-screenshot-review.json');
  if(Evidence.frontendIdentity().digest!==identity.digest) fail('FRONTEND_CHANGED_DURING_CAPTURE');
  let screenshotReviewPass=false;
  let screenshotReview=null;
  if(fs.existsSync(reviewPath)){
    try{
      screenshotReview=JSON.parse(fs.readFileSync(reviewPath,'utf8'));
      const blobs=screenshotReview.reviewed_design_blobs||{};
      const expected={
        'index.html':String(blobs.index_html||''),
        'assets/kk-storefront-v5.css':String(blobs.v5_css||''),
        'script.js':String(blobs.script_js||'')
      };
      const designUnchanged=Evidence.ownerApprovalValid(screenshotReview,identity,widths,results.flatMap(x=>x.screenshots)) && Object.entries(expected).every(([file,blob])=>{
        if(!/^[0-9a-f]{40}$/.test(blob)) return false;
        try{return execFileSync('git',['hash-object',file],{encoding:'utf8'}).trim()===blob;}catch(_){return false;}
      });
      const loopAcceptance=VisualCritic.acceptLoop({rounds:screenshotReview.rounds||[],screenshot_artifact_id:screenshotReview.screenshot_artifact_id,owner_decision:screenshotReview.owner_decision,baseline_comparison_pass:screenshotReview.baseline_comparison_pass===true});
      screenshotReview.closed_loop_acceptance=loopAcceptance;
      screenshotReviewPass=screenshotReview.status==='PASS' && designUnchanged && loopAcceptance.status==='PASS';
    }catch(_){}
  }
  const indexSource=fs.readFileSync(path.join(process.cwd(),'index.html'),'utf8');
  const storefrontStyles=[...indexSource.matchAll(/kk-storefront-v\d+\.css/gi)].map(match=>match[0].toLowerCase());
  const singleVisualSourceOfTruth=storefrontStyles.length===1 && storefrontStyles[0]==='kk-storefront-v5.css';

  const artAcceptance=ArtDirector.evaluateImplementation({
    evidence:{
      multi_viewport:results.length===widths.length,
      no_horizontal_overflow:results.length===widths.length && results.every(item=>numeric(item.metrics.document_scroll_width_px)<=numeric(item.metrics.viewport_width_px)+1),
      business_truth_unchanged:mode==='local_zero_cost' && Boolean(fixtures) && summary.production_writes===0 && summary.forms_submitted===0,
      visual_qa_pass:summary.pass,
      single_visual_source_of_truth:singleVisualSourceOfTruth,
      screenshot_review_pass:screenshotReviewPass
    }
  });
  const technicalPass=summary.pass;
  const releasePass=technicalPass && artAcceptance.status==='PASS';
  summary.screenshot_review={status:screenshotReviewPass?'PASS':'BLOCKED',record:screenshotReview?path.relative(process.cwd(),reviewPath):null,closed_loop_acceptance:screenshotReview?.closed_loop_acceptance||null};
  summary.owner_visual_acceptance=screenshotReviewPass?'PASS':'BLOCKED';
  summary.single_visual_source_of_truth=singleVisualSourceOfTruth;
  summary.art_director_acceptance=artAcceptance;
  // Source/CI acceptance and owner aesthetic release are intentionally separate gates.
  // A candidate may merge after measured technical QA while production promotion remains
  // blocked until fresh exact-candidate owner screenshot acceptance is recorded.
  summary.technical_pass=technicalPass;
  summary.release_ready=releasePass;
  summary.pass=technicalPass;

  fs.writeFileSync(path.join(outputDir,'manifest.json'),JSON.stringify(summary,null,2)+'\n');

  const lines=[
    '# Storefront Automated Visual QA',
    '',
    `Mode: ${mode}`,
    `Target: ${target.href}`,
    `Data source: ${dataSource?dataSource.href:'target deployment'}`,
    `Approved SHA: ${approvedSha}`,
    `Technical result: ${summary.technical_pass?'PASS':'FAIL'}`,
    `Release ready: ${summary.release_ready?'PASS':'BLOCKED'}`,
    `Art Director acceptance: ${summary.art_director_acceptance.status}`,
    `Design Council agents: ${(summary.invoked_agents||[]).join(', ')||'none'}`,
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
