'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','script.js'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'..','assets','kk-storefront-v5.css'),'utf8');
function extract(a,b){const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,'missing segment '+a);return source.slice(i,j)}
function setup(){
 const v={currentLang:'th',currentSearch:'',currentMonth:'all',currentFilter:'all',
 LINE_OA:'https://line.me/R/oaMessage/%40827blnmo/?',
 tr:(k,p={})=>({card_waitlist:'FULL',card_price_from:'from '+p.price,card_price_ask:'ask',line_event:'Event',line_date:'Date',line_venue:'Venue',line_price:'Price',line_pickup:'Pickup',line_nickname:'Nickname',line_phone:'Phone'}[k]||k),
 toNum:n=>Number(String(n||'').replace(/[^0-9.-]/g,''))||0,numberLocale:()=> 'en-US',
 lineVal:x=>String(x||'-').trim(),fmtPriceLine:n=>Number(n).toLocaleString('en-US')+' THB',
 availCnt:e=>(e.packages||[]).some(p=>p.avail)?1:0,
 isFuture:c=>c.rawDate>='2026-10-13',concertTs:c=>Date.parse(c.rawDate),monthKey:c=>c.rawDate.slice(0,7)};
 vm.createContext(v);
 for(const [a,b] of [
 ['function startingPriceFor','function hasBrowseFilters'],
 ['function normalizeSearchText','function emptyMsg'],
 ['function isVisibleWebAction','async function loadData'],
 ['function buildBookingMsg','function buildWaitlistMsg']
 ])vm.runInContext(extract(a,b),v);
 return v;
}
test('advertised starting price only includes bookable packages',()=>{
 const v=setup(),c={packages:[{price:590,avail:false},{price:990,avail:true}]};
 assert.equal(v.startingPriceFor(c),990);assert.equal(v.cardPriceText(c),'from 990');
});
test('full card shows waitlist, inquiry-only does not invent price',()=>{
 const v=setup();
 assert.equal(v.cardPriceText({packages:[{price:590,avail:false}]}),'FULL');
 assert.equal(v.cardPriceText({packages:[{price:0,avail:true,inquiryOnly:true}]}),'ask');
});
test('Thai LINE deep link includes real package/event/date/price without sending message',()=>{
 const v=setup(),c={name:'LYKN REFLEXION',date:'24/10/2026',venue:'IMPACT Arena'},p={model:'Phone + Lens',price:1290};
 const msg=v.buildBookingMsg(c,p),url=v.getBookingUrl(c,p);
 assert.match(msg,/สวัสดีค่ะ สนใจเช่าแพ็กเกจนี้ค่ะ/);assert.match(msg,/LYKN REFLEXION/);
 assert.match(msg,/1,290 THB/);assert.match(msg,/24\/10\/2026/);
 assert.match(url,/^https:\/\/line\.me\/R\/oaMessage\/%40827blnmo\/\?/);
 assert.equal(decodeURIComponent(url.split('?').slice(1).join('?')),msg);
});
test('English LINE message translates intro and model label',()=>{
 const v=setup();v.currentLang='en';
 const msg=v.buildBookingMsg({name:'NCT 127',date:'31/10/2026',venue:'Stadium'},{model:'Lens Only',price:390});
 assert.match(msg,/Hello, I'd like to rent this package/);assert.match(msg,/Package \/ model: Lens Only/);
 assert.doesNotMatch(msg,/สนใจเช่ามือถือ|📱 รุ่น/);
});
test('hidden/unknown web actions cannot be published',()=>{
 const v=setup();
 for(const x of ['show','show_full',' SHOW '])assert.equal(v.isVisibleWebAction(x),true);
 for(const x of ['hide','','pending','full',null])assert.equal(v.isVisibleWebAction(x),false);
});
test('case-insensitive event search, venue search and status filter',()=>{
 const v=setup();v.currentLang='en';
 const data=[{name:'LYKN',venue:'IMPACT Arena',date:'24/10',rawDate:'2026-10-24',webNote:'',packages:[{avail:true}]},
 {name:'NCT',venue:'Thammasat',date:'31/10',rawDate:'2026-10-31',webNote:'',packages:[{avail:false}]},
 {name:'LYKN Old',venue:'Bangkok',date:'01/09',rawDate:'2026-09-01',webNote:'',packages:[{avail:true}]}];
 v.currentSearch='lykn';assert.deepEqual(Array.from(v.filtered(data),x=>x.name),['LYKN']);
 v.currentSearch='THAMMASAT';v.currentFilter='full';
 assert.deepEqual(Array.from(v.filtered(data),x=>x.name),['NCT']);
 v.currentMonth='2026-11';assert.equal(v.filtered(data).length,0);
});
test('TH/EN, dark/light, mobile/desktop and search controls exist',()=>{
 for(const s of ['id="theme-toggle"','data-lang="th"','data-lang="en"','id="event-search"','id="month-filter-select"','data-filter="available"'])assert.ok(html.includes(s),s);
 assert.match(source,/function applyTheme\(theme,options\)/);
 assert.match(source,/function applyLanguage\(lang,options\)/);
 assert.match(css,/html\[data-theme="dark"\]/);
 assert.match(css,/@media\s*\(max-width:\s*700px\)/);
 assert.match(css,/@media\s*\(min-width:\s*701px\)/);
});
test('temporary image and inventory clamps remain intact',()=>{
 for(const s of ['function isKKTemporaryBrandArtwork','poster-temporary-brand-label','function eventSummaryFallback','function setImgFallback'])assert.ok(source.includes(s),s);
 assert.match(source,/p\.avail = p\.avail && phoneCnt>0/);
 assert.match(source,/p\.avail = p\.avail && lensCnt>0/);
 assert.match(source,/p\.avail = p\.avail && phoneCnt>0 && lensCnt>0/);
});
test('latest storefront JavaScript cache key is bumped for mobile Safari/CDN',()=>{
 assert.match(html,/script\.js\?v=storefront-p0-price-line-th-en-20261013/);
});
