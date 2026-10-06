'use strict';
const VERSION='KK_ULTRA_DEEP_EXTERNAL_DEMAND_V2';
const DEFAULT_WEIGHTS=Object.freeze({
  competitor_rental_activity:30,
  social_engagement:20,
  ticket_demand:15,
  fandom_photo_intent:15,
  venue_capture_value:10,
  historical_market_rental:10
});
const DEFAULT_THRESHOLDS=Object.freeze({priority:75,publish:60,watch:45});
const SIGNAL_KEYS=Object.freeze(Object.keys(DEFAULT_WEIGHTS));
const INTERNAL_BUSINESS_FIELDS=Object.freeze([
  'booking_count','booking_probability','kk_booking_count','kk_bookings',
  'kk_waitlist_count','waitlist_count','kk_inquiry_count','inquiry_count',
  'kk_revenue','revenue','conversion_count','completed_bookings'
]);

function clamp(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(100,n)):0;}
function num(v,d=0){const n=Number(v);return Number.isFinite(n)?n:d;}
function presentNumber(v){return v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));}
function ignoredInternalSignals(input={}){return INTERNAL_BUSINESS_FIELDS.filter(k=>input[k]!==undefined&&input[k]!==null&&input[k]!=='');}

function signalCoverage(input={}){
  const present=SIGNAL_KEYS.filter(k=>presentNumber(input[k]));
  return {present:present.length,total:SIGNAL_KEYS.length,ratio:present.length/SIGNAL_KEYS.length,keys:present};
}

function score(input={},config={}){
  const w={...DEFAULT_WEIGHTS,...(config.weights||{})};
  const sum=Object.values(w).reduce((a,b)=>a+num(b),0)||100;
  const signals=Object.fromEntries(SIGNAL_KEYS.map(k=>[k,presentNumber(input[k])?clamp(input[k]):null]));
  const total=clamp(Object.entries(w).reduce((a,[k,v])=>a+(signals[k]===null?0:signals[k])*num(v),0)/sum);
  const thresholds={
    priority:num(config.priority_threshold,DEFAULT_THRESHOLDS.priority),
    publish:num(config.publish_threshold,DEFAULT_THRESHOLDS.publish),
    watch:num(config.watch_threshold,DEFAULT_THRESHOLDS.watch)
  };
  const tier=total>=thresholds.priority?'PRIORITY':total>=thresholds.publish?'PUBLISH':total>=thresholds.watch?'WATCH':'REJECT';
  return {
    version:VERSION,
    score_basis:'EXTERNAL_MARKET_ONLY',
    total:Math.round(total*10)/10,
    tier,
    signals,
    weights:w,
    thresholds,
    ignored_internal_signals:ignoredInternalSignals(input)
  };
}

function revenuePotential(input={}){
  const demand=clamp(input.demand_score)/100;
  const probability=clamp(input.market_conversion_probability)/100;
  const price=Math.max(0,num(input.expected_rental_price));
  const inventory=Math.max(0,num(input.available_inventory));
  const expected_value=demand*probability*price*inventory;
  return {
    expected_value:Math.round(expected_value*100)/100,
    demand_score:clamp(input.demand_score),
    market_conversion_probability:clamp(input.market_conversion_probability),
    expected_rental_price:price,
    available_inventory:inventory,
    affects_publish_score:false
  };
}

function qualify(input={},config={}){
  const coverage=signalCoverage(input);
  const rentability=score(input,config);
  const capacity=Math.max(0,num(input.available_inventory));
  const minSignals=Math.max(1,Math.min(SIGNAL_KEYS.length,Number(config.min_signal_count||4)));
  const revenue=revenuePotential({...input,demand_score:rentability.total});
  let decision;
  if(capacity===0) decision='NO_CAPACITY';
  else if(coverage.present<minSignals) decision='VERIFY_MORE';
  else if(rentability.total>=rentability.thresholds.publish) decision='FULL_LOOP';
  else if(rentability.total>=rentability.thresholds.watch) decision='WATCH';
  else decision='REJECT';
  return {
    version:VERSION,
    decision,
    publish_eligible:decision==='FULL_LOOP',
    priority:rentability.total>=rentability.thresholds.priority,
    rentability,
    revenue,
    capacity,
    signal_coverage:coverage,
    minimum_signal_count:minSignals,
    commercial_override:false,
    internal_business_signals_affect_score:false,
    production_writes:0
  };
}

module.exports={
  VERSION,DEFAULT_WEIGHTS,DEFAULT_THRESHOLDS,SIGNAL_KEYS,INTERNAL_BUSINESS_FIELDS,
  score,revenuePotential,signalCoverage,qualify
};
