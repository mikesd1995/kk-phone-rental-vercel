'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const I=require('../server/line-booking-intake');

test('LINE webhookEventId produces deterministic request id',()=>{
 const e={webhookEventId:'01H-abc'};
 assert.equal(I.requestIdFromLineEvent(e),I.requestIdFromLineEvent(e));
 assert.match(I.requestIdFromLineEvent(e),/^line:[a-f0-9]{48}$/);
});
test('intake fails closed without canonical resolution or customer identity',()=>{
 assert.equal(I.bookingIntent({webhookEventId:'x'},{nickname:'Mint',phone:'081'},{}).code,'CANONICAL_RESOLUTION_REQUIRED');
 assert.equal(I.bookingIntent({webhookEventId:'x'},{},{event_id:'EVT-1',template_id:'TPL-1'}).code,'CUSTOMER_FIELDS_REQUIRED');
});
test('intake can create only pending unpaid LINE booking',()=>{
 const r=I.bookingIntent({webhookEventId:'x',source:{userId:'U1'}},{nickname:'Mint',phone:'081',pickup_time:'16:00'},{event_id:'EVT-1',template_id:'TPL-1'});
 assert.equal(r.ok,true); assert.equal(r.payload.booking_status,'pending'); assert.equal(r.payload.payment_status,'unpaid'); assert.equal(r.payload.contact_channel,'LINE');
});
test('canonical result requires booking id read back from SOT',()=>{
 assert.equal(I.canonicalResult({data:{row_number:25}}).ok,false);
 assert.deepEqual(I.canonicalResult({data:{booking_id:'BK-25',row_number:25}}),{ok:true,booking_id:'BK-25',row_number:25});
});
