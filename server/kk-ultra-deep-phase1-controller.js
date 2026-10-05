'use strict';

const V3=require('./kk-ultra-deep-v3.js');
const Learning=require('./kk-ultra-deep-v2-learning-agent.js');
const Rentability=require('./kk-ultra-deep-rentability-score.js');
const LearningLoop=require('./kk-ultra-deep-learning-loop.js');

const VERSION='KK_ULTRA_DEEP_PHASE1_CONTROLLER_V4';
const DEFAULT_MAX_ROUNDS=3;
function arr(v){return Array.isArray(v)?v:[];}
function text(v){return String(v==null?'':v).trim();}
function key(x){return [text(x.event_date||x.date),text(x.title||x.event_name).toLowerCase().replace(/\s+/g,' ')].join('|');}
function dedup(rows=[]){
 const map=new Map();
 for(const row of arr(rows)){const k=key(row);if(k==='|')continue;if(!map.has(k))map.set(k,{...row});else map.set(k,{...map.get(k),...row});}
 return [...map.values()];
}
function scorePool(rows=[],config={}){
 return arr(rows).map(candidate=>({candidate,qualification:Rentability.qualify(candidate,config)}));
}
function statusEvidence(x={}){
 const evidence=arr(x.status_evidence);
 const current=evidence.filter(e=>e&&e.current===true&&text(e.status));
 const statuses=[...new Set(current.map(e=>text(e.status).toUpperCase()))];
 const conflicting=statuses.length>1;
 const stale=evidence.some(e=>e&&e.stale===true);
 return {statuses,conflicting,stale,evidence_count:evidence.length};
}
function normalizeMiss(x={}){
 return {...x,title:text(x.title||x.event_name),miss_class:text(x.miss_class)||'UNCLASSIFIED_DISCOVERY_GAP',month:text(x.month)||'October 2026'};
}
function evaluateRound(input={}){
 const pool=dedup(input.candidates);
 const scored=scorePool(pool,input.scoring_config||{});
 const misses=arr(input.known_positive_misses).map(normalizeMiss);
 const statusLearningMisses=pool.flatMap(candidate=>{
   const s=statusEvidence(candidate);
   if(s.conflicting)return [{...candidate,miss_class:'STATUS_CHANGE_GAP',query_terms:[text(candidate.title||candidate.event_name)+' cancelled postponed rescheduled']}];
   if(s.stale&&s.evidence_count<2)return [{...candidate,miss_class:'STALE_LISTING_GAP',query_terms:[text(candidate.title||candidate.event_name)+' official update']}];
   return [];
 });
 const learningMisses=[...misses,...statusLearningMisses].map(normalizeMiss);
 const unresolved=arr(input.external_source_unresolved);
 const learning=Learning.learn({missed_events:learningMisses,false_positives:arr(input.false_positives),holds:arr(input.holds),source_successes:arr(input.source_successes)});
 const coverage=V3.phase1Acceptance({
   receipts:arr(input.receipts),
   discovery_pool_preserved:input.discovery_pool_preserved===true,
   deterministic_dedup_passed:input.deterministic_dedup_passed===true,
   scoring_used_as_discovery_filter:false
 });
 const blockers=[...coverage.blockers];
 const learning_acceptance=LearningLoop.evaluateClosedLoop({
   before_missed_count:Number(input.before_missed_count),
   after_missed_count:learningMisses.length,
   known_miss_regression_passed:input.known_miss_regression_passed===true,
   live_discovery_acceptance_passed:input.live_discovery_acceptance_passed===true,
   original_failure_evidence_preserved:input.original_failure_evidence_preserved===true
 });
 if(learning_acceptance.status!=='LEARNING_ACCEPTED')blockers.push(...learning_acceptance.blockers.map(x=>'LEARNING:'+x));
 const status_checks=pool.map(candidate=>({candidate_key:key(candidate),...statusEvidence(candidate)}));
 if(status_checks.some(x=>x.conflicting))blockers.push('CONFLICTING_CURRENT_STATUS_EVIDENCE');
 if(status_checks.some(x=>x.stale&&x.evidence_count<2))blockers.push('STALE_STATUS_REQUIRES_CROSSCHECK');
 if(scored.length!==pool.length)blockers.push('FULL_POOL_SCORING_INCOMPLETE');
 if(input.full_pool_confidence_scored!==true)blockers.push('FULL_POOL_CONFIDENCE_INCOMPLETE');
 if(input.known_positive_backtest_executed!==true)blockers.push('KNOWN_POSITIVE_BACKTEST_NOT_EXECUTED');
 if(misses.length)blockers.push('KNOWN_POSITIVE_RECALL_BELOW_100');
 if(unresolved.some(x=>!text(x.reason)||!text(x.evidence_url)))blockers.push('UNRESOLVED_WITHOUT_EVIDENCE');
 return {version:VERSION,pool,scored,status_checks,misses,status_learning_misses:statusLearningMisses,unresolved,learning,learning_acceptance,coverage,blockers,status:blockers.length?'RECOVERY_REQUIRED':'PHASE1_ACCEPTED',production_writes:0,phase2_started:false};
}
function next(input={}){
 const round=Math.max(1,Number(input.round||1));
 const maxRounds=Math.max(1,Math.min(5,Number(input.max_rounds||DEFAULT_MAX_ROUNDS)));
 const result=evaluateRound(input);
 if(result.status==='PHASE1_ACCEPTED')return {...result,round,max_rounds:maxRounds,next_action:'STOP_AND_REPORT_READY_FOR_OWNER_PHASE2_APPROVAL'};
 if(round>=maxRounds)return {...result,round,max_rounds:maxRounds,status:'PHASE1_HOLD',next_action:'STOP_AND_REPORT_EXTERNAL_SOURCE_UNRESOLVED'};
 return {...result,round,max_rounds:maxRounds,next_action:'APPLY_LEARNING_STRATEGY_AND_RECOVERY_SCAN',recovery_queries:result.learning.adaptive.query_terms,mandatory_expansion:result.learning.adaptive.mandatory_expansion};
}
module.exports={VERSION,DEFAULT_MAX_ROUNDS,dedup,scorePool,statusEvidence,evaluateRound,next};
