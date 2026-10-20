'use strict';
// Discovery semantics must not turn a TV poster or community fan installation into a ticketed camera rental.
const VERSION='KK_ULTRA_DEEP_EVENT_TYPE_ACCESS_V1';
const str=x=>String(x==null?'':x).trim();
const compact=x=>str(x).toLowerCase().normalize('NFKC');
function category(row={}){
 const t=compact([row.title,row.event_name,row.event_type,row.event_category].join(' '));
 const detail=compact([row.description,row.event_description,row.notes,row.caption].join(' '));
 const combined=t+' '+detail;
 // Prefer the specifically advertised offline event over the name of its parent TV series.
 if(/\bgrand premiere\b|\bpremiere (?:fan\s*meeting|event|screening)\b|รอบพรีเมียร์|งานเปิดตัวซีรีส์/.test(t))return 'OFFLINE_PREMIERE';
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
const sensitive=new Set(['SINGLE_SHOWCASE','FAN_PROJECT_GALLERY','MALL_ACTIVATION','OFFLINE_PREMIERE','FANSIGN']);
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
 // Fan-run galleries and brand / mall installations do not imply any actor attends.
 if(['FAN_PROJECT_GALLERY','MALL_ACTIVATION'].includes(kind))
  checks.verified_onsite_artist_or_rental_fit=(row.onsite_artist_presence_verified===true&&validHttpProof(row.onsite_artist_presence_source_url))||
   (row.non_artist_rental_fit_verified===true&&validHttpProof(row.non_artist_rental_fit_source_url));
 const missing=Object.entries(checks).filter(([,ok])=>!ok).map(([key])=>key),ok=missing.length===0;
 return {version:VERSION,category:kind,requires_review:true,decision:ok?'EVENT_ACCESS_VERIFIED':'VERIFY_EVENT_TYPE_ACCESS',
  access_clearance:ok,artist_presence_confirmed:row.onsite_artist_presence_verified===true,
  missing,production_writes:0};
}
function splitVerifiedDates(candidate={}){
 if(!Array.isArray(candidate.event_dates))return [candidate];
 const dates=candidate.event_dates;
 if(candidate.event_dates_verified!==true||!dates.length||dates.length>31||
    !dates.every(x=>/^\d{4}-\d{2}-\d{2}$/.test(str(x))&&!Number.isNaN(Date.parse(str(x)+'T00:00:00Z'))))
  return [{...candidate,source_date_hold:true,event_dates:dates}];
 const unique=[...new Set(dates.map(str))];
 return unique.map(d=>({...candidate,event_date:d,origin_event_dates:unique}));
}
module.exports={VERSION,category,evaluate,validHttpProof,splitVerifiedDates};
