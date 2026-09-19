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
  assert.match(source,/firstPoster=vis\[0\].*imgThumb\[0\]/);
  assert.match(source,/if\(idx<6\)[\s\S]*setImgFallback\(img,imgCandidates,\{timeoutMs:4000\}\)/);
  assert.match(source,/setImgFallbackWhenVisible\(img,imgCandidates,\{timeoutMs:6000,rootMargin:"600px 0px"\}\)/);
});
