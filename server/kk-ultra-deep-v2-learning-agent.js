'use strict';
const VERSION='KK_ULTRA_DEEP_V2_LEARNING_AGENT_V1';
const PROTECTED_POLICY=Object.freeze(['BOOKING_PRICE_LOCK','TOMBSTONE_NO_RESURRECTION','GOVERNED_ADMIN_WRITER_ONLY','EXACT_READBACK_REQUIRED','VERIFIED_EVENT_REQUIRED']);

function text(v){return String(v==null?'':v).trim();}
function uniq(xs){return [...new Set((xs||[]).map(text).filter(Boolean))];}
function learn(input={}){
 const missed=Array.isArray(input.missed_events)?input.missed_events:[];
 const falsePositives=Array.isArray(input.false_positives)?input.false_positives:[];
 const holds=Array.isArray(input.holds)?input.holds:[];
 const corrections=Array.isArray(input.manual_corrections)?input.manual_corrections:[];
 const sourceWins=Array.isArray(input.source_successes)?input.source_successes:[];
 const learnedQueries=uniq(missed.flatMap(x=>x.query_terms||[]));
 const learnedSources=uniq([...missed.map(x=>x.source),...sourceWins.map(x=>x.source)]);
 const suppressPatterns=uniq(falsePositives.flatMap(x=>x.patterns||[]));
 const holdSignals=uniq(holds.flatMap(x=>x.reasons||x.holds||[]));
 const recommendations=[];
 if(missed.length) recommendations.push('EXPAND_LONG_TAIL_QUERIES_AND_SOURCE_PRIORITY');
 if(falsePositives.length) recommendations.push('TIGHTEN_IDENTITY_AND_GENERIC_PAGE_FILTERS');
 if(holds.some(x=>(x.holds||[]).includes('VERIFIED_POSTER_REQUIRED'))) recommendations.push('EXPAND_POSTER_DISCOVERY_LEADS_FROM_EXACT_EVENT_COMPETITORS');
 if(corrections.length) recommendations.push('REVIEW_REPEATED_MANUAL_CORRECTIONS_FOR_HEURISTIC_UPDATE');
 return {
   version:VERSION,
   status:'LEARNED',
   adaptive:{query_terms:learnedQueries,source_priority_candidates:learnedSources,suppress_patterns:suppressPatterns,hold_signals:holdSignals},
   recommendations,
   change_log:{missed_events:missed.length,false_positives:falsePositives.length,holds:holds.length,manual_corrections:corrections.length},
   authority:{auto_apply_search_strategy:true,auto_apply_source_priority:true,auto_apply_matching_heuristics:true,protected_policy:[...PROTECTED_POLICY],may_change_protected_policy:false,production_writes:0}
 };
}
module.exports={VERSION,PROTECTED_POLICY,learn};
