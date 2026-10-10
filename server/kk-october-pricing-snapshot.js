'use strict';
// Zero-cost pure adapter between canonical read-only Core Sheet rows and
// October 2026 Demand Shadow. No connector, mutation, network, or PII output.
const VERSION='KK_OCT2026_PRICING_SNAPSHOT_V2_OFFICIAL_DATES';
const ACTIVE_BOOKING=new Set(['pending','confirmed','prepared','picked_up','returned','uploaded']);
const CLOSABLE=new Set(['completed']);
const PACKAGE=new Set(['phone_only','phone_lens_bundle']);
const TIMEZONE='Asia/Bangkok';
function text(v){return String(v===null||v===undefined?'':v).trim();}
function yes(v){return v===true||v===1||['true','1','yes','on'].includes(text(v).toLowerCase());}
function money(v){
 const str=text(v),n=Number(/^[0-9]{1,3}(,[0-9]{3})+$/.test(str)?str.replace(/,/g,''):str);
 return str&&Number.isFinite(n)&&n>0&&n<10000?n:null;
}
function serialDate(v){
 // Google Sheets stores dates as numeric serials; using toString() on cells
 // previously caused a silent failure of ALL October Booking-day locks.
 const val=text(v);
 const m=val.match(/^([0-3]?\d)\/([01]?\d)\/(20\d{2})$/);
 if(m)return isoDate(Number(m[3]),Number(m[2]),Number(m[1]));
 if(/^20\d{2}-\d{2}-\d{2}$/.test(val))return validISO(val)?val:null;
 const n=Number(val);
 if(!val||!Number.isInteger(n)||n<40000||n>100000)return null;
 const stamp=Date.UTC(1899,11,30)+86400000*n;
 const out=new Date(stamp).toISOString().slice(0,10);
 return validISO(out)?out:null;
}
function isoDate(y,m,d){
 const v=[y,String(m).padStart(2,'0'),String(d).padStart(2,'0')].join('-');
 return validISO(v)?v:null;
}
function validISO(value){
 const s=text(value);
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(s))return false;
 const dt=new Date(s+'T00:00:00Z');
 return Number.isFinite(dt.getTime())&&dt.toISOString().slice(0,10)===s;
}
function findPackage(rows,id,type){
 return (Array.isArray(rows)?rows:[]).find(r=>Array.isArray(r)&&text(r[1])===id&&
   text(r[2]).toLowerCase()===type);
}
function currentSnapshot(eventRow,packageRows,bookingRows,options={}){
 if(!Array.isArray(eventRow))throw Error('event row required');
 const eventId=text(eventRow[0]),eventDate=serialDate(eventRow[2]);
 if(!eventId||!eventDate||!eventDate.startsWith('2026-10-'))throw Error('OCTOBER_2026_ONLY');
 const phone=findPackage(packageRows,eventId,'phone_only');
 const bundle=findPackage(packageRows,eventId,'phone_lens_bundle');
 const all=Array.isArray(bookingRows)?bookingRows:[];
 const locked=all.filter(r=>Array.isArray(r)&&serialDate(r[21])===eventDate&&
  ACTIVE_BOOKING.has(text(r[2]).toLowerCase()));
 const vis=text(eventRow[6]).toLowerCase();
 const hidden=vis==='false'||vis==='0'||vis==='hide'||vis==='hidden'||eventRow[6]===false;
 const inventory=phone&&['available','open'].includes(text(phone[9]).toLowerCase())?
  Number(text(phone[8])):null;
 const schedule=options.officialSchedule||{};
 // Official festival date windows trump third-party calendars; NEVER infer
 // a phantom rental day from an aggregator when primary evidence conflicts.
 const scheduleVerified=schedule.verified===true&&
  /^https:\/\//i.test(text(schedule.source_url))&&Array.isArray(schedule.dates)&&
  schedule.dates.length>0&&schedule.dates.every(d=>validISO(d));
 const officialDateConflict=scheduleVerified&&!schedule.dates.includes(eventDate);
 const input={
  event_id:eventId,event_date:eventDate,event_verified:options.eventVerified===true,
  owner_hidden:hidden||yes(options.ownerHidden),tombstone_locked:yes(options.tombstoneLocked),
  owner_price_locked:yes(options.ownerPriceLocked),
  has_active_booking_on_date:locked.length>0,
  available_inventory:Number.isSafeInteger(inventory)&&inventory>=0?inventory:null,
  current_phone_price:phone?money(phone[7]):null,
  current_bundle_price:bundle?money(bundle[7]):null,
  // Unknown search is NOT searched-zero. Caller must supply verified receipts.
  competitor_market_status:'UNKNOWN',
  independent_competitors:null,
  signals:{},competitor_evidence:[],completed_history:[],
  event_source_conflict:yes(options.eventSourceConflict)||officialDateConflict,
  production_writes:0
 };
 // No customer names, phone numbers, Line IDs or exact identity-bearing
 // booking records leave this adapter.
 return {
  schema_version:VERSION,scope:'2026-10',timezone:TIMEZONE,
  read_only:true,production_writes:0,input,
  safety_summary:{active_bookings_on_date:locked.length,
   poster_source_present:/^https:\/\//i.test(text(eventRow[4])),
   approved_owner_lock:input.owner_price_locked,
   availability_verified:input.available_inventory!==null,
   market_search_unverified:true,
   first_party_schedule_checked:scheduleVerified,
   event_date_conflicts_official:scheduleVerified&&officialDateConflict,
   official_schedule_source:scheduleVerified?text(schedule.source_url):null}
 };
}
function completedComparableHistory(bookingRows,options={}){
 // Comparable ids must have explicit independent Verifier approval. A shared
 // fandom name, a booking amount, or matching date alone does not suffice.
 const sourceSet=new Set((options.verifiedComparableEventIds||[]).map(text));
 const target=text(options.targetEventId);
 const targetDate=serialDate(options.targetEventDate);
 const seen=new Set(),out=[];
 for(const r of Array.isArray(bookingRows)?bookingRows:[]){
  if(!Array.isArray(r)||!CLOSABLE.has(text(r[2]).toLowerCase()))continue;
  const id=text(r[3]),date=serialDate(r[21]),bookingId=text(r[0]);
  const amount=money(r[14]),kind=text(r[8]).toLowerCase();
  if(!sourceSet.has(id)||!bookingId||seen.has(bookingId)||id===target||
   !date||!targetDate||date>=targetDate||amount===null||!PACKAGE.has(kind))continue;
  seen.add(bookingId);
  out.push({event_id:id,event_date:date,booking_id:bookingId,
   booking_status:'completed',package_type:kind,paid_price:amount,
   source_ref:'CORE_COMPLETED_BOOKING:'+bookingId,verified:true,
   comparable_verified:true});
 }
 return out;
}
module.exports={VERSION,ACTIVE_BOOKING,serialDate,currentSnapshot,completedComparableHistory};
