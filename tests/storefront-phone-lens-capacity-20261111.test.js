'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'script.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const gate=fs.readFileSync(path.join(root,'assets/kk-booking-agreement.js'),'utf8');

function loadAvailability(){
  const from=source.indexOf('function availPkgs(c){');
  const to=source.indexOf('function availTextFor(c)',from);
  assert.ok(from>0&&to>from);
  const ctx={toNum:v=>Number(v)||0};
  vm.runInNewContext(source.slice(from,to),ctx,{timeout:300});
  return ctx;
}
const phone=(count,avail=true)=>({type:'phone_only',avail,count,price:690});
const bundle=(count,avail=true)=>({type:'phone_lens_bundle',avail,count,price:790});
const lens=(count,avail=true)=>({type:'lens_only',avail,count,price:100});

test('new-phone availability never counts standalone lens (BTS 03 and 05 Dec regression)',()=>{
  const {availCnt}=loadAvailability();
  for(const day of ['2026-12-03','2026-12-05']){
    const event={date:day,action:'show',phoneCnt:0,lensCnt:1,
      packages:[phone(0,false),lens(1),bundle(0,false)]};
    assert.equal(availCnt(event),0,day+' must not display a phone vacancy');
  }
});

test('owner FULL wins; no missing package or hidden phone invents capacity',()=>{
  const {availCnt}=loadAvailability();
  assert.equal(availCnt({action:'show_full',phoneCnt:2,lensCnt:2,packages:[phone(2),bundle(2)]}),0);
  assert.equal(availCnt({action:'show',phoneCnt:2,lensCnt:1,packages:[lens(1)]}),0);
  assert.equal(availCnt({action:'show',phoneCnt:2,lensCnt:0,packages:[]}),0);
  assert.equal(availCnt({action:'show',phoneCnt:2,lensCnt:1,packages:[phone(2,false),lens(1)]}),0);
});

test('genuine phone availability remains available, with shared phone count once',()=>{
  const {availCnt}=loadAvailability();
  assert.equal(availCnt({action:'show',phoneCnt:2,lensCnt:1,packages:[phone(2),lens(1),bundle(1)]}),2);
  assert.equal(availCnt({action:'show',phoneCnt:1,lensCnt:0,packages:[phone(1)]}),1);
  assert.equal(availCnt({action:'show',phoneCnt:0,lensCnt:0,packages:[phone(0)]}),0);
});

test('FULL modal offers phone waitlist and separate existing-renter lens inquiry, never new booking',()=>{
  assert.match(source,/var phoneIsFull=availCnt\(c\)<=0/);
  assert.match(source,/if\(!avail\.length \|\| phoneIsFull\)/);
  assert.match(source,/existingRenterLens=avail\.find\(function\(p\)\{return p\.type==="lens_only";\}\)/);
  assert.match(source,/lensAsk\.href=getExistingRenterLensUrl\(c,existingRenterLens\)/);
  assert.match(source,/lensAsk\.className="waitlist-line-btn"/);
  assert.match(source,/isExistingRenterLens\?getExistingRenterLensUrl\(c,p\):getBookingUrl\(c,p\)/);
  assert.match(source,/track\(isExistingRenterLens\?"lens_addon_inquiry_click":"booking_click"/);
  assert.match(source,/source:isExistingRenterLens\?"modal_existing_renter_lens":"modal"/);
  assert.match(source,/getWaitlistUrl\(c,null\)/);
  assert.match(gate,/a\.waitlist-line-btn/); // both paths still require unchecked agreement
  const start=source.indexOf('function buildExistingRenterLensMsg(');
  const end=source.indexOf('function getExistingRenterLensUrl(',start);
  const msg=source.slice(start,end);
  assert.ok(start>0&&end>start);
  assert.match(msg,/สอบถามเพิ่มเลนส์สำหรับผู้จองมือถือแล้ว/);
  assert.match(msg,/รหัสจองมือถือเดิม/);
  assert.doesNotMatch(msg,/สนใจเช่ามือถือ/);
  assert.match(msg,/KK-TERMS-2026-11-06/);
});

test('pre-LINE policy version and site script source remain identical across release',()=>{
  assert.match(html,/script\.js\?v=phone-lens-safety-20261111/);
  assert.match(source,/KK-TERMS-2026-11-06/);
  assert.match(source,/getBookingUrl\(c,p\)/);
  assert.match(source,/getWaitlistUrl\(c,p\)/);
});

test('every-visible-modal browser QA verifies separate waitlist and lens inquiry paths',()=>{
  const qa=fs.readFileSync(path.join(root,'scripts/qa/storefront-all-visible-modals.cjs'),'utf8');
  assert.match(qa,/const phoneFull=availCnt\(event\)<=0/);
  assert.match(qa,/PHONE_FULL_WAITLIST_MISSING/);
  assert.match(qa,/EXISTING_RENTER_LENS_INQUIRY_MISSING/);
  assert.match(qa,/LENS_FALSLY_NEW_PHONE_BOOKING/);
});

test('actual signed-LINE booking parser rejects all lens add-on enquiries, even with edited booking labels',()=>{
  const Webhook=require('../server/line-booking-webhook')._test;
  const start=source.indexOf('function buildExistingRenterLensMsg(');
  const end=source.indexOf('function getExistingRenterLensUrl(',start);
  assert.ok(start>0&&end>start);
  const dictionary={line_event:'งาน',line_date:'วันที่',line_venue:'สถานที่'};
  const ctx={tr:key=>dictionary[key]||key,lineVal:v=>String(v||''),currentLang:'th'};
  vm.runInNewContext(source.slice(start,end),ctx,{timeout:300});
  const message=ctx.buildExistingRenterLensMsg({
    name:'Synthetic BTS Event',date:'03/12/2026',venue:'Demo Venue'
  },{model:'ZEISS 2.35X'});
  assert.match(message,/เลนส์ที่ต้องการ/);
  assert.doesNotMatch(message,/(?:^|\n)[^\n]*(?:รุ่น|Model)\s*:/i);
  assert.equal(Webhook.parseBookingText(message),null);
  assert.equal(Webhook.parseBookingText(message+'\n📱 รุ่น: vivo X300 Pro'),null);
  assert.equal(Webhook.parseBookingText(message+'\n💰 ราคา: 590 บาท'),null);
  const genuine='สนใจเช่ามือถือ\n🎫 งาน: Synthetic BTS Event\n📅 วันที่: 03/12/2026\n📍 สถานที่: Demo Venue\n📱 รุ่น: vivo X300 Pro';
  assert.ok(Webhook.parseBookingText(genuine),'ordinary phone inquiries must remain supported');
  ctx.currentLang='en';
  assert.match(ctx.buildExistingRenterLensMsg({name:'Synthetic BTS Event',date:'03/12/2026',venue:'Demo Venue'},{model:'ZEISS 2.35X'}),/Lens requested/);
});
