'use strict';

const fs=require('fs');
const path=require('path');
const ContentPerformance=require('./kk-content-performance.js');

const DEFAULT_POLICY_PATH=path.resolve(__dirname,'../config/kk-operating-partner-policy.json');

function cleanText(value){
  return String(value==null?'':value).replace(/\s+/g,' ').trim();
}
function clamp(value,min=0,max=100){
  const n=Number(value);
  if(!Number.isFinite(n)) return null;
  return Math.max(min,Math.min(max,n));
}
function round(value,digits=2){
  const f=10**digits;
  return Math.round((Number(value)||0)*f)/f;
}
function loadPolicy(filePath=DEFAULT_POLICY_PATH){
  const p=JSON.parse(fs.readFileSync(filePath,'utf8'));
  if(!p || p.schema_version!=='KK_OPERATING_PARTNER_POLICY_V1') throw new Error('invalid KK operating partner policy');
  return p;
}
function priorityForScore(score,policy){
  if(score>=policy.priority_thresholds.urgent) return 'URGENT';
  if(score>=policy.priority_thresholds.high) return 'HIGH';
  if(score>=policy.priority_thresholds.medium) return 'MEDIUM';
  return 'LOW';
}
function defaultRecommendation(type,priority){
  const t=cleanText(type).toLowerCase();
  if(t==='event_rental') return priority==='URGENT'?'PREPARE_RENTAL_POST_NOW':'REVIEW_RENTAL_OPPORTUNITY';
  if(t==='content_reach') return priority==='URGENT'?'PREPARE_REACH_CONTENT_NOW':'PREPARE_REACH_CONTENT';
  if(t==='pricing') return 'REVIEW_PRICING';
  if(t==='customer') return 'PREPARE_CUSTOMER_FOLLOWUP';
  if(t==='storefront') return 'REVIEW_STOREFRONT_IMPROVEMENT';
  if(t==='engineering') return 'REVIEW_ENGINEERING_IMPROVEMENT';
  if(t==='operations') return 'REVIEW_OPERATIONS_ACTION';
  return 'OWNER_REVIEW';
}
function scoreOpportunity(opportunity={},options={}){
  const policy=options.policy||loadPolicy(options.policy_path);
  const signals=opportunity.signals&&typeof opportunity.signals==='object'?opportunity.signals:{};
  const weights=policy.opportunity_weights||{};
  let weighted=0,coverage=0;
  const usedSignals=[];
  for(const [key,weightRaw] of Object.entries(weights)){
    const weight=Number(weightRaw)||0;
    const value=clamp(signals[key]);
    if(value==null) continue;
    weighted+=value*weight;
    coverage+=weight;
    usedSignals.push({signal:key,value,weight});
  }
  const evidenceConfidence=clamp(opportunity.evidence_confidence);
  const effectiveConfidence=evidenceConfidence==null?0:evidenceConfidence;
  if(coverage<=0){
    return {
      opportunity_id:cleanText(opportunity.opportunity_id||opportunity.id),
      type:cleanText(opportunity.type||'other').toLowerCase(),
      subject_ref:cleanText(opportunity.subject_ref),
      title:cleanText(opportunity.title),
      score:0,
      raw_score:0,
      signal_coverage:0,
      evidence_confidence:effectiveConfidence,
      priority:'INSUFFICIENT_EVIDENCE',
      recommended_action:'COLLECT_MORE_EVIDENCE',
      used_signals:[],
      owner_review_required:true,
      auto_execute:false
    };
  }
  const raw=weighted/coverage;
  const coverageRatio=Math.min(1,coverage);
  const reliabilityFactor=0.75+(0.15*(effectiveConfidence/100))+(0.10*coverageRatio);
  const score=round(raw*reliabilityFactor,2);
  const insufficient=coverageRatio<Number(policy.minimum_signal_coverage||0) ||
    effectiveConfidence<Number(policy.minimum_evidence_confidence||0);
  const priority=insufficient?'INSUFFICIENT_EVIDENCE':priorityForScore(score,policy);
  return {
    opportunity_id:cleanText(opportunity.opportunity_id||opportunity.id),
    type:cleanText(opportunity.type||'other').toLowerCase(),
    subject_ref:cleanText(opportunity.subject_ref),
    title:cleanText(opportunity.title),
    score,
    raw_score:round(raw,2),
    signal_coverage:round(coverageRatio,3),
    evidence_confidence:effectiveConfidence,
    priority,
    recommended_action:insufficient?'COLLECT_MORE_EVIDENCE':cleanText(opportunity.recommended_action)||defaultRecommendation(opportunity.type,priority),
    used_signals:usedSignals,
    rationale:cleanText(opportunity.rationale),
    owner_review_required:true,
    auto_execute:false
  };
}
function analyzeOpportunities(opportunities=[],options={}){
  const policy=options.policy||loadPolicy(options.policy_path);
  const scored=(Array.isArray(opportunities)?opportunities:[]).map(item=>scoreOpportunity(item,{policy}));
  scored.sort((a,b)=>{
    const rank={URGENT:4,HIGH:3,MEDIUM:2,LOW:1,INSUFFICIENT_EVIDENCE:0};
    if((rank[b.priority]||0)!==(rank[a.priority]||0)) return (rank[b.priority]||0)-(rank[a.priority]||0);
    if(b.score!==a.score) return b.score-a.score;
    return a.title.localeCompare(b.title);
  });
  return {
    schema_version:'KK_OPPORTUNITY_PORTFOLIO_V1',
    generated_from_count:scored.length,
    opportunities:scored,
    urgent_count:scored.filter(x=>x.priority==='URGENT').length,
    high_count:scored.filter(x=>x.priority==='HIGH').length,
    insufficient_evidence_count:scored.filter(x=>x.priority==='INSUFFICIENT_EVIDENCE').length,
    autonomy:policy.autonomy
  };
}
function severityScore(value){
  const s=cleanText(value).toUpperCase();
  return ({P0:100,P1:90,P2:70,P3:50,INFO:25}[s]||40);
}
function normalizeAction(item={},source='other'){
  const explicit=clamp(item.priority_score);
  const score=explicit==null?(source==='system'?severityScore(item.severity):50):explicit;
  return {
    source,
    action_id:cleanText(item.action_id||item.id),
    title:cleanText(item.title||item.action||item.message),
    action:cleanText(item.recommended_action||item.action||'OWNER_REVIEW'),
    priority_score:score,
    reason:cleanText(item.reason||item.rationale),
    subject_ref:cleanText(item.subject_ref),
    owner_review_required:item.owner_review_required!==false,
    auto_execute:false
  };
}
function groupDecisionHistory(events=[]){
  const groups=new Map();
  for(const event of Array.isArray(events)?events:[]){
    const id=cleanText(event.decision_id);
    if(!id) continue;
    if(!groups.has(id)) groups.set(id,[]);
    groups.get(id).push(event);
  }
  return groups;
}
function learningSummary(events=[],options={}){
  const policy=options.policy||loadPolicy(options.policy_path);
  const groups=groupDecisionHistory(events);
  const buckets=new Map();
  for(const [decisionId,list] of groups){
    const rec=list.find(x=>cleanText(x.event_type).toUpperCase()==='RECOMMENDATION');
    const owner=list.find(x=>cleanText(x.event_type).toUpperCase()==='OWNER_DECISION');
    const outcome=[...list].reverse().find(x=>cleanText(x.event_type).toUpperCase()==='OUTCOME');
    if(!rec || !outcome) continue;
    const score=clamp(outcome.outcome_score);
    if(score==null) continue;
    const key=[cleanText(rec.decision_type).toLowerCase(),cleanText(rec.recommendation_code).toUpperCase()].join('|');
    if(!buckets.has(key)) buckets.set(key,{decision_type:cleanText(rec.decision_type).toLowerCase(),recommendation_code:cleanText(rec.recommendation_code).toUpperCase(),scores:[],actions:[]});
    const bucket=buckets.get(key);
    bucket.scores.push(score);
    bucket.actions.push(cleanText(owner&&owner.owner_action).toUpperCase()||'UNKNOWN');
  }
  const nudges=[];
  const stats=[];
  for(const bucket of buckets.values()){
    const sample=bucket.scores.length;
    const avg=sample?bucket.scores.reduce((a,b)=>a+b,0)/sample:0;
    const confidence=sample>=Number(policy.learning.high_confidence_samples||8)?'high':(sample>=Number(policy.learning.minimum_outcomes_for_strategy_nudge||3)?'medium':'low');
    stats.push({
      decision_type:bucket.decision_type,
      recommendation_code:bucket.recommendation_code,
      sample_count:sample,
      average_outcome_score:round(avg,2),
      confidence,
      owner_actions:bucket.actions
    });
    if(sample>=Number(policy.learning.minimum_outcomes_for_strategy_nudge||3)){
      if(avg>=Number(policy.learning.reinforce_average_score||75)){
        nudges.push({
          action:'REINFORCE',
          decision_type:bucket.decision_type,
          recommendation_code:bucket.recommendation_code,
          sample_count:sample,
          average_outcome_score:round(avg,2),
          confidence,
          requires_owner_review:true,
          auto_apply:false
        });
      }else if(avg<=Number(policy.learning.review_average_score||45)){
        nudges.push({
          action:'REVIEW_STRATEGY',
          decision_type:bucket.decision_type,
          recommendation_code:bucket.recommendation_code,
          sample_count:sample,
          average_outcome_score:round(avg,2),
          confidence,
          requires_owner_review:true,
          auto_apply:false
        });
      }
    }
  }
  return {
    schema_version:'KK_DECISION_LEARNING_SUMMARY_V1',
    measured_decision_groups:stats.length,
    stats,
    strategy_nudges:nudges,
    interpretation_rule:'Outcome evidence may propose a strategy change but never auto-apply pricing, publishing, customer sends, production changes, policy changes, or Machine SOT changes.'
  };
}
function buildDailyBrief(input={},options={}){
  const policy=options.policy||loadPolicy(options.policy_path);
  const portfolio=analyzeOpportunities(input.opportunities||[],{policy});
  const actions=[];
  for(const op of portfolio.opportunities){
    if(op.priority==='INSUFFICIENT_EVIDENCE') continue;
    actions.push({
      source:'opportunity',
      action_id:op.opportunity_id,
      title:op.title,
      action:op.recommended_action,
      priority_score:op.score,
      reason:op.rationale||('Opportunity score '+op.score+' / 100'),
      subject_ref:op.subject_ref,
      owner_review_required:true,
      auto_execute:false
    });
  }
  for(const item of Array.isArray(input.customer_actions)?input.customer_actions:[]) actions.push(normalizeAction(item,'customer'));
  for(const item of Array.isArray(input.system_signals)?input.system_signals:[]) actions.push(normalizeAction(item,'system'));
  for(const item of Array.isArray(input.operations_actions)?input.operations_actions:[]) actions.push(normalizeAction(item,'operations'));
  actions.sort((a,b)=>b.priority_score-a.priority_score || a.title.localeCompare(b.title));

  let contentPerformance=null;
  if(Array.isArray(input.content_performance_rows) && input.content_performance_rows.length){
    contentPerformance=ContentPerformance.summarizePerformance(input.content_performance_rows,{
      objective:cleanText(input.content_objective||'awareness')||'awareness'
    });
  }
  const learning=learningSummary(input.decision_history||[],{policy});
  const maxActions=Math.max(1,Number(policy.max_daily_actions||8));
  return {
    schema_version:'KK_OPERATING_PARTNER_BRIEF_V1',
    mode:'ADVISORY_OPERATING_PARTNER',
    generated_at:new Date().toISOString(),
    top_actions:actions.slice(0,maxActions),
    opportunity_summary:{
      total:portfolio.generated_from_count,
      urgent:portfolio.urgent_count,
      high:portfolio.high_count,
      insufficient_evidence:portfolio.insufficient_evidence_count
    },
    content_performance:contentPerformance,
    revenue_summary:input.revenue_summary&&typeof input.revenue_summary==='object'?input.revenue_summary:null,
    learning,
    questions_for_owner:actions.slice(0,maxActions).filter(x=>x.owner_review_required).map(x=>({
      action_id:x.action_id,
      question:'Approve, reject, modify, or defer: '+x.action
    })),
    safety:{
      advisory_only:true,
      production_writes:0,
      publishes:0,
      customer_sends:0,
      price_writes:0,
      booking_writes:0,
      inventory_writes:0,
      auto_merge:false,
      auto_deploy:false,
      policy_writes:0,
      machine_sot_writes:0
    }
  };
}
function evaluateDecisionOutcome(input={}){
  const ownerAction=cleanText(input.owner_action).toUpperCase();
  const outcomeScore=clamp(input.outcome_score);
  if(outcomeScore==null) return {
    status:'INSUFFICIENT_OUTCOME_EVIDENCE',
    owner_action:ownerAction||'UNKNOWN',
    lesson:'Record a bounded 0-100 outcome score or objective metrics before changing strategy.',
    requires_owner_review:true,
    auto_apply:false
  };
  let lesson='OBSERVE_MORE';
  if(['APPROVED','MODIFIED'].includes(ownerAction) && outcomeScore>=75) lesson='POSITIVE_OUTCOME';
  else if(['APPROVED','MODIFIED'].includes(ownerAction) && outcomeScore<=45) lesson='NEGATIVE_OUTCOME_REVIEW_STRATEGY';
  else if(ownerAction==='REJECTED') lesson='REJECTION_RECORDED_COUNTERFACTUAL_UNKNOWN';
  return {
    status:'EVALUATED',
    owner_action:ownerAction||'UNKNOWN',
    outcome_score:outcomeScore,
    lesson,
    requires_owner_review:true,
    auto_apply:false
  };
}

module.exports={
  DEFAULT_POLICY_PATH,
  cleanText,
  clamp,
  loadPolicy,
  priorityForScore,
  scoreOpportunity,
  analyzeOpportunities,
  learningSummary,
  buildDailyBrief,
  evaluateDecisionOutcome
};
