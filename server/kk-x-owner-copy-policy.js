'use strict';

// Owner-approved X commercial-copy contract. Read-only; no publishing or spend.
const VERSION='KK_X_OWNER_COPY_POLICY_V3';
const BRAND='📱 KK Phone Rental | #เช่ามือถือ';
const CTA='👉 เลือกวันแล้วจองคิว';
// Customer-facing X status is binary; internal closed/hidden/owner-locked reasons remain unchanged.
const STATUS=Object.freeze({available:'✅ ว่าง',full:'❌ เต็ม',closed:'❌ เต็ม',hidden:'❌ เต็ม',hide:'❌ เต็ม',owner_closed:'❌ เต็ม',locked:'❌ เต็ม'});
const SAFETY=Object.freeze({owner_approval_required:true,auto_publish:false,production_writes:0});

function text(value){return String(value===null||value===undefined?'':value).trim();}
function uniq(a){return [...new Set(a.filter(Boolean))];}
function requiresPolicy(input={}){
  return input.owner_x_policy_required===true ||
    text(input.requested_intent).toLowerCase()==='direct_rental_x';
}
function validatePost(post,input={}){
  const errors=[];
  if(!requiresPolicy(input))return {schema_version:VERSION,gate:'NOT_APPLICABLE',errors:[],safety:SAFETY};
  if(input.recent_context_checked!==true)errors.push('OWNER_X_RECENT_POST_HISTORY_NOT_CHECKED');
  const copy=text(post);
  const lines=copy.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  if(lines[0]!==BRAND)errors.push('OWNER_X_BRAND_HEADER_REQUIRED');
  if(lines.filter(line=>line===BRAND).length!==1)errors.push('OWNER_X_BRAND_HEADER_ONCE_ONLY');
  if(lines.slice(1).some(line=>/\bKK\b|KK Phone Rental/iu.test(line.replace(/(?:https?:\/\/)?kk-phone-rental\.vercel\.app\/?/giu,''))))errors.push('OWNER_X_BRAND_REPEATED_IN_BODY');

  const price=text(input.price_display);
  const offerLines=price?lines.filter(line=>line.includes(price)):[];
  if(!price||offerLines.length!==1)errors.push('OWNER_X_SINGLE_VERIFIED_OFFER_LINE_REQUIRED');
  const model=(text(input.model_display)||'vivo X300 Pro').toLowerCase();
  const modelLines=lines.filter(line=>line.toLowerCase().includes(model));
  if(modelLines.length!==1||!offerLines.includes(modelLines[0]))errors.push('OWNER_X_MODEL_ONLY_ON_PRICE_LINE');

  // X Premium long-form posts must have one natural booking CTA, not a
  // single fixed phrase repeated across all artists.
  const ctaLines=lines.filter(line=>/^👉\s*/u.test(line));
  if(ctaLines.length!==1 || ctaLines[0].length>180 ||
    !/(?:จอง|เช็กคิว|สำรอง)/u.test(ctaLines[0]))
    errors.push('OWNER_X_SINGLE_EVENT_CTA_REQUIRED');
  const usedTags=uniq((copy.match(/#[\p{L}\p{M}\p{N}_]+/gu)||[]).map(tag=>tag.toLowerCase()));
  const verifiedTags=new Set([
    '#เช่ามือถือ',text(input.official_event_hashtag).toLowerCase(),
    ...(Array.isArray(input.verified_hashtags)
      ?input.verified_hashtags.map(value=>text(value).toLowerCase()):[])
  ]);
  if(usedTags.length<5)errors.push('OWNER_X_FIVE_DISTINCT_HASHTAGS_REQUIRED');
  // The brand + official event tag + three relevant closing tags form the
  // owner's minimum X post contract. Do not count scattered tags as a footer.
  const officialTag=text(input.official_event_hashtag).toLowerCase();
  if(!/^#[\p{L}\p{M}\p{N}_]+$/u.test(officialTag) ||
    !lines.slice(1,-1).some(line=>(line.match(/#[\p{L}\p{M}\p{N}_]+/gu)||[])
      .some(tag=>tag.toLowerCase()===officialTag)))
    errors.push('OWNER_X_OFFICIAL_EVENT_HASHTAG_REQUIRED');
  const closingTags=(lines[lines.length-1]||'').match(/#[\p{L}\p{M}\p{N}_]+/gu)||[];
  const closingNormalized=closingTags.map(tag=>tag.toLowerCase());
  if(closingTags.length!==3 || new Set(closingNormalized).size!==3 ||
    !closingNormalized.every(tag=>verifiedTags.has(tag)&&tag!=='#เช่ามือถือ'&&tag!==officialTag) ||
    (lines[lines.length-1]||'').replace(/#[\p{L}\p{M}\p{N}_]+/gu,'').trim()!=='')
    errors.push('OWNER_X_THREE_VERIFIED_CLOSING_HASHTAGS_REQUIRED');

  if(usedTags.some(tag=>!verifiedTags.has(tag)))
    errors.push('OWNER_X_UNVERIFIED_HASHTAG');
  if(!copy.includes('kk-phone-rental.vercel.app'))errors.push('OWNER_X_BOOKING_LINK_REQUIRED');
  if(/(?:\d+\s*\/\s*\d+)\s*(?:เครื่อง)?/u.test(copy)||
    /(?:เหลือ|คงเหลือ|สุดท้าย).{0,22}(?:เครื่อง|คิว)|(?:เครื่อง|คิว)(?:สุดท้าย)/iu.test(copy))
    errors.push('OWNER_X_STOCK_QUANTITY_OR_SCARCITY_FORBIDDEN');

  if(/🚫\s*(?:ปิด(?:รับจอง)?|งด(?:รับจอง)?)/u.test(copy))
    errors.push('OWNER_X_PUBLIC_CLOSED_LABEL_FORBIDDEN');
  const rawStatuses=Array.isArray(input.day_statuses)?input.day_statuses:[];
  if(input.day_statuses_verified!==true)errors.push('OWNER_X_DAY_STATUS_EVIDENCE_REQUIRED');
  if(rawStatuses.length===0)errors.push('OWNER_X_DAY_STATUS_LIST_REQUIRED');
  const eventDates=Array.isArray(input.event_dates)?input.event_dates.map(text).filter(Boolean):[];
  if(input.event_dates_verified!==true||eventDates.length===0)
    errors.push('OWNER_X_ALL_EVENT_DATES_EVIDENCE_REQUIRED');
  const knownDays=new Set();
  for(const day of rawStatuses){
    const label=text(day&&day.date_label),state=text(day&&day.status).toLowerCase();
    if(!label||!Object.prototype.hasOwnProperty.call(STATUS,state)){
      errors.push('OWNER_X_DAY_STATUS_INVALID');continue;
    }
    if(knownDays.has(label))errors.push('OWNER_X_DUPLICATE_SOURCE_DAY:'+label);
    knownDays.add(label);
    const expected=label+' '+STATUS[state];
    if(lines.filter(line=>line===expected).length!==1)errors.push('OWNER_X_DAY_STATUS_MISSING_OR_WRONG:'+label);
    if(lines.some(line=>line.startsWith(label+' ')&&/✅|❌|🚫/u.test(line)&&line!==expected))
      errors.push('OWNER_X_DAY_STATUS_CONTRADICTS_SOURCE:'+label);
  }
  for(const label of new Set(eventDates)){
    if(!knownDays.has(label))errors.push('OWNER_X_SOURCE_DATE_OMITTED:'+label);
  }
  for(const label of knownDays){
    if(!eventDates.includes(label))errors.push('OWNER_X_UNVERIFIED_SOURCE_DATE:'+label);
  }
  for(const line of lines){
    if(/(?:✅\s*ว่าง|❌\s*เต็ม|🚫\s*ปิด)$/u.test(line)&&![...knownDays].some(label=>
      Object.values(STATUS).some(marker=>line===label+' '+marker)))
      errors.push('OWNER_X_UNVERIFIED_DAY_STATUS:'+line);
  }
  return {schema_version:VERSION,gate:errors.length?'BLOCKED':'PASS',errors:uniq(errors),day_statuses_checked:rawStatuses.length,safety:SAFETY};
}
function validateVariants(candidates=[],input={}){
  if(!requiresPolicy(input))return {schema_version:VERSION,gate:'NOT_APPLICABLE',errors:[],results:[],safety:SAFETY};
  const list=Array.isArray(candidates)?candidates:[];
  const errors=[];
  if(list.length!==3)errors.push('OWNER_X_THREE_INTERNAL_CANDIDATES_REQUIRED');
  const results=list.map((candidate,index)=>{
    const copy=typeof candidate==='string'?candidate:text(candidate&&candidate.copy);
    const result=validatePost(copy,input);
    errors.push(...result.errors.map(error=>'CANDIDATE_'+(index+1)+':'+error));
    return result;
  });
  return {schema_version:VERSION,gate:errors.length?'BLOCKED':'PASS',errors:uniq(errors),results,safety:SAFETY};
}
module.exports={VERSION,BRAND,CTA,STATUS,SAFETY,requiresPolicy,validatePost,validateVariants};
