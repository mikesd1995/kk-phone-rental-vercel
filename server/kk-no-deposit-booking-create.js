'use strict';

// New-booking admission rule for KK Phone Rental.
// No deposit at booking. Full rental payment is collected face-to-face at handover.
// This module never changes existing bookings, financial records or owner decisions.
const STATUS_ALLOWED=new Set(['pending','confirmed']);
const PAYMENT_ALLOWED='unpaid';

function checkCreateBooking(payload){
  const p=payload&&typeof payload==='object'&&!Array.isArray(payload)?payload:{};
  const status=String(p.booking_status||'confirmed').trim().toLowerCase();
  const payment=String(p.payment_status||'unpaid').trim().toLowerCase();
  const raw=p.amount_received;
  const amount=(raw===undefined||raw===null||raw==='')?0:Number(String(raw).replace(/,/g,'').trim());
  if(!STATUS_ALLOWED.has(status)){
    return {ok:false,error_code:'NO_DEPOSIT_CREATE_STATUS_INVALID',message:'New booking must start pending or confirmed; do not create a booking already picked up or completed.'};
  }
  if(payment!==PAYMENT_ALLOWED || !Number.isFinite(amount) || amount!==0){
    return {ok:false,error_code:'NO_DEPOSIT_PREPAYMENT_FORBIDDEN',message:'KK does not take a deposit. At booking, payment_status must be unpaid and amount_received must be 0. Record only verified money actually collected at physical handover.'};
  }
  return {ok:true,booking_status:status,payment_status:'unpaid',amount_received:0};
}
module.exports={checkCreateBooking,STATUS_ALLOWED};
