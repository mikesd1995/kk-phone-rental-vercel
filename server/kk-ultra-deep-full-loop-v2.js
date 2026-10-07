'use strict';

const Policy=require('./kk-ultra-deep-full-loop-v2-policy.js');
const VERSION='KK_ULTRA_DEEP_FULL_LOOP_V2_V2';

function text(v){return String(v==null?'':v).trim();}

function buildPlan(input={}){
  const candidates=Array.isArray(input.candidates)?input.candidates:[];
  const decisions=candidates.map(candidate=>({
    event_key:text(candidate.event_key)||[text(candidate.event_date),text(candidate.title)].join('|'),
    title:text(candidate.title),
    event_date:text(candidate.event_date),
    canonical_event_id:text(candidate.canonical_event_id),
    verified_venue:text(candidate.verified_venue),
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
    terminal_disposition_count:decisions.filter(d=>d.decision!=='HOLD').length,
    pending_candidate_count:decisions.filter(d=>d.decision==='HOLD').length,
    mutations,
    production_writes:0
  };
}

function acceptance(plan={},writeResult={},readback={}){
  const validCount=value=>Number.isSafeInteger(value)&&value>=0;
  const planned=plan.planned_mutation_count;
  const writes=writeResult.production_writes;
  const readbackMatched=readback.exact_match===true;
  const terminalDecisions=new Set(['CREATE','UPDATE','NO_CHANGE','SKIP_HIDDEN']);
  const terminalCoverage=validCount(plan.candidate_count)&&
    validCount(plan.terminal_disposition_count)&&validCount(plan.pending_candidate_count)&&
    plan.pending_candidate_count===0&&plan.terminal_disposition_count===plan.candidate_count&&
    Array.isArray(plan.decisions)&&plan.decisions.length===plan.candidate_count&&
    plan.decisions.every(d=>d&&terminalDecisions.has(d.decision));
  const writeCountMatched=validCount(planned)&&validCount(writes)&&writes===planned;
  const mutationEvidence=validCount(planned)&&Array.isArray(plan.mutations)&&plan.mutations.length===planned&&
    Array.isArray(plan.decisions)&&plan.decisions.every(d=>d&&Array.isArray(d.mutations)&&
      (['CREATE','UPDATE'].includes(d.decision)?d.mutations.length>0:d.mutations.length===0))&&
    plan.decisions.reduce((sum,d)=>sum+d.mutations.length,0)===planned;
  const complete=plan.status==='READY'&&terminalCoverage&&mutationEvidence&&writeResult.status==='COMPLETE'&&writeCountMatched&&readbackMatched;
  return {
    version:VERSION,
    status:complete?'COMPLETE':'INCOMPLETE',
    planned_mutations:planned,
    production_writes:writes,
    exact_readback:readbackMatched,
    blockers:[
      ...(plan.status==='READY'?[]:['PLAN_NOT_READY']),
      ...(terminalCoverage?[]:['CANDIDATE_TERMINAL_COVERAGE_REQUIRED']),
      ...(mutationEvidence?[]:['PLAN_MUTATION_EVIDENCE_REQUIRED']),
      ...(writeResult.status==='COMPLETE'?[]:['WRITE_NOT_COMPLETE']),
      ...(writeCountMatched?[]:['WRITE_COUNT_MISMATCH']),
      ...(readbackMatched?[]:['EXACT_READBACK_REQUIRED'])
    ]
  };
}

module.exports={VERSION,buildPlan,acceptance};
