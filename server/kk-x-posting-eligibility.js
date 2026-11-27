'use strict';

// Read-only eligibility contract for owner-approved X posting plans.
// Callers must provide fresh canonical Web Ready + Post Log readbacks;
// an event verified elsewhere is not sufficient evidence of bookability.
const SOURCE='08_Web_Ready';
const BLOCKING_STATUSES=new Set(['confirmed_posted','assumed_posted','planned']);
const MAX_READBACK_AGE_MS=6*60*60*1000;
function text(x){return String(x==null?'':x).trim();}
function ms(x){
  const value=text(x);
  if(!value)return null;
  const local=value.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if(local){
    const [,day,month,year,hour,minute]=local.map(Number);
    if(day<1||day>31||month<1||month>12||hour>23||minute>59)return null;
    const utc=Date.UTC(year,month-1,day,hour-7,minute);
    const verify=new Date(utc+7*3600000);
    if(verify.getUTCDate()!==day||verify.getUTCMonth()+1!==month)return null;
    return utc;
  }
  const n=Date.parse(value);
  return Number.isFinite(n)?n:null;
}
function operatingDay(timestamp){
  const value=ms(timestamp);
  if(value===null)return '';
  // BKK is UTC+7 and day starts 06:00, hence UTC timestamp + 1h.
  return new Date(value+3600000).toISOString().slice(0,10);
}
function bangkokDate(timestamp){
  const value=ms(timestamp);
  return value===null?'':new Date(value+7*3600000).toISOString().slice(0,10);
}
function eventDay(value){
  const m=text(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(!m)return '';
  const [,d,mo,y]=m.map(Number);
  const date=new Date(Date.UTC(y,mo-1,d));
  return date.getUTCFullYear()===y&&date.getUTCMonth()+1===mo&&date.getUTCDate()===d?
    date.toISOString().slice(0,10):'';
}
function fresh(timestamp,now){
  // A date-only string is not evidence of a recent actual readback.
  const stamped=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
  if(!stamped.test(text(timestamp)))return false;
  const at=ms(timestamp),base=ms(now);
  return at!==null&&base!==null&&base-at<=MAX_READBACK_AGE_MS&&base-at>=-5*60*1000;
}
function webRow(row){
  if(Array.isArray(row))return {id:text(row[0]),date:text(row[2]),status:text(row[8]),action:text(row[9]).toLowerCase(),available:Number(row[6])};
  return {id:text(row?.event_id),date:text(row?.event_date_text),status:text(row?.booking_status_for_web),action:text(row?.action_for_web).toLowerCase(),available:Number(row?.available_phone_count)};
}
function logRow(row){
  if(Array.isArray(row))return {id:text(row[2]),date:row[1],status:text(row[6]).toLowerCase()};
  return {id:text(row?.event_id),date:row?.planned_at||row?.published_at||row?.logged_at,status:text(row?.status).toLowerCase()};
}
function inputGate(input={}){
  const errors=[];
  const now=input.now||new Date().toISOString();
  if(input.storefront_source!==SOURCE||input.storefront_verified!==true||!Array.isArray(input.storefront_rows)||!fresh(input.storefront_readback_at,now))
    errors.push('FRESH_STOREFRONT_READBACK_REQUIRED');
  if(input.post_log_verified!==true||!Array.isArray(input.post_log)||!fresh(input.post_log_readback_at,now))
    errors.push('FRESH_POST_LOG_READBACK_REQUIRED');
  return {errors,now,operating_day:operatingDay(now)};
}
function eligibility(candidate={},input={},context=inputGate(input)){
  const errors=[];
  const id=text(candidate.event_id),date=text(candidate.event_date_text);
  if(candidate.verified_event!==true)errors.push('EVENT_NOT_VERIFIED');
  if(!text(candidate.event||candidate.name||candidate.title))errors.push('EVENT_NAME_REQUIRED');
  if(candidate.verified_pricing!==true)errors.push('PRICE_NOT_VERIFIED');
  if(!id||!eventDay(date))errors.push('EVENT_ID_DATE_REQUIRED');
  if(eventDay(date)&&eventDay(date)<bangkokDate(context.now))errors.push('EVENT_DATE_IN_PAST');
  if(context.errors.length)errors.push(...context.errors);
  if(!context.errors.includes('FRESH_STOREFRONT_READBACK_REQUIRED')){
    const exact=(input.storefront_rows||[]).map(webRow).filter(r=>r.id===id&&r.date===date);
    if(exact.length!==1)errors.push('EXACT_STOREFRONT_ROW_REQUIRED');
    else if(exact[0].action!=='show'||exact[0].status!=='เปิดจอง'||!Number.isFinite(exact[0].available)||exact[0].available<=0)
      errors.push('STOREFRONT_NOT_RENTABLE');
  }
  if(!context.errors.includes('FRESH_POST_LOG_READBACK_REQUIRED')){
    const relevant=(input.post_log||[]).map(logRow).filter(row=>
      row.id===id&&BLOCKING_STATUSES.has(row.status));
    if(relevant.some(row=>!operatingDay(row.date)))errors.push('POST_LOG_DATE_UNVERIFIED');
    if(relevant.some(row=>operatingDay(row.date)===context.operating_day))
      errors.push('DAILY_DUPLICATE_REJECT');
  }
  return {eligible:errors.length===0,errors:[...new Set(errors)]};
}
module.exports={SOURCE,BLOCKING_STATUSES,MAX_READBACK_AGE_MS,operatingDay,bangkokDate,eventDay,webRow,logRow,inputGate,eligibility};
