'use strict';
const Production=require('./kk-ultra-deep-production-runtime.js');
const Rent=require('./kk-ultra-deep-rentability-score.js');
const V2=require('./kk-ultra-deep-full-loop-v2.js');
const VERSION='KK_ULTRA_DEEP_V2_RUNTIME_ADAPTER_V1';
function text(v){return String(v==null?'':v).trim();}
function statusActive(v){return !['cancelled','canceled','no_show'].includes(text(v).toLowerCase());}
function bookingCountForEvent(snapshot,eventId){return (snapshot.bookings||[]).filter(b=>statusActive(b.booking_status)&&text(b.event_id)===text(eventId)).length;}
function availableOnDate(snapshot,eventDate){
 const cap=Production.phoneInventoryCapacity(snapshot);const counts=Production.bookingCountByDate(snapshot);return Math.max(0,cap-Number(counts.get(String(eventDate||'').slice(0,10))||0));
}
function matchForV2(candidate,events=[]){
 const direct=Production.matchExisting(candidate,events);if(direct.match||direct.ambiguous)return direct;
 const sameTitle=events.filter(e=>Production.norm(e.event_name)===Production.norm(candidate.title));
 if(sameTitle.length===1)return {match:{event:sameTitle[0],score:.9,reason:'EXACT_NAME_DATE_CHANGE'},ambiguous:false,candidates:[]};
 if(sameTitle.length>1)return {match:null,ambiguous:true,candidates:sameTitle.slice(0,3).map(event=>({event,score:.9,reason:'EXACT_NAME_AMBIGUOUS_DATE'}))};
 return direct;
}
function commercialByKey(commercial={}){return new Map((commercial.candidates||[]).map(x=>[text(x.event_key),x]));}
function posterFor(row={}){const p=row.poster&&row.poster.selected;return p&&p.verified===true?p:null;}
function competitorPrices(row={}){return row.pricing&&Array.isArray(row.pricing.evidence)?row.pricing.evidence:[];}
function signalValue(candidate,key,fallback=null){const n=Number(candidate&&candidate[key]);return Number.isFinite(n)?n:fallback;}
function normalizeCandidate(candidate,snapshot,commercialRow={}){
 const events=Production.snapshotEvents(snapshot),match=matchForV2(candidate,events),existing=match.match&&match.match.event||null;
 const available=availableOnDate(snapshot,candidate.event_date);
 const rentalFit=signalValue(candidate,'rental_intent',signalValue(candidate,'rental_fit_score',null));
 const rentalIntent=rentalFit===null?0:(rentalFit<=10?rentalFit*10:rentalFit);
 const exact=competitorPrices(commercialRow),commercialEvidence=Math.min(100,(new Set(exact.map(x=>x.competitor_id)).size/3)*100);
 const scoring={fandom_strength:signalValue(candidate,'fandom_strength',null),social_demand:signalValue(candidate,'social_demand',null),rental_intent:rentalFit===null?null:rentalIntent,commercial_evidence:exact.length?commercialEvidence:null,event_quality:signalValue(candidate,'event_quality',null),available_inventory:available,expected_rental_price:commercialRow.pricing&&commercialRow.pricing.proposal&&commercialRow.pricing.proposal.proposed_reference_price||0,booking_probability:signalValue(candidate,'booking_probability',0),verified_competitor_rental:exact.length>0,competitor_rental_count:new Set(exact.map(x=>x.competitor_id)).size,engagement_velocity_high:candidate.engagement_velocity_high===true,sold_out_or_added_round:candidate.sold_out_or_added_round===true,strong_fan_project_signal:candidate.strong_fan_project_signal===true};
 const qualification=existing?{decision:'EXISTING_CANONICAL_MAINTENANCE',production_writes:0}:Rent.qualify(scoring);
 const poster=posterFor(commercialRow);
 const proposal=commercialRow.pricing&&commercialRow.pricing.proposal||{};
 const priceTargets=existing?(existing.packages||[]).map(p=>({package_type:text(p.package_type).toUpperCase(),template_id:text(p.template_id||Production.packageTemplateId(p.package_id)),current_price:Number(p.price)||null,competitor_prices:exact.filter(x=>!text(x.package_type)||text(x.package_type).toUpperCase()===text(p.package_type).toUpperCase())})):[];
 return {
  event_key:text(candidate.event_key||candidate.candidate_id),title:text(candidate.title),event_date:text(candidate.event_date),verified_venue:text(candidate.venue),
  exists_in_canonical:!!existing,canonical_event_id:existing&&text(existing.event_id)||null,
  owner_hidden:existing?existing.active_on_web===false:false,tombstone_locked:existing&&existing.tombstone_locked===true,history_state:existing&&text(existing.history_state)||'',
  booking_count:existing?bookingCountForEvent(snapshot,existing.event_id):0,
  current_price:existing&&existing.packages&&existing.packages.length===1?Number(existing.packages[0].price)||null:null,
  price_targets:priceTargets,competitor_prices:exact,current_date:existing&&text(existing.event_date)||'',verified_date:text(candidate.event_date),date_change_verified:!!existing&&text(existing.event_date)!==text(candidate.event_date),
  current_venue:existing&&text(existing.venue)||'',verified_venue:text(candidate.venue),venue_change_verified:!!existing&&!!text(candidate.venue)&&text(existing.venue)!==text(candidate.venue),
  current_poster_url:existing&&text(existing.poster_image_url)||'',latest_official_poster_url:poster&&text(poster.image_url)||'',latest_official_poster_verified:!!poster,
  exact_event_verified:true,governed_fallback_price:proposal.proposal_available?Number(proposal.proposed_reference_price)||null:null,
  rentability:qualification,available_inventory:available
 };
}
function buildReadOnlyPlan({month,candidates=[],snapshot={},commercial={}}={}){
 const byKey=commercialByKey(commercial),normalized=candidates.map(c=>normalizeCandidate(c,snapshot,byKey.get(text(c.event_key||c.candidate_id))||{}));
 const selected=normalized.filter(c=>c.exists_in_canonical||['FULL_LOOP','VERIFY_MORE'].includes(c.rentability.decision));
 const excluded=normalized.filter(c=>!selected.includes(c)).map(c=>({event_key:c.event_key,title:c.title,decision:c.rentability.decision,score:c.rentability.rentability&&c.rentability.rentability.total}));
 const plan=V2.buildPlan({month,candidates:selected});
 return {version:VERSION,status:plan.status,normalized_count:normalized.length,selected_count:selected.length,excluded_count:excluded.length,excluded,plan,production_writes:0};
}
module.exports={VERSION,statusActive,bookingCountForEvent,availableOnDate,matchForV2,normalizeCandidate,buildReadOnlyPlan};
