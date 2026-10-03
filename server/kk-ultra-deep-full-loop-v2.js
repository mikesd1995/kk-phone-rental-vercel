'use strict';

const Policy=require('./kk-ultra-deep-full-loop-v2-policy.js');
const VERSION='KK_ULTRA_DEEP_FULL_LOOP_V2_V1';

function text(v){return String(v==null?'':v).trim();}

function buildPlan(input={}){
  const candidates=Array.isArray(input.candidates)?input.candidates:[];
  const decisions=candidates.map(candidate=>({
    event_key:text(candidate.event_key)||[text(candidate.event_date),text(candidate.title)].join('|'),
    title:text(candidate.title),
    event_date:text(candidate.event_date),
    ...Policy.plan(candidate)
  }));
  const counts=decisions.reduce((a,x)=>{a[x.decision]=(a[x.decision]||0)+1;return a;},{});
  const mutations=decisions.flatMap(d=>(d.mutations||[]).map(m=>({...m,event_key:d.event_key,title:d.title})));
  return {
    version:VERSION,
    month:text(input.month),
    status:decisions.some(d=>d.decision==='HOLD')?'HOLD':'READY',
    candidate_count:decisions.length,
    counts,
    decisions,
    planned_mutation_count:mutations.length,
    mutations,
    production_writes:0
  };
}

function acceptance(plan={},writeResult={},readback={}){
  const planned=Number(plan.planned_mutation_count||0);
  const writes=Number(writeResult.production_writes||0);
  const readbackMatched=readback.exact_match===true;
  const complete=plan.status==='READY'&&writeResult.status==='COMPLETE'&&writes===planned&&readbackMatched;
  return {
    version:VERSION,
    status:complete?'COMPLETE':'INCOMPLETE',
    planned_mutations:planned,
    production_writes:writes,
    exact_readback:readbackMatched,
    blockers:[
      ...(plan.status==='READY'?[]:['PLAN_NOT_READY']),
      ...(writeResult.status==='COMPLETE'?[]:['WRITE_NOT_COMPLETE']),
      ...(writes===planned?[]:['WRITE_COUNT_MISMATCH']),
      ...(readbackMatched?[]:['EXACT_READBACK_REQUIRED'])
    ]
  };
}

module.exports={VERSION,buildPlan,acceptance};
