'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../script.js'),'utf8');
function actualFunction(name,endMarker){
 const start=source.indexOf('function '+name+'(');
 const end=source.indexOf(endMarker,start);
 assert.ok(start>=0&&end>start,'missing real source for '+name);
 return source.slice(start,end);
}
function element(tag){
 const e={tag,children:[],dataset:{},attributes:{},style:{properties:{},
   setProperty(k,v){this.properties[k]=v;},removeProperty(k){delete this.properties[k];}},
   classList:{add(){},remove(){}},textContent:'',className:'',parentElement:null,
   appendChild(child){child.parentElement=this;this.children.push(child);return child;},
   replaceChild(next,old){const i=this.children.indexOf(old);assert.ok(i>=0);next.parentElement=this;old.parentElement=null;this.children[i]=next;return old;},
   removeChild(child){const i=this.children.indexOf(child);assert.ok(i>=0);this.children.splice(i,1);child.parentElement=null;return child;},
   setAttribute(k,v){this.attributes[k]=String(v);},
   addEventListener(){},
 };
 return e;
}
function find(node,klass){
 if(String(node.className||'').split(' ').includes(klass))return node;
 for(const item of node.children||[]){const result=find(item,klass);if(result)return result;}
 return null;
}
function renderFixture(concerts,lang='th'){
 const root=element('main'),head=element('head');
 let browseCount=-1,shown=null,posterFailure=null;
 const context={
   document:{getElementById:id=>id==='content'?root:null,createElement:element,head},
   renderMonthSelect(){},filtered:list=>list,updateBrowseChrome:n=>{browseCount=n;},
   renderEmpty:()=>{},emptyMsg:()=>'',tr:(key,params)=>params?.venue||key,
   browseLimit:12,PRELOADED_IMAGES:{},availCnt:()=>1,availTextFor:()=> '1 เครื่อง',
   isSoon:()=>false,getBadgeText:()=> 'ว่าง',currentLang:lang,
   eventArtworkAlt:(name,temporary)=>temporary?'ภาพประกอบชั่วคราว '+name:'โปสเตอร์ '+name,
   cardPriceText:()=> '690 / 890',showModal:c=>{shown=c;},
   setImgFallback(_img,_choices,options){posterFailure=options.onExhausted;},
   setImgFallbackWhenVisible(_img,_choices,options){posterFailure=options.onExhausted;},
   BROWSE_PAGE_SIZE:12,track(){},String,JSON,Number
 };
 vm.createContext(context);
 vm.runInContext(
   actualFunction('isKKTemporaryBrandArtwork','function getDriveId')+
   actualFunction('renderConcerts','// ─── Modal'),context
 );
 context.renderConcerts(concerts);
 return {root,head,card:root.children[0]?.children[0],count:browseCount,shown:()=>shown,posterFailure:()=>posterFailure};
}
const event={
 id:'EVT-TEST-VERIFIED',name:'Exact Verified Event',date:'2026-11-14',venue:'Bangkok Test Venue',
 img:'',imgThumb:[],rawPoster:'',action:'show',packages:[],phoneCnt:1,lensCnt:1
};
test('real renderConcerts displays an image-less valid event with KK-owned temporary image and exact metadata',()=>{
 const r=renderFixture([event]);
 assert.equal(r.count,1);
 assert.equal(r.root.children[0].children.length,1);
 assert.equal(r.card.dataset.posterMissing,'1');
 assert.equal(r.card.dataset.posterStatus,'temporary');
 const fallback=find(r.card,'poster-placeholder-event');
 assert.ok(fallback,'real fallback DOM must exist');
 assert.equal(find(fallback,'poster-placeholder-brand-art').src,'/assets/kk-brand-hero-final-20260920.png');
 assert.equal(find(fallback,'poster-placeholder-brand-art').alt,'');
 assert.equal(find(fallback,'poster-placeholder-title').textContent,event.name);
 assert.match(find(fallback,'poster-placeholder-meta').textContent,/2026-11-14.*Bangkok Test Venue/);
 assert.equal(find(r.card,'pi-price').textContent,'690 / 890');
 r.card.onclick();assert.equal(r.shown(),event,'booking card still routes to the exact event');
});
test('failed verified poster degrades into temporary art without removing its event card',()=>{
 const r=renderFixture([{...event,img:'https://official.example/poster.jpg',imgThumb:['https://official.example/poster.jpg'],rawPoster:'https://official.example/poster.jpg'}]);
 assert.equal(r.card.dataset.posterMissing,undefined);
 assert.equal(r.card.dataset.posterStatus,undefined);
 assert.equal(typeof r.posterFailure(),'function');
 r.posterFailure()();
 assert.equal(r.root.children[0].children.length,1);
 assert.equal(r.card.dataset.posterFailed,'1');
 assert.equal(r.card.dataset.posterFallback,'event-summary');
 assert.equal(find(r.card,'poster-placeholder-title').textContent,event.name);
});
test('known KK-owned temporary art receives a visible label; other event poster is not mislabeled',()=>{
 const branded=renderFixture([{...event,img:'https://kk-phone-rental.vercel.app/assets/kk-brand-hero-final-20260920.png',rawPoster:'https://kk-phone-rental.vercel.app/assets/kk-brand-hero-final-20260920.png',imgThumb:['https://kk-phone-rental.vercel.app/assets/kk-brand-hero-final-20260920.png']}]);
 assert.equal(branded.card.dataset.posterStatus,'temporary');
 assert.equal(find(branded.card,'poster-temporary-brand-label').textContent,'ภาพประกอบชั่วคราว');
 const english=renderFixture([{...event,img:'https://kk-phone-rental.vercel.app/assets/kk-brand-hero-final-20260920.png',rawPoster:'https://kk-phone-rental.vercel.app/assets/kk-brand-hero-final-20260920.png'}],'en');
 assert.equal(find(english.card,'poster-temporary-brand-label').textContent,'TEMPORARY IMAGE');
 const official=renderFixture([{...event,img:'https://official.example/event.jpg',rawPoster:'https://official.example/event.jpg'}]);
 assert.equal(official.card.dataset.posterStatus,undefined);
 assert.equal(find(official.card,'poster-temporary-brand-label'),null);
});
