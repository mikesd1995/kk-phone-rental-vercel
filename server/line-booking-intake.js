'use strict';

const crypto=require('node:crypto');

function text(v){return String(v===undefined||v===null?'':v).trim();}
function requestIdFromLineEvent(event){
  const id=text(event&&event.webhookEventId);
  if(!id) return '';
  return 'line:'+crypto.createHash('sha256').update(id,'utf8').digest('hex').slice(0,48);
}
function bookingIntent(event,booking,resolved={}){
  const request_id=requestIdFromLineEvent(event);
  if(!request_id) return {ok:false,code:'LINE_EVENT_ID_REQUIRED'};
  // A verified LINE user ID is a valid customer contact; international renters
  // must never be rejected solely because they do not have a Thai phone number.
  if(!booking||!text(booking.nickname)) return {ok:false,code:'CUSTOMER_FIELDS_REQUIRED'};
  if(!text(resolved.event_id)||!text(resolved.template_id)) return {ok:false,code:'CANONICAL_RESOLUTION_REQUIRED'};
  if(!text(event&&event.source&&event.source.userId)) return {ok:false,code:'LINE_CUSTOMER_USER_ID_REQUIRED'};
  return {ok:true,payload:{
    action:'createLineBookingPending',request_id,
    event_id:text(resolved.event_id),template_id:text(resolved.template_id),
    customer_name:text(booking.nickname),customer_contact:text(event&&event.source&&event.source.userId),
    customer_phone:text(booking.phone),contact_channel:'LINE',
    booking_status:'pending',pickup_time:text(booking.pickup_time),
    payment_status:'unpaid',amount_received:0,
    booking_note:'LINE webhook intake '+request_id
  }};
}
function buildCanonicalResolution(canonical={}){
  const event_id=text(canonical.event_id);
  const template_id=text(canonical.template_id);
  const package_id=text(canonical.package_id);
  if(!event_id||!template_id) return {ok:false,code:'CANONICAL_RESOLUTION_REQUIRED'};
  return {ok:true,event_id,template_id,package_id};
}
function prepareBookingIntent(event,booking,canonical={}){
  const resolved=buildCanonicalResolution(canonical);
  if(!resolved.ok) return resolved;
  return bookingIntent(event,booking,resolved);
}
function canonicalResult(writeResult){
  const data=writeResult&&writeResult.data||writeResult||{};
  const booking_id=text(data.booking_id);
  if(!booking_id) return {ok:false,code:'BOOKING_ID_READBACK_REQUIRED'};
  return {ok:true,booking_id,row_number:data.row_number||''};
}
module.exports={requestIdFromLineEvent,bookingIntent,buildCanonicalResolution,prepareBookingIntent,canonicalResult};
