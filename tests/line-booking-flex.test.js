'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {buildBookingFlex,httpsImageUrl}=require('../server/line-booking-flex');

const base={event:{event_name:'LYKN REFLEXION CONCERT',event_date:'2026-10-18',venue:'IMPACT Arena'},package:{package_name:'vivo X300 Pro + Lens',price_display:'1,290฿'}};

test('builds Flex hero from HTTPS poster',()=>{
 const m=buildBookingFlex({...base,event:{...base.event,poster_image_url:'https://example.com/poster.jpg'}});
 assert.equal(m.type,'flex'); assert.equal(m.contents.hero.url,'https://example.com/poster.jpg');
 assert.match(JSON.stringify(m),/LYKN REFLEXION/); assert.match(JSON.stringify(m),/1,290฿/);
});
test('missing poster falls back to text-only Flex without failing',()=>{
 const m=buildBookingFlex(base); assert.equal(m.contents.hero,undefined); assert.equal(m.type,'flex');
});
test('rejects non-HTTPS and malformed poster URLs',()=>{
 assert.equal(httpsImageUrl('http://example.com/a.jpg'),'');
 assert.equal(httpsImageUrl('javascript:alert(1)'),'');
 assert.equal(httpsImageUrl('not a url'),'');
});
test('preserves Thai and long event data safely',()=>{
 const name='งานทดสอบภาษาไทย '.repeat(40);
 const m=buildBookingFlex({event:{event_name:name,event_date:'31 ธันวาคม 2026',venue:'กรุงเทพมหานคร',poster_image_url:'https://example.com/a.png'},package:{package_name:'มือถือ + เลนส์',price:'1,390฿'}});
 assert.ok(m.altText.length<=400); assert.match(JSON.stringify(m),/งานทดสอบภาษาไทย/); assert.match(JSON.stringify(m),/มือถือ \+ เลนส์/);
});
test('builder has no send side effect or credential dependency',()=>{
 const source=require('node:fs').readFileSync(require.resolve('../server/line-booking-flex'),'utf8');
 assert.doesNotMatch(source,/api\.line\.me|Authorization|CHANNEL_ACCESS_TOKEN|fetch\s*\(/);
});

test('confirmation UX clearly states request is pending shop review and avoids misleading calendar emoji',()=>{
 const m=buildBookingFlex({...base,event:{...base.event,poster_image_url:'https://example.com/poster.jpg'}});
 const s=JSON.stringify(m);
 assert.match(s,/คำขอเช่า • รอตรวจสอบคิว/);
 assert.match(s,/ร้านได้รับคำขอเช่าแล้ว/);
 assert.match(s,/กรุณารอร้านตรวจสอบคิวและยืนยันการจองอีกครั้ง/);
 assert.doesNotMatch(s,/📅/);
});
