'use strict';

const VERSION='KK_ULTRA_DEEP_FULL_LOOP_V2_POLICY_V2';
function text(v){return String(v==null?'':v).trim();}
function money(v){const n=Number(v);return Number.isFinite(n)&&n>0?n:null;}
function bool(v){return v===true;}
function median(values=[]){const xs=values.map(Number).filter(Number.isFinite).sort((a,b)=>a-b);if(!xs.length)return null;const i=Math.floor(xs.length/2);return xs.length%2?xs[i]:(xs[i-1]+xs[i])/2;}
function hidden(input={}){return bool(input.owner_hidden)||bool(input.tombstone_locked)||text(input.history_state).toUpperCase()==='LOCKED';}
function bookingCount(input={}){return Math.max(0,Number(input.booking_count)||0);}
function nonPriceMutations(input={}){
 const out=[];
 const currentDate=text(input.current_date), verifiedDate=text(input.verified_date);
 if(verifiedDate&&currentDate&&verifiedDate!==currentDate&&bool(input.date_change_verified)) out.push({type:'UPDATE_DATE',from:currentDate,to:verifiedDate,evidence:'VERIFIED_OFFICIAL_DATE_CHANGE'});
 const currentVenue=text(input.current_venue), verifiedVenue=text(input.verified_venue);
 if(verifiedVenue&&currentVenue&&verifiedVenue!==currentVenue&&bool(input.venue_change_verified)) out.push({type:'UPDATE_VENUE',from:currentVenue,to:verifiedVenue,evidence:'VERIFIED_OFFICIAL_VENUE_CHANGE'});
 const currentPoster=text(input.current_poster_url), officialPoster=text(input.latest_official_poster_url);
 if(bool(input.latest_official_poster_verified)&&/^https:\/\//i.test(officialPoster)&&officialPoster!==currentPoster) out.push({type:'UPDATE_POSTER',from:currentPoster||null,to:officialPoster,evidence:'VERIFIED_OFFICIAL_ARTWORK'});
 return out;
}
function planExisting(input={}){
 if(hidden(input)) return {decision:'SKIP_HIDDEN',mutations:[],reason:'OWNER_HIDDEN_OR_TOMBSTONE'};
 const mutations=nonPriceMutations(input);
 const rq=input.storefront_requalification||{};
 if(rq.apply_visibility_change===true&&rq.visibility_mutation)mutations.push(rq.visibility_mutation);
 const booked=bookingCount(input)>0;
 const currentPrice=money(input.current_price);
 const prices=(input.competitor_prices||[]).map(x=>money(x&&x.price!==undefined?x.price:x)).filter(Boolean);
 const marketMedian=median(prices);
 const targets=Array.isArray(input.price_targets)?input.price_targets:[];
 if(!booked&&targets.length){
   for(const t of targets){
     const cp=money(t.current_price), ps=(t.competitor_prices||[]).map(x=>money(x&&x.price!==undefined?x.price:x)).filter(Boolean), mm=median(ps);
     if(cp&&mm&&cp!==mm) mutations.unshift({type:'UPDATE_PRICE',package_type:text(t.package_type).toUpperCase(),template_id:text(t.template_id||t.package_id),from:cp,to:mm,evidence:'FRESH_EXACT_EVENT_COMPETITOR_MEDIAN'});
   }
 }else if(!booked&&currentPrice&&marketMedian&&currentPrice!==marketMedian) mutations.unshift({type:'UPDATE_PRICE',from:currentPrice,to:marketMedian,evidence:'FRESH_EXACT_EVENT_COMPETITOR_MEDIAN'});
 return {decision:mutations.length?'UPDATE':'NO_CHANGE',mutations,market_median:marketMedian,price_locked:booked,price_lock_reason:booked?'ANY_BOOKING_LOCKS_PRICE':null};
}
function planNew(input={}){
 if(hidden(input)) return {decision:'SKIP_HIDDEN',mutations:[],reason:'OWNER_HIDDEN_OR_TOMBSTONE'};
 if(bookingCount(input)>0) return {decision:'HOLD',mutations:[],holds:['BOOKING_IDENTITY_MUST_JOIN_EXISTING_CANONICAL_EVENT']};
 const exactEvidence=bool(input.exact_event_verified);
 const poster=text(input.latest_official_poster_url);
 const posterVerified=bool(input.latest_official_poster_verified)&&/^https:\/\//i.test(poster);
 const prices=(input.competitor_prices||[]).map(x=>money(x&&x.price!==undefined?x.price:x)).filter(Boolean);
 const marketMedian=median(prices);
 const fallback=money(input.governed_fallback_price);
 const targetPrice=marketMedian||fallback;
 const holds=[];
 if(!exactEvidence) holds.push('EXACT_EVENT_EVIDENCE_REQUIRED');
 if(!posterVerified) holds.push('VERIFIED_POSTER_REQUIRED');
 if(!targetPrice) holds.push('SAFE_PRICE_REQUIRED');
 if(holds.length) return {decision:'HOLD',mutations:[],holds,poster_leads:Array.isArray(input.competitor_poster_leads)?input.competitor_poster_leads:[]};
 return {decision:'CREATE',mutations:[{type:'CREATE_EVENT',price:targetPrice,poster_url:poster,price_basis:marketMedian?'FRESH_EXACT_EVENT_COMPETITOR_MEDIAN':'GOVERNED_FALLBACK'}],market_median:marketMedian};
}
function plan(input={}){
 const out=bool(input.exists_in_canonical)?planExisting(input):planNew(input);
 return {schema_version:VERSION,...out,authority:{scanner_production_writes:0,writer:'GOVERNED_ADMIN_ONLY',exact_readback_required:true}};
}
module.exports={VERSION,median,nonPriceMutations,planExisting,planNew,plan};
