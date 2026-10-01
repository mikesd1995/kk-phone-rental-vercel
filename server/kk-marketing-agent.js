'use strict';

const Performance=require('./kk-content-performance.js');
const XSignal=require('./kk-x-signal-detector.js');

const VERSION='KK_MARKETING_AGENT_V2_X_SIGNAL';
const OBJECTIVES=Object.freeze(['awareness','engagement','conversion']);
const SAFETY=Object.freeze({
  authority:'READ_ONLY_ADVISOR',
  human_approval_required:true,
  auto_publish:false,
  auto_spend:false,
  price_writes:false,
  inventory_writes:false,
  machine_sot_writes:false,
  production_writes:0
});

function text(v){return String(v===undefined||v===null?'':v).trim();}
function num(v){const n=Number(v);return Number.isFinite(n)&&n>=0?n:0;}
function clamp(v,min=0,max=100){return Math.max(min,Math.min(max,v));}

function objective(input={}){
  const requested=text(input.primary_objective).toLowerCase();
  if(OBJECTIVES.includes(requested)) return requested;
  if(num(input.inventory_remaining)>0 && num(input.inventory_remaining)<=1) return 'conversion';
  if(input.event_is_today===true || input.event_is_tomorrow===true) return 'conversion';
  return 'awareness';
}

function scoreOpportunity(input={},xSignalAnalysis=null){
  let score=50;
  const reasons=[];
  const inv=num(input.inventory_remaining);
  const inventory=XSignal.inventoryGate(input);
  if(input.verified_event===true){score+=8;reasons.push('verified_event');}
  if(input.verified_pricing===true){score+=6;reasons.push('verified_pricing');}
  if(inventory.gate==='PASS'&&input.inventory_available===true){score+=6;reasons.push('inventory_available');}
  if(input.event_is_today===true){score+=14;reasons.push('event_today');}
  else if(input.event_is_tomorrow===true){score+=10;reasons.push('event_tomorrow');}
  else if(num(input.days_to_event)<=7){score+=6;reasons.push('event_within_7_days');}
  if(inv===1){score+=10;reasons.push('last_unit');}
  if(input.competitor_pressure==='high'){score+=4;reasons.push('high_competitor_pressure');}
  if(input.demand_signal==='high'){score+=8;reasons.push('high_demand_signal');}
  if(xSignalAnalysis&&xSignalAnalysis.gate==='PASS'&&Number.isFinite(xSignalAnalysis.priority_score)){
    if(xSignalAnalysis.priority_score>=75){score+=8;reasons.push('strong_fresh_x_signal');}
    else if(xSignalAnalysis.priority_score>=50){score+=4;reasons.push('moderate_fresh_x_signal');}
  }
  if(inventory.gate==='BLOCKED_NO_PHONE_INVENTORY'){score-=50;reasons.push('no_phone_inventory');}
  if(inventory.gate==='LENS_ONLY'){reasons.push('lens_only_inventory');}
  return {score:clamp(score),reasons,inventory_gate:inventory};
}

function chooseCampaignMode(input={},obj='awareness'){
  const inventory=XSignal.inventoryGate(input);
  if(inventory.gate==='BLOCKED_NO_PHONE_INVENTORY') return 'HOLD_NO_PHONE_INVENTORY';
  if(inventory.gate==='LENS_ONLY') return 'LENS_ONLY';
  if(input.event_is_today===true && num(input.inventory_remaining)===1) return 'ONSITE_LAST_UNIT';
  if(input.event_is_today===true) return 'ONSITE_CONVERSION';
  if(input.event_is_tomorrow===true) return 'LAST_CALL';
  if(obj==='conversion') return 'DIRECT_RENTAL';
  if(obj==='engagement') return 'FANDOM_ENGAGEMENT';
  return 'EVENT_AWARENESS';
}

function plan(input={},performanceRows=[]){
  const obj=objective(input);
  const perf=Performance.summarizePerformance(performanceRows,{objective:obj});
  const xSignalAnalysis=XSignal.summarizeEventSignals(input.x_signals||[],{
    now:input.signal_observed_at||input.now
  });
  const opportunity=scoreOpportunity(input,xSignalAnalysis);
  const mode=chooseCampaignMode(input,obj);
  const evidenceState=perf.measured_posts===0?'RULE_BASED_COLD_START':'PERFORMANCE_INFORMED';

  return {
    schema_version:VERSION,
    agent:'kk-marketing-agent',
    objective:obj,
    campaign_mode:mode,
    opportunity,
    evidence_state:evidenceState,
    measured_posts:perf.measured_posts,
    performance_nudges:perf.evidence_nudges,
    x_signal_analysis:xSignalAnalysis,
    x_signal_contract:{
      version:XSignal.VERSION,
      raw_cross_source_views_are_comparable:false,
      historical_reach_affects_current_priority:false,
      unlabeled_numeric_metrics_are_ignored:true,
      ranking_basis:'freshness-adjusted normalized dimensions'
    },
    winner_selection:{
      mode:'INTERNAL_3_TO_SINGLE_FINAL',
      public_output_count:1,
      target:obj==='conversion'?'OBJECTIVE_AWARE_REACH_AND_CONVERSION':'EXPECTED_QUALIFIED_REACH',
      evidence_state:evidenceState,
      rule:'Generate three internal candidates, QA them, then rank and expose one final winner. Never claim the selected copy is guaranteed to maximize reach.'
    },
    strategy_handoff:{
      objective:obj,
      campaign_mode:mode,
      opportunity_score:opportunity.score,
      priority_context:opportunity.reasons,
      instruction:'Content Strategy selects pillar/angle from this marketing brief; Content Agent drafts three internal candidates; QA validates them; Content Selector ranks them against this objective and exposes one final winner. Marketing Agent does not write final copy.'
    },
    safety:SAFETY,
    interpretation_rule:'Marketing guidance may prioritize what/when/objective, but never overrides verified event truth, approved pricing, inventory truth, owner-hidden visibility, or human approval.'
  };
}

module.exports={VERSION,OBJECTIVES,SAFETY,objective,scoreOpportunity,chooseCampaignMode,plan};
