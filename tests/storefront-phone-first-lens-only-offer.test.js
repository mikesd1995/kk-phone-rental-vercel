'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const script=fs.readFileSync(path.join(__dirname,'../script.js'),'utf8');

function storefrontFixture(lang='th',soon=false){
  const from=script.indexOf('function availPkgs(c)');
  const to=script.indexOf('function hasBrowseFilters()',from);
  const badgeFrom=script.indexOf('function getBadgeText(c)');
  const badgeTo=script.indexOf('function renderMonthSelect(',badgeFrom);
  assert.ok(from>=0&&to>from&&badgeFrom>=0&&badgeTo>badgeFrom,'storefront source spans must exist');
  const code=script.slice(from,to)+'\n'+script.slice(badgeFrom,badgeTo);
  const labels={
    th:{badge_lens:'Lens ว่าง',badge_full:'คิวเต็ม',badge_soon:'ใกล้ถึงวันงาน',badge_today:'งานวันนี้',badge_available:'ว่าง {count} เครื่อง',card_waitlist:'รอคิวหลุด',card_price_from:'เริ่ม {price}฿',card_price_lens_only:'เฉพาะ Lens {price}฿ · มือถือเต็ม',card_price_ask:'สอบถามราคา',lens_only_available:'เหลือ Lens อย่างเดียว',full_availability:'คิวเต็ม',phones_available:'ว่าง {count} เครื่อง'},
    en:{badge_lens:'Lens Available',badge_full:'Fully Booked',badge_soon:'Coming Soon',badge_today:'Today',badge_available:'{count} Available',card_waitlist:'Waitlist',card_price_from:'From ฿{price}',card_price_lens_only:'Lens only ฿{price} · Phones fully booked',card_price_ask:'Ask for price',lens_only_available:'Lens-only package available',full_availability:'Fully booked',phones_available:'{count} phones available'}
  };
  const tr=(key,options={})=>String(labels[lang][key]||key).replace(/\{(\w+)\}/g,(_,name)=>String(options[name]||''));
  return new Function('toNum','tr','numberLocale','isToday','isSoon',code+'\nreturn {onlyLensBookable,startingPriceFor,cardPriceText,getBadgeText,availTextFor,availCnt}')(
    x=>Number(String(x||'').replace(/,/g,''))||0,tr,()=>lang==='th'?'th-TH':'en-US',()=>false,()=>soon
  );
}
const pkg=(type,price,avail=true)=>({type,price,avail});

test('bookable phone takes priority over cheaper lens-only starting price',()=>{
  const f=storefrontFixture();
  const c={phoneCnt:2,lensCnt:2,packages:[pkg('phone_only',790),pkg('lens_only',200),pkg('phone_lens_bundle',990)]};
  assert.equal(f.onlyLensBookable(c),false);
  assert.equal(f.startingPriceFor(c),790);
  assert.equal(f.cardPriceText(c),'เริ่ม 790฿');
  assert.equal(f.availCnt(c),2);
});
test('BTS sold-out phones keep valid lens-only offer with explicit price and label, including when soon',()=>{
  const f=storefrontFixture('th',true);
  const c={phoneCnt:0,lensCnt:1,packages:[pkg('phone_only',790,false),pkg('lens_only',200),pkg('phone_lens_bundle',990,false)]};
  assert.equal(f.onlyLensBookable(c),true);
  assert.equal(f.startingPriceFor(c),200);
  assert.equal(f.cardPriceText(c),'เฉพาะ Lens 200฿ · มือถือเต็ม');
  assert.equal(f.getBadgeText(c),'Lens ว่าง');
  assert.equal(f.availTextFor(c),'เหลือ Lens อย่างเดียว');
});
test('lens-only clarity works in English',()=>{
  const f=storefrontFixture('en',true);
  const c={phoneCnt:0,lensCnt:1,packages:[pkg('phone_only',790,false),pkg('lens_only',200)]};
  assert.equal(f.cardPriceText(c),'Lens only ฿200 · Phones fully booked');
  assert.equal(f.getBadgeText(c),'Lens Available');
});
test('no available package stays waitlist-only rather than advertising any price',()=>{
  const f=storefrontFixture();
  const c={phoneCnt:0,lensCnt:0,packages:[pkg('phone_only',790,false),pkg('lens_only',200,false)]};
  assert.equal(f.availCnt(c),0);
  assert.equal(f.onlyLensBookable(c),false);
  assert.equal(f.startingPriceFor(c),0);
  assert.equal(f.cardPriceText(c),'รอคิวหลุด');
  assert.equal(f.getBadgeText(c),'คิวเต็ม');
});
test('bundle-only availability shows actual bundle price, not hidden lower phone/lens price',()=>{
  const f=storefrontFixture();
  const c={phoneCnt:1,lensCnt:1,packages:[pkg('phone_only',790,false),pkg('lens_only',200,false),pkg('phone_lens_bundle',990)]};
  assert.equal(f.onlyLensBookable(c),false);
  assert.equal(f.startingPriceFor(c),990);
  assert.equal(f.cardPriceText(c),'เริ่ม 990฿');
});
