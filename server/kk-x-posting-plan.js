'use strict';

const Marketing=require('./kk-marketing-agent.js');
const Eligibility=require('./kk-x-posting-eligibility.js');
const VisibilityRecovery=require('./kk-x-visibility-recovery.js');

const VERSION='KK_X_POSTING_PLAN_V1';
const TIMEZONE='Asia/Bangkok';
const DEFAULT_SLOTS=Object.freeze([
  Object.freeze({time:'19:30',zone:'PRIME_OPEN',action:'STANDALONE'}),
  Object.freeze({time:'21:00',zone:'PRIME_CORE',action:'STANDALONE'}),
  Object.freeze({time:'22:30',zone:'LATE_PRIME',action:'STANDALONE'}),
  Object.freeze({time:'00:00',zone:'LATE_NIGHT',action:'CONVERSATION_CAPTURE'})
]);

const WEIGHTS=Object.freeze({
  engagement_velocity:0.30,
  conversation_volume:0.20,
  event_proximity:0.15,
  fandom_strength:0.15,
  competitor_activity:0.05,
  booking_opportunity:0.15
});

function text(value){return String(value===undefined||value===null?'':value).trim();}
function clamp(value,min=0,max=100){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):0;}

function detectRequest(message=''){
  const value=text(message).toLowerCase();
  if(!value)return false;
  const mentionsX=/(^|\s)(x|twitter)(\s|$)|บน\s*x|ใน\s*x/i.test(value);
  const planning=/(ควร(?:โพส|โพสต์)อะไร|โพสอะไร|โพสต์อะไร|จัดคิว(?:โพส|โพสต์)|วางคิว(?:โพส|โพสต์)|แบ่ง(?:โซน|ช่วง)เวลา|late\s*night|ช่วงหัวค่ำ|ช่วงเย็น|คืนนี้.*(?:โพส|โพสต์))/i.test(value);
  return mentionsX&&planning;
}

function eventProximity(candidate={}){
  if(candidate.event_is_today===true)return 100;
  if(candidate.event_is_tomorrow===true)return 95;
  const days=Number(candidate.days_to_event);
  if(!Number.isFinite(days)||days<0)return 35;
  if(days<=2)return 88;
  if(days<=3)return 78;
  if(days<=7)return 62;
  if(days<=14)return 42;
  return 20;
}

function competitorActivity(candidate={}){
  if(Number.isFinite(Number(candidate.competitor_activity)))return clamp(candidate.competitor_activity);
  const pressure=text(candidate.competitor_pressure).toLowerCase();
  if(pressure==='high')return 80;
  if(pressure==='medium'||pressure==='moderate')return 55;
  if(pressure==='low')return 25;
  return 40;
}

function recentPostFatigue(candidate={}){
  if(candidate.recent_posted_evidence_verified!==true)return 0;
  const hours=Number(candidate.recent_posted_hours_ago);
  if(!Number.isFinite(hours)||hours<0)return 0;
  if(hours<2)return 40;
  if(hours<4)return 30;
  if(hours<8)return 18;
  if(hours<12)return 10;
  if(hours<24)return 4;
  return 0;
}

function dimensionValue(candidate,key,marketingPlan){
  if(key==='event_proximity')return eventProximity(candidate);
  if(key==='booking_opportunity')return clamp(marketingPlan&&marketingPlan.opportunity&&marketingPlan.opportunity.score);
  // Never turn owner-supplied or guessed social numbers into "measured X".
  const signal=marketingPlan&&marketingPlan.x_signal_analysis;
  if(!signal||signal.gate!=='PASS')return 0;
  if(candidate.signal_metrics_verified===true&&Number.isFinite(Number(candidate[key]))&&candidate[key]!==null&&candidate[key]!=='')return clamp(candidate[key]);
  if(key==='engagement_velocity'&&Number.isFinite(signal.priority_score))return clamp(signal.priority_score);
  return 0;
}

function scoreCandidate(candidate={}){
  // Learning is allowed only from link-backed, expressly verified published posts.
  const measuredRows=Array.isArray(candidate.performance_rows)?candidate.performance_rows.filter(row=>
    row&&row.evidence_verified===true&&
    /^https:\/\/(?:x\.com|twitter\.com)\/[a-zA-Z0-9_]+\/status\/\d+/.test(text(row.x_post_url||row.post_url))&&
    ['measured','confirmed_posted'].includes(text(row.status).toLowerCase())
  ):[];
  const marketingAgent=Marketing.plan(candidate,measuredRows);
  const dimensions={
    engagement_velocity:dimensionValue(candidate,'engagement_velocity',marketingAgent),
    conversation_volume:dimensionValue(candidate,'conversation_volume',marketingAgent),
    event_proximity:eventProximity(candidate),
    fandom_strength:dimensionValue(candidate,'fandom_strength',marketingAgent),
    competitor_activity:dimensionValue(candidate,'competitor_activity',marketingAgent),
    booking_opportunity:dimensionValue(candidate,'booking_opportunity',marketingAgent)
  };
  const raw=Object.entries(WEIGHTS).reduce((sum,[key,weight])=>sum+(dimensions[key]*weight),0);
  const fatigue=recentPostFatigue(candidate);
  return {
    event:text(candidate.event||candidate.name||candidate.title),
    candidate,
    dimensions,
    recent_post_fatigue:fatigue,
    base_score:Math.round(clamp(raw-fatigue)),
    confidence:marketingAgent.x_signal_analysis.gate==='PASS'?'X_SIGNAL_'+String(marketingAgent.x_signal_analysis.confidence||'low').toUpperCase():'LOW_NO_VERIFIED_X',
    score_interpretation:'HEURISTIC_ADVISORY_NOT_MEASURED_REACH',
    marketing_agent:marketingAgent
  };
}

function slotScore(row,slot){
  const d=row.dimensions;
  let bonus=0;
  if(slot.zone==='PRIME_OPEN')bonus=(d.event_proximity*0.08)+(d.fandom_strength*0.05);
  else if(slot.zone==='PRIME_CORE')bonus=(d.booking_opportunity*0.08)+(d.conversation_volume*0.06);
  else if(slot.zone==='LATE_PRIME')bonus=(d.engagement_velocity*0.08)+(d.conversation_volume*0.04);
  else if(slot.zone==='LATE_NIGHT')bonus=(d.conversation_volume*0.10)+(d.fandom_strength*0.03);
  return Math.round(clamp(row.base_score+bonus));
}

function normalizeSlots(slots){
  if(!Array.isArray(slots)||!slots.length)return DEFAULT_SLOTS.map(x=>({...x}));
  return slots.map((slot,index)=>{
    if(typeof slot==='string'){
      const fallback=DEFAULT_SLOTS[index]||DEFAULT_SLOTS[DEFAULT_SLOTS.length-1];
      return {...fallback,time:text(slot)};
    }
    const fallback=DEFAULT_SLOTS[index]||DEFAULT_SLOTS[DEFAULT_SLOTS.length-1];
    return {
      time:text(slot&&slot.time)||fallback.time,
      zone:text(slot&&slot.zone)||fallback.zone,
      action:text(slot&&slot.action)||fallback.action
    };
  });
}

function plan(input={}){
  const candidates=Array.isArray(input.candidates)?input.candidates.filter(Boolean):[];
  const gate=Eligibility.inputGate(input);
  const evaluations=candidates.map(candidate=>({candidate,gate:Eligibility.eligibility(candidate,input,gate)}));
  const rejectedCandidates=evaluations.filter(row=>!row.gate.eligible).map(row=>({
    event:text(row.candidate.event||row.candidate.name||row.candidate.title),
    event_id:text(row.candidate.event_id),
    reason:row.gate.errors[0],
    reasons:row.gate.errors
  }));
  const eligibleCandidates=evaluations.filter(row=>row.gate.eligible).map(row=>{
    const candidate=row.candidate;
    const date=Eligibility.eventDay(candidate.event_date_text);
    const today=Eligibility.bangkokDate(gate.now);
    const delta=Math.round((Date.parse(date+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000);
    // Exact Web Ready row, not a stale candidate claim, owns remaining phones.
    const web=(input.storefront_rows||[]).map(Eligibility.webRow).find(row=>
      row.id===text(candidate.event_id)&&row.date===text(candidate.event_date_text));
    return {...candidate,days_to_event:delta,event_is_today:delta===0,event_is_tomorrow:delta===1,
      inventory_available:true,inventory_remaining:web.available,phone_inventory_remaining:web.available};
  });
  const ranking=eligibleCandidates.map(scoreCandidate).sort((a,b)=>b.base_score-a.base_score);
  const slots=normalizeSlots(input.slots);
  // Account-wide advisory: even distinct events must not flood the same X account.
  const visibilityRecovery=VisibilityRecovery.assess(input,slots,gate);
  const allowed=new Set(visibilityRecovery.allowed_indexes);
  const used=new Set();
  const assignments=slots.map((slot,index)=>{
    if(!allowed.has(index)){
      return {
        time:slot.time,zone:slot.zone,action:slot.action,
        event:'',event_id:'',score:0,confidence:'BLOCKED_VISIBILITY_RECOVERY',
        objective:'',campaign_mode:'',
        reason:[visibilityRecovery.slot_reasons[index]||'RECOVERY_SLOT_NOT_ALLOWED']
      };
    }
    const eligible=ranking
      .filter(row=>row.event&&!used.has(row.event.toLocaleLowerCase()))
      .map(row=>({...row,slot_score:slotScore(row,slot)}))
      .sort((a,b)=>b.slot_score-a.slot_score);
    const winner=eligible[0]||null;
    if(winner)used.add(winner.event.toLocaleLowerCase());
    return {
      time:slot.time,
      zone:slot.zone,
      action:slot.action,
      event:winner?winner.event:'',
      score:winner?winner.slot_score:0,
      confidence:winner?winner.confidence:'NO_ELIGIBLE_EVENT',
      event_id:winner?text(winner.candidate.event_id):'',
      objective:winner&&winner.marketing_agent?winner.marketing_agent.objective:'',
      campaign_mode:winner&&winner.marketing_agent?winner.marketing_agent.campaign_mode:'',
      reason:winner?[
        winner.confidence==='LOW_NO_VERIFIED_X'?'proximity_and_verified_stock_only':'verified_x_and_commercial_signals',
        winner.recent_post_fatigue>0?'recent_post_fatigue_applied':'no_recent_post_penalty',
        slot.zone.toLowerCase()
      ]:[]
    };
  });

  return {
    schema_version:VERSION,
    status:ranking.length&&assignments.some(slot=>slot.event)?'READY_FOR_OWNER_REVIEW':
      ranking.length?'BLOCKED_VISIBILITY_RECOVERY':'BLOCKED_NO_ELIGIBLE_EVENTS',
    readiness_gates:[...new Set([...gate.errors,...visibilityRecovery.errors])],
    visibility_recovery:visibilityRecovery,
    operating_day:gate.operating_day,
    evidence_policy:'Booking, Owner Locks, Storefront and Post Log <=6h readback; planned/assumed not measured published X',
    timezone:text(input.timezone)||TIMEZONE,
    objective:'MAXIMIZE_QUALIFIED_REACH_AND_ENGAGEMENT_WITH_BOOKING_INTENT',
    weights:{...WEIGHTS},
    ranking,
    rejected_candidates:rejectedCandidates,
    slots:assignments,
    safety:{
      authority:'READ_ONLY_ADVISOR',
      auto_publish:false,
      auto_spend:false,
      production_writes:0,
      publishes:0
    },
    production_writes:0,
    publishes:0
  };
}

module.exports={
  VERSION,
  TIMEZONE,
  DEFAULT_SLOTS,
  WEIGHTS,
  detectRequest,
  eventProximity,
  recentPostFatigue,
  scoreCandidate,
  slotScore,
  plan
};
