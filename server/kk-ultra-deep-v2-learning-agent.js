'use strict';
const VERSION='KK_ULTRA_DEEP_V2_LEARNING_AGENT_V6';
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
function list(v){return Array.isArray(v)?v:(text(v)?[v]:[]);}
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
 const missClasses=uniq(missed.map(x=>x.miss_class));
 const artistBrandSocialMiss=missed.some(x=>['ARTIST_BRAND_SOCIAL_KEYWORDLESS_APPEARANCE','ARTIST_SCHEDULE_GAP','BRAND_SOCIAL_GAP'].includes(text(x&&x.miss_class).toUpperCase()));
 const broadCoverageMiss=missed.some(x=>['INTERNATIONAL_CONCERT_SOURCE_GAP','THAI_LIVE_SOURCE_GAP','FESTIVAL_TAXONOMY_GAP','FAN_BIRTHDAY_SOURCE_GAP','VENUE_CALENDAR_GAP','TICKETING_SOURCE_GAP'].includes(text(x&&x.miss_class).toUpperCase()));
 const campaignVisualMiss=missed.some(x=>['BRAND_PURCHASE_CAMPAIGN_GAP','BRAND_LEAD_TIME_CAMPAIGN_GAP','RETAIL_SCHEDULE_BOARD_GAP','IMAGE_ONLY_SCHEDULE_GAP','BRAND_PRIVATE_EXPERIENCE_GAP','PRIVATE_SESSION_CROSSMONTH_NAMED_EVENT_GAP'].includes(text(x&&x.miss_class).toUpperCase()));
 const freeCrossMonthMiss=missed.some(x=>['FREE_PUBLIC_FESTIVAL_RADIO_CROSSMONTH_GAP','FREE_PUBLIC_FESTIVAL_MEDIA_ORGANIZER_CROSS_MONTH_RECALL_GAP','ARTIST_OFFICIAL_SALE_WINDOW_NEXTMONTH_GAP'].includes(text(x&&x.miss_class).toUpperCase()));
 const dateIdentityMiss=missed.some(x=>['REPEATED_EVENT_NEW_DATE_SOURCE_GAP','TICKET_SALE_VS_EVENT_DATE_GAP','UPDATED_DATE_PRIMARY_PAGE_CONFLICT_GAP','STALE_KNOWN_CANDIDATE_LIFECYCLE_GAP'].includes(text(x&&x.miss_class).toUpperCase()));
 const expansionQueries=artistBrandSocialMiss?uniq(missed.flatMap(x=>{
   const artists=list(x&&x.artists||x&&x.artist),brands=list(x&&x.brands||x&&x.brand),month=text(x&&x.month);
   return [...artists.map(a=>a+' '+month+' schedule'),...artists.map(a=>a+' '+month+' brand event'),...brands.flatMap(b=>artists.map(a=>b+' '+a+' '+month)),...artists.map(a=>a+' lucky fan top spender fansign appearance')];
 })):[];
 const campaignExpansion=campaignVisualMiss?uniq(missed.flatMap(x=>{const artists=list(x&&x.artists||x&&x.artist),brands=list(x&&x.brands||x&&x.brand),month=text(x&&x.month);return [...artists.map(a=>a+' '+month+' performance schedule'),...artists.map(a=>a+' lucky fan purchase register winner announcement'),...artists.map(a=>a+' private talk workshop polaroid one day trip'),...brands.flatMap(b=>artists.map(a=>b+' '+a+' campaign')), ...brands.map(b=>b+' artist lucky fan top spender purchase register '+month)];})):[];
 const dateIdentityExpansion=dateIdentityMiss?uniq(missed.flatMap(x=>{const artist=list(x&&x.artists||x&&x.artist),source=list(x&&x.brands||x&&x.brand),month=text(x&&x.month);return [...artist.map(a=>a+' '+month+' updated date new schedule ticket on sale'),...artist.map(a=>a+' busking repeat new show date'),...source.map(b=>b+' official announcement revised poster old product date'),...source.map(b=>b+' event date vs ticket onsale next month')];})) : [];
 const freeCrossMonthExpansion=freeCrossMonthMiss?['radio station free music festival Bangkok PMCU Flex1045 Siam Halloween 30 Oct 1 Nov','ฟรีคอนเสิร์ต งานฟรี ปฏิทินศิลปินห้าง สยามฮาโลวีน งานที่คร่อมเดือน','official artist concerts announced in previous month JMNK SHEเสิร์ฟ 21 November'] : [];
 const coverageExpansion=broadCoverageMiss?[
   'ticketing Bangkok concert fanmeeting festival',
   'Bangkok venue concert event calendar',
   'Thailand promoter concert fan meeting',
   'Bangkok festival livehouse showcase',
   'Bangkok birthday fan event fancon'
 ]:[];
 const hotFandoms=uniq([
   ...outcomes.flatMap(x=>x.fandom||x.artist||x.pair||[]),
   ...waitlists.flatMap(x=>x.fandom||x.artist||x.pair||[]),
   ...inquiries.flatMap(x=>x.fandom||x.artist||x.pair||[])
 ]);
 const recommendations=[];
 if(missed.length) recommendations.push('EXPAND_LONG_TAIL_QUERIES_AND_SOURCE_PRIORITY');
 if(artistBrandSocialMiss) recommendations.push('MANDATORY_ARTIST_MONTH_SCHEDULE_AND_BRAND_SOCIAL_EXPANSION');
 if(broadCoverageMiss) recommendations.push('MANDATORY_MULTI_AXIS_SOURCE_UNIVERSE_SWEEP_AND_KNOWN_POSITIVE_BACKTEST');
 if(campaignVisualMiss) recommendations.push('MANDATORY_BRAND_CAMPAIGN_VISUAL_SCHEDULE_AND_LEAD_TIME_EXPANSION');
 if(dateIdentityMiss) recommendations.push('MANDATORY_EVENT_DATE_VS_SALE_DATE_AND_OFFICIAL_DATE_REVISION_RECONCILIATION');
 if(freeCrossMonthMiss) recommendations.push('REQUIRE_RADIO_FREE_FESTIVAL_MALL_AND_THREE_DAY_CROSSMONTH_DISCOVERY');
 if(falsePositives.length) recommendations.push('TIGHTEN_IDENTITY_AND_GENERIC_PAGE_FILTERS');
 if(holds.some(x=>(x.holds||[]).includes('VERIFIED_POSTER_REQUIRED'))) recommendations.push('EXPAND_POSTER_DISCOVERY_LEADS_FROM_EXACT_EVENT_COMPETITORS');
 if(corrections.length) recommendations.push('REVIEW_REPEATED_MANUAL_CORRECTIONS_FOR_HEURISTIC_UPDATE');
 if(outcomes.length||waitlists.length||inquiries.length) recommendations.push('BOOST_ADJACENT_FANDOM_DISCOVERY_PRIORITY_ONLY');
 if(waitlists.length||inquiries.length) recommendations.push('EXPAND_FANDOM_GRAPH_AND_RENTAL_KEYWORD_RADAR');
 return {
   version:VERSION,
   status:'LEARNED',
   adaptive:{
     query_terms:uniq([...learnedQueries,...expansionQueries,...campaignExpansion,...dateIdentityExpansion,...freeCrossMonthExpansion,...coverageExpansion]),
     miss_classes:missClasses,
     mandatory_expansion:uniq([
       ...(artistBrandSocialMiss?['ARTIST_MONTH_SCHEDULE','BRAND_OFFICIAL_SOCIAL','VENUE_MALL_SOCIAL','ARTIST_TO_RELATED_EVENT_PIVOT']:[]),
       ...(campaignVisualMiss?['BRAND_PURCHASE_CAMPAIGN','RETAIL_PERFORMANCE_SCHEDULE','IMAGE_SCHEDULE_SEGMENTATION','CAMPAIGN_LEAD_TIME_NEXT_MONTH','WINNER_CONFIRMATION_WINDOW']:[]),
       ...(freeCrossMonthMiss?['RADIO_MEDIA_FREE_FESTIVAL_SOURCE','CROSS_MONTH_MULTI_DAY_EXPANSION','EXACT_DATE_ARTIST_LINEUP_EVIDENCE','NON_TICKETED_EVENT_DISCOVERY']:[]),
       ...(dateIdentityMiss?['REPEAT_EVENT_DATE_DISAMBIGUATION','EVENT_DATE_VS_TICKET_SALE_DATE','OFFICIAL_POSTER_PRIMARY_PAGE_DATE_CONFLICT_CHECK','EXISTING_CANDIDATE_LIFECYCLE_REFRESH']:[]),
       ...(broadCoverageMiss?['TICKETING_UNIVERSE','ORGANIZER_PROMOTER_UNIVERSE','VENUE_CALENDAR_UNIVERSE','BROAD_CONCERT_LIVE_UNIVERSE','FESTIVAL_TAXONOMY_UNIVERSE','KNOWN_POSITIVE_BACKTEST']:[])
     ]),
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
