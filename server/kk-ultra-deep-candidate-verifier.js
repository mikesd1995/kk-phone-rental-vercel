'use strict';

const crypto=require('node:crypto');
const PublicWeb=require('./kk-ultra-deep-public-web-adapters.js');

const VERSION='KK_ULTRA_DEEP_CANDIDATE_VERIFIER_V5';
const DEFAULT_CONCURRENCY=4;
const MAX_CONCURRENCY=6;

const EVENT_SIGNAL=/(concert|fan\s*-?\s*meet(?:ing)?|fanmeet|fancon|fansign|showcase|festival|world\s+tour|live\s+in|live\s+tour|awards?|premiere|birthday\s+event|final\s+ep|special\s+event|คอนเสิร์ต|แฟนมีต|แฟนคอน|แฟนไซน์|โชว์เคส|เฟสติวัล|เทศกาลดนตรี|งานรางวัล|รอบปฐมทัศน์|งานวันเกิด|ไฟนอล\s*อีพี)/i;
const HIGH_FIT_SIGNAL=/(fan\s*-?\s*meet(?:ing)?|fanmeet|fancon|fansign|showcase|final\s+ep|birthday\s+event|แฟนมีต|แฟนคอน|แฟนไซน์|โชว์เคส|ไฟนอล\s*อีพี|งานวันเกิด)/i;
const CONCERT_SIGNAL=/(concert|world\s+tour|live\s+in|live\s+tour|คอนเสิร์ต)/i;
const MID_FIT_SIGNAL=/(festival|awards?|premiere|เฟสติวัล|เทศกาลดนตรี|งานรางวัล|รอบปฐมทัศน์)/i;
const LOW_FIT_SIGNAL=/(pool\s+party|exhibition|expo|trade\s+show|workshop|webinar|orchestra|symphony|conference|oktoberfest|codes?\b|roblox|นิทรรศการ|เวิร์กช็อป|สัมมนา)/i;
const ARTIST_POPUP_SIGNAL=/(?:\bpop[\s-]?up\b|ป๊อปอัพ|ป็อปอัพ|ป๊อปอัป)/i;
const ARTIST_APPEARANCE_SIGNAL=/(?:\bwith\s+[a-z][a-z0-9_-]{2,}|\b(?:x|feat\.?|featuring)\s+[a-z][a-z0-9_-]{2,}|(?:พบกับ|ศิลปิน)\s*[\u0e00-\u0e7f]{3,}|artist\s+appearance)/i;
const GENERIC_TITLE=/^(home|homepage|google|ticketmaster|events?|concerts?\s+in\s+bangkok|bangkok\s+concerts?|thailand\s+events?)\b/i;
const AGGREGATED_RESULT_SIGNAL=/(facebook\b.*(?:on\s+x|twitter)|(?:on\s+x|twitter)\b.*facebook|bangkok\s+post|youtube|google\s+search|search\s+results?|teetee\s+philippines\s+on\s+x)/i;
const SOCIAL_OR_SEARCH_HOST=/(^|\.)(facebook\.com|x\.com|twitter\.com|instagram\.com|youtube\.com|youtu\.be|google\.com|bing\.com|duckduckgo\.com)$/i;
const MAX_VERIFIED_TITLE_LENGTH=180;

const TRUSTED_EVENT_HOSTS=new Set([
 'www.thaiticketmajor.com','thaiticketmajor.com',
 'www.eventpop.me','eventpop.me',
 'www.ticketmelon.com','ticketmelon.com',
 'www.livenationtero.co.th','livenationtero.co.th',
 'www.allticket.com','allticket.com',
 'www.zipeventapp.com','zipeventapp.com',
 'www.songkick.com','songkick.com',
 'www.paragonhall.com','paragonhall.com',
 'www.impact.co.th','impact.co.th',
 'www.impactarena.asia','impactarena.asia'
]);

const KNOWN_VENUES=[
 'IMPACT Arena','IMPACT Challenger','Thunder Dome','Thunderdome',
 'Union Hall','Paragon Hall','ICONSIAM Hall','TRUE ICON HALL',
 'Rajamangala National Stadium','BITEC','QSNCC','Queen Sirikit National Convention Center',
 'centralwOrld Beacon 3','CentralWorld Live','CentralwOrld Pulse','centralwOrld','MCC Hall','Siam Pavalai Royal Grand Theatre',
 'Lido Connect','Sphere Hall','UOB LIVE','One Bangkok Forum','The Street Hall'
];

function text(v){return String(v==null?'':v).trim();}
function https(v){try{const u=new URL(text(v));return u.protocol==='https:'?u.toString():'';}catch(_){return '';}}
function isoDate(v){
 const raw=text(v);if(!raw)return '';
 const m=raw.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m)return m[1]+'-'+m[2]+'-'+m[3];
 const d=new Date(raw);return Number.isNaN(d.getTime())?'':d.toISOString().slice(0,10);
}
function bangkokLocalTime(value=''){
 const raw=text(value);
 // Keep the announced local wall clock only when the source uses Thailand
 // offset (+07:00), or deliberately supplies no offset. Never mislabel UTC.
 const m=raw.match(/T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/i);
 if(!m||m[2]&&!/^\+07:?00$/.test(m[2]))return '';
 return m[1];
}
function venueTokens(value=''){
 return text(value).toLowerCase().replace(/([a-z])(\d)/g,'$1 $2')
  .replace(/[^a-z0-9ก-๙]+/g,' ').split(' ')
  .filter(x=>x.length>=3&&!['bangkok','floor','zone','กรุงเทพ','ชั้น'].includes(x));
}
function eventKey(row={}){
 const base=[text(row.title||row.event_name).toLowerCase().replace(/[^a-z0-9฀-๿]+/g,' ').replace(/\s+/g,' ').trim(),isoDate(row.event_date)].join('|');
 return 'UD-'+crypto.createHash('sha1').update(base).digest('hex').slice(0,16);
}
function host(url){try{return new URL(text(url)).hostname.toLowerCase();}catch(_){return '';}}
function eventSpecificUrl(url){
 try{
  const u=new URL(text(url));const h=u.hostname.toLowerCase();const p=u.pathname.toLowerCase();
  if(/eventpop\.me$/.test(h)) return /^\/e\//.test(p);
  if(/thaiticketmajor\.com$/.test(h)) return /^\/(concert|performance|event)\//.test(p);
  if(/livenationtero\.co\.th$/.test(h)) return /^\/show\//.test(p)||p.includes('/event/');
  if(/zipeventapp\.com$/.test(h)) return /^\/e\//.test(p);
  if(/songkick\.com$/.test(h)) return p.includes('/concerts/');
  if(/ticketmelon\.com$/.test(h)) return p.split('/').filter(Boolean).length>=2;
  if(/allticket\.com$/.test(h)) return p!=='/'&&p.split('/').filter(Boolean).length>=1;
  if(TRUSTED_EVENT_HOSTS.has(h)) return p!=='/'&&p.length>1;
  return false;
 }catch(_){return false;}
}
function monthMatches(date,month){return /^\d{4}-\d{2}$/.test(text(month))&&isoDate(date).startsWith(text(month)+'-');}
function titleQuality(title=''){
 const value=text(title);const reasons=[];
 if(!value||GENERIC_TITLE.test(value))reasons.push('GENERIC_OR_MISSING_TITLE');
 if(value.length>MAX_VERIFIED_TITLE_LENGTH)reasons.push('EVENT_TITLE_TOO_LONG');
 if(AGGREGATED_RESULT_SIGNAL.test(value))reasons.push('AGGREGATED_SEARCH_RESULT_TITLE');
 if((value.match(/\|/g)||[]).length>=2)reasons.push('AGGREGATED_SEARCH_RESULT_TITLE');
 return {ok:reasons.length===0,reasons:[...new Set(reasons)]};
}

function namedPopupArtists(row={}){
 const raw=[row.artist,row.artists].filter(Boolean).flatMap(x=>Array.isArray(x)?x:[x]);
 return [...new Set(raw.flatMap(x=>text(x).split(/\s*\|\s*|,\s*/)).map(text)
  .filter(x=>x.length>=3&&!/^(artist|unknown|none|n\/a|tbd|ศิลปิน)$/i.test(x)))];
}
function artistPopupLead(row={},title=text(row.title||row.event_name)){
 return ARTIST_POPUP_SIGNAL.test(title)&&
  (namedPopupArtists(row).length>0||ARTIST_APPEARANCE_SIGNAL.test(title));
}
function sourceConfirmsPopupArtist(body='',candidate={}){
 const page=text(body).slice(0,800000).toLowerCase();
 const named=namedPopupArtists(candidate);
 const inTitle=text(candidate.title||candidate.event_name).match(/\b(?:with|x|featuring)\s+([a-z][a-z0-9_-]{2,})\b/i);
 const artists=named.length?named:(inTitle?[inTitle[1]]:[]);
 // Do not let THAI match 'Thailand' or another artist replace the title artist.
 return artists.length?artists.every(a=>{
  if(/[ก-๙]/.test(a))return page.includes(a.toLowerCase());
  const escaped=a.replace(/[.*+?^$()|[\]{}\\]/g,'\\$&');
  return new RegExp('(^|[^a-z0-9])'+escaped+'($|[^a-z0-9])','i').test(page);
 }):false;
}

function authoritativeEventSource(url='',picked=null,verified={}){
 const h=host(url);const trustedDetail=TRUSTED_EVENT_HOSTS.has(h)&&eventSpecificUrl(url);
 const socialOrSearch=SOCIAL_OR_SEARCH_HOST.test(h);
 const structuredExact=!!(picked&&picked.d===verified.date&&text(picked.e&&picked.e.name)&&verified.venue&&verified.poster);
 return {ok:trustedDetail||(!socialOrSearch&&structuredExact),trusted_detail:trustedDetail,structured_exact:structuredExact,social_or_search:socialOrSearch};
}
function prefilter(candidate={},month=''){
 const title=text(candidate.title);
 const date=isoDate(candidate.event_date);
 const url=https(candidate.source_url);
 const popupLead=artistPopupLead(candidate,title);
 const reasons=[];
 if(!url)reasons.push('HTTPS_SOURCE_REQUIRED');
 // Search/RSS snippets often omit the event date. Retain strong event leads
 // only for source verification; a missing source-backed date can NEVER publish.
 const eventLead=EVENT_SIGNAL.test(title)||popupLead||eventSpecificUrl(url);
 if(!date&&!eventLead)reasons.push('EVENT_DATE_REQUIRED');
 else if(date&&month&&!monthMatches(date,month))reasons.push('OUTSIDE_TARGET_MONTH');
 const quality=titleQuality(title);reasons.push(...quality.reasons);
 if(LOW_FIT_SIGNAL.test(title))reasons.push('NON_RENTAL_EVENT_SIGNAL');
 if(!EVENT_SIGNAL.test(title)&&!eventSpecificUrl(url)&&!popupLead)
  reasons.push('EVENT_IDENTITY_NOT_STRONG_ENOUGH');
 return {eligible:reasons.length===0,reasons,event_date:date,event_specific_url:eventSpecificUrl(url),artist_popup_lead:popupLead};
}
function flattenJsonLd(value,out=[]){
 if(Array.isArray(value)){for(const x of value)flattenJsonLd(x,out);return out;}
 if(!value||typeof value!=='object')return out;
 if(Array.isArray(value['@graph']))flattenJsonLd(value['@graph'],out);
 const t=value['@type'];
 const types=Array.isArray(t)?t.map(text):[text(t)];
 if(types.some(x=>/Event$/i.test(x)||['MusicEvent','Festival','TheaterEvent'].includes(x)))out.push(value);
 return out;
}
function parseJsonLd(body=''){
 const out=[];
 for(const m of String(body).matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  try{flattenJsonLd(JSON.parse(m[1]),out);}catch(_){}
 }
 return out;
}
function metaValue(body,key){
 const esc=key.replace(/[.*+?^$(){}|[\]\\]/g,'\\$&');
 const patterns=[
  new RegExp("<meta[^>]+(?:property|name)=[\\\"']"+esc+"[\\\"'][^>]+content=[\\\"']([^\\\"']+)[\\\"'][^>]*>",'i'),
  new RegExp("<meta[^>]+content=[\\\"']([^\\\"']+)[\\\"'][^>]+(?:property|name)=[\\\"']"+esc+"[\\\"'][^>]*>",'i')
 ];
 for(const p of patterns){const m=String(body).match(p);if(m)return PublicWeb.decodeHtmlEntities(m[1]);}
 return '';
}
function locationName(v){
 if(!v)return '';
 if(Array.isArray(v)){for(const x of v){const n=locationName(x);if(n)return n;}return '';}
 if(typeof v==='string')return text(v);
 const direct=text(v.name);if(direct)return direct;
 const a=v.address;
 if(typeof a==='string')return text(a);
 if(a&&typeof a==='object')return [a.streetAddress,a.addressLocality,a.addressRegion].map(text).filter(Boolean).join(', ');
 return '';
}
function imageUrl(v){
 const one=Array.isArray(v)?v[0]:v;
 if(typeof one==='string')return https(one);
 if(one&&typeof one==='object')return https(one.url||one.contentUrl);
 return '';
}
function findKnownVenue(body,title=''){
 const hay=(text(title)+' '+PublicWeb.cleanHtml(String(body).slice(0,800000))).toLowerCase();
 for(const venue of KNOWN_VENUES){if(hay.includes(venue.toLowerCase()))return venue;}
 return '';
}
function rentalFitScore(title='',candidate={}){
 const t=text(title);
 if(LOW_FIT_SIGNAL.test(t))return 4.5;
 if(HIGH_FIT_SIGNAL.test(t))return 9.0;
 if(CONCERT_SIGNAL.test(t))return 8.2;
 if(MID_FIT_SIGNAL.test(t))return 7.5;
 // Pop-up artist involvement is promising, but owner access and filming review
 // always remain required; a fit score alone never authorizes publication.
 if(artistPopupLead(candidate,t))return 7.0;
 if(EVENT_SIGNAL.test(t))return 7.0;
 return 5.0;
}
function sourceTier(url){
 const h=host(url);
 if(/thaiticketmajor|eventpop|ticketmelon|allticket/.test(h))return 'TICKETING';
 if(/livenationtero/.test(h))return 'PROMOTER';
 if(/impact|paragonhall/.test(h))return 'VENUE';
 return 'PUBLIC_WEB';
}
function chooseJsonLdEvent(events=[],candidate={},month=''){
 const wanted=isoDate(candidate.event_date);
 const scored=(events||[]).map(e=>{
  const d=isoDate(e.startDate||e.start_date);
  let score=0;
  if(wanted&&d===wanted)score+=5;
  else if(month&&d.startsWith(month+'-'))score+=2;
  if(locationName(e.location))score+=2;
  if(imageUrl(e.image))score+=1;
  if(text(e.name))score+=1;
  return {e,d,score};
 }).filter(x=>x.d&&(!month||x.d.startsWith(month+'-'))).sort((a,b)=>b.score-a.score);
 return scored[0]||null;
}
function verifyHtmlCandidate(candidate={},body='',context={}){
 const month=text(context.month);
 const pre=prefilter(candidate,month);
 if(!pre.eligible)return {status:'HOLD_VERIFIER',verified:false,blockers:pre.reasons,candidate};
 const events=parseJsonLd(body);
 const picked=chooseJsonLdEvent(events,candidate,month);
 const title=text(picked&&picked.e&&picked.e.name)||text(candidate.title)||metaValue(body,'og:title');
 const date=isoDate(picked&&picked.d)||pre.event_date;
 const popupLead=pre.artist_popup_lead||artistPopupLead(candidate,title);
 const venue=locationName(picked&&picked.e&&picked.e.location)||findKnownVenue(body,title);
 const poster=imageUrl(picked&&picked.e&&picked.e.image)||https(metaValue(body,'og:image'));
 const url=https(candidate.source_url);
 const blockers=[];
 const quality=titleQuality(title);blockers.push(...quality.reasons);
 if(!date||!monthMatches(date,month))blockers.push('VERIFIED_TARGET_MONTH_DATE_REQUIRED');
 // Do not promote a date inferred only from an unverified search snippet.
 if(!picked||!isoDate(picked.d))blockers.push('SOURCE_EVENT_DATE_REQUIRED');
 if(pre.event_date&&picked&&isoDate(picked.d)&&isoDate(picked.d)!==pre.event_date)
  blockers.push('CANDIDATE_SOURCE_DATE_CONFLICT');
 if(!venue)blockers.push('VERIFIED_VENUE_REQUIRED');
 if(!EVENT_SIGNAL.test(title)&&!eventSpecificUrl(url)&&!popupLead)blockers.push('VERIFIED_EVENT_IDENTITY_REQUIRED');
 if(!poster)blockers.push('VERIFIED_POSTER_REQUIRED');
 const baseAuthority=authoritativeEventSource(url,picked,{date,venue,poster,title});
 // A structured page on an arbitrary domain cannot authorize customer access
 // or photography at a brand appearance. Owner review is mandatory.
 const authority=popupLead?{...baseAuthority,ok:false,owner_review_required:true}:baseAuthority;
 if(!baseAuthority.ok)blockers.push('AUTHORITATIVE_EVENT_SOURCE_REQUIRED');
 if(popupLead&&text(candidate.venue)&&picked&&locationName(picked.e&&picked.e.location)){
  const wanted=venueTokens(candidate.venue),received=new Set(venueTokens(locationName(picked.e.location)));
  const overlap=wanted.filter(x=>received.has(x)).length;
  if(wanted.length&&overlap<Math.min(2,wanted.length))
   blockers.push('ARTIST_POPUP_VENUE_CONFLICT');
 }
 if(popupLead){
  if(!picked||!text(picked.e&&picked.e.name)||!locationName(picked.e.location)||!imageUrl(picked.e.image))
   blockers.push('ARTIST_POPUP_PRIMARY_EVENT_RECEIPT_REQUIRED');
  if(pre.event_date&&picked&&isoDate(picked.d)&&isoDate(picked.d)!==pre.event_date)
   blockers.push('ARTIST_POPUP_DATE_CONFLICT');
  if(!sourceConfirmsPopupArtist(body,candidate))
   blockers.push('ARTIST_POPUP_ARTIST_SOURCE_CONFIRMATION_REQUIRED');
  blockers.push('ARTIST_POPUP_OWNER_ACCESS_PHOTO_POLICY_REVIEW_REQUIRED');
 }
 const fit=rentalFitScore(title,candidate);
 if(fit<7)blockers.push('RENTAL_FIT_BELOW_PUBLISH_THRESHOLD');
 const key=eventKey({title,event_date:date});
 const verified=blockers.length===0;
 return {
  version:VERSION,
  status:verified?'VERIFIED_FOR_COMMERCIAL':(popupLead?'HOLD_OWNER_ARTIST_POPUP_REVIEW':'HOLD_VERIFIER'),
  verified,
  blockers,
  candidate:{
   candidate_id:text(candidate.candidate_id)||key,
   event_key:key,title,event_date:date,event_time:text(candidate.event_time)||bangkokLocalTime(picked&&picked.e&&picked.e.startDate)||null,venue,
   artist:namedPopupArtists(candidate),
   source_url:url,confidence:verified?0.9:0.4,rental_fit_score:fit,
   publish_eligibility:{status:popupLead?'HOLD_OWNER_ARTIST_POPUP_REVIEW':(fit>=7?'ELIGIBLE':'REJECTED_LOW_RENTAL_FIT'),eligible:!popupLead&&fit>=7,rental_fit_score:fit,minimum_publish_score:7}
  },
  poster:poster?{event_key:key,source_tier:sourceTier(url),source_url:url,image_url:poster,official:TRUSTED_EVENT_HOSTS.has(host(url)),verified:authority.ok}:null,
  evidence:{jsonld_event_count:events.length,event_specific_url:eventSpecificUrl(url),source_tier:sourceTier(url),authoritative_event_source:authority.ok,artist_popup_lead:popupLead,source_artist_confirmed:popupLead?sourceConfirmsPopupArtist(body,candidate):null,authority}
 };
}
async function verifyCandidate(candidate={},context={},options={}){
 const pre=prefilter(candidate,context.month);
 if(!pre.eligible)return {status:'HOLD_VERIFIER',verified:false,blockers:pre.reasons,candidate};
 try{
  const body=await PublicWeb.fetchPage(candidate.source_url,{fetchFn:options.fetchFn,timeout_ms:Number(options.timeout_ms||10000)});
  return verifyHtmlCandidate(candidate,body,context);
 }catch(err){
  return {status:'HOLD_VERIFIER',verified:false,blockers:['SOURCE_FETCH_FAILED'],candidate,error_class:text(err&&(err.code||err.name))||'ERROR'};
 }
}
function concurrency(options={}){
 const raw=Number(options.concurrency||DEFAULT_CONCURRENCY);
 return Number.isFinite(raw)?Math.max(1,Math.min(Math.floor(raw),MAX_CONCURRENCY)):DEFAULT_CONCURRENCY;
}
async function verifyBatch(candidates=[],context={},options={}){
 const rows=Array.isArray(candidates)?candidates:[];
 const selected=[];const preHeld=[];const seen=new Set();
 for(const c of rows){
  const pre=prefilter(c,context.month);
  const k=[text(c.title).toLowerCase(),isoDate(c.event_date),https(c.source_url)].join('|');
  if(seen.has(k))continue;seen.add(k);
  if(pre.eligible)selected.push(c);else preHeld.push({status:'HOLD_VERIFIER',verified:false,blockers:pre.reasons,candidate:c});
 }
 const results=new Array(selected.length);let next=0;
 async function worker(){while(true){const i=next++;if(i>=selected.length)return;results[i]=await verifyCandidate(selected[i],context,options);}}
 await Promise.all(Array.from({length:Math.min(concurrency(options),selected.length||1)},()=>worker()));
 const all=[...results,...preHeld];
 const verified=all.filter(x=>x&&x.verified);
 const holds=all.filter(x=>!x||!x.verified);
 const posters=verified.map(x=>x.poster).filter(Boolean);
 return {
  version:VERSION,
  status:verified.length?'VERIFIER_EVIDENCE_READY':'HOLD_NO_VERIFIED_CANDIDATES',
  input_count:rows.length,
  fetched_count:selected.length,
  verified_count:verified.length,
  hold_count:holds.length,
  verified_candidates:verified.map(x=>x.candidate),
  posters,
  holds:holds.slice(0,200).map(x=>({
   title:text(x&&x.candidate&&x.candidate.title)||null,
   event_date:isoDate(x&&x.candidate&&x.candidate.event_date)||null,
   event_time:text(x&&x.candidate&&x.candidate.event_time)||null,
   venue:text(x&&x.candidate&&x.candidate.venue)||null,
   artist:Array.isArray(x&&x.candidate&&x.candidate.artist)?x.candidate.artist:[],
   source_url:https(x&&x.candidate&&x.candidate.source_url)||null,
   status:text(x&&x.status)||'HOLD_VERIFIER',
   poster_for_review:x&&x.poster&&https(x.poster.image_url)||null,
   artist_popup_lead:!!(x&&x.evidence&&x.evidence.artist_popup_lead),
   blockers:x&&x.blockers||['UNKNOWN']
  })),
  production_writes:0,
  authoritative:false,
  verifier_required:true
 };
}

module.exports={
 VERSION,TRUSTED_EVENT_HOSTS,KNOWN_VENUES,EVENT_SIGNAL,ARTIST_POPUP_SIGNAL,ARTIST_APPEARANCE_SIGNAL,artistPopupLead,namedPopupArtists,sourceConfirmsPopupArtist,HIGH_FIT_SIGNAL,CONCERT_SIGNAL,MID_FIT_SIGNAL,LOW_FIT_SIGNAL,AGGREGATED_RESULT_SIGNAL,SOCIAL_OR_SEARCH_HOST,MAX_VERIFIED_TITLE_LENGTH,
 text,https,isoDate,eventKey,host,eventSpecificUrl,monthMatches,titleQuality,authoritativeEventSource,prefilter,flattenJsonLd,parseJsonLd,metaValue,locationName,imageUrl,
 findKnownVenue,rentalFitScore,bangkokLocalTime,venueTokens,sourceTier,chooseJsonLdEvent,verifyHtmlCandidate,verifyCandidate,verifyBatch,concurrency
};
