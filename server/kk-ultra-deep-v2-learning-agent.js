'use strict';
const VERSION='KK_ULTRA_DEEP_V2_LEARNING_AGENT_V3';
const PROTECTED_POLICY=Object.freeze(['BOOKING_PRICE_LOCK','TOMBSTONE_NO_RESURRECTION','GOVERNED_ADMIN_WRITER_ONLY','EXACT_READBACK_REQUIRED','VERIFIED_EVENT_REQUIRED']);
const ADAPTIVE_SCORING=Object.freeze(['RENTABILITY_WEIGHTS','HIGH_MEDIUM_THRESHOLDS','SOURCE_PRIORITY','QUERY_TERMS','MATCHING_HEURISTICS']);

function text(v){return String(v==null?'':v).trim();}
function uniq(xs){return [...new Set((xs||[]).map(text).filter(Boolean))];}
function learn(input={}){
 const missed=Array.isArray(input.missed_events)?input.missed_events:[];
 const falsePositives=Array.isArray(input.false_positives)?input.false_positives:[];
 const holds=Array.isArray(input.holds)?input.holds:[];
 const corrections=Array.isArray(input.manual_corrections)?input.manual_corrections:[];
 const sourceWins=Array.isArray(input.source_successes)?input.source_successes:[];
 const outcomes=Array.isArray(input.booking_outcomes)?input.booking_outcomes:[];
 const learnedQueries=uniq(missed.flatMap(x=>x.query_terms||[]));
 const missClasses=uniq(missed.map(x=>x.miss_class));
 const broadCoverageMiss=missed.some(x=>['INTERNATIONAL_CONCERT_SOURCE_GAP','THAI_LIVE_SOURCE_GAP','FESTIVAL_TAXONOMY_GAP','FAN_BIRTHDAY_SOURCE_GAP','VENUE_CALENDAR_GAP','TICKETING_SOURCE_GAP'].includes(text(x&&x.miss_class).toUpperCase()));
 const artistBrandSocialMiss=missed.some(x=>['ARTIST_BRAND_SOCIAL_KEYWORDLESS_APPEARANCE','ARTIST_SCHEDULE_GAP','BRAND_SOCIAL_GAP'].includes(text(x&&x.miss_class).toUpperCase()));
 const expansionQueries=artistBrandSocialMiss?uniq(missed.flatMap(x=>{
   const artists=Array.isArray(x.artists)?x.artists:[];
   const brands=Array.isArray(x.brands)?x.brands:[];
   const month=text(x.month)||'';
   return [
     ...artists.map(a=>a+' '+month+' schedule'),
     ...artists.map(a=>a+' '+month+' brand event'),
     ...brands.flatMap(b=>artists.map(a=>b+' '+a+' '+month)),
     ...artists.map(a=>a+' lucky fan top spender fansign appearance')
   ];
 })) : [];
 const coverageExpansion=broadCoverageMiss?[
   'ticketing Bangkok October 2026 concert fanmeeting festival',
   'Bangkok venue October 2026 concert event calendar',
   'Thailand promoter October 2026 concert fan meeting',
   'Bangkok October 2026 festival livehouse showcase',
   'Bangkok October 2026 birthday fan event fancon'
 ]:[];
 const learnedSources=uniq([...missed.map(x=>x.source),...sourceWins.map(x=>x.source)]);
 const suppressPatterns=uniq(falsePositives.flatMap(x=>x.patterns||[]));
 const holdSignals=uniq(holds.flatMap(x=>x.reasons||x.holds||[]));
 const recommendations=[];
 if(missed.length) recommendations.push('EXPAND_LONG_TAIL_QUERIES_AND_SOURCE_PRIORITY');
 if(artistBrandSocialMiss) recommendations.push('MANDATORY_ARTIST_MONTH_SCHEDULE_AND_BRAND_SOCIAL_EXPANSION');
 if(broadCoverageMiss) recommendations.push('MANDATORY_MULTI_AXIS_SOURCE_UNIVERSE_SWEEP_AND_KNOWN_POSITIVE_BACKTEST');
 if(falsePositives.length) recommendations.push('TIGHTEN_IDENTITY_AND_GENERIC_PAGE_FILTERS');
 if(holds.some(x=>(x.holds||[]).includes('VERIFIED_POSTER_REQUIRED'))) recommendations.push('EXPAND_POSTER_DISCOVERY_LEADS_FROM_EXACT_EVENT_COMPETITORS');
 if(corrections.length) recommendations.push('REVIEW_REPEATED_MANUAL_CORRECTIONS_FOR_HEURISTIC_UPDATE');
 if(outcomes.length) recommendations.push('CALIBRATE_RENTABILITY_WEIGHTS_AND_THRESHOLDS_FROM_BOOKING_REVENUE_OUTCOMES');
 return {
   version:VERSION,
   status:'LEARNED',
   adaptive:{query_terms:uniq([...learnedQueries,...expansionQueries,...coverageExpansion]),miss_classes:missClasses,mandatory_expansion:uniq([
     ...(artistBrandSocialMiss?['ARTIST_MONTH_SCHEDULE','BRAND_OFFICIAL_SOCIAL','VENUE_MALL_SOCIAL','ARTIST_TO_RELATED_EVENT_PIVOT']:[]),
     ...(broadCoverageMiss?['TICKETING_UNIVERSE','ORGANIZER_PROMOTER_UNIVERSE','VENUE_CALENDAR_UNIVERSE','BROAD_CONCERT_LIVE_UNIVERSE','FESTIVAL_TAXONOMY_UNIVERSE','KNOWN_POSITIVE_BACKTEST']:[])
   ]),source_priority_candidates:learnedSources,suppress_patterns:suppressPatterns,hold_signals:holdSignals},
   recommendations,
   change_log:{missed_events:missed.length,false_positives:falsePositives.length,holds:holds.length,manual_corrections:corrections.length,booking_outcomes:outcomes.length},
   scoring_learning:{adaptive_fields:[...ADAPTIVE_SCORING],required_evidence:['BOOKING_OUTCOMES','REVENUE_OUTCOMES','MISSED_EVENTS','FALSE_POSITIVES'],change_control:['VERSION_EVERY_CHANGE','RECORD_BEFORE_AFTER','RECORD_EVIDENCE','ROLLBACK_AVAILABLE']},
   authority:{auto_apply_search_strategy:true,auto_apply_source_priority:true,auto_apply_matching_heuristics:true,protected_policy:[...PROTECTED_POLICY],may_change_protected_policy:false,production_writes:0}
 };
}
module.exports={VERSION,PROTECTED_POLICY,ADAPTIVE_SCORING,learn};
