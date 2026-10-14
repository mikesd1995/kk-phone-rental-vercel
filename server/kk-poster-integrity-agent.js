'use strict';

// Zero-cost, read-only evidence triage. HTTP image delivery is NOT proof of event identity.
// Visual/OCR observations can be supplied from a separately reviewed provider, but this
// module never calls providers or writes to Google Sheets, GitHub, or production.
const VERSION='KK_POSTER_INTEGRITY_ADVISOR_V1';
const KNOWN_WRONG=Object.freeze({
  'EVT-20261015-LE7EL-1ST-DEBUT-ANNIVERSARY':'https://www.thai2music.com/uploads/artists/photo_cover/cover_1035_1762919037.jpg',
  'EVT-20261025-VVV-TORNADO-SHOPPING-XIAOMI':'https://pbs.twimg.com/media/G3iTTicXMAAbtyE.jpg',
  'EVT-20261030-POPPAH4-HALLOWEEN-NAMP':'https://static.amarintv.com/media/PJVlR0ljpO7yvkfhEH4VNNZ54YMVWAxlVfBQwSENDkv21tWvbtjShU6FnewvzElMDb.jpg'
});
function str(v){return String(v==null?'':v).trim();}
function dateKey(v){
  const s=str(v);let m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if(m){const y=Number(m[3])>2500?Number(m[3])-543:Number(m[3]);const d=`${String(y).padStart(4,'0')}-${m[2]}-${m[1]}`;return validDay(d)?d:'';}
  m=s.match(/^(\d{4}-\d{2}-\d{2})(?:T|$)/);
  return m&&validDay(m[1])?m[1]:'';
}
function validDay(day){
  const m=day.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return false;
  const x=new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])));
  return x.getUTCFullYear()===Number(m[1])&&x.getUTCMonth()===Number(m[2])-1&&x.getUTCDate()===Number(m[3]);
}
function urlKey(v){
  const u=str(v);if(!u)return '';
  try {
    const parsed=new URL(u,'https://kk-phone-rental.vercel.app');
    // Strip only size/fragment/query for known whole-image URLs; Drive IDs are
    // stable across thumbnail view formats, but do not infer which event they depict.
    const drive=parsed.searchParams.get('id')||parsed.pathname.match(/^\/d\/([\w-]{15,})/)?.[1]||'';
    if(drive&&/^(drive\.google\.com|lh3\.googleusercontent\.com)$/.test(parsed.hostname)){
      return 'drive:'+drive;
    }
    return parsed.origin+parsed.pathname;
  }catch{return u.split(/[?#]/)[0];}
}
function normalizedName(v){return str(v).normalize('NFKC').toLowerCase().replace(/\s+/g,' ');}
function isBrandHero(url){return /(?:^|\/)kk-brand-hero-final-20260920\.png(?:[?#]|$)/i.test(str(url));}
function visible(row){return ['show','show_full'].includes(str(row.action_for_web||row.action));}
function source(row){return str(row.poster_image_url||row.canonical||row.poster_url);}
function triage(input={}){
  const rows=Array.isArray(input.rows)?input.rows:[];
  const delivery=input.delivery_by_event&&typeof input.delivery_by_event==='object'?input.delivery_by_event:{};
  const observations=Array.isArray(input.visual_observations)?input.visual_observations:[];
  const asOf=dateKey(input.as_of||'');
  const chosen=rows.filter(r=>visible(r)&&(!asOf||!dateKey(r.event_date_text||r.event_date||r.date)||dateKey(r.event_date_text||r.event_date||r.date)>=asOf));
  const groups=new Map(),sameBytes=new Map();
  for(const row of chosen){const key=urlKey(source(row));if(!key)continue;let g=groups.get(key)||[];g.push(row);groups.set(key,g);}
  // Independently decoded same-byte fingerprints enable review across unlike URLs.
  for(const row of chosen){
    const evidence=delivery[str(row.event_id)]||{};
    const sha=str(evidence.sha256).toLowerCase();
    if(evidence.loaded!==true||!(Number(evidence.natural_width)>0)||!/^[a-f0-9]{64}$/.test(sha)||
       str(evidence.poster_url)!==source(row))continue;
    const group=sameBytes.get(sha)||[];group.push(row);sameBytes.set(sha,group);
  }
  const reviewQueue=[];
  const findings=chosen.map(row=>{
    const id=str(row.event_id),name=str(row.event_name),day=dateKey(row.event_date_text||row.event_date||row.date);
    const url=source(row),key=urlKey(url),d=delivery[id]||{};
    const checks=Array.isArray(d.candidates)?d.candidates:[];
    const tested=checks.length>0,healthy=checks.some(x=>x&&x.ok===true);
    const reasons=[];
    if(!url)reasons.push('POSTER_SOURCE_MISSING');
    else if(KNOWN_WRONG[id]&&urlKey(KNOWN_WRONG[id])===key)reasons.push('KNOWN_WRONG_EVENT_ART');
    else if(isBrandHero(url))reasons.push('GENERIC_BRAND_HERO_NOT_OFFICIAL_POSTER');
    if(!id||!name||!day)reasons.push('EVENT_IDENTITY_INCOMPLETE');
    if(url&&tested&&!healthy)reasons.push('NO_HEALTHY_IMAGE_DELIVERY');
    const sharing=groups.get(key)||[];
    if(url&&sharing.some(other=>str(other.event_id)!==id && normalizedName(other.event_name)!==normalizedName(name))){
      // One flyer may legitimately cover multiple concert days/events.
      reasons.push('SHARED_ART_DIFFERENT_EVENT_REVIEW');
    }
    for(const obs of observations){
      if(str(obs.event_id)!==id || urlKey(obs.poster_url)!==key || !url)continue;
      const extractedDate=dateKey(obs.observed_event_date);
      if(extractedDate&&day&&extractedDate!==day)reasons.push('VISUAL_DATE_CONFLICT_REVIEW');
      const extractedName=normalizedName(obs.observed_event_name);
      if(extractedName&&normalizedName(name)!==extractedName)reasons.push('VISUAL_NAME_CONFLICT_REVIEW');
      // Unrecognized/ambiguous OCR MUST NOT be treated as verified official artwork.
    }
    const observation=delivery[id]||{};
    const sha=str(observation.sha256).toLowerCase();
    if(sha&&(sameBytes.get(sha)||[]).some(other=>
      str(other.event_id)!==id&&normalizedName(other.event_name)!==normalizedName(name)))
      reasons.push('SAME_IMAGE_BYTES_CROSS_EVENT_REVIEW');
    if(url&&/(?:TEMP_IMAGE|รอโปสเตอร์ต้นฉบับ|ภาพประกอบชั่วคราว|ไม่ใช่โปสเตอร์)/i.test(str(row.event_note)))
      reasons.push('TEMPORARY_ARTWORK_REVIEW');
    // An AI verdict is advisory and tied to the exact URL, event ID, date and decoded bytes.
    const matching=(Array.isArray(input.vision_reviews)?input.vision_reviews:[]).filter(v=>
      str(v.event_id)===id&&str(v.poster_url)===url&&dateKey(v.event_date)===day);
    let vision_status='NOT_REVIEWED';
    if(matching.length===1){
      const v=matching[0],verdict=str(v.verdict).toUpperCase();
      if(verdict==='MISMATCH'){
        vision_status='MISMATCH_REPORTED';reasons.push('AI_REPORTED_ART_MISMATCH_REVIEW');
      }else if(verdict==='MATCH'&&/^[a-f0-9]{64}$/.test(str(v.asset_sha256).toLowerCase())&&
        observation.loaded===true&&Number(observation.natural_width)>0&&
        str(observation.poster_url)===url&&sha===str(v.asset_sha256).toLowerCase()&&
        /^https:\/\//i.test(str(v.evidence_url))&&v.title_match===true&&v.date_match===true&&
        Number(v.confidence)>=0.8&&Number(v.confidence)<=1){
        vision_status='AI_MATCH_UNVERIFIED_BY_OWNER';
      }else{
        vision_status='INCOMPLETE';reasons.push('AI_EVIDENCE_INCOMPLETE_REVIEW');
      }
    }
    if(url&&vision_status==='NOT_REVIEWED')reviewQueue.push({
      event_id:id,event_name:name,event_date:day,poster_url:url,
      required_checks:['original image pixels and printed artist/title','date on image vs exact event',
       'same decoded file SHA256','official source evidence URL','signed-out load and crop check'],
      instruction:'Review original pixels; never publish or change Sheets from AI results.'
    });
    const unique=[...new Set(reasons)];
    const critical=unique.some(x=>['POSTER_SOURCE_MISSING','KNOWN_WRONG_EVENT_ART','GENERIC_BRAND_HERO_NOT_OFFICIAL_POSTER','NO_HEALTHY_IMAGE_DELIVERY','EVENT_IDENTITY_INCOMPLETE'].includes(x));
    const verdict=critical?'BLOCKED_NEEDS_POSTER':unique.length?'OWNER_REVIEW_REQUIRED':'DELIVERY_ONLY_IDENTITY_UNVERIFIED';
    const next=critical?'REPLACE_WITH_VERIFIED_EXACT_EVENT_POSTER':unique.length?'REVIEW_EVENT_ARTWORK_AND_SOURCE':'VERIFY_ORGANIZER_ARTWORK';
    return {event_id:id,event_name:name,event_date:day,poster_url:url,delivery_status:tested?(healthy?'IMAGE_DELIVERED':'IMAGE_DELIVERY_FAILED'):'NOT_TESTED',verdict,reasons:unique,vision_status,owner_review_required:true,owner_approved:false,next_action:next,official_poster_verified:false};
  });
  return {
    schema_version:VERSION,status:findings.some(x=>x.verdict==='BLOCKED_NEEDS_POSTER')?'NEEDS_REPAIR':findings.some(x=>x.verdict==='OWNER_REVIEW_REQUIRED')?'NEEDS_OWNER_REVIEW':'IDENTITY_UNVERIFIED',
    as_of:asOf||null,visible_events:findings.length,blocked:findings.filter(x=>x.verdict==='BLOCKED_NEEDS_POSTER').length,
    review:findings.filter(x=>x.verdict==='OWNER_REVIEW_REQUIRED').length,
    delivery_only:findings.filter(x=>x.verdict==='DELIVERY_ONLY_IDENTITY_UNVERIFIED').length,
    findings,ai_review_queue:reviewQueue,provider_calls:0,paid_ai_calls:0,production_writes:0,booking_writes:0,pricing_writes:0,
    inventory_writes:0,visibility_writes:0,poster_writes:0,auto_publish:false,ai_can_approve:false,owner_approval_required:true
  };
}
module.exports={VERSION,KNOWN_WRONG,dateKey,urlKey,triage};
