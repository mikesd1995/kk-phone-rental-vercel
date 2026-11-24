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
