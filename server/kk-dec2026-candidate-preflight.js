'use strict';

// Read-only December candidate preflight. Never authorizes production writes.
const Pricing=require('./kk-final-pricing-policy.js');
const VERSION='KK_DEC2026_CANDIDATE_PREFLIGHT_V1';
const ALLOWED_PRICE_SOURCES=new Set([
 'EXACT_EVENT_COMPETITOR_MEDIAN','KK_RENTAL_FIT_SCORE_FALLBACK',
 'KK_ACTIVE_STANDARD_PACKAGE_SOT','KK_APPROVED_BASELINE'
]);
const CANCELLED=new Set(['cancelled','canceled','void','refunded']);
const clean=v=>String(v==null?'':v).trim();
const lower=v=>clean(v).toLowerCase();
const norm=v=>clean(v).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
const isoDate=value=>{
 const s=clean(value);
 if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
 const m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
 if(m)return m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');
 const event=s.match(/EVT-(\d{4})(\d{2})(\d{2})-/i);
 return event?event[1]+'-'+event[2]+'-'+event[3]:null;
};
function dateOf(row={}){
 return isoDate(row.event_date)||isoDate(row.date)||isoDate(row.event_id)||null;
}
function isWeekend(date){
 const day=new Date(date+'T00:00:00Z').getUTCDay();
 return day===0||day===5||day===6;
}
function validHttps(value){
 try{
  const url=new URL(clean(value));
  return url.protocol==='https:'&&!url.username&&!url.password;
 }catch(_){return false;}
}
function sameEvent(row,candidate,date){
 const id=clean(candidate.event_id);
 if(id&&clean(row.event_id)===id)return true;
 return dateOf(row)===date&&!!norm(row.title||row.name)&&norm(row.title||row.name)===norm(candidate.title||candidate.name);
}
function evaluateCandidate(candidate={},snapshot={},options={}){
 const blockers=[],date=dateOf(candidate);
 const bookings=Array.isArray(snapshot.bookings)?snapshot.bookings:null;
 const events=Array.isArray(snapshot.events)?snapshot.events:null;
 const locks=Array.isArray(snapshot.owner_locks)?snapshot.owner_locks:null;
 const now=Date.parse(clean(options.now_iso)||new Date().toISOString());
 const checked=Date.parse(clean(snapshot.checked_at));
 const ageMs=now-checked;
 const maxAgeMs=Number.isFinite(Number(options.max_age_minutes))?Number(options.max_age_minutes)*60000:15*60000;
 if(!date||!/^2026-12-\d{2}$/.test(date)||Number(date.slice(-2))>31||Number(date.slice(-2))<1)blockers.push('DECEMBER_DATE_NOT_VERIFIED');
 if(!bookings)blockers.push('BOOKING_SNAPSHOT_MISSING');
 if(!events)blockers.push('CORE_EVENT_SNAPSHOT_MISSING');
 if(!locks)blockers.push('OWNER_LOCK_SNAPSHOT_MISSING');
 if(!snapshot.snapshot_verified||!Number.isFinite(checked)||!Number.isFinite(now)||ageMs<0||ageMs>maxAgeMs)blockers.push('FRESH_SOT_READBACK_REQUIRED');
 if(!clean(candidate.title||candidate.name)||!clean(candidate.venue))blockers.push('EVENT_IDENTITY_INCOMPLETE');
 if(!validHttps(candidate.primary_source_url)||candidate.primary_source_verified!==true)blockers.push('PRIMARY_EVENT_SOURCE_NOT_VERIFIED');
 if(!validHttps(candidate.poster_url)||candidate.poster_verified!==true)blockers.push('OFFICIAL_POSTER_NOT_VERIFIED');
 if(candidate.photo_allowed!==true)blockers.push('PHONE_PHOTOGRAPHY_PERMISSION_NOT_VERIFIED');
 if(candidate.bundle_requested!==false&&candidate.lens_allowed!==true)blockers.push('ADDON_LENS_PERMISSION_NOT_VERIFIED');
 if(clean(candidate.access_type).toUpperCase()!=='PUBLIC'&&!(
   clean(candidate.access_type).toUpperCase()==='RESTRICTED'&&candidate.access_verified===true&&candidate.access_terms_disclosed===true
 ))blockers.push('EVENT_ADMISSION_ACCESS_UNVERIFIED');
 let booked=0,unresolved=0,duplicates=0,ownerLocked=0;
 if(date&&bookings)for(const b of bookings){
  if(CANCELLED.has(lower(b.status)))continue;
  const bd=dateOf(b);if(!bd){unresolved++;continue;}
  if(bd===date)booked++;
 }
 if(booked)blockers.push('ANY_CONFIRMED_OR_NONCANCELLED_BOOKING_ON_DATE');
 if(unresolved)blockers.push('BOOKING_DATE_UNRESOLVED');
 if(date&&events)for(const e of events)if(sameEvent(e,candidate,date))duplicates++;
 if(duplicates)blockers.push('EXISTING_CORE_RECORD_RECONCILE_NOT_CREATE');
 if(date&&locks)for(const lock of locks){
  if(clean(lock.state).toUpperCase()!=='LOCKED')continue;
  const reason=clean(lock.reason).toUpperCase();
  const entireDay=/DAY_EXCLUSIVE|BOOKED_DAY_ALL|HIDE_ALL|ONLY_EVENT/.test(reason);
  if(sameEvent(lock,candidate,date)||(entireDay&&dateOf(lock)===date))ownerLocked++;
 }
 if(ownerLocked)blockers.push('OWNER_HIDDEN_HISTORY_LOCK');
 const p=candidate.pricing||{};
 if(p.status!=='FINAL_PRICES_RESOLVED'||p.policy_approved!==true||
   !ALLOWED_PRICE_SOURCES.has(clean(p.source))||!Array.isArray(p.final_prices)){
  blockers.push('FINAL_KK_PRICING_POLICY_NOT_VERIFIED');
 }else{
  const phone=p.final_prices.find(r=>r.template_id==='TPL-VIVO-X300-PRO-PHONE'&&r.active_override===true);
  const bundle=p.final_prices.find(r=>r.template_id==='TPL-VIVO-X300-PRO-BUNDLE'&&r.active_override===true);
  const lens=p.final_prices.find(r=>r.template_id==='TPL-ZEISS-2-35X-LENS');
  if(!phone||!(Number(phone.override_price)>0)||
    (candidate.bundle_requested!==false&&(!bundle||!(Number(bundle.override_price)>0)))||
    (lens&&lens.active_override!==false))blockers.push('PACKAGE_PRICE_OR_LENS_ONLY_VISIBILITY_INVALID');
  if(p.source==='EXACT_EVENT_COMPETITOR_MEDIAN'){
   if(!(Number(p.competitor_evidence_count)>=1)||p.exact_comparables_verified!==true)
    blockers.push('EXACT_EVENT_COMPETITOR_PROOF_MISSING');
  }
  if(p.source==='KK_RENTAL_FIT_SCORE_FALLBACK'){
   const expected=Pricing.scoreFallback({rental_fit_score:candidate.rental_fit_score});
   if(!expected)blockers.push('RENTAL_FIT_SCORE_UNVERIFIED');
   else{
    const required=expected.final_prices.filter(row=>row.active_override===true);
    if(required.some(row=>{
      const actual=p.final_prices.find(x=>x.template_id===row.template_id);
      return !actual||Number(actual.override_price)!==row.override_price;
    }))blockers.push('SCORE_FALLBACK_TIER_MISMATCH');
   }
  }
  if(date&&isWeekend(date)&&p.source!=='EXACT_EVENT_COMPETITOR_MEDIAN'&&p.needs_price_recheck!==true)
   blockers.push('WEEKEND_FALLBACK_PRICE_RECHECK_MISSING');
 }
 return {
  version:VERSION,event_date:date,visible_title:clean(candidate.title||candidate.name)||null,
  status:blockers.length?'HOLD':'CANDIDATE_PREFLIGHT_PASS_NOT_PUBLISH_APPROVAL',
  blockers:[...new Set(blockers)],booking_day_matches:booked,
  owner_lock_matches:ownerLocked,core_duplicate_matches:duplicates,
  pricing_source:clean(p.source)||null,
  publication_authorized:false,authoritative:false,verifier_required:true,
  production_writes:0
 };
}
function evaluate(snapshot={},options={}){
 const rows=Array.isArray(snapshot.candidates)?snapshot.candidates:[];
 const results=rows.map(c=>evaluateCandidate(c,snapshot,options));
 return {
  version:VERSION,status:results.every(x=>x.status==='CANDIDATE_PREFLIGHT_PASS_NOT_PUBLISH_APPROVAL')&&rows.length?'PREPARED_FOR_INDEPENDENT_VERIFIER':'HOLD',
  candidate_count:rows.length,preflight_pass_count:results.filter(x=>!x.blockers.length).length,
  results,production_writes:0,publication_authorized:false
 };
}
module.exports={VERSION,isoDate,dateOf,sameEvent,evaluateCandidate,evaluate};
