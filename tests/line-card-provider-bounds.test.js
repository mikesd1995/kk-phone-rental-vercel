'use strict';
// Zero-network contract tests for the customer LINE Flex builder. They do not
// assert that a message has been delivered to a real LINE account.
const test=require('node:test');
const assert=require('node:assert/strict');
const {buildBookingFlex,httpsImageUrl}=require('../server/line-booking-flex');

const packages=[
  ['vivo X300 Pro','590฿'],
  ['vivo X300 Pro + Lens 200mm','790฿'],
  ['vivo X500 Pro Max','1,090฿'],
  ['vivo X500 Pro Max + Lens 200mm','1,290฿'],
  ['vivo X500 Pro Max + Lens 400mm','1,590฿']
];

for(const [name,price] of packages){
 test('customer Pending Flex renders canonical package without falsely confirming: '+name,()=>{
  const flex=buildBookingFlex({
   event:{event_name:'STAGING MOCK EVENT',event_date:'2026-12-18',venue:'SANDBOX TEST HALL'},
   package:{package_name:name,price_display:price},
   customer:{nickname:'SYNTHETIC TESTER',pickup_time:'13:00'},
   booking:{booking_id:'BK-STAGING-01'}
  });
  const rendered=JSON.stringify(flex);
  assert.equal(flex.type,'flex');assert.equal(flex.contents.type,'bubble');
  assert.match(rendered,/Booking ID  BK-STAGING-01/);
  assert.ok(rendered.includes(name));assert.ok(rendered.includes(price));
  assert.match(rendered,/รอตรวจสอบคิว/);
  assert.doesNotMatch(rendered,/ยืนยันการจองสำเร็จ|TERMS_ACK_BACKEND|\bapproved\b/i);
  assert.equal(flex.contents.hero,undefined);
 });
}

test('without canonical booking readback, card must not claim recorded Pending',()=>{
 const flex=buildBookingFlex({event:{event_name:'SYNTHETIC EVENT'},
  package:{package_name:'vivo X300 Pro'}});
 const rendered=JSON.stringify(flex);
 assert.match(rendered,/ยังไม่บันทึกจอง/);
 assert.doesNotMatch(rendered,/Booking ID|ร้านได้รับคำขอเช่าแล้ว/);
});

test('untrusted and overlong poster URLs are suppressed, never cause invalid LINE hero',()=>{
 const valid='https://example.com/synthetic-poster.jpg';
 assert.equal(httpsImageUrl(valid),valid);
 for(const unsafe of ['http://example.com/x.jpg','https://user:password@example.com/x.jpg',
  'javascript:alert(1)','https://example.com/'+('a'.repeat(2050))]){
  assert.equal(httpsImageUrl(unsafe),'');
  assert.equal(buildBookingFlex({event:{poster_image_url:unsafe}}).contents.hero,undefined);
 }
});

test('hostile oversized Unicode source fields stay bounded without corrupting emoji',()=>{
 const huge='ทดสอบ🎟️📱'.repeat(8000);
 const flex=buildBookingFlex({event:{event_name:huge,event_date:huge,
  venue:huge,poster_image_url:'https://example.com/a.jpg'},
  package:{package_name:huge,price_display:huge},
  customer:{nickname:huge,pickup_time:huge},booking:{booking_id:'BK-STAGING-01'}});
 const json=JSON.stringify(flex);
 assert.ok(Buffer.byteLength(json,'utf8')<30*1024,'single Flex bubble safely below 30 KB');
 assert.ok(flex.altText.length<=400);
 for(const element of flex.contents.body.contents.filter(x=>x.type==='text')){
  assert.ok(Array.from(element.text).length<=220,'Flex text field stays within explicit source cap');
  assert.equal(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(element.text),false,'no torn Unicode surrogate');
 }
 assert.equal(flex.contents.hero.url,'https://example.com/a.jpg');
});

test('control characters in customer-facing fields cannot inject multiple card lines',()=>{
 const flex=buildBookingFlex({event:{event_name:'SYNTHETIC\r\nBooking approved',venue:'Safe\u0000 Hall'},
  package:{package_name:'vivo X500 Pro Max'}});
 assert.equal(flex.contents.body.contents[1].text,'SYNTHETIC  Booking approved');
 assert.match(JSON.stringify(flex),/Safe  Hall/);
});

test('source text replaces isolated UTF-16 surrogates without changing valid Thai or emoji',()=>{
 const raw='ไทย📱\uD800A\uDC00';
 const expected='ไทย📱\uFFFDA\uFFFD';
 const flex=buildBookingFlex({event:{event_name:raw,event_date:raw,venue:raw},
  package:{package_name:raw,price_display:raw},customer:{nickname:raw,pickup_time:raw},
  booking:{booking_id:'BK-STAGING-01'}});
 assert.equal(flex.contents.body.contents[1].text,expected);
 assert.ok(flex.altText.includes(expected));
 const texts=flex.contents.body.contents.filter(x=>x.type==='text').map(x=>x.text);
 assert.equal(texts.filter(t=>t.includes(expected)).length,7);
 assert.ok(texts.includes('Booking ID  BK-STAGING-01'));
 assert.equal(/[\uD800-\uDFFF]/u.test(flex.altText),false);
 for(const value of texts) assert.equal(/[\uD800-\uDFFF]/u.test(value),false);
});

// Use the actual storefront package builder and draft formatter, not a second
// fixture-only label implementation. Stub unrelated UI/formatting dependencies.
const fs=require('node:fs');
const vm=require('node:vm');
const Line=require('../server/line-booking-webhook')._test;
const Approval=require('../server/line-booking-owner-approval');
const EVENT_ID='EVT-SYNTHETIC-LENS-01';
const EVENT={event_id:EVENT_ID,event_name:'SYNTHETIC LENS MATRIX',
 event_date_text:'18/12/2026',venue:'SANDBOX TEST HALL',
 action_for_web:'show',booking_status_for_web:'เปิดจอง',available_phone_count:5};
const BOOKING={event_name:EVENT.event_name,event_date:EVENT.event_date_text,venue:EVENT.venue};
const MATRIX=[
 ['TPL-X300-PHONE','VIVO_X300_PRO','vivo X300 Pro','phone_only','NONE',590,'vivo X300 Pro'],
 ['TPL-X300-200','VIVO_X300_PRO','vivo X300 Pro','phone_lens_bundle','ZEISS_2_35X',790,'vivo X300 Pro + Lens 200mm'],
 ['TPL-X500-PHONE','VIVO_X500_PRO_MAX','vivo X500 Pro Max','phone_only','NONE',1090,'vivo X500 Pro Max'],
 ['TPL-X500-200','VIVO_X500_PRO_MAX','vivo X500 Pro Max','phone_lens_bundle','ZEISS_2_35X',1290,'vivo X500 Pro Max + Lens 200mm'],
 ['TPL-X500-400','VIVO_X500_PRO_MAX','vivo X500 Pro Max','phone_lens_bundle','ZEISS_400MM',1590,'vivo X500 Pro Max + Lens 400mm']
];
function syntheticRows(){
 return MATRIX.map(([id,model_group,model_display,package_type,lens_group,price],i)=>({
  package_id:EVENT_ID+'-'+id,event_id:EVENT_ID,package_type,model_group,model_display,
  lens_group,lens_display:lens_group==='NONE'?'':'SYNTHETIC OPTIC DISPLAY',
  price,available_count:1,package_status:'available',sort_order:i+1,web_note:'',
  raw_available_count:1,use_case:''
 }));
}
function csv(rows){
 if(!rows.length)return '';
 const keys=Object.keys(rows[0]);
 const esc=x=>'"'+String(x==null?'':x).replace(/"/g,'""')+'"';
 return [keys.join(','),...rows.map(r=>keys.map(k=>esc(r[k])).join(','))].join('\n');
}
function fakeCanonicalFetch(rows){
 return async url=>{
  if(String(url).includes('08_Web_Ready'))return {ok:true,status:200,text:async()=>csv([EVENT])};
  if(String(url).includes('09_Web_Packages'))return {ok:true,status:200,text:async()=>csv(rows)};
  throw Error('unexpected external fetch in offline test');
 };
}
function canonical(name,rows=syntheticRows()){
 return Line.resolveCanonicalPackage({...BOOKING,package_name:name,price_display:'1 บาท'},
   fakeCanonicalFetch(rows),{});
}
function loadStorefrontBuilders(){
 const source=fs.readFileSync(require.resolve('../script.js'),'utf8');
 function segment(start,end){
  const i=source.indexOf(start),j=source.indexOf(end,i+start.length);
  assert.ok(i>=0&&j>i,'storefront source contract: '+start);
  return source.slice(i,j);
 }
 const context={
  dedupePackageRows:rows=>rows,
  isPkgVisible:p=>!['hidden','hide'].includes(p.package_status),
  hasVal:v=>v!==undefined&&v!==null&&String(v).trim()!=='',
  toNum:v=>Number(String(v==null?'':v).replace(/,/g,''))||0,
  sanitizePublicText:v=>String(v||''),
  lineVal:v=>String(v||'').replace(/\s+/g,' ').trim()||'-',
  fmtPriceLine:v=>String(v)+' บาท',
  tr:k=>({line_event:'งาน',line_date:'วันที่',line_venue:'สถานที่',
   line_price:'ราคา',line_pickup:'เวลารับอุปกรณ์',line_nickname:'ชื่อเล่น',
   line_phone:'เบอร์โทร',ask_price:'สอบถามราคา'}[k]||k)
 };
 vm.runInNewContext(
  segment('function storefrontBundleLabel(','// Fallback from 08_Web_Ready')+'\n'+
  segment('function buildBookingMsg(','function getBookingUrl('),context);
 return context;
}

test('all five actual storefront drafts resolve exact canonical identity, price and owner card',async()=>{
 const rows=syntheticRows();
 const ui=loadStorefrontBuilders();
 const packs=ui.buildPackagesFromSheet(rows.map(r=>({...r,pkg_type:r.package_type})),
  EVENT_ID,5,3);
 assert.equal(packs.length,5);
 for(const [index,entry] of MATRIX.entries()){
  const [id,,,,,price,label]=entry;
  const pack=packs[index];
  assert.equal(pack.model,label);
  const draft=ui.buildBookingMsg({name:EVENT.event_name,date:EVENT.event_date_text,
   venue:EVENT.venue},pack);
  const parsed=Line.parseBookingText(draft);
  assert.ok(parsed,'actual LINE draft must parse');
  assert.equal(parsed.package_name,label);
  assert.equal(Line.packageLabel(rows[index]),label);
  const result=await canonical(parsed.package_name,rows);
  assert.ok(result,'must resolve exact canonical package '+label);
  assert.equal(result.template_id,id);
  assert.equal(result.package_id,EVENT_ID+'-'+id);
  assert.equal(result.package_name,label);
  assert.equal(result.price_display,price.toLocaleString('en-US')+' บาท');
  // An edited price in the incoming LINE draft is not the canonical quote.
  assert.notEqual(result.price_display,'1 บาท');
  const owner=Approval.ownerApprovalMessage({
   booking_id:'BK-SYNTHETIC-01',event_name:EVENT.event_name,
   package_name:result.package_name,price_display:result.price_display
  },{LINE_CHANNEL_SECRET:'synthetic-only-secret'});
  const client=buildBookingFlex({event:{event_name:EVENT.event_name},
   package:result,booking:{booking_id:'BK-SYNTHETIC-01'}});
  for(const card of [owner,client]){
   const rendered=JSON.stringify(card);
   assert.ok(rendered.includes(label));
   assert.ok(rendered.includes(result.price_display));
  }
 }
});

test('ambiguous legacy X500 bundle is rejected even if just one variant is bookable',async()=>{
 for(const otherState of ['available','full','hidden']){
  const rows=syntheticRows();
  rows[4].package_status=otherState;
  rows[4].available_count=otherState==='available'?1:0;
  assert.equal(await canonical('vivo X500 Pro Max + Lens',rows),null);
 }
 assert.equal(await canonical('vivo X500 Pro Max + Lens',[syntheticRows()[3]]),null);
});

test('explicit sold-out X500 400mm never falls back to 200mm or phone only',async()=>{
 const rows=syntheticRows();
 rows[4].package_status='full';rows[4].available_count=0;
 assert.equal(await canonical('vivo X500 Pro Max + Lens 400mm',rows),null);
 assert.equal((await canonical('vivo X500 Pro Max + Lens 200mm',rows)).template_id,'TPL-X500-200');
});

test('duplicate exact identities fail closed before stock filtering, including hidden duplicates',async()=>{
 const rows=syntheticRows();
 rows.push({...rows[3],package_id:EVENT_ID+'-TPL-UNEXPECTED-DUPLICATE',
  package_status:'hidden',available_count:0});
 assert.equal(await canonical('vivo X500 Pro Max + Lens 200mm',rows),null);
});

test('old X300 generic draft remains compatible with its unique canonical bundle',async()=>{
 const result=await canonical('vivo X300 Pro + Lens');
 assert.equal(result.template_id,'TPL-X300-200');
 assert.equal(result.package_name,'vivo X300 Pro + Lens 200mm');
});

test('incompatible or unknown lens enums and inquiry-only/fractional stock fail closed',async()=>{
 const rows=syntheticRows();
 const invalid400={...rows[1],lens_group:'ZEISS_400MM'};
 assert.equal(await canonical('vivo X300 Pro + Lens 400mm',[invalid400]),null);
 assert.equal(await canonical('vivo X500 Pro Max + Lens 200mm',[{...rows[3],lens_group:'UNKNOWN'}]),null);
 for(const patch of [{web_note:'[INQUIRY_ONLY]'},{use_case:'INQUIRY_ONLY'},
  {available_count:'0.5'}]){
  assert.equal(await canonical('vivo X500 Pro Max + Lens 200mm',[{...rows[3],...patch}]),null);
 }
});

