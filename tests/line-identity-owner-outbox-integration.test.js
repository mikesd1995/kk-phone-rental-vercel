'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Approval=require('../server/line-booking-owner-approval');
const Terms=require('../server/kk-booking-terms-evidence');

const OWNER='U'+'a'.repeat(32);
const env={
  KK_LINE_BOOKING_AUTOMATION_ENABLED:'true',
  KK_LINE_OWNER_OUTBOX_V1_ENABLED:'true',
  KK_LINE_OWNER_OUTBOX_DISPATCH_SECRET:'synthetic-private-dispatch-credential-20261112',
  KK_ADMIN_SCRIPT_URL:'https://script.google.com/macros/s/SYNTHETIC/exec',
  KK_ADMIN_API_KEY:'synthetic-admin-key',
  KK_OWNER_LINE_USER_ID:OWNER,
  LINE_CHANNEL_ACCESS_TOKEN:'synthetic-token',
  LINE_CHANNEL_SECRET:'synthetic-secret'
};
function bubble(termsStatus){
  return Approval.ownerApprovalMessage({
    booking_id:'BK-20261113-SYNTH-1',event_name:'Synthetic Event',
    event_date:'2026-11-13',package_name:'Phone + Lens',
    price_display:'890',nickname:'Synthetic Customer',
    terms_version:Terms.VERSION,terms_status:termsStatus
  },env);
}
test('identity-verified Terms badge and owner durable outbox can coexist in one runtime',()=>{
  const b=bubble('VERIFIED_LINE_IDENTITY_TERMS_ACCEPTED');
  assert.equal(b.type,'flex');
  assert.match(JSON.stringify(b),/ยอมรับเงื่อนไขแล้ว/);
  assert.doesNotMatch(JSON.stringify(b),/ยังไม่พบข้อความยอมรับเงื่อนไข/);
  assert.equal(b.contents.footer.contents.length,2);
  const [approve,reject]=b.contents.footer.contents.map(x=>Approval.parseDecisionData(x.action.data,env));
  assert.equal(approve.decision,'approve');
  assert.equal(reject.decision,'reject');
  assert.equal(approve.booking_id,reject.booking_id);
  assert.equal(Approval.automationReadiness(env).ready,true);
  const source=fs.readFileSync(path.join(__dirname,'../server/line-booking-owner-approval.js'),'utf8');
  assert.match(source,/KK_LINE_OWNER_OUTBOX_V1_ENABLED/);
  assert.match(source,/lineOwnerOutboxReadiness/);
  assert.match(source,/DurableOutbox\.deliverDecision/);
  const webhook=fs.readFileSync(path.join(__dirname,'../server/line-booking-webhook.js'),'utf8');
  assert.match(webhook,/signatureVerified:true/);
  assert.match(webhook,/TERMS_EVIDENCE_REQUIRED/);
  assert.match(webhook,/ยังไม่ได้บันทึกคำขอจองค่ะ/);
  assert.match(webhook,/termsStatus:termsStatus/);
});
test('missing Terms evidence cannot be marked accepted by mere legacy LINE copy',()=>{
  const b=bubble('NOT_CONFIRMED');
  assert.match(JSON.stringify(b),/ยังไม่พบข้อความยอมรับเงื่อนไข/);
  assert.doesNotMatch(JSON.stringify(b),/ยืนยัน LINE User ID จากหลักฐานหลังบ้าน/);
});
