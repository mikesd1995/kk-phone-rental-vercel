'use strict';

const VERSION='KK_ULTRA_DEEP_RECONCILIATION_V2';

const EVENT_INTENT_RE=/(concert|tour|fan\s*meet(?:ing)?|fanmeeting|fan\s*con|fancon|fan\s*sign|fansign|showcase|festival|live\s*(?:show|performance|concert)?|music\s*(?:show|event|festival)|award|meet\s*(?:&|and)?\s*greet|lucky\s*fan|artist\s*event|คอนเสิร์ต|แฟนมีต|แฟนคอน|แฟนไซน์|โชว์เคส|เฟสติวัล|เทศกาลดนตรี|งานดนตรี|กิจกรรมศิลปิน)/i;
const BANGKOK_SCOPE_RE=/(bangkok|bkk|กรุงเทพ|nonthaburi|นนทบุรี|pathum\s*thani|ปทุมธานี|samut\s*prakan|สมุทรปราการ|muang\s*thong|เมืองทอง|impact\s*arena|impact\s*challenger|thunder\s*dome|ธันเดอร์โดม|union\s*hall|ยูเนี่ยน\s*ฮอลล์|qsncc|queen\s*sirikit|ศูนย์สิริกิติ์)/i;
const EVENT_SOURCE_HOST_RE=/(^|\.)(thaiticketmajor\.com|allticket\.com|eventpop\.me|ticketmelon\.com|livenation\.co\.th|impact\.co\.th|theconcert\.com)$/i;

function text(v){return String(v==null?'':v).trim();}
function norm(v){return text(v).toLowerCase().replace(/[^a-z0-9฀-๿]+/g,' ').replace(/\s+/g,' ').trim();}
function date(v){const s=text(v);if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const m=s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);return m?m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'):s;}
function host(v){try{return new URL(text(v)).hostname.toLowerCase();}catch(_){return '';}}

function key(row={}){
  return [norm(row.title||row.event_name),date(row.event_date)].join('|');
}

function hasComparableEventIdentity(row={}){
  const title=norm(row.title||row.event_name);
  const eventDate=date(row.event_date);
  return Boolean(title && /^\d{4}-\d{2}-\d{2}$/.test(eventDate));
}

function referenceEligibilityDecision(row={},scope={}){
  if(row&&row.eligible_for_discovery===false) return {eligible:false,reason:'EXPLICITLY_INELIGIBLE'};
  if(!hasComparableEventIdentity(row)) return {eligible:true,reason:'UNSTRUCTURED_REFERENCE'};

  const eventDate=date(row.event_date);
  const month=text(scope.month);
  if(/^\d{4}-\d{2}$/.test(month)&&!eventDate.startsWith(month+'-')){
    return {eligible:false,reason:'OUTSIDE_TARGET_MONTH'};
  }

  const target=norm(scope.location);
  const evidence=[row.title,row.event_name,row.venue,row.location,row.search_context].map(text).filter(Boolean).join(' ');
  if(target.includes('bangkok')){
    if(!BANGKOK_SCOPE_RE.test(evidence)){
      return {eligible:false,reason:'TARGET_LOCATION_NOT_PROVEN'};
    }
  }

  const eventIntent=EVENT_INTENT_RE.test(evidence)||EVENT_SOURCE_HOST_RE.test(host(row.source_url));
  if(!eventIntent) return {eligible:false,reason:'EVENT_INTENT_NOT_PROVEN'};

  return {eligible:true,reason:'ELIGIBLE_STRUCTURED_REFERENCE'};
}

function scopeReferenceCandidates(reference=[],scope={}){
  return (Array.isArray(reference)?reference:[]).filter(Boolean).map(row=>{
    const decision=referenceEligibilityDecision(row,scope);
    return Object.assign({},row,{
      eligible_for_discovery:decision.eligible,
      reference_eligibility_reason:decision.reason
    });
  });
}

function reconcileCandidateSets(discovered=[],reference=[]){
  const found=new Set((Array.isArray(discovered)?discovered:[]).filter(hasComparableEventIdentity).map(key));
  const refs=(Array.isArray(reference)?reference:[]).filter(Boolean);
  const ineligible=refs.filter(row=>row.eligible_for_discovery===false);
  const eligibleRefs=refs.filter(row=>row.eligible_for_discovery!==false);
  const comparableRefs=eligibleRefs.filter(hasComparableEventIdentity);
  const missing=[];
  const matched=[];
  for(const row of comparableRefs){
    const k=key(row);
    if(found.has(k))matched.push({reference_id:text(row.reference_id)||null,key:k});
    else missing.push({
      reference_id:text(row.reference_id)||null,
      title:text(row.title||row.event_name)||null,
      event_date:date(row.event_date)||null,
      source_url:text(row.source_url)||null
    });
  }
  const ineligibleReasons={};
  for(const row of ineligible){
    const reason=text(row.reference_eligibility_reason)||'INELIGIBLE';
    ineligibleReasons[reason]=(ineligibleReasons[reason]||0)+1;
  }
  return {
    version:VERSION,
    complete:comparableRefs.length>0&&missing.length===0,
    reconciliation_gap_count:missing.length,
    reference_count:comparableRefs.length,
    raw_reference_count:refs.length,
    ineligible_reference_count:ineligible.length,
    ineligible_reference_reasons:ineligibleReasons,
    unstructured_reference_count:eligibleRefs.length-comparableRefs.length,
    matched_count:matched.length,
    missing_candidates:missing,
    production_writes:0
  };
}

function classifyAgainstSot(candidates=[],context={}){
  const events=Array.isArray(context.events)?context.events:[];
  const archive=Array.isArray(context.archive)?context.archive:[];
  const locks=Array.isArray(context.visibility_locks)?context.visibility_locks:[];
  const bookings=Array.isArray(context.bookings)?context.bookings:[];
  const eventByKey=new Map(events.map(e=>[key(e),e]));
  const archiveKeys=new Set(archive.map(key));
  const lockedIds=new Set(locks.filter(x=>String(x&&x.locked||x&&x.active||'').toLowerCase()!=='false').map(x=>text(x.event_id)));
  const bookedIds=new Set(bookings.filter(x=>!['cancelled','canceled','no_show'].includes(norm(x.booking_status))).map(x=>text(x.event_id)));

  return (Array.isArray(candidates)?candidates:[]).map(c=>{
    const existing=eventByKey.get(key(c));
    const eventId=text(existing&&existing.event_id);
    let classification='NEW';
    if(existing){
      const active=String(existing.active_on_web).toLowerCase()==='true';
      classification=active?'EXISTING_VISIBLE':'EXISTING_HIDDEN';
    }else if(archiveKeys.has(key(c))) classification='ARCHIVED';
    if(eventId&&lockedIds.has(eventId)) classification='TOMBSTONED';
    if(eventId&&bookedIds.has(eventId)) classification='BOOKED';
    return {
      candidate_id:text(c.candidate_id)||null,
      title:text(c.title)||null,
      event_date:date(c.event_date)||null,
      event_id:eventId||null,
      classification,
      allow_auto_create:classification==='NEW',
      allow_auto_reprice:!['BOOKED','TOMBSTONED','EXISTING_HIDDEN','ARCHIVED'].includes(classification)
    };
  });
}

module.exports={
  VERSION,EVENT_INTENT_RE,BANGKOK_SCOPE_RE,EVENT_SOURCE_HOST_RE,
  key,hasComparableEventIdentity,referenceEligibilityDecision,scopeReferenceCandidates,
  reconcileCandidateSets,classifyAgainstSot
};
