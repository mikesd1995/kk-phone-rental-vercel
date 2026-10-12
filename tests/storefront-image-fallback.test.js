'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

const source=fs.readFileSync(require.resolve('../script.js'),'utf8');
function extractFunction(name,nextMarker){
  const start=source.indexOf('function '+name+'(');
  assert.notEqual(start,-1,'missing '+name);
  const end=source.indexOf(nextMarker,start);
  assert.notEqual(end,-1,'missing next marker after '+name);
  return source.slice(start,end);
}
let observerInstance=null;
class FakeIntersectionObserver{
  constructor(cb,options){this.cb=cb;this.options=options;this.disconnected=false;observerInstance=this;}
  observe(img){this.img=img;}
  disconnect(){this.disconnected=true;}
  trigger(isIntersecting){this.cb([{isIntersecting,intersectionRatio:isIntersecting?1:0,target:this.img}]);}
}
const sandbox={setTimeout,clearTimeout,encodeURIComponent,console,IntersectionObserver:FakeIntersectionObserver,document:{
  createElement(){return {className:'',innerHTML:''};}
}};
vm.createContext(sandbox);
vm.runInContext(
  extractFunction('getDriveId','function getImgCandidates')+
  extractFunction('getImgCandidates','function setImgFallbackWhenVisible')+
  extractFunction('setImgFallbackWhenVisible','function setImgFallback(img')+
  extractFunction('setImgFallback','\n\n// ─── CSV'),
  sandbox
);

function fakeImg(){
  return {
    id:'',style:{},src:'',onload:null,onerror:null,parentElement:null,
    removed:false,dataset:{},
    remove(){this.removed=true;}
  };
}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

test('Drive poster candidates keep the proven thumbnail path first and retain two fallbacks',()=>{
  const urls=sandbox.getImgCandidates('https://drive.google.com/thumbnail?id=12345678901234567890&sz=w1200','thumb');
  assert.equal(urls.length,3);
  assert.match(urls[0],/^https:\/\/drive\.google\.com\/thumbnail/);
  assert.match(urls[1],/^https:\/\/lh3\.googleusercontent\.com\/d\//);
  assert.match(urls[2],/^https:\/\/drive\.google\.com\/uc\?/);
});

test('image loader advances to next candidate on explicit error',()=>{
  const img=fakeImg();
  sandbox.setImgFallback(img,['a','b'],{timeoutMs:1000});
  assert.equal(img.src,'a');
  img.onerror();
  assert.equal(img.src,'b');
  img._kkCancelImageFallback();
});

test('image loader advances when a candidate hangs without onerror',async()=>{
  const img=fakeImg();
  sandbox.setImgFallback(img,['slow','fallback'],{timeoutMs:1000});
  // timeout has a 1000 ms safety floor
  assert.equal(img.src,'slow');
  await sleep(1050);
  assert.equal(img.src,'fallback');
  img._kkCancelImageFallback();
});

test('successful load cancels timeout failover',async()=>{
  const img=fakeImg();
  sandbox.setImgFallback(img,['good','should-not-run'],{timeoutMs:1000});
  img.onload();
  await sleep(1050);
  assert.equal(img.src,'good');
});

test('reusing one image element cancels the previous fallback chain',async()=>{
  const img=fakeImg();
  sandbox.setImgFallback(img,['old-slow','old-fallback'],{timeoutMs:1000});
  sandbox.setImgFallback(img,['new-good','new-fallback'],{timeoutMs:2000});
  assert.equal(img.src,'new-good');
  await sleep(1050);
  assert.equal(img.src,'new-good');
  img._kkCancelImageFallback();
});

test('lazy fallback does not start timeout chain until image approaches viewport',async()=>{
  const img=fakeImg();
  observerInstance=null;
  sandbox.setImgFallbackWhenVisible(img,['lazy-a','lazy-b'],{timeoutMs:1000,rootMargin:'600px 0px'});
  assert.ok(observerInstance);
  assert.equal(img.src,'');
  await sleep(1050);
  assert.equal(img.src,'');
  observerInstance.trigger(true);
  assert.equal(img.src,'lazy-a');
  await sleep(1050);
  assert.equal(img.src,'lazy-b');
  img._kkCancelImageFallback();
});

test('storefront renders first six posters eagerly and defers timeout chain for later cards',()=>{
  assert.match(source,/img\.loading=idx<6\?"eager":"lazy"/);
  assert.match(source,/firstPoster=page\[0\].*imgThumb\[0\]/);
  assert.match(source,/if\(idx<6\)[\s\S]*setImgFallback\(img,imgCandidates,\{timeoutMs:4000,onExhausted:posterFailure\}\)/);
  assert.match(source,/setImgFallbackWhenVisible\(img,imgCandidates,\{timeoutMs:6000,rootMargin:"600px 0px",onExhausted:posterFailure\}\)/);
});


test('image loader can fail closed through an onExhausted hook',()=>{
  const img=fakeImg();
  let calls=0;
  sandbox.setImgFallback(img,['dead'],{timeoutMs:1000,onExhausted(){calls++;}});
  assert.equal(img.src,'dead');
  img.onerror();
  assert.equal(calls,1);
  assert.equal(img.removed,false);
});

test('storefront keeps valid events visible when poster delivery is exhausted',()=>{
  assert.doesNotMatch(source,/vis=vis\.filter\(function\(c\)\{ return !!\(c&&c\.img/);
  assert.match(source,/onExhausted:posterFailure/);
  assert.match(source,/card\.dataset\.posterFailed="1"/);
  assert.match(source,/img\.parentElement\.replaceChild\(eventSummaryFallback\(\),img\)/);
  assert.match(source,/imgWrap\.appendChild\(eventSummaryFallback\(\)\)/);
  assert.doesNotMatch(source,/if\(card\.parentElement\) card\.remove\(\)/);
});


test('fallback preserves a poster that already has decoded pixels before timeout exhaustion',()=>{
  assert.match(source,/function imageHasPixels\(\)/);
  assert.match(source,/img\.complete && Number\(img\.naturalWidth\|\|0\)>0/);
  assert.match(source,/if\(imageHasPixels\(\)\)\{ settleLoaded\(\); return; \}/);
  assert.match(source,/Safari\/iOS can paint the image while load-event delivery is delayed/);
});


test('canonical poster_image_url wins over emergency storefront overrides',()=>{
  assert.match(source,/var rawPoster\s*= String\(r\.poster_image_url\|\|""\)\.trim\(\) \|\| storefrontPosterOverride\(r\);/);
  assert.doesNotMatch(source,/var rawPoster\s*= storefrontPosterOverride\(r\) \|\| String\(r\.poster_image_url\|\|""\)\.trim\(\);/);
});


test('canonical poster remains first while verified emergency poster is retained as delivery fallback',()=>{
  assert.match(source,/var rawPoster\s*= String\(r\.poster_image_url\|\|""\)\.trim\(\) \|\| storefrontPosterOverride\(r\);/);
  assert.match(source,/var emergencyPoster = storefrontPosterOverride\(r\);/);
  assert.match(source,/if\(emergencyPoster && emergencyPoster!==rawPoster\)/);
  assert.match(source,/posterThumbCandidates\.push\(url\)/);
  assert.match(source,/posterFullCandidates\.push\(url\)/);
  assert.match(source,/imgThumb:\s+posterThumbCandidates/);
  assert.match(source,/imgFull:\s+posterFullCandidates/);
});

test('Nineentertain keeps the local verified poster as fallback behind canonical SOT',()=>{
  assert.match(source,/nineentertain-24th-anniversary-charity-concert-2026-09-30\.jpg/);
  assert.match(source,/canonical first; verified emergency poster is delivery fallback only/);
});


test('poster exhaustion renders an exact-event summary fallback instead of a generic image substitute',()=>{
  assert.match(source,/card\.dataset\.posterFallback="event-summary"/);
  assert.match(source,/poster-placeholder poster-placeholder-event/);
  assert.match(source,/title\.textContent=String\(c\.name\|\|tr\("no_image"\)\)/);
  assert.match(source,/meta\.textContent=\[String\(c\.date\|\|""\).*String\(c\.venue\|\|""\)/s);
  assert.doesNotMatch(source,/storefrontPosterOverride\(c\).*posterFailure/);
});

test('KHOM KHLANG keeps a public owner copy as fallback behind the private canonical Drive poster',()=>{
  assert.match(source,/dateKey==="2026-10-05"/);
  assert.match(source,/name\.indexOf\("khom khlang"\)>=0/);
  assert.match(source,/1f995RLhvIO-aSJb6Hu12lg8BBUgmMAYC/);
  assert.match(source,/canonical sheet poster points to an[\s\S]*owner-private Drive file/);
});



test('missing image alone never hides a date/bookable event card',()=>{
  assert.match(source,/var vis=filtered\(concerts\);/);
  assert.doesNotMatch(source,/vis=vis\.filter\(function\(c\)\{ return !!\(c&&c\.img/);
  assert.match(source,/card\.dataset\.posterMissing="1"/);
  assert.match(source,/imgWrap\.appendChild\(eventSummaryFallback\(\)\)/);
});

test('temporary artwork is clearly marked and derived from the exact event not an unrelated poster',()=>{
  assert.match(source,/function eventSummaryFallback\(\)/);
  assert.match(source,/card\.dataset\.posterFallback="event-summary"/);
  assert.match(source,/card\.dataset\.posterStatus="temporary"/);
  assert.match(source,/currentLang==="en"\?"TEMPORARY EVENT ART":"ภาพประกอบชั่วคราว"/);
  assert.match(source,/title\.textContent=String\(c\.name\|\|tr\("no_image"\)\)/);
  assert.match(source,/meta\.textContent=\[String\(c\.date\|\|""\).*String\(c\.venue\|\|""\)/s);
});

test('show-only gate remains upstream and fallback does not promote owner-hidden events',()=>{
  assert.match(source,/return isVisibleWebAction\(r\.action_for_web\)/);
  assert.match(source,/var vis=filtered\(concerts\);/);
  assert.match(source,/var rawPoster\s*=\s*String\(r\.poster_image_url\|\|""\)\.trim\(\)\s*\|\|\s*storefrontPosterOverride\(r\);/);
});

test('script cache key changes when temporary artwork becomes first-class fallback',()=>{
  const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
  assert.match(html,/script\.js\?v=storefront-temporary-brand-flag-20261012/);
});

test('a loaded KK-owned brand image is visibly marked temporary; official event artwork is not',()=>{
  const css=fs.readFileSync(require.resolve('../assets/kk-storefront-v5.css'),'utf8');
  assert.match(source,/function isKKTemporaryBrandArtwork\(url\)/);
  assert.match(source,/kk-brand-hero-final-20260920\.png/);
  assert.match(source,/var temporaryBrandArtwork=isKKTemporaryBrandArtwork\(c\.rawPoster\|\|c\.img\)/);
  assert.match(source,/if\(temporaryBrandArtwork\)\{/);
  assert.match(source,/card\.dataset\.posterStatus="temporary"/);
  assert.match(source,/tempIndicator\.textContent=currentLang==="en"\?"TEMPORARY IMAGE":"ภาพประกอบชั่วคราว"/);
  assert.match(css,/\.poster-img-wrap \.poster-temporary-brand-label/);
  assert.match(source,/var rows=dedupeWebRowsByEventId\(webRows\)\.filter/);
});

test('temporary-brand detector requires the exact first-party artwork URL',()=>{
  const isolated={};
  vm.createContext(isolated);
  vm.runInContext(extractFunction('isKKTemporaryBrandArtwork','function getDriveId'),isolated);
  const valid='https://kk-phone-rental.vercel.app/assets/kk-brand-hero-final-20260920.png';
  assert.equal(isolated.isKKTemporaryBrandArtwork(valid),true);
  assert.equal(isolated.isKKTemporaryBrandArtwork(valid+'?v=12'),true);
  assert.equal(isolated.isKKTemporaryBrandArtwork('https://example.com/assets/kk-brand-hero-final-20260920.png'),false);
  assert.equal(isolated.isKKTemporaryBrandArtwork('https://kk-phone-rental.vercel.app/assets/actual-event-poster.jpg'),false);
});

// Exercise the real allow-list implementation, rather than just matching source
// syntax. These are the only action_for_web states in the verified Core feed.
test('only canonical show/show_full actions are eligible, even with a missing poster',()=>{
  const gate=extractFunction('isVisibleWebAction','async function loadData');
  const isolated={}; vm.createContext(isolated); vm.runInContext(gate,isolated);
  for(const action of ['show','show_full','SHOW',' Show_Full ']){
    assert.equal(isolated.isVisibleWebAction(action),true,action);
  }
  for(const action of ['hide','owner_hidden','deleted','archived','pending','waitlist','show_full_pending','',null,undefined]){
    assert.equal(isolated.isVisibleWebAction(action),false,String(action));
  }
  assert.match(source,/dedupeWebRowsByEventId\(webRows\)\.filter\(function\(r\)\{ return isVisibleWebAction\(r\.action_for_web\); \}\)/);
});
