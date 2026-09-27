'use strict';

const VERSION = 'KK_ULTRA_DEEP_V3';
const REQUIRED_TIERS = Object.freeze([
  'OFFICIAL','TICKETING','VENUE','ARTIST_AGENCY','BRAND_SPONSOR','SOCIAL','COMPETITOR','PUBLIC_CALENDAR'
]);
const FREE_FIRST_PROVIDER_ORDER = Object.freeze([
  'OFFICIAL_DIRECT','RSS_OR_PUBLIC_FEED','SEARXNG','DDGS_TRAFILATURA','CRAWL4AI','EXA'
]);

function clean(v){ return String(v == null ? '' : v).trim(); }
function upper(v){ return clean(v).toUpperCase(); }

function buildCoverageMap(observations=[]){
  const byTier=Object.fromEntries(REQUIRED_TIERS.map(t=>[t,[]]));
  for(const row of observations){
    const tier=upper(row && (row.source_tier || row.tier));
    const url=clean(row && (row.source_url || row.url));
    if(!byTier[tier] || !/^https:\/\//i.test(url)) continue;
    if(!byTier[tier].some(x=>x.url===url)) byTier[tier].push({url,provider:upper(row.provider)||'UNKNOWN'});
  }
  const missing=REQUIRED_TIERS.filter(t=>byTier[t].length===0);
  return {version:VERSION,required_tiers:[...REQUIRED_TIERS],by_tier:byTier,missing_tiers:missing,complete:missing.length===0};
}

function planGapSearch(observations=[], options={}){
  const coverage=buildCoverageMap(observations);
  const enabled=new Set((options.enabled_providers||FREE_FIRST_PROVIDER_ORDER).map(upper));
  const provider_order=FREE_FIRST_PROVIDER_ORDER.filter(p=>enabled.has(p));
  return {
    version:VERSION,
    mode:'ULTRA_DEEP',
    coverage,
    provider_order,
    gap_tasks:coverage.missing_tiers.map(source_tier=>({
      source_tier,
      providers:[...provider_order],
      stop_condition:'AT_LEAST_ONE_VALID_HTTPS_SOURCE',
      evidence_required:true
    })),
    hf_policy:{
      use_for:['EVENT_CLASSIFICATION','SEMANTIC_DEDUP','RELEVANCE_ASSIST'],
      authoritative:false,
      verifier_required:true,
      production_writes:0
    },
    status:coverage.complete?'COVERAGE_COMPLETE':'SEARCH_GAPS_REQUIRED',
    production_writes:0
  };
}

function acceptance(input={}){
  const coverage=buildCoverageMap(input.observations||[]);
  const blockers=[];
  if(!coverage.complete) blockers.push(...coverage.missing_tiers.map(t=>`MISSING_SOURCE_TIER:${t}`));
  if(input.deterministic_dedup_passed!==true) blockers.push('DETERMINISTIC_DEDUP_NOT_PASSED');
  if(input.hf_required===true && input.hf_assist_passed!==true) blockers.push('HF_ASSIST_NOT_PASSED');
  if(input.verifier_ready!==true) blockers.push('VERIFIER_NOT_READY');
  if(input.commercial_evidence_ready!==true) blockers.push('COMMERCIAL_EVIDENCE_NOT_READY');
  return {
    version:VERSION,
    status:blockers.length?'HOLD_FOR_ULTRA_DEEP_ACCEPTANCE':'READY_FOR_FINAL_VERIFIER',
    blockers,
    production_writes:0,
    final_truth_mutation:false
  };
}

module.exports={VERSION,REQUIRED_TIERS,FREE_FIRST_PROVIDER_ORDER,buildCoverageMap,planGapSearch,acceptance};
