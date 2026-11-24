'use strict';

function clean(value, fallback='-') {
  const s=String(value == null ? '' : value).trim();
  return s || fallback;
}
// Limit source-driven text to keep the LINE Flex bubble valid when input data is
// anomalously large. Code-point slicing avoids tearing emoji surrogate pairs.
function cardText(value, fallback='-', maxCharacters=180) {
  const s=clean(value,fallback).replace(/[\u0000-\u001F\u007F]/g,' ').replace(/[\uD800-\uDFFF]/gu,'\uFFFD').trim();
  return Array.from(s || fallback).slice(0,maxCharacters).join('');
}
function httpsImageUrl(value) {
  const s=String(value || '').trim();
  if (!s || s.length>2000) return '';
  try {
    const u=new URL(s);
    return u.protocol === 'https:' && !u.username && !u.password && u.href.length<=2000 ? u.href : '';
  } catch (_) { return ''; }
}
function buildBookingFlex({event={}, package:pkg={}, customer={}, booking={}}={}) {
  const image=httpsImageUrl(event.poster_image_url || event.poster_url || event.image_url);
  const name=cardText(event.event_name || event.name, 'KK Phone Rental',180);
  const date=cardText(event.event_date || event.date,'-',80);
  const venue=cardText(event.venue,'-',160);
  const packageName=cardText(pkg.package_name || pkg.model || pkg.name,'-',160);
  const price=cardText(pkg.price_display || pkg.price,'-',64);
  const nickname=cardText(customer.nickname || customer.name,'',100);
  const pickup=cardText(customer.pickup_time || customer.pickup || customer.time,'',100);
  const bookingId=clean(booking.booking_id, '');
  const rows=[
    {type:'text',text:'วันที่  '+date,size:'sm',wrap:true},
    {type:'text',text:'สถานที่  '+venue,size:'sm',wrap:true},
    {type:'separator',margin:'md'},
    {type:'text',text:'แพ็กเกจ  '+packageName,size:'sm',wrap:true,margin:'md'},
    {type:'text',text:'ราคา  '+price,size:'sm',weight:'bold',wrap:true}
  ];
  if(bookingId) rows.push({type:'text',text:'Booking ID  '+bookingId,size:'sm',weight:'bold',wrap:true,margin:'md'});
  if(nickname) rows.push({type:'text',text:'ชื่อผู้จอง  '+nickname,size:'sm',wrap:true,margin:'md'});
  if(pickup) rows.push({type:'text',text:'เวลารับอุปกรณ์  '+pickup,size:'sm',wrap:true});
  // A LINE Reply is not a booking write. Only the canonical Booking ID readback
  // permits the customer-facing card to say that a request was recorded.
  const recorded=Boolean(bookingId);
  rows.push(
    {type:'separator',margin:'md'},
    {type:'text',text:recorded?'ร้านได้รับคำขอเช่าแล้ว':'ร้านได้รับข้อความสอบถามแล้ว',weight:'bold',size:'sm',wrap:true,margin:'md'},
    {type:'text',text:recorded
      ?'กรุณารอร้านตรวจสอบคิวและยืนยันการจองอีกครั้ง'
      :'ยังไม่มีรายการจองในระบบ กรุณาติดต่อร้านเพื่อยืนยันคำขอเช่า',size:'xs',wrap:true,color:'#666666'}
  );
  const contents={
    type:'bubble',
    body:{
      type:'box',layout:'vertical',spacing:'sm',
      contents:[
        {type:'text',text:recorded?'คำขอเช่า • รอตรวจสอบคิว':'สอบถามการเช่า • ยังไม่บันทึกจอง',weight:'bold',size:'sm',color:'#666666',wrap:true},
        {type:'text',text:name,weight:'bold',size:'xl',wrap:true,margin:'sm'},
        ...rows
      ]
    }
  };
  if(image) contents.hero={type:'image',url:image,size:'full',aspectRatio:'20:13',aspectMode:'cover'};
  return {type:'flex',altText:((recorded?'รับคำขอเช่าแล้ว • ':'ได้รับข้อความสอบถาม • ')+name).slice(0,400),contents};
}
module.exports={buildBookingFlex,httpsImageUrl};
