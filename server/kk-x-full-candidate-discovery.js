'use strict';
// Pure, read-only candidate discovery. Never infer DOM visibility from a CSV row.
const {eventDay,webRow}=require('./kk-x-posting-eligibility.js');
const MAX_PHONES=2;
function str(v){return String(v==null?'':v).trim();}
function discover(rows,{today='2026-10-19',locks=[],requireDom=true,domEvidence=[]}={}){
  if(!Array.isArray(rows))throw new TypeError('rows must be an array');
  const latest=new Map();
  for(const row of rows){const r=webRow(row);if(r.id)latest.set(r.id,row);}
  const lockIds=new Set((Array.isArray(locks)?locks:[]).filter(l=>{
    const s=str(Array.isArray(l)?l[6]:l.lock_state).toUpperCase();return s==='LOCKED';
  }).map(l=>str(Array.isArray(l)?l[1]:l.event_id)));
  const evidence=new Map((Array.isArray(domEvidence)?domEvidence:[]).filter(x=>x&&x.event_id).map(x=>[str(x.event_id),x]));
  const candidates=[],rejected=[];
  for(const row of latest.values()){
    const r=webRow(row),why=[];
    const date=eventDay(r.date);
    if(!date||date<today)why.push('PAST_OR_INVALID_DATE');
    if(r.action!=='show'||r.status!=='เปิดจอง'||!Number.isInteger(r.available)||r.available<1||r.available>MAX_PHONES)why.push('NOT_OPEN_WITH_VALID_PHONE_STOCK');
    if(lockIds.has(r.id))why.push('OWNER_LOCKED');
    const dom=evidence.get(r.id);
    if(requireDom&&!(dom?.card_visible===true&&dom?.booking_cta_verified===true&&dom?.event_date_text===r.date))why.push('RENDERED_BOOKING_NOT_VERIFIED');
    const item={event_id:r.id,event_name:str(Array.isArray(row)?row[1]:row.event_name),event_date_text:r.date,available_phone_count:r.available,dom_verified:why.indexOf('RENDERED_BOOKING_NOT_VERIFIED')===-1};
    (why.length?rejected:candidates).push(why.length?{...item,reasons:why}:item);
  }
  return {source_rows:rows.length,unique_events:latest.size,candidates,rejected,production_writes:0,auto_publish:false};
}
module.exports={discover};
