'use strict';

const VERSION='KK_CONTENT_SELECTOR_V1';
const SAFETY=Object.freeze({
  authority:'READ_ONLY_SELECTOR',
  human_approval_required:true,
  auto_publish:false,
  production_writes:0,
  publishes:0
});

const PROFILES=Object.freeze({
  awareness:Object.freeze({
    hook_strength:0.30,
    event_fandom_relevance:0.25,
    timing_relevance:0.15,
    novelty:0.15,
    hashtag_relevance:0.10,
    readability:0.05
  }),
  engagement:Object.freeze({
    hook_strength:0.25,
    event_fandom_relevance:0.25,
    timing_relevance:0.15,
    novelty:0.15,
    hashtag_relevance:0.10,
    readability:0.10
  }),
  conversion:Object.freeze({
    hook_strength:0.20,
    event_fandom_relevance:0.20,
    timing_relevance:0.20,
    novelty:0.10,
    hashtag_relevance:0.10,
    readability:0.05,
    commercial_relevance:0.15
  })
});

function text(v){return String(v===undefined||v===null?'':v).trim();}
function clamp(v){const n=Number(v);return Number.isFinite(n)?Math.max(0,Math.min(100,n)):null;}
function objective(v){const o=text(v).toLowerCase();return PROFILES[o]?o:'awareness';}

function normalizeMetrics(candidate={},obj='awareness'){
  const profile=PROFILES[objective(obj)];
  const src=candidate.metrics&&typeof candidate.metrics==='object'?candidate.metrics:{};
  const metrics={};
  const errors=[];
  for(const key of Object.keys(profile)){
    const value=clamp(src[key]);
    if(value===null) errors.push('METRIC_MISSING:'+key);
    else metrics[key]=value;
  }
  return {metrics,errors};
}

function scoreCandidate(candidate={},ctx={}){
  const obj=objective(ctx.objective);
  const profile=PROFILES[obj];
  const normalized=normalizeMetrics(candidate,obj);
  const errors=[...normalized.errors];

  if(!text(candidate.copy)) errors.push('COPY_MISSING');
  if(!text(candidate.angle)) errors.push('ANGLE_MISSING');
  if(candidate.qa_gate!=='PASS') errors.push('QA_NOT_PASS');

  let score=0;
  if(errors.length===0){
    for(const [key,weight] of Object.entries(profile)){
      score+=normalized.metrics[key]*weight;
    }
    const measured=Number(ctx.measured_posts)||0;
    const performanceSupport=clamp(candidate.performance_support);
    if(measured>=3 && performanceSupport!==null){
      score=Math.min(100,score*0.9+performanceSupport*0.1);
    }
  }

  return {
    id:text(candidate.id),
    angle:text(candidate.angle),
    score:Number(score.toFixed(2)),
    eligible:errors.length===0,
    errors,
    metrics:normalized.metrics,
    evidence_state:(Number(ctx.measured_posts)||0)>=3?'PERFORMANCE_INFORMED':'RULE_BASED_COLD_START'
  };
}

function selectWinner(candidates=[],ctx={}){
  const list=Array.isArray(candidates)?candidates:[];
  const errors=[];
  if(list.length!==3) errors.push('EXACTLY_3_INTERNAL_CANDIDATES_REQUIRED');

  const scored=list.map(c=>scoreCandidate(c,ctx));
  const eligible=scored.filter(x=>x.eligible).sort((a,b)=>b.score-a.score || a.id.localeCompare(b.id));

  if(eligible.length!==3) errors.push('THREE_QA_PASSING_CANDIDATES_REQUIRED');

  const winnerScore=errors.length===0?(eligible[0]||null):null;
  const winner=winnerScore?list.find(c=>text(c.id)===winnerScore.id):null;

  return {
    schema_version:VERSION,
    gate:errors.length?'BLOCKED':'PASS',
    public_output_mode:'SINGLE_FINAL_POST',
    internal_candidate_count:list.length,
    public_output_count:errors.length?0:1,
    objective:objective(ctx.objective),
    evidence_state:(Number(ctx.measured_posts)||0)>=3?'PERFORMANCE_INFORMED':'RULE_BASED_COLD_START',
    selection_profile:PROFILES[objective(ctx.objective)],
    errors,
    scored_candidates:scored,
    winner:winner?{
      id:text(winner.id),
      angle:text(winner.angle),
      score:winnerScore.score,
      copy:text(winner.copy)
    }:null,
    interpretation_rule:'Winner score estimates fit to the current objective from available evidence. It is not a guarantee of maximum reach or bookings.',
    safety:SAFETY
  };
}

module.exports={VERSION,SAFETY,PROFILES,objective,normalizeMetrics,scoreCandidate,selectWinner};
