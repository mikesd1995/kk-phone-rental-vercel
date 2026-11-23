'use strict';

// Legacy customer-origin statement carried in the signed LINE message.
// Authenticated web acceptance is separate, verified by the server-side
// LINE Login evidence store and matched to the signed webhook sender.
// Neither browser cookies nor an unsent LINE draft are identity proof.
const VERSION='KK-TERMS-2026-11-06';
const ACK_LINE='✅ ยืนยันยอมรับเงื่อนไขการเช่า KK Phone Rental ('+VERSION+')';
const PRIVACY_LINE='ℹ️ รับทราบนโยบายความเป็นส่วนตัว: https://kk-phone-rental.vercel.app/privacy/';

function extractFromCustomerText(value){
  const lines=String(value||'').split(/\r?\n/).map(line=>line.trim());
  const accepted=lines.includes(ACK_LINE) && lines.includes(PRIVACY_LINE);
  return {
    status:accepted?'CUSTOMER_LINE_MESSAGE_CONFIRMED':'NOT_CONFIRMED',
    version:accepted?VERSION:'',
    // The line webhook already validates the LINE signature before calling.
    // Never treat this parser alone as verified identity or a legal certificate.
    matched:accepted
  };
}
module.exports={VERSION,ACK_LINE,PRIVACY_LINE,extractFromCustomerText};
