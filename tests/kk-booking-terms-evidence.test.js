'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Evidence=require('../server/kk-booking-terms-evidence');
const Webhook=require('../server/line-booking-webhook')._test;
const Intake=require('../server/line-booking-intake');
const Owner=require('../server/line-booking-owner-approval');
const root=path.resolve(__dirname,'..');

function request(messageLines=[]){
 return ['สนใจเช่ามือถือ','🎫 งาน: DEMO EVENT','📅 วันที่: 06/11/2026','📍 สถานที่: DEMO VENUE','📱 รุ่น: vivo X300 Pro','💰 ราคา: 590 บาท','👤 ชื่อเล่น: Demo',...messageLines].join('\n');
}

test('web-originated booking drafts are compact and do not inject legal attestation text into LINE',()=>{
 const source=fs.readFileSync(path.join(root,'script.js'),'utf8');
 const terms=fs.readFileSync(path.join(root,'terms/index.html'),'utf8');
 const privacy=fs.readFileSync(path.join(root,'privacy/index.html'),'utf8');
 assert.equal(Evidence.VERSION,'KK-TERMS-2026-11-06');
 assert.match(terms,/<meta name="kk-terms-version" content="KK-TERMS-2026-11-06">/);
 assert.ok(terms.includes('<time datetime="2026-11-06">6 พฤศจิกายน 2569</time>'));
 assert.match(privacy,/เว็บไซต์ไม่แนบข้อความยืนยันนี้อัตโนมัติ/);
 const booking=source.slice(source.indexOf('function buildBookingMsg'),source.indexOf('function getBookingUrl'));
 const waitlist=source.slice(source.indexOf('function buildWaitlistMsg'),source.indexOf('function getWaitlistUrl'));
 for(const text of [booking,waitlist]){
   assert.equal(text.includes(Evidence.ACK_LINE),false);
   assert.equal(text.includes(Evidence.PRIVACY_LINE),false);
 }
 // Existing legacy/direct LINE acknowledgements may still be verified, but a
 // browser-only checkbox must never turn into a forged customer-sent statement.
 const pending=Webhook.parseBookingText(request());
 assert.equal(pending.terms_acknowledged,false);
 assert.equal(pending.terms_version,'');
});

test('only an exact customer-origin LINE statement for this terms version qualifies as message evidence',()=>{
 const complete=request([Evidence.ACK_LINE,Evidence.PRIVACY_LINE]);
 const got=Evidence.extractFromCustomerText(complete);
 assert.deepEqual(got,{status:'CUSTOMER_LINE_MESSAGE_CONFIRMED',version:Evidence.VERSION,matched:true});
 const booking=Webhook.parseBookingText(complete);
 assert.equal(booking.terms_acknowledged,true);
 assert.equal(booking.terms_version,Evidence.VERSION);
 for(const bad of [
  request(),request([Evidence.ACK_LINE]),
  request([Evidence.PRIVACY_LINE]),
  request([Evidence.ACK_LINE.replace('2026-11-06','2026-11-05'),Evidence.PRIVACY_LINE]),
  request([Evidence.ACK_LINE.replace('ยืนยันยอมรับ','ไม่ยอมรับ'),Evidence.PRIVACY_LINE]),
  request([Evidence.ACK_LINE+' รวมถึงการตลาด',Evidence.PRIVACY_LINE])
 ]){
  const parsed=Webhook.parseBookingText(bad);
  assert.equal(parsed.terms_acknowledged,false,'unsupported or absent statement must fail closed');
  assert.equal(parsed.terms_version,'');
 }
});

test('governed pending booking has bounded evidence marker linked to existing LINE request id, no new PII',()=>{
 const event={webhookEventId:'safely-synthetic-event',source:{userId:'UCUSTOMER001'}};
 const canonical={event_id:'EVT-1',template_id:'TPL-1',package_id:'PKG-1'};
 const ack=Webhook.parseBookingText(request([Evidence.ACK_LINE,Evidence.PRIVACY_LINE]));
 const yes=Intake.prepareBookingIntent(event,ack,canonical);
 const no=Intake.prepareBookingIntent(event,Object.assign({},ack,{terms_acknowledged:false,terms_version:''}),canonical);
 assert.equal(yes.ok,true);
 assert.equal(no.ok,true);
 assert.match(yes.payload.booking_note,/^LINE webhook intake line:[a-f0-9]{48} \| TERMS_ACK:KK-TERMS-2026-11-06$/);
 assert.match(no.payload.booking_note,/TERMS_NOT_CONFIRMED$/);
 assert.equal(yes.payload.request_id,no.payload.request_id);
 assert.equal(yes.payload.booking_status,'pending');
 assert.equal(yes.payload.payment_status,'unpaid');
 assert.equal(yes.payload.amount_received,0);
 assert.equal(yes.payload.customer_contact,'UCUSTOMER001');
 assert.doesNotMatch(yes.payload.booking_note,/Demo|UCUSTOMER001|590/);
 assert.equal(yes.payload.terms_evidence,undefined,'no new unapproved canonical column');
});

test('owner approval prompt visibly distinguishes a sent statement from missing direct-LINE acknowledgement',()=>{
 const ownerMessage=ctx=>Owner.ownerApprovalMessage(Object.assign({
   booking_id:'BK-TEST',event_name:'Demo',event_date:'06/11/2026',
   package_name:'vivo X300 Pro',price_display:'590 บาท',nickname:'Demo'
 },ctx),{LINE_CHANNEL_SECRET:'synthetic-secret'});
 const content=message=>JSON.stringify(message.contents.body);
 assert.match(content(ownerMessage({terms_status:'NOT_CONFIRMED'})),/ขอคำยืนยันทาง LINE ก่อนอนุมัติ/);
 assert.match(content(ownerMessage({terms_status:'LINE_MESSAGE_CONFIRMED',terms_version:Evidence.VERSION})),/พบข้อความยอมรับเงื่อนไขใน LINE/);
 assert.match(content(ownerMessage({terms_status:'LINE_MESSAGE_CONFIRMED',terms_version:'KK-TERMS-2026-11-05'})),/ขอคำยืนยันทาง LINE ก่อนอนุมัติ/);
});

test('inbound message origin, id and timestamp remain linked by existing verified LINE inbox path',()=>{
 const line=require('../server/kk-line-webhook');
 const event={type:'message',source:{type:'user',userId:'UCUSTOMER001'},timestamp:1793961600000,
  webhookEventId:'synthetic-webhook-id',message:{type:'text',id:'synthetic-line-msg',text:request([Evidence.ACK_LINE,Evidence.PRIVACY_LINE])}};
 const normalized=line.normalizeEvent(event);
 assert.equal(normalized.external_message_id,'synthetic-webhook-id');
 assert.equal(normalized.external_user_id,'UCUSTOMER001');
 assert.match(normalized.text,/KK-TERMS-2026-11-06/);
 assert.ok(normalized.received_at);
});
