#!/usr/bin/env node
'use strict';
// R16: Capture real Chromium DOM measurements and images on isolated loopback.
// No live provider, credentials, Production cookie or customer data is read.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const crypto=require('node:crypto');
const {chromium}=require('playwright');
const Projection=require('../server/kk-admin-ops-projection.js');
const widths=[320,375,390,430,480,768,1024,1440];
const heights=[568,812,844,932,932,1024,768,900];
const root=path.resolve(__dirname,'..');
const target=path.join(root,'artifacts/admin-ops-ux');
const evidenceFile=path.join(target,'browser-evidence.json');
const sourcePaths=['admin/operations-dashboard.html','admin/operations-dashboard.css','admin/operations-dashboard.js'];
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');

function fixture(){
 const events=[],web_ready=[],web_packages=[];
 const specs=[
  ['EVT-20261127-QA-SYNTHETIC-A','2026-11-27','Synthetic Test Venue A',2,'show',590,690],
  ['EVT-20261203-QA-SYNTHETIC-B','2026-12-03','Synthetic Test Venue B',0,'show_full',790,990],
  ['EVT-20261205-QA-SYNTHETIC-C','2026-12-05','Synthetic Test Venue C',1,'show',490,590]
 ];
 for(const [id,date,venue,stock,action,phonePrice,bundlePrice] of specs){
  events.push({event_id:id,event_name:'QA SYNTHETIC '+id.slice(-1),event_date:date,venue,status:'open',active_on_web:true});
  web_ready.push({event_id:id,event_name:'QA SYNTHETIC '+id.slice(-1),event_date:date,venue,available_phone_count:stock,available_lens_count:1,action_for_web:action,poster_image_url:''});
  web_packages.push(
   {package_id:id+'-P',event_id:id,package_type:'phone_only',price:phonePrice,available_count:stock,package_status:stock>0?'available':'full'},
   {package_id:id+'-B',event_id:id,package_type:'phone_lens_bundle',price:bundlePrice,available_count:stock,package_status:stock>0?'available':'full'}
  );
 }
 const raw={
  ok:true,data:{generated_at:new Date().toISOString(),snapshot_source:'synthetic-private-test-only',
  fallback_reader:'synthetic-private-test-only',events,web_ready,web_packages,
  bookings:[{event_id:specs[0][0],booking_id:'SYNTHETIC_BOOKING_DO_NOT_EXPOSE',
     booking_status:'confirmed',customer_name:'SYNTHETIC_CUSTOMER_DO_NOT_EXPOSE',customer_phone:'0980000000',amount_received:9999}],
  visibility_locks:specs.map(s=>({event_id:s[0],lock_state:'SEEN_CORE'}))}
 };
 const projected=Projection.project(raw);
 const bytes=JSON.stringify(projected);
 for(const sentinel of ['SYNTHETIC_CUSTOMER_DO_NOT_EXPOSE','SYNTHETIC_BOOKING_DO_NOT_EXPOSE','0980000000','amount_received']){
  assert.ok(!bytes.includes(sentinel),'raw private field projected: '+sentinel);
 }
 return projected;
}

async function main(){
 const commit=String(process.env.GITHUB_SHA||'').trim();
 assert.match(commit,/^[0-9a-f]{40}$/,'exact Git SHA required');
 const sources={};
 for(const file of sourcePaths)sources[file]=sha(fs.readFileSync(path.join(root,file)));
 fs.mkdirSync(target,{recursive:true});
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url||'/', 'http://127.0.0.1');
  const send=(status,body,type)=>{
   res.writeHead(status,{
    'Content-Type':type||'application/json; charset=utf-8',
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
    'X-Robots-Tag':'noindex,nofollow,noarchive',
    'Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; img-src https: data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    'X-KK-Ops-Data-Class':'synthetic-loopback-only'
   });
   res.end(body);
  };
  if(req.method!=='GET'){send(405,JSON.stringify({error:'TEST_READ_ONLY'}));return;}
  if(url.pathname==='/api/kk-admin-auth'){send(200,JSON.stringify({authenticated:true,source:'synthetic-loopback-only'}));return;}
  if(url.pathname==='/api/kk-admin'&&url.searchParams.get('action')==='operationsSnapshot'){
   send(200,JSON.stringify(fixture()));return;
  }
  const file={
   '/admin/operations-dashboard.html':['admin/operations-dashboard.html','text/html; charset=utf-8'],
   '/admin/operations-dashboard.css':['admin/operations-dashboard.css','text/css; charset=utf-8'],
   '/admin/operations-dashboard.js':['admin/operations-dashboard.js','application/javascript; charset=utf-8']
  }[url.pathname];
  if(!file){send(404,JSON.stringify({error:'NOT_FOUND'}));return;}
  send(200,fs.readFileSync(path.join(root,file[0])),file[1]);
 });
 await new Promise((resolve,reject)=>{
  server.once('error',reject);server.listen(0,'127.0.0.1',resolve);
 });
 let browser;
 try{
  const address='http://127.0.0.1:'+server.address().port+'/admin/operations-dashboard.html';
  browser=await chromium.launch({headless:true});
  const packets=[];
  for(let i=0;i<widths.length;i++){
   const width=widths[i],height=heights[i];
   const context=await browser.newContext({
    viewport:{width,height},deviceScaleFactor:1,locale:'th-TH',timezoneId:'Asia/Bangkok',
    reducedMotion:'reduce',serviceWorkers:'block'
   });
   const page=await context.newPage();
   const errors=[];
   page.on('pageerror',err=>errors.push(String(err.message||err)));
   page.on('request',req=>{
    const u=new URL(req.url());
    if(u.hostname!=='127.0.0.1')errors.push('EXTERNAL_BROWSER_REQUEST_BLOCKED');
   });
   await page.goto(address,{waitUntil:'load',timeout:30000});
   await page.locator('#app').waitFor({state:'visible',timeout:12000});
   await page.waitForFunction(()=>document.querySelectorAll('#rows tr').length===3,{timeout:12000});
   const metrics=await page.evaluate(()=>{
    const visible=el=>!!(el.getClientRects().length) && getComputedStyle(el).visibility!=='hidden';
    const targets=Array.from(document.querySelectorAll('a,button,.filters input,.filters select'))
     .filter(visible).map(el=>{
      const r=el.getBoundingClientRect();
      return {id:String(el.id||el.textContent||el.getAttribute('aria-label')||el.tagName).trim().slice(0,80),
       width:Math.round(r.width),height:Math.round(r.height)};
     });
    const forms=Array.from(document.querySelectorAll('.filters input,.filters select')).filter(visible);
    const fontSizes=forms.map(el=>parseFloat(getComputedStyle(el).fontSize)).filter(Number.isFinite);
    const bodyText=String(document.body.innerText||'');
    return {
     viewport_width_px:window.innerWidth,
     viewport_height_px:window.innerHeight,
     document_scroll_width_px:document.documentElement.scrollWidth,
     content_width_px:document.documentElement.clientWidth,
     min_form_control_font_px:fontSizes.length?Math.min(...fontSizes):0,
     tap_targets:targets,
     raw_i18n_key_count:(bodyText.match(/\b(?:journey|proof|events|filter|footer|modal|faq)_[a-z0-9_]+\b/gi)||[]).length
    };
   });
   assert.equal(metrics.viewport_width_px,width);
   assert.ok(metrics.document_scroll_width_px<=width+1,'horizontal page overflow '+width);
   assert.ok(metrics.min_form_control_font_px>=16,'small form font '+width);
   assert.ok(metrics.tap_targets.length>=8,'missing measured controls '+width);
   assert.equal(metrics.raw_i18n_key_count,0,'untranslated keys '+width);
   assert.equal(errors.length,0,'browser errors '+width+': '+errors.join(','));
   const content=await page.locator('#rows').innerText();
   assert.match(content,/QA SYNTHETIC A/);
   assert.match(content,/QA SYNTHETIC B/);
   assert.match(content,/QA SYNTHETIC C/);
   for(const privateMarker of ['SYNTHETIC_CUSTOMER_DO_NOT_EXPOSE','SYNTHETIC_BOOKING_DO_NOT_EXPOSE','0980000000']){
    assert.ok(!content.includes(privateMarker),'raw private marker in DOM');
   }
   const screenshotName='admin_post_'+width+'.png';
   const png=await page.screenshot({type:'png',animations:'disabled',fullPage:false});
   fs.writeFileSync(path.join(target,screenshotName),png);
   packets.push({
    surface:'KK Phone Rental internal Admin Operations Dashboard V4, isolated synthetic fixture',
    platform:width<=768?'ios-contract-via-chromium':'chromium',
    viewport:{width,height},metrics,
    screenshot_artifacts:[{name:screenshotName,sha256:sha(png)}],
    screenshot_observations:[],
    evidence_type:'CHROMIUM_LOOPBACK_SYNTHETIC_NO_CUSTOMER_PII'
   });
   console.log('CAPTURED '+width+'x'+height+' DOM rows=3 scroll='+metrics.document_scroll_width_px+' sha='+sha(png));
   await context.close();
  }
  const evidence={
   capture_kind:'post-implementation Chromium browser evidence captured on exact GitHub runner HEAD; loopback synthetic only',
   browser:'Playwright Chromium',
   source_commit_sha:commit,
   source_sha256:sources,
   packets
  };
  fs.writeFileSync(evidenceFile,JSON.stringify(evidence,null,2)+'\n');
  console.log('EVIDENCE_FILE '+evidenceFile+' sha256='+sha(fs.readFileSync(evidenceFile)));
 }finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
}
main().catch(err=>{console.error('ADMIN_OPS_BROWSER_CAPTURE_FAILED: '+String(err?.message||err));process.exitCode=1});
