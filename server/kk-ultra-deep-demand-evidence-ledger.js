'use strict';
const crypto=require('crypto');
const Rent=require('./kk-ultra-deep-rentability-score.js');
const VERSION='KK_ULTRA_DEEP_DEMAND_EVIDENCE_LEDGER_V1';
const FIELD_BY_TYPE={competitor_rental:'competitor_rental_activity',social_engagement:'social_engagement',ticket_demand:'ticket_demand',fandom_photo_intent:'fandom_photo_intent',venue_capture_value:'venue_capture_value',historical_market_rental:'historical_market_rental'};
function text(v){return String(v==null?'':v).trim();}
function clamp(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(100,n)):null;}
function normalizeEvidence(e={}){
 const type=text(e.type),field=FIELD_BY_TYPE[type],score=clamp(e.score);
 if(!field||score===null||!text(e.source_url)||!text(e.observed_at)||!text(e.summary))return null;
 return {type,score,source_url:text(e.source_url),observed_at:text(e.observed_at),summary:text(e.summary),source_kind:text(e.source_kind||'public_external')};
}
function build(input={}){
 const evidence=(input.evidence||[]).map(normalizeEvidence).filter(Boolean),signals={};
 for(const [type,field] of Object.entries(FIELD_BY_TYPE)){const xs=evidence.filter(x=>x.type===type).map(x=>x.score);signals[field]=xs.length?Math.max(...xs):null;}
 const score=Rent.score(signals,input.config||{});
 const payload={version:VERSION,event_id:text(input.event_id),event_key:text(input.event_key),event_name:text(input.event_name),event_date:text(input.event_date),evidence,signals,score,internal_business_signals_affect_score:false};
 payload.evidence_hash=crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
 return payload;
}
function verify(r={}){
 const errors=[];for(const k of ['event_id','event_name','event_date','evidence_hash'])if(!text(r[k]))errors.push('MISSING_'+k.toUpperCase());
 if(!Array.isArray(r.evidence)||r.evidence.length<4)errors.push('INSUFFICIENT_EXTERNAL_EVIDENCE');
 if(r.internal_business_signals_affect_score!==false)errors.push('INTERNAL_SIGNAL_BOUNDARY_VIOLATION');
 return {ok:errors.length===0,errors};
}
module.exports={VERSION,FIELD_BY_TYPE,normalizeEvidence,build,verify};