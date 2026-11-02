'use strict';

const VERSION='KK_ULTRA_DEEP_FULL_LOOP_COMPLETION_GATE_V3';
const REQUIRED_STAGES=Object.freeze([
  'discovery','verification_dedup','commercial_pricing','poster',
  'storefront_comparison','governed_publish','production_readback','final_report'
]);
const SAFE_TERMINAL_DISPOSITIONS=Object.freeze(new Set(['SKIPPED_BOOKING_DATE','SKIPPED_FULL_BOOKING_DATE','SKIPPED_EVENT_HISTORY','SKIPPED_OWNER_HIDDEN']));

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

// A discovery audit can find an event days before the storefront accepts it.
// Never accept a final report unless the exact dated identity is evidenced
// in a read-back Candidate Queue or explicitly safe terminal disposition.
// Date-only matches are forbidden: shared-date events have different owners/stock.
function auditIdentity(row={}){
 const id=text(row.event_id||row.event_key||row.candidate_id).toLowerCase();
 const date=text(row.event_date||row.date);
 const title=text(row.title||row.event_name||row.name).toLowerCase().replace(/[^a-z0-9\u0e00-\u0e7f]+/g,' ').trim();
 return {id,date,title};
}
function auditQueueReconciliation(input={}){
 const leads=Array.isArray(input.audit_discovery_leads)?input.audit_discovery_leads:[];
 const required=input.discovery?.audit_required===true||leads.length>0;
 const rawQueue=Array.isArray(input.candidate_queue_readback)?input.candidate_queue_readback:[];
 const terminals=Array.isArray(input.terminal_dispositions)?input.terminal_dispositions:[];
 const readback=input.candidate_queue_readback_verified===true;
 const queue=rawQueue.map(auditIdentity);
 const allowed=terminals.filter(r=>SAFE_TERMINAL_DISPOSITIONS.has(text(r.status).toUpperCase())).map(auditIdentity);
 const unresolved=[],accounted=[];
 const match=(row,expected)=>row.date===expected.date && (expected.id&&row.id===expected.id || expected.title&&row.title===expected.title);
 for(const lead of leads){
  const key=auditIdentity(lead);
  if(!key.date||(!key.id&&!key.title)) {
   unresolved.push({event_id:key.id,event_date:key.date,reason:'AUDIT_LEAD_IDENTITY_INSUFFICIENT'});
   continue;
  }
  const matchedRow=readback?rawQueue.find(q=>match(auditIdentity(q),key)):null;
  const requiredVariants=Array.isArray(lead.required_access_variants)?lead.required_access_variants:[];
  const actualVariants=Array.isArray(matchedRow?.access_variants)?matchedRow.access_variants:[];
  const absentVariants=requiredVariants.filter(x=>!actualVariants.includes(x));
  const safelyClosed=allowed.some(q=>match(q,key));
  if((matchedRow&&absentVariants.length===0)||safelyClosed)
   accounted.push({event_id:key.id,event_date:key.date,disposition:safelyClosed?'SAFE_TERMINAL_DISPOSITION':'CANDIDATE_QUEUE_READBACK'});
  else unresolved.push({event_id:key.id,event_date:key.date,reason:!readback?'CANDIDATE_QUEUE_READBACK_NOT_VERIFIED':!matchedRow?'AUDIT_LEAD_NOT_IN_CANDIDATE_QUEUE':'ACCESS_VARIANT_COVERAGE_INCOMPLETE',missing_access_variants:absentVariants});
 }
 const complete=!required||(leads.length>0&&unresolved.length===0&&(readback||accounted.every(r=>r.disposition==='SAFE_TERMINAL_DISPOSITION')));
 return {required,complete,lead_count:leads.length,readback_verified:readback,accounted_count:accounted.length,
  missing_count:unresolved.length,unresolved,accounted};
}
function evaluate(input={}){
  const blockers=[];
  const discovery=input.discovery||{};
  const audit_reconciliation=auditQueueReconciliation(input);
  if(!audit_reconciliation.complete)blockers.push('AUDIT_LEAD_TO_CANDIDATE_RECONCILIATION_INCOMPLETE');
  if(!ok(discovery.full)||text(discovery.status).toUpperCase()!=='READY_FOR_VERIFIER') blockers.push('DISCOVERY_COVERAGE_NOT_FULL');

  const candidates=Array.isArray(input.candidates)?input.candidates:[];
  const terminal=Array.isArray(input.terminal_dispositions)?input.terminal_dispositions:[];
  const verifiedCandidateCount=Number.isInteger(Number(input.verified_candidate_count))?Number(input.verified_candidate_count):null;
  let completionMode='CANDIDATE_EVIDENCE';

  if(!candidates.length){
    if(verifiedCandidateCount>0 && terminal.length===verifiedCandidateCount){
      const unsafe=terminal.filter(row=>!SAFE_TERMINAL_DISPOSITIONS.has(text(row&&row.status).toUpperCase()));
      if(unsafe.length) blockers.push('UNSAFE_TERMINAL_DISPOSITION');
      else completionMode='SAFE_NOOP_TERMINAL_DISPOSITIONS';
    }else if(verifiedCandidateCount>0 && terminal.length!==verifiedCandidateCount){
      blockers.push('TERMINAL_DISPOSITION_COVERAGE_MISMATCH');
    }else{
      blockers.push('NO_VERIFIED_CANDIDATES');
    }
  }

  const rows=candidates.map(evaluateCandidate);
  if(rows.some(r=>!r.complete)) blockers.push('CANDIDATE_FULL_LOOP_INCOMPLETE');

  if(!ok(input.final_report_ready)) blockers.push('FINAL_REPORT_NOT_READY');

  const complete=blockers.length===0;
  return {
    version:VERSION,
    status:complete?'COMPLETE':'BLOCKED_INCOMPLETE_FULL_LOOP',
    complete,
    completion_mode:completionMode,
    blockers:[...new Set(blockers)],
    required_stages:[...REQUIRED_STAGES],
    audit_reconciliation,
    verified_candidate_count:verifiedCandidateCount,
    terminal_disposition_count:terminal.length,
    terminal_dispositions:terminal.map(row=>({event_key:text(row&&row.event_key),status:text(row&&row.status).toUpperCase()})),
    candidates:rows,
    production_completion_claim_allowed:complete
  };
}

module.exports={VERSION,REQUIRED_STAGES,SAFE_TERMINAL_DISPOSITIONS,auditIdentity,auditQueueReconciliation,evaluateCandidate,evaluate};
