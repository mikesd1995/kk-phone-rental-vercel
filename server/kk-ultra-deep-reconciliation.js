'use strict';

const VERSION='KK_ULTRA_DEEP_RECONCILIATION_V3';

function text(v){return String(v==null?'':v).trim();}
function norm(v){return text(v).toLowerCase().replace(/[^a-z0-9฀-๿]+/g,' ').replace(/\s+/g,' ').trim();}
function date(v){const s=text(v);if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const m=s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);return m?m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'):s;}

function key(row={}){
  return [norm(row.title||row.event_name),date(row.event_date)].join('|');
}

function eventSeriesTitle(value){
  let s=text(value).replace(/\u2026|\.\.\.+/g,' ').trim();
  s=s.replace(/^\s*(?:tickets?|official\s+ticket)\s*[:|]\s*/i,'');
  s=s.replace(/,\s*(?:Bangkok|กรุงเทพ(?:มหานคร)?)\s*,?\s*(?:(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)\s*,?\s*)?\d{1,2}\s+[A-Za-z]+\s+20\d{2}.*$/i,'');
  s=s.replace(/,\s*(?:Bangkok|กรุงเทพ(?:มหานคร)?)\s*,?\s*(?:(?:Mon(?:day)?|Tue(?:sday)?|Wed(?:nesday)?|Thu(?:rsday)?|Fri(?:day)?|Sat(?:urday)?|Sun(?:day)?)\s*,?\s*)?[A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?(?:,)?\s+20\d{2}.*$/i,'');
  return norm(s);
}

function reconcileKey(row={}){
  return [eventSeriesTitle(row.title||row.event_name),date(row.event_date)].join('|');
}

function hasComparableEventIdentity(row={}){
  const title=norm(row.title||row.event_name);
  const eventDate=date(row.event_date);
  return Boolean(title && /^\d{4}-\d{2}-\d{2}$/.test(eventDate));
}

const TRUSTED_THAI_EVENT_HOSTS=new Set([
  'thaiticketmajor.com','www.thaiticketmajor.com',
  'eventpop.me','www.eventpop.me',
  'ticketmelon.com','www.ticketmelon.com',
  'allticket.com','www.allticket.com',
  'livenationtero.co.th','www.livenationtero.co.th',
  'paragonhall.com','www.paragonhall.com',
  'impact.co.th','www.impact.co.th'
]);
const EVENT_SIGNAL=/\b(concert|fan\s*meet(?:ing)?|fancon|fansign|festival|showcase|tour|special\s+live|live\s+in|artist\s+event|premiere|awards?|birthday\s+event|final\s+ep|special\s+episode)\b|คอนเสิร์ต|แฟนมีต|แฟนคอน|แฟนไซน์|เทศกาล|โชว์เคส|งานศิลปิน|รอบปฐมทัศน์|งานวันเกิด/i;
const LOCATION_SIGNAL=/\b(bangkok|thailand|thai)\b|กรุงเทพ|ประเทศไทย/i;
const OUT_OF_SCOPE_SIGNAL=/\b(codes?|roblox|breathwork|meditation|wellness|workshop|webinar|album\s+review|memories\s+album)\b/i;
const EXPLICIT_FOREIGN_LOCATION=/\b(hong\s*kong|singapore|tokyo|osaka|seoul|taipei|jakarta|manila|kuala\s*lumpur|ho\s*chi\s*minh|hanoi)\b/i;

function sourceHost(row={}){
  try{return new URL(text(row.source_url)).hostname.toLowerCase();}catch(_){return '';}
}
function canonicalSourceUrl(row={}){
  try{const u=new URL(text(row.source_url));u.hash='';u.search='';return u.toString().replace(/\/$/,'');}catch(_){return '';}
}
function sourceDateKey(row={}){const u=canonicalSourceUrl(row),d=date(row.event_date);return u&&/^\d{4}-\d{2}-\d{2}$/.test(d)?u+'|'+d:'';}

function referenceScope(row={},context={}){
  if(!hasComparableEventIdentity(row)) return {eligible:false,reason:'UNSTRUCTURED_REFERENCE'};
  const eventDate=date(row.event_date);
  const month=text(context.month);
  if(/^\d{4}-\d{2}$/.test(month) && !eventDate.startsWith(month+'-')){
    return {eligible:false,reason:'OUT_OF_TARGET_MONTH'};
  }
  const title=text(row.title||row.event_name);
  const venue=text(row.venue);
  const source=text(row.source_url);
  const combined=[title,venue,source].filter(Boolean).join(' ');
  const host=sourceHost(row);
  if(EXPLICIT_FOREIGN_LOCATION.test(combined) && !LOCATION_SIGNAL.test([title,venue].join(' '))){
    return {eligible:false,reason:'EXPLICIT_FOREIGN_LOCATION'};
  }
  if(OUT_OF_SCOPE_SIGNAL.test(title)){
    return {eligible:false,reason:'NON_RENTAL_EVENT_CATEGORY'};
  }
  if(/^\s*(home|homepage)\b/i.test(title)){
    return {eligible:false,reason:'GENERIC_REFERENCE_PAGE'};
  }
  const eventSignal=EVENT_SIGNAL.test(title);
  const locationSignal=LOCATION_SIGNAL.test([title,venue].join(' '));
  const trustedThaiHost=TRUSTED_THAI_EVENT_HOSTS.has(host);
  if(!eventSignal) return {eligible:false,reason:'NO_EVENT_IDENTITY_SIGNAL'};
  if(!locationSignal&&!trustedThaiHost) return {eligible:false,reason:'NO_THAI_LOCATION_PROOF'};
  return {eligible:true,reason:trustedThaiHost?'TRUSTED_THAI_EVENT_HOST':'EXPLICIT_THAI_LOCATION'};
}

function reconcileCandidateSets(discovered=[],reference=[],context={}){
  const discoveredRows=(Array.isArray(discovered)?discovered:[]).filter(hasComparableEventIdentity);
  const found=new Set(discoveredRows.map(reconcileKey));
  const foundSourceDates=new Set(discoveredRows.map(sourceDateKey).filter(Boolean));
  const refs=(Array.isArray(reference)?reference:[]).filter(Boolean);
  const structuredRefs=refs.filter(hasComparableEventIdentity);
  // Generic reconciliation must not infer business scope itself. Runtime callers
  // mark independently searched rows with eligible_for_discovery after applying
  // month/location/category policy. Undefined remains backwards-compatible and
  // eligible for deterministic/unit callers.
  const eligibleRefs=structuredRefs.filter(row=>row.eligible_for_discovery!==false);
  // A scoped, event-specific reference without a structured day is not
  // equivalent to a verified event. It is a pending Verifier obligation.
  // Ordinary unscoped search/calendar pages are still excluded, preserving
  // backwards-compatible reconciliation semantics and zero fake FULL claims.
  const pendingSourceDate=refs.filter(row=>
    row.eligible_for_discovery===true &&
    !hasComparableEventIdentity(row) &&
    !text(row.event_date) &&
    text(row.reference_scope_reason)==='SOURCE_DATE_PENDING_PRIMARY_VERIFIER'
  );
  const missing=pendingSourceDate.map(row=>({
    reference_id:text(row.reference_id)||null,
    title:text(row.title||row.event_name)||null,
    event_date:null,
    source_url:text(row.source_url)||null,
    reason:'SOURCE_EVENT_DATE_PENDING_VERIFIER'
  }));
  const matched=[];
  for(const row of eligibleRefs){
    const k=reconcileKey(row);
    const sdk=sourceDateKey(row);
    if(found.has(k)||Boolean(sdk&&foundSourceDates.has(sdk)))matched.push({reference_id:text(row.reference_id)||null,key:k,match_reason:found.has(k)?'SERIES_TITLE_DATE':'EXACT_SOURCE_URL_DATE'});
    else if(row.eligible_for_discovery!==false)missing.push({
      reference_id:text(row.reference_id)||null,
      title:text(row.title||row.event_name)||null,
      event_date:date(row.event_date)||null,
      source_url:text(row.source_url)||null
    });
  }
  return {
    version:VERSION,
    complete:eligibleRefs.length>0&&missing.length===0,
    reconciliation_gap_count:missing.length,
    reference_count:eligibleRefs.length,
    structured_reference_count:structuredRefs.length,
    raw_reference_count:refs.length,
    excluded_reference_count:structuredRefs.length-eligibleRefs.length,
    unstructured_reference_count:refs.length-structuredRefs.length,
    matched_count:matched.length,
    pending_source_date_count:pendingSourceDate.length,
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

module.exports={VERSION,TRUSTED_THAI_EVENT_HOSTS,key,eventSeriesTitle,reconcileKey,hasComparableEventIdentity,sourceHost,canonicalSourceUrl,sourceDateKey,referenceScope,reconcileCandidateSets,classifyAgainstSot};
