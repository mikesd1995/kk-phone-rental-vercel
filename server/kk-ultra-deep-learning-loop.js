'use strict';

const KnownMiss=require('./kk-ultra-deep-known-miss-regression.js');

const VERSION='KK_ULTRA_DEEP_LEARNING_LOOP_V1';

function text(v){return String(v==null?'':v).trim();}
function uniq(xs){return [...new Set((xs||[]).map(text).filter(Boolean))];}

function learnKnownMiss(input={}){
  const verified=input.verified_event===true;
  const wasMissed=input.was_missed===true;
  const title=text(input.title);
  const eventDate=text(input.event_date);
  const sourceUrl=text(input.source_url);
  const aliases=uniq(input.aliases);
  const searchQueries=uniq(input.search_queries);
  const blockers=[];
  if(!verified) blockers.push('EVENT_NOT_VERIFIED');
  if(!wasMissed) blockers.push('NOT_CONFIRMED_AS_PRIOR_MISS');
  if(!title) blockers.push('TITLE_MISSING');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) blockers.push('EVENT_DATE_INVALID');
  if(!/^https:\/\//i.test(sourceUrl)) blockers.push('VERIFIED_HTTPS_SOURCE_MISSING');
  if(!aliases.length&&!searchQueries.length) blockers.push('SEARCH_SIGNATURE_MISSING');
  const caseId=text(input.case_id)||title.toLowerCase().replace(/[^a-z0-9\u0E00-\u0E7F]+/g,'-').replace(/^-|-$/g,'')+'-'+eventDate.replace(/-/g,'');
  const duplicate=KnownMiss.CORPUS.some(x=>x.case_id===caseId || (x.event_date===eventDate && [x.title,...(x.aliases||[])].some(a=>KnownMiss.fuzzyAliasMatch(title,a))));
  if(duplicate) blockers.push('KNOWN_MISS_ALREADY_COVERED');
  return {
    schema_version:VERSION,
    status:blockers.length?'BLOCKED':'PROPOSED_REGRESSION_CASE',
    blockers,
    proposed_case:blockers.length?null:{case_id:caseId,title,aliases,event_date:eventDate,search_queries:searchQueries,verified_source_url:sourceUrl},
    next_actions:blockers.length?[]:['ADD_TO_KNOWN_MISS_CORPUS','ADD_VERIFIED_FIXTURE','RUN_KNOWN_MISS_REGRESSION','RERUN_LIVE_DISCOVERY_ACCEPTANCE'],
    authority:{production_writes:0,business_writes:0,auto_apply:false,human_review_required:true}
  };
}

function evaluateClosedLoop(input={}){
  const before=Number(input.before_missed_count);
  const after=Number(input.after_missed_count);
  const regression=Boolean(input.known_miss_regression_passed);
  const live=Boolean(input.live_discovery_acceptance_passed);
  const original=Boolean(input.original_failure_evidence_preserved);
  const blockers=[];
  if(!Number.isFinite(before)||!Number.isFinite(after)) blockers.push('MISS_METRICS_MISSING');
  if(Number.isFinite(before)&&Number.isFinite(after)&&after>before) blockers.push('MISS_RATE_REGRESSED');
  if(!regression) blockers.push('KNOWN_MISS_REGRESSION_NOT_PASSED');
  if(!live) blockers.push('LIVE_DISCOVERY_ACCEPTANCE_NOT_PASSED');
  if(!original) blockers.push('ORIGINAL_FAILURE_EVIDENCE_MISSING');
  return {
    schema_version:'KK_ULTRA_DEEP_LEARNING_ACCEPTANCE_V1',
    status:blockers.length?'BLOCKED':'LEARNING_ACCEPTED',
    blockers,
    metrics:{before_missed_count:Number.isFinite(before)?before:null,after_missed_count:Number.isFinite(after)?after:null,improvement:Number.isFinite(before)&&Number.isFinite(after)?before-after:null},
    production_writes:0,
    auto_mutation:false
  };
}

module.exports={VERSION,learnKnownMiss,evaluateClosedLoop};
