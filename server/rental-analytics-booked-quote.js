'use strict';
// Read-only Master Booking quote reconciliation for Rental Analytics.
// Master X is the agreed rental price. Master O is collected cash; never use O for Future.
const ACTIVE=new Set(['pending','confirmed','prepared','picked_up','returned','uploaded']);
const norm=v=>String(v==null?'':v).trim();
function error(code){const e=new Error(code);e.code=code;return e;}
function positivePrice(value){
  const s=norm(value).replace(/,/g,'');
  if(!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(s))return null;
  const n=Number(s);
  return Number.isFinite(n)&&n>0&&Number.isSafeInteger(Math.round(n*100))?n:null;
}
function key(id,eventId){return norm(id)+'\u0000'+norm(eventId);}
function bookedPriceRows(rows,masterCsv,parseCsv){
  if(!Array.isArray(rows)||typeof parseCsv!=='function')throw error('RENTAL_QUOTE_INPUT_INVALID');
  const master=parseCsv(masterCsv);
  const headers=(master[0]||[]).map(v=>norm(v).toLowerCase().replace(/[\s_\-]+/g,''));
  const col=name=>headers.indexOf(name);
  const idx={id:col('bookingid'),status:col('bookingstatus'),event:col('eventid'),pkg:col('packagetype'),price:col('packageprice')};
  if(Object.values(idx).some(i=>i<0))throw error('RENTAL_MASTER_QUOTE_SCHEMA_INVALID');
  const byKey=new Map();
  for(const r of master.slice(1)){
    const id=norm(r[idx.id]),event=norm(r[idx.event]);
    if(!id&&!event)continue;
    if(!id||!event)continue; // non-actionable malformed row cannot be used as evidence
    const k=key(id,event);
    if(byKey.has(k)){byKey.set(k,null);continue;} // duplicate identity is ambiguous, even if prices match
    byKey.set(k,{status:norm(r[idx.status]).toLowerCase(),package_type:norm(r[idx.pkg]).toLowerCase(),price:positivePrice(r[idx.price])});
  }
  return rows.map(r=>{
    const status=norm(r.status).toLowerCase();
    if(!ACTIVE.has(status))return {...r,package_price:null};
    const found=byKey.get(key(r.booking_id,r.event_id));
    if(!found || found.price===null || found.status!==status ||
       !norm(r.package_type) || found.package_type!==norm(r.package_type).toLowerCase()){
      // No guessing across similarly named customers, archive rows or reused booking IDs.
      throw error('RENTAL_ACTIVE_QUOTE_UNVERIFIED');
    }
    return {...r,package_price:found.price};
  });
}
module.exports={ACTIVE,positivePrice,bookedPriceRows};
