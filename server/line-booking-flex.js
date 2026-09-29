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
function buildBookingFlex({event={}, package:pkg={}}={}) {
  const image=httpsImageUrl(event.poster_image_url || event.poster_url || event.image_url);
  const name=clean(event.event_name || event.name, 'KK Phone Rental');
  const date=clean(event.event_date || event.date);
  const venue=clean(event.venue);
  const packageName=clean(pkg.package_name || pkg.model || pkg.name);
  const price=clean(pkg.price_display || pkg.price);
  const contents={
    type:'bubble',
    body:{
      type:'box',layout:'vertical',spacing:'sm',
      contents:[
        {type:'text',text:name,weight:'bold',size:'lg',wrap:true},
        {type:'text',text:'📅 '+date,size:'sm',wrap:true},
        {type:'text',text:'📍 '+venue,size:'sm',wrap:true},
        {type:'separator',margin:'md'},
        {type:'text',text:'แพ็กเกจ: '+packageName,size:'sm',wrap:true,margin:'md'},
        {type:'text',text:'ราคา: '+price,size:'sm',wrap:true}
      ]
    }
  };
  if(image) contents.hero={type:'image',url:image,size:'full',aspectRatio:'20:13',aspectMode:'cover'};
  return {type:'flex',altText:('จอง '+name).slice(0,400),contents};
}
module.exports={buildBookingFlex,httpsImageUrl};
