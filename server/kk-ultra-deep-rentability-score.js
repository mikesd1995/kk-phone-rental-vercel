'use strict';
const VERSION='KK_ULTRA_DEEP_RENTABILITY_V1';
const DEFAULT_WEIGHTS=Object.freeze({fandom_strength:30,social_demand:25,rental_intent:20,commercial_evidence:15,event_quality:10});
function clamp(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(100,n)):0;}
function num(v,d=0){const n=Number(v);return Number.isFinite(n)?n:d;}
function score(input={},config={}){
 const w={...DEFAULT_WEIGHTS,...(config.weights||{})}; const sum=Object.values(w).reduce((a,b)=>a+num(b),0)||100;
 const signals={fandom_strength:clamp(input.fandom_strength),social_demand:clamp(input.social_demand),rental_intent:clamp(input.rental_intent),commercial_evidence:clamp(input.commercial_evidence),event_quality:clamp(input.event_quality)};
 let total=Object.entries(w).reduce((a,[k,v])=>a+signals[k]*num(v),0)/sum;
 const boosts=[]; let boost=0;
 if(input.sold_out_or_added_round===true){boost+=5;boosts.push('SOLD_OUT_OR_ADDED_ROUND');}
 if(input.engagement_velocity_high===true){boost+=5;boosts.push('ENGAGEMENT_VELOCITY_HIGH');}
 if(num(input.competitor_rental_count)>1){boost+=5;boosts.push('MULTIPLE_COMPETITOR_RENTAL_LISTINGS');}
 if(input.strong_fan_project_signal===true){boost+=3;boosts.push('STRONG_FAN_PROJECT_SIGNAL');}
 total=clamp(total+boost);
 const high=num(config.high_threshold,70),medium=num(config.medium_threshold,50);
 return {version:VERSION,total:Math.round(total*10)/10,tier:total>=high?'HIGH':total>=medium?'MEDIUM':'LOW',signals,weights:w,boosts,thresholds:{high,medium}};
}
function revenuePotential(input={}){
 const demand=clamp(input.demand_score)/100, probability=clamp(input.booking_probability)/100;
 const price=Math.max(0,num(input.expected_rental_price)),inventory=Math.max(0,num(input.available_inventory));
 const expected_value=demand*probability*price*inventory;
 return {expected_value:Math.round(expected_value*100)/100,demand_score:clamp(input.demand_score),booking_probability:clamp(input.booking_probability),expected_rental_price:price,available_inventory:inventory};
}
function signalCoverage(input={}){const keys=['fandom_strength','social_demand','rental_intent','commercial_evidence','event_quality'];const present=keys.filter(k=>Number.isFinite(Number(input[k])));return {present:present.length,total:keys.length,ratio:present.length/keys.length,keys:present};}
function qualify(input={},config={}){
 const coverage=signalCoverage(input), rentability=score(input,config), revenue=revenuePotential({...input,demand_score:input.demand_score??rentability.total});
 const capacity=Math.max(0,num(input.available_inventory));
 const override=Boolean(input.strong_commercial_signal||input.verified_competitor_rental);
 let decision;
 if(capacity===0) decision='NO_CAPACITY';
 else if(coverage.present<Number(config.min_signal_count||3)) decision='VERIFY_MORE';
 else if(rentability.tier==='HIGH'||override) decision='FULL_LOOP';
 else if(rentability.tier==='MEDIUM') decision='VERIFY_MORE';
 else decision='WATCH';
 return {version:VERSION,decision,rentability,revenue,capacity,signal_coverage:coverage,commercial_override:override,production_writes:0};
}
module.exports={VERSION,DEFAULT_WEIGHTS,score,revenuePotential,signalCoverage,qualify};
