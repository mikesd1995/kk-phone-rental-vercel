'use strict';

const MarketingAgent = require('./kk-marketing-agent.js');
const XSignal = require('./kk-x-signal-detector.js');

const VERSION = 'KK_X_POSTING_PLAN_AGENT_V1';
const DEFAULT_TIMEZONE = 'Asia/Bangkok';
const MIN_POST_SCORE = 45;

const SLOTS = Object.freeze([
  Object.freeze({ id:'morning', label:'Morning', start:'08:00', end:'10:30' }),
  Object.freeze({ id:'midday', label:'Midday', start:'11:30', end:'13:30' }),
  Object.freeze({ id:'afternoon', label:'Afternoon', start:'15:00', end:'17:30' }),
  Object.freeze({ id:'prime_time', label:'Prime time', start:'19:30', end:'21:30' }),
  Object.freeze({ id:'late_night', label:'Late night', start:'22:00', end:'00:30' })
]);

const WEIGHTS = Object.freeze({
  x_current_momentum:0.22,
  engagement_quality:0.12,
  rental_ticket_intent:0.14,
  event_proximity:0.16,
  fandom_strength:0.10,
  booking_fit:0.10,
  novelty:0.10,
  competitor_signal:0.06
});

const SAFETY = Object.freeze({
  authority:'READ_ONLY_ADVISOR',
  auto_publish:false,
  auto_schedule:false,
  auto_spend:false,
  price_writes:false,
  booking_writes:false,
  inventory_writes:false,
  production_writes:0,
  final_copy_authority:false
});

function text(value){ return String(value===undefined||value===null?'':value).trim(); }
function number(value, fallback=null){
  const parsed=Number(value);
  return Number.isFinite(parsed)?parsed:fallback;
}
function clamp(value,min=0,max=100){ return Math.max(min,Math.min(max,value)); }
function boundedScore(value){ return clamp(number(value,0)); }

function eventKey(candidate={}){
  return text(candidate.event_key||candidate.event_id||candidate.event||candidate.name).toLowerCase();
}

function daysToEventScore(days){
  const value=number(days,null);
  if(value===null) return 40;
  if(value<0) return 0;
  if(value===0) return 100;
  if(value===1) return 95;
  if(value<=3) return 88;
  if(value<=7) return 74;
  if(value<=14) return 55;
  if(value<=30) return 38;
  return 20;
}

function competitorSignal(candidate={}){
  if(candidate.competitor_signal_verified===true && number(candidate.competitor_signal_score,null)!==null){
    return boundedScore(candidate.competitor_signal_score);
  }
  const pressure=text(candidate.competitor_pressure).toLowerCase();
  if(pressure==='high') return 72;
  if(pressure==='medium') return 50;
  if(pressure==='low') return 28;
  return 40;
}

function recentPostAgeHours(candidate={},recentPosts=[],nowMs=Date.now()){
  const key=eventKey(candidate);
  const rows=[...(Array.isArray(recentPosts)?recentPosts:[]),...(Array.isArray(candidate.recent_posts)?candidate.recent_posts:[])];
  let newest=null;
  for(const row of rows){
    if(!row||typeof row!=='object') continue;
    const rowKey=eventKey(row);
    if(key && rowKey && key!==rowKey) continue;
    if(key && !rowKey && text(row.event).toLowerCase()!==key) continue;
    const ms=Date.parse(row.published_at||row.posted_at||row.created_at||'');
    if(!Number.isFinite(ms)||ms>nowMs) continue;
    if(newest===null||ms>newest) newest=ms;
  }
  if(newest===null) return null;
  return (nowMs-newest)/3600000;
}

function noveltyScore(ageHours){
  if(ageHours===null) return 100;
  if(ageHours<2) return 0;
  if(ageHours<4) return 15;
  if(ageHours<8) return 35;
  if(ageHours<12) return 55;
  if(ageHours<24) return 72;
  if(ageHours<48) return 88;
  return 100;
}

function bookingFit(candidate={},marketingPlan={}){
  const inventory=marketingPlan&&marketingPlan.opportunity&&marketingPlan.opportunity.inventory_gate;
  if(inventory&&inventory.gate==='BLOCKED_NO_PHONE_INVENTORY') return candidate.allow_noncommercial===true?25:0;
  const remaining=number(candidate.inventory_remaining,null);
  let score=55;
  if(candidate.inventory_available===true) score+=20;
  if(remaining===1) score+=12;
  else if(remaining!==null&&remaining>1) score+=8;
  if(candidate.verified_pricing===true) score+=8;
  if(candidate.event_is_today===true||candidate.event_is_tomorrow===true) score+=5;
  return clamp(score);
}

function weighted(parts){
  return Number(parts.reduce((sum,part)=>sum+(part.value*part.weight),0).toFixed(2));
}

function analyzeCandidate(candidate={},context={}){
  const now=text(context.now)||new Date().toISOString();
  const nowMs=Date.parse(now);
  const signal=XSignal.summarizeEventSignals(candidate.x_signals||[],{now});
  const marketingPlan=MarketingAgent.plan({
    ...candidate,
    x_signals:candidate.x_signals||[],
    signal_observed_at:now,
    requested_channel:'x',
    primary_objective:candidate.primary_objective||context.primary_objective||''
  },Array.isArray(context.performanceRows)?context.performanceRows:[]);

  const currentMomentum=signal.gate==='PASS'?boundedScore(signal.priority_score):0;
  const engagement=signal.gate==='PASS'?boundedScore(signal.dimensions.engagement_quality):0;
  const rentalIntent=signal.gate==='PASS'?boundedScore(signal.dimensions.rental_ticket_intent):0;
  const fandom=signal.gate==='PASS'?boundedScore(signal.dimensions.official_fandom_momentum):0;
  const proximity=daysToEventScore(candidate.days_to_event);
  const recentAge=recentPostAgeHours(candidate,context.recent_posts,Number.isFinite(nowMs)?nowMs:Date.now());
  const novelty=noveltyScore(recentAge);
  const booking=bookingFit(candidate,marketingPlan);
  const competitor=competitorSignal(candidate);

  const evidenceBlocked = candidate.verified_event!==true || signal.gate!=='PASS';
  const score=evidenceBlocked?null:weighted([
    {value:currentMomentum,weight:WEIGHTS.x_current_momentum},
    {value:engagement,weight:WEIGHTS.engagement_quality},
    {value:rentalIntent,weight:WEIGHTS.rental_ticket_intent},
    {value:proximity,weight:WEIGHTS.event_proximity},
    {value:fandom,weight:WEIGHTS.fandom_strength},
    {value:booking,weight:WEIGHTS.booking_fit},
    {value:novelty,weight:WEIGHTS.novelty},
    {value:competitor,weight:WEIGHTS.competitor_signal}
  ]);

  return {
    event_key:eventKey(candidate),
    event:text(candidate.event||candidate.name),
    verified_event:candidate.verified_event===true,
    score,
    gate:evidenceBlocked?'BLOCKED_INSUFFICIENT_CURRENT_EVIDENCE':'PASS',
    blocker:candidate.verified_event!==true?'EVENT_NOT_VERIFIED':(signal.gate!=='PASS'?'CURRENT_X_SIGNAL_REQUIRED':''),
    dimensions:{
      x_current_momentum:currentMomentum,
      engagement_quality:engagement,
      rental_ticket_intent:rentalIntent,
      event_proximity:proximity,
      fandom_strength:fandom,
      booking_fit:booking,
      novelty,
      competitor_signal:competitor
    },
    recent_post_age_hours:recentAge===null?null:Number(recentAge.toFixed(2)),
    marketing_plan:marketingPlan,
    x_signal_analysis:signal
  };
}

function slotModifier(slotId,row){
  const d=row.dimensions||{};
  if(slotId==='prime_time'){
    return Number((((d.x_current_momentum||0)*0.05)+((d.fandom_strength||0)*0.04)+((d.engagement_quality||0)*0.03)).toFixed(2));
  }
  if(slotId==='late_night'){
    return Number((((d.engagement_quality||0)*0.04)+((d.rental_ticket_intent||0)*0.04)+((d.novelty||0)*0.02)).toFixed(2));
  }
  if(slotId==='afternoon'){
    return Number((((d.event_proximity||0)*0.04)+((d.booking_fit||0)*0.03)).toFixed(2));
  }
  if(slotId==='midday'){
    return Number((((d.fandom_strength||0)*0.03)+((d.novelty||0)*0.02)).toFixed(2));
  }
  return Number((((d.novelty||0)*0.03)+((d.event_proximity||0)*0.02)).toFixed(2));
}

function contentMode(slotId,row){
  const mode=text(row.marketing_plan&&row.marketing_plan.campaign_mode);
  if(slotId==='late_night' && (row.dimensions.engagement_quality>=55 || row.dimensions.rental_ticket_intent>=55)){
    return 'CONVERSATION_CAPTURE';
  }
  if(mode==='LAST_CALL'||mode==='ONSITE_CONVERSION'||mode==='ONSITE_LAST_UNIT') return mode;
  if(row.dimensions.booking_fit>=70 && row.dimensions.event_proximity>=74) return 'DIRECT_RENTAL';
  return 'FANDOM_ENGAGEMENT';
}

function resolveSlots(requested){
  const ids=Array.isArray(requested)&&requested.length
    ? requested.map(text).filter(Boolean)
    : SLOTS.map(slot=>slot.id);
  const selected=[];
  for(const id of ids){
    const slot=SLOTS.find(item=>item.id===id);
    if(slot&&!selected.some(item=>item.id===slot.id)) selected.push(slot);
  }
  return selected;
}

function plan(input={}){
  const now=text(input.now)||new Date().toISOString();
  const timezone=text(input.timezone)||DEFAULT_TIMEZONE;
  const candidates=Array.isArray(input.candidates)?input.candidates:[];
  const recentPosts=Array.isArray(input.recent_posts)?input.recent_posts:[];
  const requestedSlots=resolveSlots(input.requested_slots);
  const analyzed=candidates.map(candidate=>analyzeCandidate(candidate,{
    now,
    recent_posts:recentPosts,
    performanceRows:input.performanceRows||[],
    primary_objective:input.primary_objective||''
  }));
  const eligible=analyzed.filter(row=>row.gate==='PASS'&&Number.isFinite(row.score));

  if(!eligible.length){
    return {
      schema_version:VERSION,
      agent:'kk-x-posting-plan',
      status:'BLOCKED_INSUFFICIENT_CURRENT_EVIDENCE',
      timezone,
      now,
      requested_slots:requestedSlots,
      candidate_rankings:analyzed,
      slots:[],
      safety:SAFETY,
      interpretation_rule:'Do not invent live X momentum. At least one verified event with current labeled X evidence is required.'
    };
  }

  const used=new Map();
  const slots=[];
  for(const slot of requestedSlots){
    const ranked=eligible.map(row=>{
      const repeats=used.get(row.event_key)||0;
      const repeatPenalty=repeats*18;
      const finalScore=Number((row.score+slotModifier(slot.id,row)-repeatPenalty).toFixed(2));
      return {...row,slot_score:finalScore,repeat_penalty:repeatPenalty};
    }).sort((a,b)=>b.slot_score-a.slot_score);

    const winner=ranked[0];
    if(!winner||winner.slot_score<MIN_POST_SCORE){
      slots.push({
        slot_id:slot.id,label:slot.label,start:slot.start,end:slot.end,
        action:'HOLD',score:winner?winner.slot_score:null,
        reason:'NO_CANDIDATE_CLEARS_MIN_POST_SCORE'
      });
      continue;
    }

    used.set(winner.event_key,(used.get(winner.event_key)||0)+1);
    slots.push({
      slot_id:slot.id,
      label:slot.label,
      start:slot.start,
      end:slot.end,
      action:'POST',
      event_key:winner.event_key,
      event:winner.event,
      score:winner.slot_score,
      base_score:winner.score,
      content_mode:contentMode(slot.id,winner),
      campaign_mode:winner.marketing_plan.campaign_mode,
      rationale:[
        'fresh_x_signal',
        winner.dimensions.event_proximity>=74?'near_event':'future_event',
        winner.dimensions.novelty>=72?'low_recent_post_fatigue':'recent_post_fatigue_present',
        winner.dimensions.rental_ticket_intent>=50?'active_rental_or_ticket_intent':'limited_market_intent'
      ],
      dimensions:winner.dimensions,
      recent_post_age_hours:winner.recent_post_age_hours,
      evidence_confidence:winner.x_signal_analysis.confidence
    });
  }

  return {
    schema_version:VERSION,
    agent:'kk-x-posting-plan',
    status:'READY',
    timezone,
    now,
    weights:WEIGHTS,
    candidate_rankings:[...eligible].sort((a,b)=>b.score-a.score),
    slots,
    selected_event_count:new Set(slots.filter(x=>x.action==='POST').map(x=>x.event_key)).size,
    safety:SAFETY,
    interpretation_rule:'This ranks current verified opportunities for qualified reach, engagement and booking fit. It never guarantees maximum reach and it never publishes or schedules automatically.'
  };
}

module.exports={
  VERSION,DEFAULT_TIMEZONE,MIN_POST_SCORE,SLOTS,WEIGHTS,SAFETY,
  eventKey,daysToEventScore,recentPostAgeHours,noveltyScore,analyzeCandidate,plan
};
