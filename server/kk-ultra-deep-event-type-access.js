'use strict';
// Discovery semantics must not turn a TV poster or community fan installation into a ticketed camera rental.
const VERSION='KK_ULTRA_DEEP_EVENT_TYPE_ACCESS_V3';
const str=x=>String(x==null?'':x).trim();
const compact=x=>str(x).toLowerCase().normalize('NFKC');
function category(row={}){
 const explicit=compact([row.event_type,row.event_category,row.activity_type,row.poster_kind,row.content_type].join(' ')).replace(/[^a-z0-9]+/g,'_');
 const t=compact([row.title,row.event_name,row.event_type,row.event_category].join(' '));
 const detail=compact([row.description,row.event_description,row.notes,row.caption].join(' '));
 const combined=t+' '+detail;
 // Prefer the specifically advertised offline event over the name of its parent TV series.
 if(/private_lucky_fan|brand_private_event|exclusive_winner_meet/.test(explicit)||row.private_event===true||row.lucky_winner_access_only===true)return 'BRAND_PRIVATE_EVENT';
 if(/ticketed_first_ep|first_episode_screening/.test(explicit))return 'OFFLINE_PREMIERE';
 if(/live_tour|themed_live_concert/.test(explicit))return 'LIVE_TOUR';
 if(/offline_premiere/.test(explicit))return 'OFFLINE_PREMIERE';
 if(/fan_project_gallery|fan_gallery|fan_art_exhibition/.test(explicit))return 'FAN_PROJECT_GALLERY';
 if(/single_showcase|music_showcase/.test(explicit))return 'SINGLE_SHOWCASE';
 if(/fansign/.test(explicit))return 'FANSIGN';
 if(/mall_activation|mall_ip_activation/.test(explicit))return 'MALL_ACTIVATION';
 if(/tv_series|broadcast_only|series_key_visual/.test(explicit)||row.broadcast_only===true)return 'BROADCAST_ONLY';
 if(/\bgrand premiere\b|\bpremiere (?:fan\s*meeting|event|screening)\b|รอบพรีเมียร์|งานเปิดตัวซีรีส์|ชมตอนแรกพร้อมกัน|first\s*(?:ep\.?|episode)\s*(?:fan|screening|special|event)/.test(t))return 'OFFLINE_PREMIERE';
 if(/\b(?:lucky\s*fans?|private\s*(?:meet|fan|experience)|top\s*spender)\b|ผู้โชคดี(?:\s*\d+)?\s*คน|เฉพาะผู้มีสิทธิ์/.test(combined))return 'BRAND_PRIVATE_EVENT';
 if(/\blive tour\b/.test(t))return 'LIVE_TOUR';
 if(/\b(?:fan\s*)?gallery\b|\bfan\s*project\b|photo exhibition|นิทรรศการแฟน|แฟนโปรเจกต์/.test(t))return 'FAN_PROJECT_GALLERY';
 if(/\bshowcase\b|single launch|single release event|เปิดตัวซิงเกิล|โชว์เคส/.test(t))return 'SINGLE_SHOWCASE';
 if(/\bfansign\b|แฟนไซน์/.test(t))return 'FANSIGN';
 if(/\bhalloween\b|check[ -]?in|mall activation|exhibition|จัดแสดง|บูธกิจกรรม|กิจกรรมฮาโลวีน/.test(combined)&&/siam center|shopping mall|union mall|mall|สยามเซ็นเตอร์|ห้าง|we\s*tv|star\s*hunter/.test(combined))return 'MALL_ACTIVATION';
 if(/\b(?:airing|broadcast|streaming|episode|on(?:e)?\s*31|oned)\b|ออกอากาศ|ทุกวันพุธ|ทุกวันเสาร์|รับชมทาง|ดูทีวี/.test(combined))return 'BROADCAST_ONLY';
 return 'OTHER';
}
function validHttpProof(x){
 try{
  const u=new URL(str(x));
  return u.protocol==='https:'&&Boolean(u.hostname)&&!u.username&&!u.password&&
   !['localhost','127.0.0.1'].includes(u.hostname.toLowerCase());
 }catch{return false;}
}
const sensitive=new Set(['SINGLE_SHOWCASE','FAN_PROJECT_GALLERY','MALL_ACTIVATION','OFFLINE_PREMIERE','FANSIGN','BRAND_PRIVATE_EVENT','LIVE_TOUR']);
function evaluate(row={}){
 const kind=category(row);
 if(kind==='BROADCAST_ONLY')return {version:VERSION,category:kind,requires_review:true,decision:'NOT_OFFLINE_EVENT',access_clearance:false,
  missing:['offline_event_evidence'],artist_presence_confirmed:false,production_writes:0};
 if(!sensitive.has(kind))return {version:VERSION,category:kind,requires_review:false,decision:'NOT_APPLICABLE',access_clearance:true,missing:[],production_writes:0};
 const checks={
  verified_offline_venue_and_date:row.in_person_activity_verified===true&&Boolean(str(row.event_date))&&Boolean(str(row.venue)),
  first_party_event_evidence:row.official_event_source_verified===true&&validHttpProof(row.official_event_source_url),
  phone_recording_rights:row.phone_recording_allowed_verified===true,
  external_lens_rights:row.external_lens_allowed_verified===true,
  camera_policy_evidence:row.official_camera_policy_verified===true&&validHttpProof(row.official_camera_policy_url),
  owner_not_blocked:row.owner_hidden!==true&&row.owner_hold!==true&&row.tombstone_locked!==true
 };
 // A winner-only brand activation is not a public event: require independent rights/access evidence.
 if(kind==='BRAND_PRIVATE_EVENT'){
  checks.verified_renter_entry_eligibility=row.eligible_renter_entry_verified===true&&validHttpProof(row.official_entry_eligibility_url);
  checks.explicit_owner_private_event_approval=row.owner_private_event_approval_verified===true;
 }
 // Fan-run galleries and brand / mall installations do not imply any actor attends.
 if(['FAN_PROJECT_GALLERY','MALL_ACTIVATION'].includes(kind))
  checks.verified_onsite_artist_or_rental_fit=(row.onsite_artist_presence_verified===true&&validHttpProof(row.onsite_artist_presence_source_url))||
   (row.non_artist_rental_fit_verified===true&&validHttpProof(row.non_artist_rental_fit_source_url));
 const missing=Object.entries(checks).filter(([,ok])=>!ok).map(([key])=>key),ok=missing.length===0;
 return {version:VERSION,category:kind,requires_review:true,decision:ok?'EVENT_ACCESS_VERIFIED':'VERIFY_EVENT_TYPE_ACCESS',
  access_clearance:ok,artist_presence_confirmed:row.onsite_artist_presence_verified===true,
  missing,production_writes:0};
}
function validIsoDate(x){
 const s=str(x);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
 const d=new Date(s+'T00:00:00Z');
 return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s;
}
function splitVerifiedDates(candidate={}){
 if(!Array.isArray(candidate.event_dates))return [candidate];
 const dates=candidate.event_dates;
 if(candidate.event_dates_verified!==true||!dates.length||dates.length>31||
    !dates.every(validIsoDate))
  return [{...candidate,source_date_hold:true,event_dates:dates}];
 const unique=[...new Set(dates.map(str))];
 return unique.map(d=>({...candidate,event_key:str(candidate.event_key||candidate.candidate_id||candidate.title)+'-'+d.replace(/-/g,''),origin_event_key:str(candidate.event_key||candidate.candidate_id),event_date:d,origin_event_dates:unique}));
}
module.exports={VERSION,category,evaluate,validHttpProof,validIsoDate,splitVerifiedDates};
