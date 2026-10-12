'use strict';
/* Pure, no-write source-of-truth consistency check before commercial planning.
 * Based on PR #655 but strengthens date+canonical event-ID booking provenance.
 */
const Production=require('./kk-ultra-deep-production-runtime.js');
const VERSION='KK_ULTRA_DEEP_STATE_CONSISTENCY_V3_EXACT_DAY_BOOKING';
const ACTIVE_BOOKING_STATUSES=new Set(['pending','confirmed','prepared','picked_up']);
function text(v){return String(v==null?'':v).trim();}
function dateKey(v){return Production.date(v);}
function flag(v){return v===true||String(v||'').toLowerCase()==='true';}
function bookingState(input={}){
 const dates=new Set(),byDate=new Map();
 for(const b of Array.isArray(input.bookings)?input.bookings:[]){
  if(!ACTIVE_BOOKING_STATUSES.has(text(b.booking_status).toLowerCase()))continue;
  const day=dateKey(b.event_date);if(!day)continue;
  dates.add(day);if(!byDate.has(day))byDate.set(day,new Set());
  if(text(b.event_id))byDate.get(day).add(text(b.event_id));
 }
 return {dates,byDate};
}
function audit(snapshot={}){
 const locks=new Map((snapshot.visibility_locks||[]).filter(x=>text(x.event_id)).map(x=>[text(x.event_id),x]));
 const web=new Map((snapshot.web_ready||[]).filter(x=>text(x.event_id)).map(x=>[text(x.event_id),x]));
 const booking=bookingState(snapshot),violations=[];
 for(const event of Array.isArray(snapshot.events)?snapshot.events:[]){
  const id=text(event.event_id);if(!id)continue;
  const lock=locks.get(id)||{},status=text(lock.lock_state||lock.history_state).toUpperCase();
  const reason=text(lock.lock_reason||lock.history_reason).toUpperCase();
  const day=dateKey(event.event_date);
  const bookedSameEvent=!!day&&booking.byDate.get(day)?.has(id)===true;
  const blockedByOtherBooking=!!day&&booking.dates.has(day)&&!bookedSameEvent;
  const coreVisible=flag(event.active_on_web);
  const action=text((web.get(id)||{}).action_for_web).toLowerCase();
  const publicVisible=['show','show_full'].includes(action);
  const critical=(code)=>violations.push({severity:'CRITICAL',event_id:id,event_date:day,code});
  const error=(code)=>violations.push({severity:'ERROR',event_id:id,event_date:day,code});
  if(status==='LOCKED'&&coreVisible)critical('LOCKED_BUT_CORE_ACTIVE');
  if(status==='LOCKED'&&publicVisible)critical('LOCKED_BUT_PRODUCTION_VISIBLE');
  if(blockedByOtherBooking&&coreVisible)critical('OTHER_EVENT_ACTIVE_ON_BOOKING_DAY');
  if(blockedByOtherBooking&&publicVisible)critical('OTHER_EVENT_VISIBLE_ON_BOOKING_DAY');
  if((status==='REOPENED'||reason.startsWith('OWNER_KEEP'))&&!coreVisible&&!blockedByOtherBooking)error('OWNER_VISIBLE_INTENT_BUT_CORE_HIDDEN');
  if(coreVisible&&action==='hide')error('CORE_ACTIVE_BUT_WEB_HIDE');
  if(!coreVisible&&publicVisible)critical('CORE_HIDDEN_BUT_WEB_VISIBLE');
 }
 const critical=violations.filter(x=>x.severity==='CRITICAL').length;
 return {version:VERSION,status:critical?'FAIL_CLOSED':violations.length?'RECONCILE_REQUIRED':'PASS',
  violations,counts:{total:violations.length,critical,error:violations.length-critical},
  checked_events:(snapshot.events||[]).length,active_booking_dates:[...booking.dates].sort(),
  read_only:true,production_writes:0,authoritative:false};
}
module.exports={VERSION,ACTIVE_BOOKING_STATUSES,dateKey,bookingState,audit};
