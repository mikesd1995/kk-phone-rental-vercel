'use strict';

const VERSION='KK_ULTRA_DEEP_FULL_LOOP_COMPLETION_GATE_V1';
const REQUIRED_STAGES=Object.freeze([
  'discovery','verification_dedup','commercial_pricing','poster',
  'storefront_comparison','governed_publish','production_readback','final_report'
]);

function text(v){return String(v==null?'':v).trim();}
function ok(v){return v===true || ['PASS','PASSED','COMPLETE','COMPLETED','VERIFIED','PUBLISHED','READY'].includes(text(v).toUpperCase());}
function candidateId(c,i){return text(c.candidate_id||c.event_key||c.event_id||c.title)||('candidate_'+i);}

function evaluateCandidate(candidate={},index=0){
  const blockers=[];
  const id=candidateId(candidate,index);
  if(!ok(candidate.verified) && !ok(candidate.verification_status)) blockers.push('EVENT_NOT_VERIFIED');
  if(!ok(candidate.deduplicated) && !ok(candidate.dedup_status)) blockers.push('DEDUP_NOT_PROVEN');

  const pricing=candidate.pricing||{};
  const hasCompetitor=Array.isArray(pricing.competitor_evidence)&&pricing.competitor_evidence.length>0;
  const hasFallback=ok(pricing.fallback_applied)||text(pricing.proposal_source).includes('FALLBACK')||text(pricing.proposal_source).includes('COMPARABLE')||Number.isFinite(Number(pricing.final_price));
  if(!hasCompetitor&&!hasFallback) blockers.push('PRICING_EVIDENCE_OR_FALLBACK_MISSING');
  if(!Number.isFinite(Number(pricing.final_price))) blockers.push('FINAL_KK_PRICE_MISSING');

  const poster=candidate.poster||{};
  if(!ok(poster.verified)||!/^https:\/\//i.test(text(poster.image_url))) blockers.push('VERIFIED_POSTER_MISSING');

  if(!ok(candidate.storefront_compared)) blockers.push('STOREFRONT_COMPARISON_MISSING');
  if(!ok(candidate.publish_required) && text(candidate.publish_decision).toUpperCase()!=='SKIP') blockers.push('PUBLISH_DECISION_MISSING');

  const shouldPublish=ok(candidate.publish_required);
  if(shouldPublish&&!ok(candidate.governed_publish)) blockers.push('GOVERNED_PUBLISH_NOT_PROVEN');
  if(shouldPublish&&!ok(candidate.production_readback)) blockers.push('PRODUCTION_READBACK_NOT_PROVEN');

  return {candidate_id:id,complete:blockers.length===0,blockers};
}

function evaluate(input={}){
  const blockers=[];
  const discovery=input.discovery||{};
  if(!ok(discovery.full)||text(discovery.status).toUpperCase()!=='READY_FOR_VERIFIER') blockers.push('DISCOVERY_COVERAGE_NOT_FULL');

  const candidates=Array.isArray(input.candidates)?input.candidates:[];
  if(!candidates.length) blockers.push('NO_VERIFIED_CANDIDATES');

  const rows=candidates.map(evaluateCandidate);
  if(rows.some(r=>!r.complete)) blockers.push('CANDIDATE_FULL_LOOP_INCOMPLETE');

  if(!ok(input.final_report_ready)) blockers.push('FINAL_REPORT_NOT_READY');

  const complete=blockers.length===0;
  return {
    version:VERSION,
    status:complete?'COMPLETE':'BLOCKED_INCOMPLETE_FULL_LOOP',
    complete,
    blockers:[...new Set(blockers)],
    required_stages:[...REQUIRED_STAGES],
    candidates:rows,
    production_completion_claim_allowed:complete
  };
}

module.exports={VERSION,REQUIRED_STAGES,evaluateCandidate,evaluate};
