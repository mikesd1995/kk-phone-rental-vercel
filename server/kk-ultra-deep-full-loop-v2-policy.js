'use strict';

const VERSION='KK_ULTRA_DEEP_FULL_LOOP_V2_POLICY_V1';

function text(v){ return String(v==null?'':v).trim(); }
function money(v){ const n=Number(v); return Number.isFinite(n)&&n>0?n:null; }
function bool(v){ return v===true; }
function median(values=[]){
  const xs=values.map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
  if(!xs.length) return null;
  const i=Math.floor(xs.length/2);
  return xs.length%2?xs[i]:(xs[i-1]+xs[i])/2;
}
function hidden(input={}){
  return bool(input.owner_hidden)||bool(input.tombstone_locked)||text(input.history_state).toUpperCase()==='LOCKED';
}
function bookingCount(input={}){ return Math.max(0,Number(input.booking_count)||0); }

function planExisting(input={}){
  const currentPrice=money(input.current_price);
  if(hidden(input)) return {decision:'SKIP_HIDDEN',mutations:[],reason:'OWNER_HIDDEN_OR_TOMBSTONE'};
  if(bookingCount(input)>0) return {decision:'SKIP_BOOKED',mutations:[],reason:'ANY_BOOKING_LOCKS_EVENT_PRICE_AND_DISCOVERY'};

  const mutations=[];
  const competitorPrices=(input.competitor_prices||[]).map(x=>money(x&&x.price!==undefined?x.price:x)).filter(Boolean);
  const marketMedian=median(competitorPrices);
  if(currentPrice&&marketMedian&&currentPrice!==marketMedian){
    mutations.push({type:'UPDATE_PRICE',from:currentPrice,to:marketMedian,evidence:'FRESH_EXACT_EVENT_COMPETITOR_MEDIAN'});
  }

  const currentDate=text(input.current_date);
  const verifiedDate=text(input.verified_date);
  if(verifiedDate&&currentDate&&verifiedDate!==currentDate&&bool(input.date_change_verified)){
    mutations.push({type:'UPDATE_DATE',from:currentDate,to:verifiedDate,evidence:'VERIFIED_OFFICIAL_DATE_CHANGE'});
  }

  const currentVenue=text(input.current_venue);
  const verifiedVenue=text(input.verified_venue);
  if(verifiedVenue&&currentVenue&&verifiedVenue!==currentVenue&&bool(input.venue_change_verified)){
    mutations.push({type:'UPDATE_VENUE',from:currentVenue,to:verifiedVenue,evidence:'VERIFIED_OFFICIAL_VENUE_CHANGE'});
  }

  const currentPoster=text(input.current_poster_url);
  const officialPoster=text(input.latest_official_poster_url);
  if(bool(input.latest_official_poster_verified)&&/^https:\/\//i.test(officialPoster)&&officialPoster!==currentPoster){
    mutations.push({type:'UPDATE_POSTER',from:currentPoster||null,to:officialPoster,evidence:'VERIFIED_OFFICIAL_ARTWORK'});
  }

  return {decision:mutations.length?'UPDATE':'NO_CHANGE',mutations,market_median:marketMedian};
}

function planNew(input={}){
  if(hidden(input)) return {decision:'SKIP_HIDDEN',mutations:[],reason:'OWNER_HIDDEN_OR_TOMBSTONE'};
  if(bookingCount(input)>0) return {decision:'SKIP_BOOKED',mutations:[],reason:'BOOKING_IDENTITY_CONFLICT_REQUIRES_EXISTING_EVENT_PATH'};

  const exactEvidence=bool(input.exact_event_verified);
  const poster=text(input.latest_official_poster_url);
  const posterVerified=bool(input.latest_official_poster_verified)&&/^https:\/\//i.test(poster);
  const prices=(input.competitor_prices||[]).map(x=>money(x&&x.price!==undefined?x.price:x)).filter(Boolean);
  const marketMedian=median(prices);
  const fallback=money(input.governed_fallback_price);
  const targetPrice=marketMedian||fallback;

  const holds=[];
  if(!exactEvidence) holds.push('EXACT_EVENT_EVIDENCE_REQUIRED');
  if(!posterVerified) holds.push('VERIFIED_OFFICIAL_POSTER_REQUIRED');
  if(!targetPrice) holds.push('SAFE_PRICE_REQUIRED');
  if(holds.length) return {decision:'HOLD',mutations:[],holds};

  return {decision:'CREATE',mutations:[{type:'CREATE_EVENT',price:targetPrice,poster_url:poster,price_basis:marketMedian?'FRESH_EXACT_EVENT_COMPETITOR_MEDIAN':'GOVERNED_FALLBACK'}],market_median:marketMedian};
}

function plan(input={}){
  const exists=bool(input.exists_in_canonical);
  const out=exists?planExisting(input):planNew(input);
  return {schema_version:VERSION,...out,authority:{scanner_production_writes:0,writer:'GOVERNED_ADMIN_ONLY',exact_readback_required:true}};
}

module.exports={VERSION,median,planExisting,planNew,plan};
