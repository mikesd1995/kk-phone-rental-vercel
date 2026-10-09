'use strict';
const Production=require('./kk-ultra-deep-production-runtime.js');
const Rent=require('./kk-ultra-deep-rentability-score.js');
const V2=require('./kk-ultra-deep-full-loop-v2.js');
const Requal=require('./kk-ultra-deep-storefront-requalification.js');
const StateConsistency=require('./kk-ultra-deep-state-consistency.js');
const VERSION='KK_ULTRA_DEEP_V2_RUNTIME_ADAPTER_V6_STATE_CONSISTENCY';
function text(v){return String(v==null?'':v).trim();}
const ACTIVE_BOOKING_STATUSES=new Set(['pending','confirmed','prepared','picked_up']);
function statusActive(v){return ACTIVE_BOOKING_STATUSES.has(text(v).toLowerCase());}
function bookingCountForEvent(snapshot,eventId){return (snapshot.bookings||[]).filter(b=>statusActive(b.booking_status)&&text(b.event_id)===text(eventId)).length;}
function bookingCountOnDate(snapshot,eventDate){return Number(Production.bookingCountByDate(snapshot).get(String(eventDate||'').slice(0,10))||0);}
function availableOnDate(snapshot,eventDate){
 const cap=Production.phoneInventoryCapacity(snapshot);const counts=Production.bookingCountByDate(snapshot);return Math.max(0,cap-Number(counts.get(String(eventDate||'').slice(0,10))||0));
}
function dateChangeAuthority(candidate={},sameTitle=[]){
 const targetDate=text(candidate.event_date).slice(0,10);
 const priorId=text(candidate.canonical_event_id||candidate.existing_event_id||candidate.event_id);
 const explicit= candidate.official_date_change_verified===true &&
  ['POSTPONED','RESCHEDULED','DATE_CHANGED'].includes(text(candidate.change_state||candidate.lifecycle_state).toUpperCase());
 return explicit && !!priorId && sameTitle.length===1 &&
  text(sameTitle[0].event_id)===priorId &&
  text(sameTitle[0].event_date).slice(0,10)!==targetDate;
}
function addedShowIdentity(candidate={}){
 return candidate.verified_added_show===true &&
  ['ADDED_SHOW','NEW_ROUND_ADDED','EXTRA_SHOW'].includes(text(candidate.change_state||candidate.lifecycle_state).toUpperCase());
}
function matchForV2(candidate,events=[]){
 const direct=Production.matchExisting(candidate,events);
 if(direct.match||direct.ambiguous)return direct;
 const sameTitle=events.filter(e=>Production.norm(e.event_name)===Production.norm(candidate.title));
 if(!sameTitle.length)return direct;
 // Repeated same-title shows are separate date identities, never implicit date edits.
 // A date change needs a verified primary announcement and an explicit canonical ID.
 if(dateChangeAuthority(candidate,sameTitle))return {match:{event:sameTitle[0],score:1,reason:'OFFICIALLY_VERIFIED_DATE_CHANGE'},ambiguous:false,candidates:[]};
 if(addedShowIdentity(candidate))return direct;
 return {match:null,ambiguous:true,candidates:sameTitle.slice(0,3).map(event=>({
  event,score:.9,reason:'DATE_SIBLING_OR_POSTPONEMENT_UNRESOLVED'
 }))};
}
function commercialByKey(commercial={}){return new Map((commercial.candidates||[]).map(x=>[text(x.event_key),x]));}
function posterFor(row={}){const p=row.poster&&row.poster.selected;return p&&p.verified===true?p:null;}
function competitorPrices(row={}){return row.pricing&&Array.isArray(row.pricing.evidence)?row.pricing.evidence:[];}
function signalValue(candidate,key,fallback=null){const n=Number(candidate&&candidate[key]);return Number.isFinite(n)?n:fallback;}
function averagePresent(values=[]){const xs=values.filter(v=>v!==null&&v!==undefined&&Number.isFinite(Number(v))).map(Number);return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null;}
function competitorActivity(count){const n=Math.max(0,Number(count)||0);return n>=4?100:n===3?90:n===2?75:n===1?45:null;}
function normalizeCandidate(candidate,snapshot,commercialRow={}){
 const events=Production.snapshotEvents(snapshot),match=matchForV2(candidate,events),existing=match.match&&match.match.event||null;
 const dateBookingCount=bookingCountOnDate(snapshot,candidate.event_date);
 const sameEventBookingCount=existing?bookingCountForEvent(snapshot,existing.event_id):0;
 const bookingDayExcluded=dateBookingCount>0&&sameEventBookingCount===0;
 const identityAmbiguous=match.ambiguous===true;
 const available=availableOnDate(snapshot,candidate.event_date);
 const exact=competitorPrices(commercialRow);
 const competitorCount=new Set(exact.map(x=>x.competitor_id).filter(Boolean)).size;
 const legacyRental=signalValue(candidate,'rental_intent',signalValue(candidate,'rental_fit_score',null));
 const normalizedLegacyRental=legacyRental===null?null:(legacyRental<=10?legacyRental*10:legacyRental);
 const fandom=signalValue(candidate,'fandom_strength',null);
 const scoring={
   competitor_rental_activity:signalValue(candidate,'competitor_rental_activity',competitorActivity(competitorCount)),
   social_engagement:signalValue(candidate,'social_engagement',signalValue(candidate,'social_demand',null)),
   ticket_demand:signalValue(candidate,'ticket_demand',candidate.sold_out_or_added_round===true?100:null),
   fandom_photo_intent:signalValue(candidate,'fandom_photo_intent',averagePresent([fandom,normalizedLegacyRental])),
   venue_capture_value:signalValue(candidate,'venue_capture_value',signalValue(candidate,'event_quality',null)),
   historical_market_rental:signalValue(candidate,'historical_market_rental',signalValue(candidate,'historical_rental_activity',null)),
   available_inventory:available,
   expected_rental_price:commercialRow.pricing&&commercialRow.pricing.proposal&&commercialRow.pricing.proposal.proposed_reference_price||0,
   market_conversion_probability:signalValue(candidate,'market_conversion_probability',0),

   // Explicitly carried only so the scorer can prove they are ignored.
   booking_count:existing?bookingCountForEvent(snapshot,existing.event_id):0,
   kk_booking_count:signalValue(candidate,'kk_booking_count',null),
   kk_waitlist_count:signalValue(candidate,'kk_waitlist_count',null),
   kk_inquiry_count:signalValue(candidate,'kk_inquiry_count',null),
   kk_revenue:signalValue(candidate,'kk_revenue',null)
 };
 const qualification=identityAmbiguous?
  {decision:'HOLD_DATE_SIBLING_IDENTITY',publish_eligible:false,production_writes:0,internal_business_signals_affect_score:false}:
  (bookingDayExcluded?{decision:'ACTIVE_BOOKING_DATE_EXCLUDED',publish_eligible:false,production_writes:0,internal_business_signals_affect_score:false}:
  (existing?{decision:'EXISTING_CANONICAL_MAINTENANCE',production_writes:0,internal_business_signals_affect_score:false}:Rent.qualify(scoring)));
 const requalification=existing?(bookingDayExcluded?{decision:'BOOKING_DAY_EXCLUDED',apply_visibility_change:false,reason:'OWNER_BOOKING_DAY_EXCLUSIVITY_REQUIRES_GOVERNED_RECONCILIATION',internal_business_signals_affect_score:false}:Requal.requalify({
   external_scoring:scoring,
   active_booking_count:bookingCountForEvent(snapshot,existing.event_id),
   available_inventory:available,
   owner_keep:candidate.owner_keep===true||existing.owner_keep===true||text(existing.history_reason).toUpperCase().startsWith('OWNER_KEEP'),
   owner_hidden:existing.owner_hidden===true,
   tombstone_locked:existing.tombstone_locked===true,
   history_state:text(existing.history_state),
   active_on_web:existing.active_on_web!==false,
   owner_monthly_reconciliation_apply:candidate.owner_monthly_reconciliation_apply===true,
   visibility_lock_reason:'OWNER_MONTHLY_DEMAND_PRUNE'
 })):null;
 const poster=posterFor(commercialRow);
 const proposal=commercialRow.pricing&&commercialRow.pricing.proposal||{};
 const priceTargets=existing?(existing.packages||[]).map(p=>({package_type:text(p.package_type).toUpperCase(),template_id:text(p.template_id||Production.packageTemplateId(p.package_id)),current_price:Number(p.price)||null,competitor_prices:exact.filter(x=>!text(x.package_type)||text(x.package_type).toUpperCase()===text(p.package_type).toUpperCase())})):[];
 return {
  event_key:text(candidate.event_key||candidate.candidate_id),title:text(candidate.title),event_date:text(candidate.event_date),verified_venue:text(candidate.venue),
  exists_in_canonical:!!existing,canonical_event_id:existing&&text(existing.event_id)||null,
  owner_hidden:existing?existing.active_on_web===false:false,tombstone_locked:existing&&existing.tombstone_locked===true,history_state:existing&&text(existing.history_state)||'',
  booking_count:sameEventBookingCount,date_booking_count:dateBookingCount,booking_day_excluded:bookingDayExcluded,
  identity_ambiguous:identityAmbiguous,identity_hold_reason:identityAmbiguous?'DATE_SIBLING_OR_POSTPONEMENT_UNRESOLVED':null,
  current_price:existing&&existing.packages&&existing.packages.length===1?Number(existing.packages[0].price)||null:null,
  price_targets:priceTargets,competitor_prices:exact,current_date:existing&&text(existing.event_date)||'',verified_date:text(candidate.event_date),date_change_verified:!!existing&&text(existing.event_date)!==text(candidate.event_date),
  current_venue:existing&&text(existing.venue)||'',verified_venue:text(candidate.venue),venue_change_verified:!!existing&&!!text(candidate.venue)&&text(existing.venue)!==text(candidate.venue),
  current_poster_url:existing&&text(existing.poster_image_url)||'',latest_official_poster_url:poster&&text(poster.image_url)||'',latest_official_poster_verified:!!poster,
  exact_event_verified:true,governed_fallback_price:proposal.proposal_available?Number(proposal.proposed_reference_price)||null:null,
  rentability:qualification,storefront_requalification:requalification,external_scoring:scoring,available_inventory:available
 };
}
function buildReadOnlyPlan({month,candidates=[],snapshot={},commercial={}}={}){
 const consistency=StateConsistency.audit(snapshot);
 if(consistency.status==='FAIL_CLOSED')return {
   version:VERSION,status:'BLOCKED_STATE_CONSISTENCY',state_consistency:consistency,
   normalized_count:0,selected_count:0,excluded_count:0,
   read_only:true,production_writes:0
 };
 const byKey=commercialByKey(commercial),normalized=candidates.map(c=>normalizeCandidate(c,snapshot,byKey.get(text(c.event_key||c.candidate_id))||{}));
 // Existing canonical events remain eligible for maintenance. New candidates must pass the external-demand publish gate.
 const selected=normalized.filter(c=>!c.booking_day_excluded&&(c.exists_in_canonical||c.rentability.decision==='FULL_LOOP'));
 const excluded=normalized.filter(c=>!selected.includes(c)).map(c=>({
   event_key:c.event_key,title:c.title,decision:c.rentability.decision,
   score:c.rentability.rentability&&c.rentability.rentability.total,
   tier:c.rentability.rentability&&c.rentability.rentability.tier,
   signal_coverage:c.rentability.signal_coverage||null
 }));
 const plan=V2.buildPlan({month,candidates:selected});
 return {
   version:VERSION,status:plan.status,state_consistency:consistency,normalized_count:normalized.length,selected_count:selected.length,excluded_count:excluded.length,
   external_demand_publish_gate:{publish_threshold:Rent.DEFAULT_THRESHOLDS.publish,priority_threshold:Rent.DEFAULT_THRESHOLDS.priority,watch_threshold:Rent.DEFAULT_THRESHOLDS.watch,internal_business_signals_affect_score:false},
   excluded,
   storefront_requalification:Requal.report(normalized.filter(c=>c.exists_in_canonical)),
   plan,production_writes:0
 };
}
module.exports={VERSION,ACTIVE_BOOKING_STATUSES,statusActive,bookingCountForEvent,bookingCountOnDate,availableOnDate,dateChangeAuthority,addedShowIdentity,matchForV2,normalizeCandidate,buildReadOnlyPlan};
