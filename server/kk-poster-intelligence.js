'use strict';
// Read-only poster intelligence preflight. No paid inference, no production writer.
const VERSION='KK_POSTER_INTELLIGENCE_V1';
const WRONG=Object.freeze({
 'EVT-20261015-LE7EL-1ST-DEBUT-ANNIVERSARY':'https://www.thai2music.com/uploads/artists/photo_cover/cover_1035_1762919037.jpg',
 'EVT-20261025-VVV-TORNADO-SHOPPING-XIAOMI':'https://pbs.twimg.com/media/G3iTTicXMAAbtyE.jpg',
 'EVT-20261030-POPPAH4-HALLOWEEN-NAMP':'https://static.amarintv.com/media/PJVlR0ljpO7yvkfhEH4VNNZ54YMVWAxlVfBQwSENDkv21tWvbtjShU6FnewvzElMDb.jpg'
});
const t=v=>String(v==null?'':v).trim();
function date(v){
 const s=t(v),a=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/),b=s.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
 if(!a&&!b)return '';
 let y=Number(a?a[3]:b[1]),m=Number(a?a[2]:b[2]),d=Number(a?a[1]:b[3]);
 if(y>2500)y-=543;
 const c=new Date(Date.UTC(y,m-1,d));
 if(c.getUTCFullYear()!==y||c.getUTCMonth()+1!==m||c.getUTCDate()!==d)return '';
 return [String(y).padStart(4,'0'),String(m).padStart(2,'0'),String(d).padStart(2,'0')].join('-');
}
function key(url){
 const s=t(url);if(!s)return '';
 const drive=/^https:\/\/(?:drive\.google\.com|lh3\.googleusercontent\.com)\//i.test(s);
 const dm=s.match(/(?:[?&]id=|\/d\/)([A-Za-z0-9_-]{15,100})(?:[&/=#?]|$)/);
 if(drive&&dm)return 'drive:'+dm[1];
 return s.replace(/[?#].*$/,'').toLowerCase();
}
function urlRisk(url){
 const s=t(url);
 if(!s)return 'MISSING_POSTER';
 if(s.startsWith('/')&&!s.startsWith('//'))return '';
 const m=s.match(/^https:\/\/([^/?#]+)/i);
 if(!m||m[1].includes('@'))return 'INVALID_POSTER_URL';
 const h=m[1].toLowerCase().replace(/:\d+$/,'');
 if(h==='localhost'||h.endsWith('.localhost')||h.endsWith('.internal')||
  /^(?:127|10|0|169\.254|192\.168)\./.test(h)||
  /^172\.(?:1[6-9]|2\d|3[01])\./.test(h)||h==='[::1]')return 'UNSAFE_POSTER_HOST';
 return '';
}
function firstExact(rows,id,url,eventDate){
 const all=(Array.isArray(rows)?rows:[]).filter(x=>
  t(x.event_id)===id&&t(x.poster_url)===url&&(!eventDate||date(x.event_date)===eventDate));
 return all.length===1?all[0]:null;
}
function audit(input={}){
 const asOf=date(input.as_of);
 const rows=(Array.isArray(input.rows)?input.rows:[]).filter(r=>{
  if(!['show','show_full'].includes(t(r.action_for_web).toLowerCase()))return false;
  const d=date(r.event_date_text||r.event_date||r.date);
  return !asOf||!d||d>=asOf;
 });
 const duplicateId=new Map(),shared=new Map();
 rows.forEach(r=>{const id=t(r.event_id),k=key(r.poster_image_url);duplicateId.set(id,(duplicateId.get(id)||0)+1);
  if(k){const v=shared.get(k)||[];v.push(r);shared.set(k,v);}
 });
 const events=rows.map(r=>{
  const event_id=t(r.event_id),event_name=t(r.event_name),event_date=date(r.event_date_text||r.event_date||r.date),
   venue=t(r.venue||r.event_venue||r.event_location),poster_url=t(r.poster_image_url);
  const issues=[],put=(code,priority)=>{if(!issues.some(x=>x.code===code))issues.push({code,priority});};
  if(!event_id||!event_name||!event_date)put('INCOMPLETE_EVENT_IDENTITY','P0');
  if(duplicateId.get(event_id)!==1)put('DUPLICATE_EVENT_ID','P0');
  const bad=urlRisk(poster_url);if(bad)put(bad,'P0');
  if(/\/assets\/kk-brand-hero-final-20260920\.png(?:[?#]|$)/i.test(poster_url))put('NON_EVENT_BRAND_PLACEHOLDER','P0');
  if(poster_url&&WRONG[event_id]&&key(WRONG[event_id])===key(poster_url))put('KNOWN_WRONG_EVENT_IMAGE','P0');
  if(poster_url&&(shared.get(key(poster_url))||[]).some(x=>t(x.event_name).normalize('NFKC').toLowerCase()!==event_name.normalize('NFKC').toLowerCase()))
   put('CROSS_EVENT_IMAGE_REUSE','P1');
  const observation=firstExact(input.observations,event_id,poster_url);
  if(observation){
   if(observation.loaded===false||observation.ok===false||observation.natural_width===0)put('IMAGE_DELIVERY_FAILED','P0');
   if(observation.content_type&&!/^image\/(?:jpeg|png|gif|webp|avif)(?:;|$)/i.test(t(observation.content_type)))put('NON_IMAGE_RESPONSE','P0');
   if(observation.natural_width!=null&& !(Number(observation.natural_width)>0))put('INVALID_IMAGE_DIMENSIONS','P0');
  }else if(poster_url&&!bad)put('IMAGE_DELIVERY_UNVERIFIED','P1');
  const review=firstExact(input.vision_reviews,event_id,poster_url,event_date);
  let vision_status='NOT_REVIEWED';
  if(review){
   if(t(review.verdict).toUpperCase()==='MISMATCH'){vision_status='MISMATCH_REPORTED';put('VISION_SUSPECTED_MISMATCH','P0');}
   else if(t(review.verdict).toUpperCase()==='MATCH'&&/^[a-f0-9]{64}$/i.test(t(review.asset_sha256))&&
    observation&&observation.loaded===true&&Number(observation.natural_width)>0&&
    t(observation.sha256).toLowerCase()===t(review.asset_sha256).toLowerCase()&&
    /^https:\/\//i.test(t(review.evidence_url))&&review.title_match===true&&review.date_match===true&&
    Number(review.confidence)>=0.8&&Number(review.confidence)<=1)
     vision_status='AI_MATCH_UNVERIFIED_BY_OWNER';
   else {vision_status='INCOMPLETE';put('VISION_EVIDENCE_INCOMPLETE','P1');}
  }
  if(poster_url&&!issues.some(x=>x.priority==='P0')&&vision_status!=='AI_MATCH_UNVERIFIED_BY_OWNER')
   put('EVENT_ART_IDENTITY_UNVERIFIED','P1');
  issues.sort((a,b)=>a.priority.localeCompare(b.priority)||a.code.localeCompare(b.code));
  const priority=issues.some(x=>x.priority==='P0')?'P0':issues.length?'P1':'P2';
  return {event_id,event_name,event_date,venue,poster_url,priority,issues,
   vision_status,disposition:priority==='P0'?'HOLD_REPLACE_OR_VERIFY':'REVIEW_REQUIRED',
   owner_approved:false,production_writes:0};
 });
 return {schema:VERSION,source:'08_Web_Ready',as_of:asOf||null,generated_at:t(input.generated_at)||new Date().toISOString(),
  visible_events:events.length,missing_poster:events.filter(e=>e.issues.some(x=>x.code==='MISSING_POSTER')).length,
  p0:events.filter(e=>e.priority==='P0').length,p1:events.filter(e=>e.priority==='P1').length,
  flagged_events:events.filter(e=>e.issues.length).length,events,
  ai_review_queue:events.filter(e=>e.poster_url&&e.vision_status==='NOT_REVIEWED').map(e=>({
   event_id:e.event_id,event_name:e.event_name,event_date:e.event_date,poster_url:e.poster_url,
   required_checks:['read printed event/artist/date from actual image','compare exact event identity and date',
    'record SHA256 of exact image bytes','source provenance URL','signed-out delivery and no cropping'],
   instruction:'Analyze actual pixels, not filename or URL. Output evidence only. Never write Sheet or approve publishing.'
  })),
  safety:{poster_writes:0,booking_writes:0,price_writes:0,inventory_writes:0,visibility_writes:0,production_writes:0,auto_publish:false,auto_replacement:false,ai_can_approve:false}
 };
}
module.exports={VERSION,WRONG,date,key,urlRisk,audit};