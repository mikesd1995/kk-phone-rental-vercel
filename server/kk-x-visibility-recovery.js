'use strict';

// Temporary, conservative owner-review advisory while X discoverability is unverified.
// This is NOT an X official limit and does not publish anything.
const E=require('./kk-x-posting-eligibility.js');
const MAX_DAILY_RECOMMENDATIONS=2;
const MIN_SPACING_MINUTES=90;
const ACTIVE_STATUSES=new Set(['confirmed_posted','assumed_posted','planned']);
function text(x){return String(x==null?'':x).trim();}
function slotMs(day,time){
  const m=text(time).match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if(!m||!day)return null;
  const hour=Number(m[1]);
  const localDay=new Date(Date.parse(day+'T00:00:00Z')+(hour<6?86400000:0)).toISOString().slice(0,10);
  const parsed=Date.parse(localDay+'T'+time+':00+07:00');
  return Number.isFinite(parsed)?parsed:null;
}
function assess(input={},slots=[],context=E.inputGate(input)){
  const errors=[...context.errors];
  const records=Array.isArray(input.post_log)?input.post_log.map(E.logRow):[];
  const active=records.filter(row=>ACTIVE_STATUSES.has(row.status));
  // When any active record has no reliable timestamp, don't silently assume no prior posts.
  if(active.some(row=>!E.operatingDay(row.date)))errors.push('ACTIVE_POST_LOG_TIME_UNVERIFIED');
  const daily=active.filter(row=>E.operatingDay(row.date)===context.operating_day);
  // Thai dd/mm/yyyy HH:mm timestamps are also supported by eligibility's date parser,
  // so derive those without trusting the host's locale-dependent Date.parse.
  const normalizedTimes=daily.map(row=>{
    const iso=text(row.date);
    const thai=iso.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
    if(thai)return Date.UTC(Number(thai[3]),Number(thai[2])-1,Number(thai[1]),Number(thai[4])-7,Number(thai[5]));
    return Date.parse(iso);
  }).filter(Number.isFinite);
  const allowed_indexes=[],slot_reasons={},scheduled=[];
  const remaining=Math.max(0,MAX_DAILY_RECOMMENDATIONS-daily.length);
  slots.forEach((slot,index)=>{
    const when=slotMs(context.operating_day,slot&&slot.time);
    if(errors.length){slot_reasons[index]='VISIBILITY_EVIDENCE_BLOCKED';return;}
    if(when===null){slot_reasons[index]='INVALID_SLOT_TIME';return;}
    if(allowed_indexes.length>=remaining){slot_reasons[index]='RECOVERY_DAILY_POST_CAP';return;}
    if([...normalizedTimes,...scheduled].some(previous=>Math.abs(when-previous)<MIN_SPACING_MINUTES*60000)){
      slot_reasons[index]='RECOVERY_SPACING_UNDER_90_MIN';return;
    }
    allowed_indexes.push(index);
    scheduled.push(when);
  });
  return {
    mode:'CONSERVATIVE_SHADOWBAN_RISK_RECOVERY_ADVISORY',
    max_daily_recommendations:MAX_DAILY_RECOMMENDATIONS,
    min_spacing_minutes:MIN_SPACING_MINUTES,
    operating_day:context.operating_day,
    existing_active_post_log_rows:daily.length,
    allowed_indexes,
    slot_reasons,
    errors:[...new Set(errors)],
    note:'KK precaution only, not an X platform threshold; verified public X visibility and owner approval still required'
  };
}
module.exports={MAX_DAILY_RECOMMENDATIONS,MIN_SPACING_MINUTES,ACTIVE_STATUSES,slotMs,assess};
