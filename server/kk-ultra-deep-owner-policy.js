'use strict';

const VERSION='KK_ULTRA_DEEP_OWNER_POLICY_V1';
function text(v){return String(v==null?'':v).trim();}
function money(v){const n=Number(v);return Number.isFinite(n)&&n>0?n:null;}
function bool(v){return v===true;}
function median(xs=[]){const a=xs.map(Number).filter(Number.isFinite).sort((a,b)=>a-b);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}

function discoveryDecision(input={}){
 const hidden=bool(input.owner_hidden)||bool(input.tombstone_locked)||text(input.history_state).toUpperCase()==='LOCKED';
 const bookingCount=Math.max(0,Number(input.booking_count)||0);
 if(hidden) return {status:'SKIP',reason:'OWNER_HIDDEN_OR_TOMBSTONE',scan_allowed:false,publish_allowed:false};
 if(bookingCount>0) return {status:'SKIP',reason:'BOOKING_DATE_DISCOVERY_SKIP',scan_allowed:false,publish_allowed:false};
 return {status:'SCAN',reason:'NO_BOOKING_AND_NOT_HIDDEN',scan_allowed:true,publish_allowed:true};
}

function pricingDecision(input={}){
 const bookingCount=Math.max(0,Number(input.booking_count)||0);
 const dateBookingCount=Math.max(0,Number(input.date_booking_count)||0);
 const stockRemaining=Math.max(0,Number(input.stock_remaining)||0);
 const current=money(input.current_price);
 const prices=(input.competitor_prices||[]).map(x=>money(x&&x.price!==undefined?x.price:x)).filter(Boolean);
 const market=median(prices);
 if(bookingCount>0||dateBookingCount>0) return {status:'KEEP',reason:stockRemaining>0?'BOOKING_DATE_PRICE_LOCK_WITH_REMAINING_STOCK':'BOOKING_DATE_PRICE_LOCK',current_price:current,target_price:current,market_median:market,write_required:false};
 if(!current) return {status:'HOLD',reason:'CURRENT_PRICE_MISSING',current_price:null,target_price:null,market_median:market,write_required:false};
 if(!market) return {status:'KEEP',reason:'NO_FRESH_COMPETITOR_PRICE',current_price:current,target_price:current,market_median:null,write_required:false};
 if(current===market) return {status:'KEEP',reason:'ALIGNED_WITH_MARKET',current_price:current,target_price:current,market_median:market,write_required:false};
 return {status:'REPRICE',reason:current>market?'KK_ABOVE_MARKET_REDUCE':'KK_BELOW_MARKET_INCREASE',current_price:current,target_price:market,market_median:market,write_required:true};
}

function posterDecision(input={}){
 const current=text(input.current_poster_url);
 const official=text(input.latest_official_poster_url);
 const verified=bool(input.latest_official_poster_verified);
 if(!verified||!/^https:\/\//i.test(official)) return {status:'KEEP',reason:'NO_VERIFIED_NEW_OFFICIAL_POSTER',write_required:false,target_poster_url:current||null};
 if(current===official) return {status:'KEEP',reason:'POSTER_ALREADY_CURRENT',write_required:false,target_poster_url:current};
 return {status:'UPDATE',reason:'VERIFIED_OFFICIAL_POSTER_CHANGED',write_required:true,target_poster_url:official};
}

function evaluate(input={}){
 return {schema_version:VERSION,discovery:discoveryDecision(input),pricing:pricingDecision(input),poster:posterDecision(input),authority:{scanner_production_writes:0,requires_governed_admin_write:true,exact_readback_required:true}};
}
module.exports={VERSION,median,discoveryDecision,pricingDecision,posterDecision,evaluate};
