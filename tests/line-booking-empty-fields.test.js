'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parseBookingText}=require('../server/line-booking-webhook')._test;
const {buildBookingFlex}=require('../server/line-booking-flex');

const realTemplate=`สนใจเช่ามือถือ
🎫 งาน: Moonshadow : The Afterglow After Party
📅 วันที่: 15/10/2026
📍 สถานที่: ICONSIAM HALL, 7th Floor, ICONSIAM
📱 รุ่น: Vivo X300 Pro + Lens
💰 ราคา: 990 บาท
⏰ เวลาที่สะดวกรับอุปกรณ์:

👤 ชื่อเล่น:
📞 เบอร์โทร:`;

test('blank optional customer fields never consume the next labelled line',()=>{
 const b=parseBookingText(realTemplate);
 assert.ok(b);
 assert.equal(b.pickup_time,'');
 assert.equal(b.nickname,'');
 assert.equal(b.phone,'');
});

test('filled optional customer fields remain parsed on their own lines',()=>{
 const b=parseBookingText(realTemplate
   .replace('⏰ เวลาที่สะดวกรับอุปกรณ์:','⏰ เวลาที่สะดวกรับอุปกรณ์: 14:30')
   .replace('👤 ชื่อเล่น:','👤 ชื่อเล่น: ไมค์')
   .replace('📞 เบอร์โทร:','📞 เบอร์โทร: 0812345678'));
 assert.equal(b.pickup_time,'14:30');
 assert.equal(b.nickname,'ไมค์');
 assert.equal(b.phone,'0812345678');
});

test('Flex omits blank optional customer rows instead of showing adjacent labels',()=>{
 const b=parseBookingText(realTemplate);
 const flex=buildBookingFlex({event:b,package:{package_name:b.package_name,price_display:b.price_display},customer:{nickname:b.nickname,pickup_time:b.pickup_time}});
 const rows=flex.contents.body.contents.map(x=>x.text||'').join('\n');
 assert.equal(rows.includes('ชื่อผู้จอง'),false);
 assert.equal(rows.includes('เวลารับอุปกรณ์'),false);
 assert.equal(rows.includes('เบอร์โทร:'),false);
 assert.equal(rows.includes('ชื่อเล่น:'),false);
});
