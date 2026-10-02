'use strict';

const VERSION='KK_ULTRA_DEEP_RECONCILIATION_V1';

function text(v){return String(v==null?'':v).trim();}
function norm(v){return text(v).toLowerCase().replace(/[^a-z0-9฀-๿]+/g,' ').replace(/\s+/g,' ').trim();}
function date(v){const s=text(v);if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const m=s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);return m?m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'):s;}

function key(row={}){
  return [norm(row.title||row.event_name),date(row.event_date)].join('|');
}

function hasComparableEventIdentity(row={}){
  const title=norm(row.title||row.event_name);
  const eventDate=date(row.event_date);
  return Boolean(title && /^\d{4}-\d{2}-\d{2}$/.test(eventDate));
}

function reconcileCandidateSets(discovered=[],reference=[]){
  const found=new Set((Array.isArray(discovered)?discovered:[]).filter(hasComparableEventIdentity).map(key));
  const refs=(Array.isArray(reference)?reference:[]).filter(Boolean);
  const comparableRefs=refs.filter(hasComparableEventIdentity);
  const eligibleRefs=comparableRefs.filter(row=>row.eligible_for_discovery!==false);
  const missing=[];
  const matched=[];
  for(const row of eligibleRefs){
    const k=key(row);
    if(found.has(k))matched.push({reference_id:text(row.reference_id)||null,key:k});
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
    structured_reference_count:comparableRefs.length,
    raw_reference_count:refs.length,
    excluded_reference_count:comparableRefs.length-eligibleRefs.length,
    unstructured_reference_count:refs.length-comparableRefs.length,
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

module.exports={VERSION,key,hasComparableEventIdentity,reconcileCandidateSets,classifyAgainstSot};
