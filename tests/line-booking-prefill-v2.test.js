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
