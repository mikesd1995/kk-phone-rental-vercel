'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const I=require('../server/line-booking-intake');
const LineIdentity=require('../server/kk-line-identity');
const CUSTOMER='U'+'a'.repeat(32);
const FOREIGN='U'+'b'.repeat(32);

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
 const r=I.bookingIntent({webhookEventId:'x',source:{userId:CUSTOMER}},{nickname:'Mint',phone:'081',pickup_time:'16:00'},{event_id:'EVT-1',template_id:'TPL-1'});
 assert.equal(r.ok,true); assert.equal(r.payload.action,'createLineBookingPending'); assert.equal(r.payload.booking_status,'pending'); assert.equal(r.payload.payment_status,'unpaid'); assert.equal(r.payload.contact_channel,'LINE');
});
test('one provider LINE ID contract rejects malformed customer and permits explicit group targets',()=>{
 for(const candidate of ['U1','UOWNER','U'+'G'.repeat(32),'U'+'a'.repeat(33),'C'+'a'.repeat(32),'R'+'a'.repeat(32)]){
   assert.equal(LineIdentity.isUserId(candidate),false);
 }
 assert.equal(LineIdentity.isUserId(CUSTOMER),true);
 assert.equal(LineIdentity.isPushTarget(CUSTOMER),true);
 assert.equal(LineIdentity.isPushTarget('C'+'c'.repeat(32)),true);
 assert.equal(LineIdentity.isPushTarget('R'+'d'.repeat(32)),true);
 assert.equal(LineIdentity.isPushTarget('UOWNER'),false);
});

test('canonical pending intake rejects malformed signed LINE customer without mutation payload',()=>{
 const canonical={event_id:'EVT-1',template_id:'TPL-1'};
 for(const userId of ['U1','UFOREIGNCUSTOMER001','U'+'g'.repeat(32),'C'+'a'.repeat(32)]){
   const result=I.prepareBookingIntent({webhookEventId:'signed-synthetic-event',source:{type:'user',userId}}, {nickname:'Synthetic'},canonical);
   assert.deepEqual(result,{ok:false,code:'LINE_CUSTOMER_USER_ID_INVALID'});
   assert.equal('payload' in result,false);
 }
});

test('canonical result requires booking id read back from SOT',()=>{
 assert.equal(I.canonicalResult({data:{row_number:25}}).ok,false);
 assert.deepEqual(I.canonicalResult({data:{booking_id:'BK-25',row_number:25}}),{ok:true,booking_id:'BK-25',row_number:25});
});


test('E2E intake boundary rejects display-only package resolution',()=>{
 const event={webhookEventId:'evt-e2e-1',source:{userId:CUSTOMER}};
 const booking={nickname:'Mint',phone:'0812345678',pickup_time:'16:00'};
 const bad=I.prepareBookingIntent(event,booking,{event_id:'EVT-1',package_id:'PKG-1'});
 assert.equal(bad.ok,false); assert.equal(bad.code,'CANONICAL_RESOLUTION_REQUIRED');
});
test('E2E intake boundary produces stable pending unpaid mutation only after canonical ids',()=>{
 const event={webhookEventId:'evt-e2e-2',source:{userId:CUSTOMER}};
 const booking={nickname:'Mint',phone:'0812345678',pickup_time:'16:00'};
 const canonical={event_id:'EVT-1',template_id:'TPL-1',package_id:'PKG-1'};
 const a=I.prepareBookingIntent(event,booking,canonical);
 const b=I.prepareBookingIntent(event,booking,canonical);
 assert.equal(a.ok,true); assert.equal(a.payload.request_id,b.payload.request_id);
 assert.equal(a.payload.event_id,'EVT-1'); assert.equal(a.payload.template_id,'TPL-1');
 assert.equal(a.payload.booking_status,'pending'); assert.equal(a.payload.payment_status,'unpaid');
 assert.equal(a.payload.amount_received,0); assert.equal(a.payload.contact_channel,'LINE');
});


test('international customer may book using verified LINE ID without phone',()=>{
 const event={webhookEventId:'evt-international-01',source:{userId:FOREIGN}};
 const booking={nickname:'Alex',phone:'',pickup_time:''};
 const canonical={event_id:'EVT-1',template_id:'TPL-1',package_id:'PKG-1'};
 const r=I.prepareBookingIntent(event,booking,canonical);
 assert.equal(r.ok,true);
 assert.equal(r.payload.customer_contact,FOREIGN);
 assert.equal(r.payload.customer_phone,'');
 assert.equal(r.payload.booking_status,'pending');
 assert.equal(r.payload.payment_status,'unpaid');
 assert.equal(r.payload.amount_received,0);
 assert.equal(r.payload.phone_asset_id,undefined);
 assert.equal(r.payload.lens_asset_id,undefined);
 const noIdentity=I.prepareBookingIntent(
   {webhookEventId:'evt-international-02',source:{}},
   {nickname:'Alex',phone:''},canonical);
 assert.equal(noIdentity.ok,false);
 assert.equal(noIdentity.code,'LINE_CUSTOMER_USER_ID_REQUIRED');
});
