'use strict';

// Read-only handover advisory. Never authorizes asset allocation or booking writes.
const VERSION='KK_BOOKING_HANDOVER_SAFETY_SHADOW_V1';
const ACTIVE=new Set(['confirmed','prepared','picked_up','returned','uploaded']);
const clean=v=>String(v==null?'':v).trim();
function isoDate(value){
  const s=clean(value);
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)){
    const d=new Date(s+'T00:00:00Z');
    return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s?s:'';
  }
  const m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if(m){
    const y=Number(m[3])>2500?Number(m[3])-543:Number(m[3]);
    return isoDate(String(y)+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'));
  }
  if(/^\d{5}$/.test(s)&&Number(s)>40000&&Number(s)<80000){
    return new Date((Number(s)-25569)*86400000).toISOString().slice(0,10);
  }
  return '';
}
function adjacent(a,b){
  if(!a||!b)return false;
  return Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z')===86400000;
}
function audit(bookings=[],options={}){
  const focusSpecified=Object.prototype.hasOwnProperty.call(options,'focusDates');
  const focus=Array.isArray(options.focusDates)?new Set(options.focusDates.map(isoDate).filter(Boolean)):null;
  const invalidFocus=focusSpecified&&(!Array.isArray(options.focusDates)||options.focusDates.length===0||options.focusDates.some(date=>!isoDate(date)));
  const rows=[];
  for(const r of Array.isArray(bookings)?bookings:[]){
    const status=clean(r&&r.booking_status).toLowerCase();
    const id=clean(r.phone_asset_id);
    // A pending request with a reserved phone still participates in asset safety.
    if(!ACTIVE.has(status)&&!(status==='pending'&&id))continue;
    const day=isoDate(r.event_date);
    if(focus&&(!day||!focus.has(day)))continue;
    rows.push({day,id,pickup:!!clean(r.pickup_time),return:!!clean(r.return_time)});
  }
  const counts={active_checked:rows.length,invalid_focus_dates:invalidFocus?1:0,missing_event_date:0,missing_asset:0,missing_pickup:0,missing_return:0,same_day_asset_duplicates:0,adjacent_day_asset_reuse:0,unverified_interday_handover:0};
  const byDay=new Map();
  for(const r of rows){
    if(!r.day)counts.missing_event_date++;
    if(!r.id)counts.missing_asset++;
    if(!r.pickup)counts.missing_pickup++;
    if(!r.return)counts.missing_return++;
    if(!r.day||!r.id)continue;
    if(!byDay.has(r.day))byDay.set(r.day,new Map());
    const devices=byDay.get(r.day);
    const prev=devices.get(r.id);
    if(prev)counts.same_day_asset_duplicates++;
    else devices.set(r.id,r);
  }
  const days=[...byDay.keys()].sort();
  for(let i=0;i<days.length-1;i++){
    if(!adjacent(days[i],days[i+1]))continue;
    const prev=byDay.get(days[i]),next=byDay.get(days[i+1]);
    for(const [id,left] of prev){
      const right=next.get(id);
      if(!right)continue;
      counts.adjacent_day_asset_reuse++;
      if(!left.return||!right.pickup)counts.unverified_interday_handover++;
    }
  }
  const blockers=Object.entries(counts).filter(([key,n])=>(key.startsWith('missing_')||key==='invalid_focus_dates')&&n>0||['same_day_asset_duplicates','unverified_interday_handover'].includes(key)&&n>0).map(([key])=>key.toUpperCase());
  const review=counts.adjacent_day_asset_reuse>0;
  return {version:VERSION,mode:'READ_ONLY_SHADOW',status:blockers.length?'BLOCKED':review?'OWNER_REVIEW_REQUIRED':'NO_OBSERVED_BLOCKER',blockers,counts,owner_review_required:review||blockers.length>0,authorizes_booking_write:false,authorizes_asset_allocation:false,production_writes:0};
}
module.exports={VERSION,isoDate,adjacent,audit};
