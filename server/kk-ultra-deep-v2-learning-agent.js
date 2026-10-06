'use strict';
const VERSION='KK_ULTRA_DEEP_V2_LEARNING_AGENT_V2';
const PROTECTED_POLICY=Object.freeze([
  'BOOKING_PRICE_LOCK','TOMBSTONE_NO_RESURRECTION','GOVERNED_ADMIN_WRITER_ONLY',
  'EXACT_READBACK_REQUIRED','VERIFIED_EVENT_REQUIRED','EXTERNAL_DEMAND_SCORE_EXCLUDES_KK_INTERNAL_OUTCOMES'
]);
const ADAPTIVE_DISCOVERY=Object.freeze([
  'SOURCE_PRIORITY','QUERY_TERMS','MATCHING_HEURISTICS','FANDOM_GRAPH_EXPANSION',
  'COMPETITOR_RENTAL_RADAR_TERMS','ANNOUNCEMENT_EARLY_WARNING_PRIORITY'
]);
const ADAPTIVE_SCORING=Object.freeze([
  'EXTERNAL_DEMAND_WEIGHTS_BY_EXTERNAL_EVIDENCE_ONLY',
  'EXTERNAL_DEMAND_THRESHOLDS_BY_OWNER_REVIEW_ONLY'
]);

function text(v){return String(v==null?'':v).trim();}
function uniq(xs){return [...new Set((xs||[]).map(text).filter(Boolean))];}
function learn(input={}){
 const missed=Array.isArray(input.missed_events)?input.missed_events:[];
 const falsePositives=Array.isArray(input.false_positives)?input.false_positives:[];
 const holds=Array.isArray(input.holds)?input.holds:[];
 const corrections=Array.isArray(input.manual_corrections)?input.manual_corrections:[];
 const sourceWins=Array.isArray(input.source_successes)?input.source_successes:[];
 const outcomes=Array.isArray(input.booking_outcomes)?input.booking_outcomes:[];
 const waitlists=Array.isArray(input.waitlist_signals)?input.waitlist_signals:[];
 const inquiries=Array.isArray(input.inquiry_signals)?input.inquiry_signals:[];
 const learnedQueries=uniq(missed.flatMap(x=>x.query_terms||[]));
 const learnedSources=uniq([...missed.map(x=>x.source),...sourceWins.map(x=>x.source)]);
 const suppressPatterns=uniq(falsePositives.flatMap(x=>x.patterns||[]));
 const holdSignals=uniq(holds.flatMap(x=>x.reasons||x.holds||[]));
 const hotFandoms=uniq([
   ...outcomes.flatMap(x=>x.fandom||x.artist||x.pair||[]),
   ...waitlists.flatMap(x=>x.fandom||x.artist||x.pair||[]),
   ...inquiries.flatMap(x=>x.fandom||x.artist||x.pair||[])
 ]);
 const recommendations=[];
 if(missed.length) recommendations.push('EXPAND_LONG_TAIL_QUERIES_AND_SOURCE_PRIORITY');
 if(falsePositives.length) recommendations.push('TIGHTEN_IDENTITY_AND_GENERIC_PAGE_FILTERS');
 if(holds.some(x=>(x.holds||[]).includes('VERIFIED_POSTER_REQUIRED'))) recommendations.push('EXPAND_POSTER_DISCOVERY_LEADS_FROM_EXACT_EVENT_COMPETITORS');
 if(corrections.length) recommendations.push('REVIEW_REPEATED_MANUAL_CORRECTIONS_FOR_HEURISTIC_UPDATE');
 if(outcomes.length||waitlists.length||inquiries.length) recommendations.push('BOOST_ADJACENT_FANDOM_DISCOVERY_PRIORITY_ONLY');
 if(waitlists.length||inquiries.length) recommendations.push('EXPAND_FANDOM_GRAPH_AND_RENTAL_KEYWORD_RADAR');
 return {
   version:VERSION,
   status:'LEARNED',
   adaptive:{
     query_terms:learnedQueries,
     source_priority_candidates:learnedSources,
     suppress_patterns:suppressPatterns,
     hold_signals:holdSignals,
     hot_fandom_discovery_priority:hotFandoms
   },
   recommendations,
   change_log:{
     missed_events:missed.length,false_positives:falsePositives.length,holds:holds.length,
     manual_corrections:corrections.length,booking_outcomes:outcomes.length,
     waitlist_signals:waitlists.length,inquiry_signals:inquiries.length
   },
   scoring_learning:{
     adaptive_fields:[...ADAPTIVE_SCORING],
     internal_outcomes_affect_external_score:false,
     kk_booking_revenue_waitlist_inquiry_use:'DISCOVERY_PRIORITY_FEEDBACK_ONLY',
     required_score_evidence:[
       'COMPETITOR_RENTAL_ACTIVITY','PUBLIC_SOCIAL_ENGAGEMENT','TICKET_DEMAND',
       'FANDOM_PHOTO_INTENT','VENUE_CAPTURE_VALUE','HISTORICAL_EXTERNAL_RENTAL_ACTIVITY'
     ],
     change_control:['VERSION_EVERY_CHANGE','RECORD_BEFORE_AFTER','RECORD_EVIDENCE','OWNER_REVIEW_FOR_SCORE_POLICY','ROLLBACK_AVAILABLE']
   },
   discovery_learning:{adaptive_fields:[...ADAPTIVE_DISCOVERY]},
   authority:{
     auto_apply_search_strategy:true,auto_apply_source_priority:true,auto_apply_matching_heuristics:true,
     may_change_external_score_from_kk_internal_outcomes:false,
     protected_policy:[...PROTECTED_POLICY],may_change_protected_policy:false,production_writes:0
   }
 };
}
module.exports={VERSION,PROTECTED_POLICY,ADAPTIVE_DISCOVERY,ADAPTIVE_SCORING,learn};
