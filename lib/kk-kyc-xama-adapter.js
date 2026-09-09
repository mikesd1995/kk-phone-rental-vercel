'use strict';
const {evidenceTimestamp,evidenceCount}=require('./kk-evidence-validation');

/**
 * Convert a Xama Onboarding provider result into the minimal non-PII
 * kyc_attestation consumed by kk-booking-intake-guard.
 *
 * Fail closed: provider decision vocabularies must be configured explicitly by
 * the caller from the governed provider contract. No default "looks good"
 * interpretation is allowed.
 */

const RAW_PII_KEYS = new Set([
  'document_given_names','document_last_name','date_of_birth','passport_number',
  'driving_license_number','street','city','postcode','country'
]);

function text(v){ return String(v == null ? '' : v).trim(); }
function lower(v){ return typeof v==='string'?v.trim().toLowerCase():''; }
function parseTime(v, field){
  if(!evidenceTimestamp(v)) throw new Error(`${field} invalid`);
  return Date.parse(v);
}
function normalizedAllowed(values, field){
  if(!Array.isArray(values) || !values.length) throw new Error(`${field} explicit allowlist required`);
  if(values.some(v=>typeof v!=='string'||!v.trim()))throw new Error(`${field} explicit allowlist strings required`);
  const out=[...new Set(values.map(lower).filter(Boolean))];
  if(!out.length) throw new Error(`${field} explicit allowlist required`);
  return out;
}
function assertProviderPayloadNotEmbedded(output){
  const serialized=JSON.stringify(output || {});
  for(const key of RAW_PII_KEYS){
    if(serialized.includes(`\"${key}\"`)) throw new Error(`raw provider PII leaked to attestation: ${key}`);
  }
}

function xamaToKycAttestation(input){
  if(!input || typeof input!=='object') throw new Error('input required');
  const customerRef=text(input.customer_ref);
  if(!customerRef) throw new Error('customer_ref required');

  const provider=input.provider_result;
  if(!provider || typeof provider!=='object') throw new Error('provider_result required');

  const policy=input.provider_policy || {};
  const acceptedStatuses=normalizedAllowed(policy.accepted_statuses,'accepted_statuses');
  const acceptedReviewDecisions=normalizedAllowed(policy.accepted_review_decisions,'accepted_review_decisions');
  const acceptedDocumentDecisions=normalizedAllowed(policy.accepted_document_decisions,'accepted_document_decisions');

  const status=lower(provider.status);
  const reviewDecision=lower(provider.review && provider.review.decision);
  const documentDecision=lower(provider.data && provider.data.idscan && provider.data.idscan.document_decision);
  if(!acceptedStatuses.includes(status)) throw new Error(`Xama status not accepted: ${status || '<blank>'}`);
  if(!acceptedReviewDecisions.includes(reviewDecision)) throw new Error(`Xama review decision not accepted: ${reviewDecision || '<blank>'}`);
  if(!acceptedDocumentDecisions.includes(documentDecision)) throw new Error(`Xama document decision not accepted: ${documentDecision || '<blank>'}`);

  if(typeof policy.require_face_match!=='boolean')throw new Error('require_face_match explicit boolean required');
  if(policy.require_face_match===true){
    const requested=lower(provider.config && provider.config.parameters && provider.config.parameters.face_match);
    if(!['true','1','yes','required','enabled'].includes(requested)) throw new Error('Xama face-match requirement was not enabled for this request');
    if(policy.face_match_evidence_verified!==true) throw new Error('independent face-match verification evidence required');
  }

  const providerId=text(provider.id);
  if(typeof provider.id!=='string'||!providerId||!/^[A-Za-z0-9_-]+$/.test(providerId)) throw new Error('Xama provider request id required');
  const binding=input.request_binding;
  if(!binding||binding.verified!==true||binding.provider_request_id!==providerId||binding.subject_ref!==customerRef||!text(binding.evidence_ref))throw new Error('verified provider request binding to subject required');
  const reportLink=text(provider.data && (provider.data.report_link || (provider.data.idscan && provider.data.idscan.document_report_link)));
  if(!reportLink) throw new Error('Xama evidence/report reference required');

  const verifiedAt=text(
    (provider.data && provider.data.idscan && provider.data.idscan.document_decision_date) ||
    (provider.data && provider.data.refreshed_at)
  );
  const verifiedMs=parseTime(verifiedAt,'Xama verified_at');
  const nowMs=input.now_ms==null?Date.now():evidenceCount(input.now_ms);
  if(nowMs===null) throw new Error('now_ms invalid');
  if(verifiedMs>nowMs+5*60*1000) throw new Error('Xama verified_at is in the future');

  const authority=text(policy.authority || 'XAMA_ONBOARDING_V1');
  if(authority!=='XAMA_ONBOARDING_V1') throw new Error('unexpected Xama authority identifier');

  // Evidence ref is opaque. Do not copy report payload, personal names, document
  // numbers, DOB or addresses into Machine SOT.
  const attestation={
    verified:true,
    subject_ref:customerRef,
    evidence_ref:`XAMA|${providerId}`,
    authority,
    verified_at:new Date(verifiedMs).toISOString()
  };
  assertProviderPayloadNotEmbedded(attestation);
  return attestation;
}

module.exports={xamaToKycAttestation};
