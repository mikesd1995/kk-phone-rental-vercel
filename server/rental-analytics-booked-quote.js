'use strict';
// Master Booking X is booked revenue. Master O is cash received, never Future.
const ACTIVE=new Set(['pending','confirmed','prepared','picked_up','returned','uploaded']);
const norm=v=>String(v==null?'':v).trim();
function error(code){const e=new Error(code);e.code=code;return e;}
function positivePrice(value){
 const raw=norm(value);
 if(!/^(?:(?:0|[1-9]\d*)(?:\.\d{1,2})?|[1-9]\d{0,2}(?:,\d{3})+(?:\.\d{1,2})?)$/.test(raw))return null;
 const n=Number(raw.replace(/,/g,''));
 return Number.isFinite(n)&&n>0&&Number.isSafeInteger(Math.round(n*100))?n:null;
}
function key(id,event){return norm(id)+'\u0000'+norm(event);}
function buildStrictBookingQuoteMap(csv,parseCsv){
 if(typeof parseCsv!=='function')throw error('RENTAL_QUOTE_INPUT_INVALID');
 const master=parseCsv(csv);
 const headers=(master[0]||[]).map(v=>norm(v).toLowerCase().replace(/[\s_\-]+/g,''));
 const col=name=>headers.indexOf(name);
 const idx={id:col('bookingid'),event:col('eventid'),status:col('bookingstatus'),pkg:col('packagetype'),price:col('packageprice')};
 if(Object.values(idx).some(i=>i<0)||idx.price!==23||headers.length<24)
   throw error('RENTAL_MASTER_QUOTE_SCHEMA_INVALID');
 const quotes=new Map();
 for(const r of master.slice(1)){
   const id=norm(r[idx.id]),event=norm(r[idx.event]);
   if(!id&&!event)continue;
   if(!id||!event)continue; // malformed identity cannot authorize a quote
   const k=key(id,event);
   if(quotes.has(k)){quotes.set(k,{duplicate:true});continue;}
   quotes.set(k,{booking_id:id,event_id:event,
     status:norm(r[idx.status]).toLowerCase(),
     package_type:norm(r[idx.pkg]).toLowerCase(),
     price:positivePrice(r[idx.price]),duplicate:false});
 }
 return quotes;
}
function bookedPriceRows(rows,csvOrMap,parseCsv){
 if(!Array.isArray(rows))throw error('RENTAL_QUOTE_INPUT_INVALID');
 const quotes=csvOrMap instanceof Map?csvOrMap:buildStrictBookingQuoteMap(csvOrMap,parseCsv);
 const seenActiveHelper=new Set();
 return rows.map(r=>{
   const status=norm(r.status).toLowerCase();
   if(!ACTIVE.has(status))return {...r,package_price:null};
   const id=norm(r.booking_id),event=norm(r.event_id),pkg=norm(r.package_type).toLowerCase();
   if(!id||!event||!pkg)throw error('MISSING_QUOTE');
   const helperKey=key(id,event);
   // One canonical quote cannot authorize two active Helper projections.
   if(seenActiveHelper.has(helperKey))throw error('RENTAL_ACTIVE_HELPER_DUPLICATE');
   seenActiveHelper.add(helperKey);
   const found=quotes.get(helperKey);
   if(found&&found.duplicate)throw error('DUPLICATE_QUOTE');
   if(!found||found.booking_id!==id||found.event_id!==event||!found.price||
      found.status!==status||found.package_type!==pkg)throw error('MISSING_QUOTE');
   return {...r,package_price:found.price};
 });
}
module.exports={ACTIVE,positivePrice,buildStrictBookingQuoteMap,bookedPriceRows};
