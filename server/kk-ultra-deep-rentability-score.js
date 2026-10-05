'use strict';
const VERSION='KK_ULTRA_DEEP_RENTABILITY_V2';
const DEFAULT_WEIGHTS=Object.freeze({
  fandom_strength:25,
  camera_value:20,
  social_demand:15,
  event_format:10,
  historical_similarity:10,
  venue_attendance:10,
  competitor_activity:5,
  operational_feasibility:5
});
const INTENT_TERMS=Object.freeze(['lucky fan','top spender','fansign','fan sign','fan benefit','hi touch','hi-touch','photo opportunity','selected fan','birthday','fanmeeting','fan meeting','premiere','artist appearance','brand x artist','meet & greet','meet and greet']);

function clamp(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(100,n)):0;}
function num(v,d=0){const n=Number(v);return Number.isFinite(n)?n:d;}
function text(v){return String(v==null?'':v).trim().toLowerCase();}
function uniq(xs){return [...new Set(xs)];}
function intentSignals(input={}){
 const hay=text([input.title,input.category,input.description,input.notes].filter(Boolean).join(' '));
 return INTENT_TERMS.filter(term=>hay.includes(term));
}
function score(input={},config={}){
 const w={...DEFAULT_WEIGHTS,...(config.weights||{})};
 const sum=Object.values(w).reduce((a,b)=>a+num(b),0)||100;
 const signals=Object.fromEntries(Object.keys(DEFAULT_WEIGHTS).map(k=>[k,clamp(input[k])]));
 let total=Object.entries(w).reduce((a,[k,v])=>a+signals[k]*num(v),0)/sum;
 const boosts=[]; let boost=0;
 const intents=intentSignals(input);
 if(intents.length){boost+=Math.min(10,4+intents.length*2);boosts.push('DIRECT_RENTAL_INTENT:'+intents.join(','));}
 if(input.sold_out_or_added_round===true){boost+=5;boosts.push('SOLD_OUT_OR_ADDED_ROUND');}
 if(input.engagement_velocity_high===true){boost+=5;boosts.push('ENGAGEMENT_VELOCITY_HIGH');}
 if(num(input.competitor_rental_count)>1){boost+=5;boosts.push('MULTIPLE_COMPETITOR_RENTAL_LISTINGS');}
 if(input.strong_fan_project_signal===true){boost+=3;boosts.push('STRONG_FAN_PROJECT_SIGNAL');}
 total=clamp(total+boost);
 const s=num(config.s_threshold,80),a=num(config.a_threshold,65),b=num(config.b_threshold,45),c=num(config.c_threshold,25);
 const tier=total>=s?'S':total>=a?'A':total>=b?'B':total>=c?'C':'D';
 return {version:VERSION,total:Math.round(total*10)/10,tier,signals,weights:w,boosts,intent_signals:intents,thresholds:{s,a,b,c}};
}
function discoveryConfidence(input={}){
 const sourceCount=Math.max(0,num(input.independent_source_count));
 const official=input.official_source===true,ticketing=input.ticketing_source===true,venue=input.venue_source===true;
 const identity=input.identity_match===true,date=input.date_match===true,location=input.location_match===true;
 let total=0;
 if(official) total+=35;
 if(ticketing) total+=20;
 if(venue) total+=15;
 total+=Math.min(15,sourceCount*5);
 if(identity) total+=5;
 if(date) total+=5;
 if(location) total+=5;
 return {total:clamp(total),signals:{official,ticketing,venue,independent_source_count:sourceCount,identity_match:identity,date_match:date,location_match:location}};
}
function priority(input={},config={}){
 const rentability=score(input,config);
 const confidence=discoveryConfidence(input);
 const urgent=clamp(input.urgency_score);
 const total=Math.round((rentability.total*.6+confidence.total*.25+urgent*.15)*10)/10;
 const mandatory=Boolean(input.known_booking||input.owner_requested||input.known_storefront||input.known_historical_demand);
 const phase2=mandatory||rentability.tier==='S'||rentability.tier==='A'||rentability.tier==='B';
 return {version:VERSION,total,rentability,discovery_confidence:confidence,urgency:urgent,mandatory_override:mandatory,phase2_recommended:phase2,authority:'PRIORITIZATION_ONLY',may_drop_candidate:false,production_writes:0};
}
function signalCoverage(input={}){const keys=Object.keys(DEFAULT_WEIGHTS);const present=keys.filter(k=>input[k]!==null&&input[k]!==undefined&&input[k]!==''&&Number.isFinite(Number(input[k])));return {present:present.length,total:keys.length,ratio:present.length/keys.length,keys:present};}
function qualify(input={},config={}){
 const coverage=signalCoverage(input),p=priority(input,config);
 let decision;
 if(p.mandatory_override) decision='PHASE2_MANDATORY';
 else if(coverage.present<Number(config.min_signal_count||4)) decision='VERIFY_MORE';
 else if(p.rentability.tier==='S'||p.rentability.tier==='A') decision='PHASE2_PRIORITY';
 else if(p.rentability.tier==='B') decision='PHASE2_NORMAL';
 else decision='HOLD_VISIBLE';
 return {version:VERSION,decision,...p,signal_coverage:coverage,discovery_preserved:true,production_writes:0};
}
module.exports={VERSION,DEFAULT_WEIGHTS,INTENT_TERMS,intentSignals,score,discoveryConfidence,priority,signalCoverage,qualify};
