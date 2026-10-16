'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const webhook=require('../server/line-booking-webhook')._test;

test('parses storefront LINE booking template v2',()=>{
 const msg=['สนใจเช่ามือถือ','🎫 งาน: REMASTER CONCERT','📅 วันที่: 10 ต.ค. 2569','📍 สถานที่: Paragon Hall ชั้น 5','📱 รุ่น: vivo X300 Pro + Lens','💰 ราคา: 590 บาท','⏰ เวลาที่สะดวกรับอุปกรณ์: 14:00 น.','','👤 ชื่อเล่น: Mike','📞 เบอร์โทร: 0812345678'].join('\n');
 const b=webhook.parseBookingText(msg);
 assert.equal(b.event_name,'REMASTER CONCERT');
 assert.equal(b.package_name,'vivo X300 Pro + Lens');
 assert.equal(b.price_display,'590 บาท');
 assert.equal(b.pickup_time,'14:00 น.');
 assert.equal(b.nickname,'Mike');
 assert.equal(b.phone,'0812345678');
});
test('legacy package-first template remains parseable',()=>{
 const msg=['สนใจเช่า vivo X300 Pro + Lens','งาน : OLD EVENT','วันที่ : 01/10/2026','สถานที่ : Union Hall','ราคา : 590 บาท','ชื่อเล่น : Mike','เบอร์โทร : 0812345678','เวลารับอุปกรณ์ : 14:00'].join('\n');
 const b=webhook.parseBookingText(msg);
 assert.equal(b.package_name,'vivo X300 Pro + Lens');
 assert.equal(b.price_display,'590 บาท');
});

test('canonical package resolver replaces mismatched client bundle price with package feed price',async()=>{
 const web='event_id,event_name,event_date,venue,poster_image_url,action_for_web,booking_status_for_web,available_phone_count\nEVT-1,Nineentertain 24th Anniversary Charity Concert,30/09/2026,"Parc Paragon, Siam Paragon, Bangkok",https://example.com/p.jpg,show,เปิดจอง,1\n';
 const pkg='package_id,event_id,package_type,model_group,model_display,lens_group,lens_display,price,available_count,package_status,sort_order,web_note,raw_available_count,use_case\nPKG-PHONE,EVT-1,phone_only,VIVO_X300_PRO,Vivo X300 Pro,NONE,,590,1,available,10,,1,\nPKG-BUNDLE,EVT-1,phone_lens_bundle,VIVO_X300_PRO,Vivo X300 Pro,ZEISS,Lens Vivo,890,1,available,30,,1,\n';
 const fetchImpl=async url=>({ok:true,text:async()=>String(url).includes('09_Web_Packages')?pkg:web});
 const got=await webhook.resolveCanonicalPackage({event_name:'Nineentertain 24th Anniversary Charity Concert',venue:'Parc Paragon, Siam Paragon, Bangkok',package_name:'Vivo X300 Pro + Lens',price_display:'590 บาท'},fetchImpl);
 assert.equal(got.package_id,'PKG-BUNDLE');
 assert.equal(got.price_display,'890 บาท');
});
test('canonical package resolver supports comma-formatted event-specific bundle prices without arithmetic assumptions',async()=>{
 const web='event_id,event_name,event_date,venue,poster_image_url,action_for_web,booking_status_for_web,available_phone_count\nEVT-LYKN,LYKN REFLEXION CONCERT,24/10/2026,IMPACT Arena,,show,เปิดจอง,1\n';
 const pkg='package_id,event_id,package_type,model_group,model_display,lens_group,lens_display,price,available_count,package_status,sort_order,web_note,raw_available_count,use_case\nPKG-BUNDLE,EVT-LYKN,phone_lens_bundle,VIVO_X300_PRO,Vivo X300 Pro,ZEISS,Lens Vivo,"1,290",1,available,30,,1,\n';
 const fetchImpl=async url=>({ok:true,text:async()=>String(url).includes('09_Web_Packages')?pkg:web});
 const got=await webhook.resolveCanonicalPackage({event_name:'LYKN REFLEXION CONCERT',venue:'IMPACT Arena',package_name:'Vivo X300 Pro + Lens'},fetchImpl);
 assert.equal(got.price_display,'1,290 บาท');
});
test('canonical resolver fails closed when package cannot be matched uniquely',async()=>{
 const web='event_id,event_name,event_date,venue,poster_image_url,action_for_web,booking_status_for_web,available_phone_count\nEVT-1,EVENT,01/10/2026,VENUE,,show,เปิดจอง,1\n';
 const pkg='package_id,event_id,package_type,model_group,model_display,lens_group,lens_display,price,available_count,package_status,sort_order,web_note,raw_available_count,use_case\n';
 const fetchImpl=async url=>({ok:true,text:async()=>String(url).includes('09_Web_Packages')?pkg:web});
 assert.equal(await webhook.resolveCanonicalPackage({event_name:'EVENT',venue:'VENUE',package_name:'Vivo X300 Pro + Lens',price_display:'590 บาท'},fetchImpl),null);
});


test('canonical date normalizes Thai Buddhist and ISO/Gregorian dates',()=>{
 assert.equal(webhook.canonicalDate('16 ต.ค. 2569'),'2026-10-16');
 assert.equal(webhook.canonicalDate('16/10/2026'),'2026-10-16');
 assert.equal(webhook.canonicalDate('2026-10-16'),'2026-10-16');
 assert.equal(webhook.canonicalDate('16 Oct 2026'),'2026-10-16');
});

test('canonical resolver distinguishes same-name same-venue multi-day events by date',async()=>{
 const web=[
  'event_id,event_name,event_date_text,venue,poster_image_url,action_for_web,booking_status_for_web,available_phone_count',
  'EVT-16,OH MY FOURTH CONCERT,16/10/2026,BITEC LIVE,https://example.com/16.jpg,show,เปิดจอง,1',
  'EVT-17,OH MY FOURTH CONCERT,17/10/2026,BITEC LIVE,https://example.com/17.jpg,show,เปิดจอง,1'
 ].join('\n');
 const pkg=[
  'package_id,event_id,package_type,model_group,model_display,lens_group,lens_display,price,available_count,package_status,sort_order,web_note,raw_available_count,use_case',
  'PKG-16,EVT-16,phone_only,VIVO_X300_PRO,Vivo X300 Pro,NONE,,590,1,available,10,,1,',
  'PKG-17,EVT-17,phone_only,VIVO_X300_PRO,Vivo X300 Pro,NONE,,790,1,available,10,,1,'
 ].join('\n');
 const fetchImpl=async url=>({ok:true,text:async()=>String(url).includes('09_Web_Packages')?pkg:web});
 const got=await webhook.resolveCanonicalPackage({event_name:'OH MY FOURTH CONCERT',event_date:'17 ต.ค. 2569',venue:'BITEC LIVE',package_name:'Vivo X300 Pro'},fetchImpl);
 assert.equal(got.event_id,'EVT-17');
 assert.equal(got.package_id,'PKG-17');
 assert.equal(got.price_display,'790 บาท');
});

test('canonical resolver fails closed for hidden or sold-out packages',async()=>{
 const web='event_id,event_name,event_date_text,venue,poster_image_url,action_for_web,booking_status_for_web,available_phone_count\nEVT-1,EVENT,18/10/2026,VENUE,,show,เปิดจอง,1\n';
 const makeFetch=status=>async url=>({ok:true,text:async()=>String(url).includes('09_Web_Packages')
   ? ['package_id,event_id,package_type,model_group,model_display,lens_group,lens_display,price,available_count,package_status,sort_order,web_note,raw_available_count,use_case',
      'PKG-1,EVT-1,phone_only,VIVO_X300_PRO,Vivo X300 Pro,NONE,,790,'+(status==='full'?'0':'1')+','+status+',10,,1,'].join('\n')
   : web});
 for(const status of ['hidden','full']){
   const got=await webhook.resolveCanonicalPackage({event_name:'EVENT',event_date:'18/10/2026',venue:'VENUE',package_name:'Vivo X300 Pro'},makeFetch(status));
   assert.equal(got,null);
 }
});

test('event resolver fails closed when date is missing or ambiguous',()=>{
 const rows=[
  {event_id:'E1',event_name:'EVENT',event_date_text:'16/10/2026',venue:'VENUE'},
  {event_id:'E2',event_name:'EVENT',event_date_text:'17/10/2026',venue:'VENUE'}
 ];
 assert.equal(webhook.resolveEventRow(rows,{event_name:'EVENT',venue:'VENUE',event_date:''}),null);
 assert.equal(webhook.resolveEventRow(rows,{event_name:'EVENT',venue:'VENUE',event_date:'18/10/2026'}),null);
});
