'use strict';

const Learning=require('./kk-ultra-deep-v2-learning-agent.js');
const VERSION='KK_ULTRA_DEEP_PHASE2_CONTROLLER_V1';
const DEFAULT_MAX_ROUNDS=3;
const DISPOSITIONS=Object.freeze(['VERIFIED','VERIFY_REQUIRED','STATUS_CHANGED','REJECT_WITH_REASON']);
function arr(v){return Array.isArray(v)?v:[];}
function text(v){return String(v==null?'':v).trim();}
function normalize(row={}){
 const disposition=text(row.disposition).toUpperCase()||'VERIFY_REQUIRED';
 return {...row,disposition:DISPOSITIONS.includes(disposition)?disposition:'VERIFY_REQUIRED'};
}
function missFor(row={}){
 if(row.disposition!=='VERIFY_REQUIRED')return null;
 const reason=text(row.reason).toUpperCase();
 let miss_class='OFFICIAL_SOURCE_GAP';
 if(reason.includes('SECONDARY'))miss_class='SECONDARY_ONLY_VERIFICATION_GAP';
 else if(reason.includes('CONFLICT'))miss_class='FIELD_CONFLICT_GAP';
 else if(reason.includes('IDENTITY')||reason.includes('AMBIG'))miss_class='IDENTITY_AMBIGUITY_GAP';
 else if(reason.includes('FRESH')||reason.includes('STALE'))miss_class='FRESHNESS_GAP';
 return {...row,miss_class,query_terms:arr(row.recovery_queries)};
}
function evaluate(input={}){
 const expected=Math.max(0,Number(input.expected_candidate_count||0));
 const results=arr(input.results).map(normalize);
 const misses=results.map(missFor).filter(Boolean);
 const learning=Learning.learn({missed_events:misses,false_positives:arr(input.false_positives),source_successes:arr(input.source_successes)});
 const blockers=[];
 if(!input.candidate_master_pool_frozen)blockers.push('CANDIDATE_MASTER_POOL_NOT_FROZEN');
 if(expected===0)blockers.push('EXPECTED_CANDIDATE_COUNT_MISSING');
 if(results.length!==expected)blockers.push('CANDIDATE_DISPOSITION_INCOMPLETE');
 if(results.some(x=>!DISPOSITIONS.includes(x.disposition)))blockers.push('INVALID_DISPOSITION');
 if(results.some(x=>x.disposition==='VERIFY_REQUIRED'&&(!text(x.reason)||!arr(x.evidence).length)))blockers.push('VERIFY_REQUIRED_WITHOUT_REASON_OR_EVIDENCE');
 if(results.some(x=>x.disposition==='REJECT_WITH_REASON'&&!text(x.reason)))blockers.push('REJECTION_WITHOUT_REASON');
 if(results.some(x=>x.disposition==='STATUS_CHANGED'&&!arr(x.evidence).length))blockers.push('STATUS_CHANGE_WITHOUT_EVIDENCE');
 if(input.production_writes!==0)blockers.push('PRODUCTION_WRITES_MUST_BE_ZERO');
 return {version:VERSION,results,learning_misses:misses,learning,blockers,status:blockers.length?'RECOVERY_REQUIRED':(misses.length?'RECOVERY_REQUIRED':'PHASE2_ACCEPTED'),production_writes:0,phase3_started:false};
}
function next(input={}){
 const round=Math.max(1,Number(input.round||1));
 const max=Math.max(1,Math.min(5,Number(input.max_rounds||DEFAULT_MAX_ROUNDS)));
 const out=evaluate(input);
 if(out.status==='PHASE2_ACCEPTED')return {...out,round,max_rounds:max,next_action:'STOP_AND_REPORT_READY_FOR_OWNER_PHASE3_APPROVAL'};
 if(round>=max)return {...out,round,max_rounds:max,status:'PHASE2_HOLD',next_action:'STOP_AND_REPORT_UNRESOLVED_VERIFICATION',unresolved:out.results.filter(x=>x.disposition==='VERIFY_REQUIRED')};
 return {...out,round,max_rounds:max,next_action:'APPLY_LEARNING_AND_RERUN_VERIFY_REQUIRED_ONLY',recovery_queries:out.learning.adaptive.query_terms,mandatory_expansion:out.learning.adaptive.mandatory_expansion};
}
module.exports={VERSION,DEFAULT_MAX_ROUNDS,DISPOSITIONS,normalize,missFor,evaluate,next};
