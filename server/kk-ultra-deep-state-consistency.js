'use strict';
const VERSION='KK_ULTRA_DEEP_STATE_CONSISTENCY_V2';
function text(v){return String(v==null?'':v).trim();}
function bool(v){return v===true||String(v).toLowerCase()==='true';}
function dateKey(v){return text(v).slice(0,10);}
const ACTIVE_BOOKING_STATUSES=new Set(['pending','confirmed','prepared','picked_up']);
function bookingState(input={}){const dates=new Set(),events=new Set();for(const b of input.bookings||[]){if(!ACTIVE_BOOKING_STATUSES.has(text(b.booking_status).toLowerCase()))continue;const d=dateKey(b.event_date);if(d)dates.add(d);const id=text(b.event_id);if(id)events.add(id);}return {dates,events};}
function audit(input={}){
 const lockById=new Map((input.visibility_locks||[]).map(x=>[text(x.event_id),x])),webById=new Map((input.web_ready||[]).map(x=>[text(x.event_id),x])),booking=bookingState(input),violations=[];
 for(const e of input.events||[]){
  const id=text(e.event_id);if(!id)continue;const l=lockById.get(id)||{},state=text(l.lock_state||l.history_state).toUpperCase(),reason=text(l.lock_reason||l.history_reason).toUpperCase();
  const active=bool(e.active_on_web),action=text((webById.get(id)||{}).action_for_web).toLowerCase(),visible=['show','show_full'].includes(action),ownerKeep=reason.startsWith('OWNER_KEEP'),dateBlocked=booking.dates.has(dateKey(e.event_date))&&!booking.events.has(id);
  if(state==='LOCKED'&&active)violations.push({severity:'CRITICAL',event_id:id,code:'LOCKED_BUT_CORE_ACTIVE'});
  if(state==='LOCKED'&&visible)violations.push({severity:'CRITICAL',event_id:id,code:'LOCKED_BUT_PRODUCTION_VISIBLE'});
  if(dateBlocked&&active)violations.push({severity:'CRITICAL',event_id:id,code:'OTHER_EVENT_ACTIVE_ON_BOOKING_DAY'});
  if(dateBlocked&&visible)violations.push({severity:'CRITICAL',event_id:id,code:'OTHER_EVENT_VISIBLE_ON_BOOKING_DAY'});
  if((state==='REOPENED'||ownerKeep)&&!active&&!dateBlocked)violations.push({severity:'ERROR',event_id:id,code:'OWNER_VISIBLE_INTENT_BUT_CORE_HIDDEN'});
  if(active&&action==='hide')violations.push({severity:'ERROR',event_id:id,code:'CORE_ACTIVE_BUT_WEB_HIDE'});
  if(!active&&visible)violations.push({severity:'CRITICAL',event_id:id,code:'CORE_HIDDEN_BUT_WEB_VISIBLE'});
 }
 return {version:VERSION,status:violations.some(x=>x.severity==='CRITICAL')?'FAIL_CLOSED':violations.length?'RECONCILE_REQUIRED':'PASS',violations,counts:{total:violations.length,critical:violations.filter(x=>x.severity==='CRITICAL').length,error:violations.filter(x=>x.severity==='ERROR').length},production_writes:0};
}
module.exports={VERSION,ACTIVE_BOOKING_STATUSES,dateKey,bookingState,audit};