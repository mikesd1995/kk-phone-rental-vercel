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
function renderFixture(concerts,lang='th',availability=1){
 const root=element('main'),head=element('head');
 let browseCount=-1,shown=null,posterFailure=null;
 const context={
   document:{getElementById:id=>id==='content'?root:null,createElement:element,head},
   renderMonthSelect(){},filtered:list=>list,updateBrowseChrome:n=>{browseCount=n;},
   renderEmpty:()=>{},emptyMsg:()=>'',tr:(key,params)=>params?.venue||key,
   browseLimit:12,PRELOADED_IMAGES:{},availCnt:()=>availability,availTextFor:()=> availability?'1 เครื่อง':'เต็ม',
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
 return {root,head,card:root.children[0]?.children[0],count:browseCount,countNow:()=>browseCount,shown:()=>shown,posterFailure:()=>posterFailure};
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

test('LE7EL temporary artist profile is clearly labeled only for audited exact event and URL',()=>{
 const photo='https://www.thai2music.com/uploads/artists/photo_cover/cover_1035_1762919037.jpg';
 const card={...event,id:'EVT-20261015-LE7EL-1ST-DEBUT-ANNIVERSARY',
   name:'LE7EL — 1st Debut Anniversary',date:'2026-10-15',img:photo,rawPoster:photo,imgThumb:[photo]};
 const thai=renderFixture([card]);
 assert.equal(thai.card.dataset.posterStatus,'temporary');
 assert.equal(find(thai.card,'poster-temporary-brand-label').textContent,'ภาพประกอบชั่วคราว');
 thai.card.onclick();assert.equal(thai.shown(),card,'poster label must not affect actual event booking identity');
 const english=renderFixture([card],'en');
 assert.equal(find(english.card,'poster-temporary-brand-label').textContent,'TEMPORARY IMAGE');
 const otherEvent=renderFixture([{...card,id:'EVT-OTHER'}]);
 assert.equal(otherEvent.card.dataset.posterStatus,undefined,'photo URL alone must not label another event');
 const correctedSource=renderFixture([{...card,img:'https://official.example/le7el-oct15.jpg',
   rawPoster:'https://official.example/le7el-oct15.jpg',imgThumb:['https://official.example/le7el-oct15.jpg']}]);
 assert.equal(correctedSource.card.dataset.posterStatus,undefined,'exact event can transition to official art without stale temporary label');
});

test('image-less sold-out event remains waitlist-only; fallback must never invent inventory',()=>{
 const sold=renderFixture([{...event,phoneCnt:0,lensCnt:0}], 'th',0);
 assert.equal(sold.count,1);
 assert.match(sold.card.className,/waitlist-card/);
 assert.match(find(sold.card,'status-badge').className,/full/);
 assert.equal(sold.card.dataset.posterMissing,'1');
 sold.card.onclick();
 assert.equal(sold.shown().id,event.id);
 assert.equal(sold.shown().phoneCnt,0);
});
test('broken official poster preserves sold-out status and exact event identity',()=>{
 const sold=renderFixture([{...event,img:'https://official.example/poster.jpg',imgThumb:['https://official.example/poster.jpg'],rawPoster:'https://official.example/poster.jpg',phoneCnt:0}], 'en',0);
 sold.posterFailure()();
 assert.match(sold.card.className,/waitlist-card/);
 assert.equal(sold.card.dataset.eventId,event.id);
 assert.equal(find(sold.card,'poster-placeholder-title').textContent,event.name);
 assert.equal(sold.root.children[0].children.length,1);
});

test('one failed poster does not reduce global result count to first page size',()=>{
 const events=Array.from({length:13},(_,i)=>({...event,id:'EVT-PAGINATION-'+i,name:'Valid Event '+i,img:'https://official.example/'+i+'.jpg',imgThumb:['https://official.example/'+i+'.jpg'],rawPoster:'https://official.example/'+i+'.jpg'}));
 const r=renderFixture(events);
 assert.equal(r.countNow(),13,'all eligible results counted before poster fails');
 assert.equal(r.root.children[0].children.length,12,'one page contains 12 cards');
 r.posterFailure()();
 assert.equal(r.countNow(),13,'image delivery failure must not corrupt the total count');
 assert.equal(r.root.children[0].children.length,12,'poster failure must not remove the card');
});
