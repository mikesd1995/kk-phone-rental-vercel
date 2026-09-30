'use strict';

function clean(value, fallback='-') {
  const s=String(value == null ? '' : value).trim();
  return s || fallback;
}
function httpsImageUrl(value) {
  const s=String(value || '').trim();
  if (!s) return '';
  try {
    const u=new URL(s);
    return u.protocol === 'https:' ? u.href : '';
  } catch (_) { return ''; }
}
function buildBookingFlex({event={}, package:pkg={}, customer={}}={}) {
  const image=httpsImageUrl(event.poster_image_url || event.poster_url || event.image_url);
  const name=clean(event.event_name || event.name, 'KK Phone Rental');
  const date=clean(event.event_date || event.date);
  const venue=clean(event.venue);
  const packageName=clean(pkg.package_name || pkg.model || pkg.name);
  const price=clean(pkg.price_display || pkg.price);
  const nickname=clean(customer.nickname || customer.name, '');
  const pickup=clean(customer.pickup_time || customer.pickup || customer.time, '');
  const rows=[
    {type:'text',text:'วันที่  '+date,size:'sm',wrap:true},
    {type:'text',text:'สถานที่  '+venue,size:'sm',wrap:true},
    {type:'separator',margin:'md'},
    {type:'text',text:'แพ็กเกจ  '+packageName,size:'sm',wrap:true,margin:'md'},
    {type:'text',text:'ราคา  '+price,size:'sm',weight:'bold',wrap:true}
  ];
  if(nickname) rows.push({type:'text',text:'ชื่อผู้จอง  '+nickname,size:'sm',wrap:true,margin:'md'});
  if(pickup) rows.push({type:'text',text:'เวลารับอุปกรณ์  '+pickup,size:'sm',wrap:true});
  rows.push(
    {type:'separator',margin:'md'},
    {type:'text',text:'ร้านได้รับคำขอเช่าแล้ว',weight:'bold',size:'sm',wrap:true,margin:'md'},
    {type:'text',text:'กรุณารอร้านตรวจสอบคิวและยืนยันการจองอีกครั้ง',size:'xs',wrap:true,color:'#666666'}
  );
  const contents={
    type:'bubble',
    body:{
      type:'box',layout:'vertical',spacing:'sm',
      contents:[
        {type:'text',text:'คำขอเช่า • รอตรวจสอบคิว',weight:'bold',size:'sm',color:'#666666',wrap:true},
        {type:'text',text:name,weight:'bold',size:'xl',wrap:true,margin:'sm'},
        ...rows
      ]
    }
  };
  if(image) contents.hero={type:'image',url:image,size:'full',aspectRatio:'20:13',aspectMode:'cover'};
  return {type:'flex',altText:('รับคำขอเช่าแล้ว • '+name).slice(0,400),contents};
}
module.exports={buildBookingFlex,httpsImageUrl};
