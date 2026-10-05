'use strict';

const VERSION='KK_DISCOVERY_COMMERCIAL_PREP_V4';
const MIN_EXACT_COMPETITORS=3;
const MIN_PUBLISH_SCORE=7;

function text(v){return String(v==null?'':v).trim();}
function money(v){const n=Number(v);return Number.isFinite(n)&&n>0?n:null;}
function score(v){const n=Number(v);return Number.isFinite(n)&&n>=0&&n<=10?n:null;}
function httpsUrl(v){try{const u=new URL(text(v));return u.protocol==='https:'?u.toString():'';}catch(_){return '';}}
function median(values=[]){const a=values.map(Number).filter(Number.isFinite).sort((x,y)=>x-y);if(!a.length)return null;const m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;}
function normalizeCompetitor(row={}){return {competitor_id:text(row.competitor_id||row.account||row.shop),event_key:text(row.event_key),package_type:text(row.package_type).toUpperCase(),price:money(row.price),source_url:httpsUrl(row.source_url),observed_at:text(row.observed_at),exact_event:row.exact_event===true};}
function normalizeReference(row={},kind='COMPARABLE_EVENT'){return {reference_id:text(row.reference_id||row.event_key||row.package_id),package_type:text(row.package_type).toUpperCase(),price:money(row.price),source_url:httpsUrl(row.source_url),reference_kind:text(row.reference_kind||kind).toUpperCase(),approved:row.approved===true};}

function rentalFitScore(candidate={},input={}){
  const key=text(candidate.event_key||candidate.candidate_id);
  const direct=score(candidate.rental_fit_score==null?candidate.score:candidate.rental_fit_score);
  if(direct!==null) return direct;
  const map=input.rental_fit_scores&&typeof input.rental_fit_scores==='object'?input.rental_fit_scores:{};
  return score(map[key]);
}

function publishEligibility(candidate={},input={}){
  const minimum=score(input.minimum_publish_score);
  const threshold=minimum===null?MIN_PUBLISH_SCORE:minimum;
  const value=rentalFitScore(candidate,input);
  if(value===null){
    return {
      status:'UNSCORED',
      eligible:null,
      rental_fit_score:null,
      minimum_publish_score:threshold,
      reason:'RENTAL_FIT_SCORE_NOT_SUPPLIED'
    };
  }
  if(value<threshold){
    return {
      status:'REJECTED_LOW_RENTAL_FIT',
      eligible:false,
      rental_fit_score:value,
      minimum_publish_score:threshold,
      reason:'RENTAL_FIT_SCORE_BELOW_THRESHOLD'
    };
  }
  return {
    status:'ELIGIBLE',
    eligible:true,
    rental_fit_score:value,
    minimum_publish_score:threshold,
    reason:'RENTAL_FIT_SCORE_PASSED'
  };
}

function priceEvidence(candidate={},rows=[]){
 const key=text(candidate.event_key||candidate.candidate_id);
 const normalized=rows.map(normalizeCompetitor).filter(r=>r.exact_event&&r.event_key===key&&r.competitor_id&&r.price&&r.source_url);
 const byCompetitor=new Map();for(const r of normalized){const k=r.competitor_id.toLowerCase()+'|'+r.package_type;if(!byCompetitor.has(k))byCompetitor.set(k,r);}
 const unique=[...byCompetitor.values()];const shops=new Set(unique.map(r=>r.competitor_id.toLowerCase()));const prices=unique.map(r=>r.price);const n=shops.size;
 return {evidence_type:'EXACT_EVENT_COMPETITOR_PRICE',minimum_independent_competitors:MIN_EXACT_COMPETITORS,independent_competitors:n,complete:n>=MIN_EXACT_COMPETITORS,market_median:prices.length?median(prices):null,market_min:prices.length?Math.min(...prices):null,market_max:prices.length?Math.max(...prices):null,evidence:unique};
}

function proposalEvidence(candidate={},input={},exact={}){
 const comparable=(input.comparable_prices||[]).map(r=>normalizeReference(r,'COMPARABLE_EVENT')).filter(r=>r.price&&r.source_url);
 const baseline=(input.store_baseline_prices||[]).map(r=>normalizeReference(r,'KK_APPROVED_BASELINE')).filter(r=>r.price&&r.approved);
 let source='',confidence='',basis=[],proposed=null;
 if(exact.independent_competitors>=3){source='EXACT_EVENT_MEDIAN';confidence='HIGH';basis=exact.evidence;proposed=exact.market_median;}
 else if(exact.independent_competitors>=1){source='LIMITED_EXACT_EVENT';confidence='MEDIUM';basis=exact.evidence;proposed=exact.market_median;}
 else if(comparable.length){source='COMPARABLE_EVENT_MEDIAN';confidence='MEDIUM_LOW';basis=comparable;proposed=median(comparable.map(x=>x.price));}
 else if(baseline.length){source='KK_APPROVED_BASELINE';confidence='LOW';basis=baseline;proposed=median(baseline.map(x=>x.price));}
 return {proposal_available:Number.isFinite(Number(proposed))&&Number(proposed)>0,proposal_source:source||'NONE',confidence:confidence||'NONE',proposed_reference_price:proposed,basis,requires_final_pricing_policy:true,requires_verifier:true,auto_final_price:false};
}

function posterEvidence(candidate={},posters=[]){
 const key=text(candidate.event_key||candidate.candidate_id);
 const valid=posters.map((p={})=>({event_key:text(p.event_key),source_tier:text(p.source_tier).toUpperCase(),source_url:httpsUrl(p.source_url),image_url:httpsUrl(p.image_url),official:p.official===true,verified:p.verified===true})).filter(p=>p.event_key===key&&p.source_url&&p.image_url&&p.verified);
 valid.sort((a,b)=>Number(b.official)-Number(a.official));
 const selected=valid[0]||null;
 return {complete:!!selected,selected,evidence:valid};
}

function prepareCandidate(candidate={},input={}){
 const pricingOnly=text(input.phase_scope).toUpperCase()==='PHASE3_PRICING';
 const pricing=priceEvidence(candidate,input.competitor_prices||[]);
 const proposal=proposalEvidence(candidate,input,pricing);
 const poster=posterEvidence(candidate,input.posters||[]);
 const publish_eligibility=publishEligibility(candidate,input);
 const blockers=[];
 if(!text(candidate.title))blockers.push('EVENT_TITLE_REQUIRED');
 if(!text(candidate.event_date))blockers.push('EVENT_DATE_REQUIRED');
 if(!text(candidate.venue))blockers.push('EVENT_VENUE_REQUIRED');
 if(publish_eligibility.eligible===false) blockers.push('RENTAL_FIT_BELOW_PUBLISH_THRESHOLD');
 if(!proposal.proposal_available&&publish_eligibility.eligible!==true) blockers.push('PRICING_REFERENCE_UNAVAILABLE');
 if(!pricingOnly&&!poster.complete)blockers.push('VERIFIED_POSTER_EVIDENCE_MISSING');
 return {
  schema_version:VERSION,
  candidate_id:text(candidate.candidate_id),
  event_key:text(candidate.event_key||candidate.candidate_id),
  title:text(candidate.title),
  event_date:text(candidate.event_date),
  venue:text(candidate.venue),
  artist:Array.isArray(candidate.artist)?candidate.artist.map(text).filter(Boolean):[],
  rental_fit_score:publish_eligibility.rental_fit_score,
  publish_eligibility,
  pricing:{...pricing,proposal,reference_missing:!proposal.proposal_available,reference_required_for_publish:publish_eligibility.eligible!==true},
  poster,
  status:blockers.length?(pricingOnly?'HOLD_FOR_PHASE3_PRICING':'HOLD_FOR_COMMERCIAL_EVIDENCE'):(pricingOnly?'READY_FOR_PHASE3_PRICING':'READY_FOR_FINAL_VERIFIER'),
  phase_scope:pricingOnly?'PHASE3_PRICING':'FULL_COMMERCIAL',
  blockers,
  authoritative:false,
  verifier_required:true,
  final_price_write_allowed:false,
  production_writes:0,
  publishes:0
 };
}

function prepareBatch(input={}){
 const candidates=Array.isArray(input.candidates)?input.candidates:[];
 const prepared=candidates.map(c=>prepareCandidate(c,input));
 const pricingOnly=text(input.phase_scope).toUpperCase()==='PHASE3_PRICING';
 const readyStatus=pricingOnly?'READY_FOR_PHASE3_PRICING':'READY_FOR_FINAL_VERIFIER';
 const holdStatus=pricingOnly?'HOLD_FOR_PHASE3_PRICING':'HOLD_FOR_COMMERCIAL_EVIDENCE';
 return {
  schema_version:VERSION,
  phase_scope:pricingOnly?'PHASE3_PRICING':'FULL_COMMERCIAL',
  status:prepared.length&&prepared.every(x=>x.status===readyStatus)?readyStatus:holdStatus,
  candidates:prepared,
  ready_count:prepared.filter(x=>x.status===readyStatus).length,
  hold_count:prepared.filter(x=>x.status!==readyStatus).length,
  production_writes:0,
  publishes:0
 };
}

module.exports={
 VERSION,MIN_EXACT_COMPETITORS,MIN_PUBLISH_SCORE,
 median,normalizeCompetitor,normalizeReference,rentalFitScore,publishEligibility,
 priceEvidence,proposalEvidence,posterEvidence,prepareCandidate,prepareBatch
};
