'use strict';

const crypto=require('node:crypto');

const VERSION='KK_ULTRA_DEEP_PHASE2_ARTIFACT_V1';
function text(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function stable(value){
 if(Array.isArray(value))return value.map(stable);
 if(!value||typeof value!=='object')return value;
 return Object.keys(value).sort().reduce((o,k)=>{o[k]=stable(value[k]);return o;},{});
}
function sha(value){return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');}
function candidateId(row={}){return text(row.candidate_id||row.event_key||row.id);}
function canonicalResult(row={}){
 return {
  candidate_id:candidateId(row),
  title:text(row.title),
  event_date:text(row.event_date),
  venue:text(row.venue),
  disposition:text(row.disposition).toUpperCase(),
  reason:text(row.reason),
  evidence:arr(row.evidence).map(text).filter(Boolean).sort()
 };
}
function freezePhase2(input={}){
 const rows=arr(input.results).map(canonicalResult);
 const allIds=rows.map(candidateId);
 const pricingRows=rows.filter(x=>x.disposition==='VERIFIED');
 const pricingIds=pricingRows.map(candidateId);
 const blockers=[];
 if(text(input.status)!=='PHASE2_ACCEPTED')blockers.push('PHASE2_ACCEPTED_REQUIRED');
 if(input.ready_for_phase3!==true)blockers.push('PHASE2_READY_FOR_PHASE3_REQUIRED');
 if(Number(input.production_writes||0)!==0)blockers.push('PHASE2_PRODUCTION_WRITES_MUST_BE_ZERO');
 if(input.phase3_started!==false)blockers.push('PHASE2_PHASE3_STARTED_MUST_BE_FALSE');
 if(!text(input.phase1_fingerprint||input.pool_fingerprint))blockers.push('PHASE1_FINGERPRINT_REQUIRED');
 if(!rows.length)blockers.push('PHASE2_RESULT_SET_EMPTY');
 if(allIds.some(x=>!x))blockers.push('PHASE2_CANDIDATE_ID_REQUIRED');
 if(new Set(allIds).size!==allIds.length)blockers.push('PHASE2_DUPLICATE_CANDIDATE_ID');
 if(rows.some(x=>!['VERIFIED','VERIFY_REQUIRED','STATUS_CHANGED','REJECT_WITH_REASON'].includes(x.disposition)))blockers.push('PHASE2_DISPOSITION_INVALID');
 if(rows.some(x=>x.disposition==='VERIFIED'&&!x.evidence.length))blockers.push('PHASE2_VERIFIED_EVIDENCE_REQUIRED');
 if(rows.some(x=>x.disposition==='VERIFY_REQUIRED'))blockers.push('PHASE2_UNRESOLVED_VERIFY_REQUIRED');
 const payload={
  schema:VERSION,
  phase:'PHASE2',
  status:'PHASE2_ACCEPTED',
  month:text(input.month),
  accepted_at:text(input.accepted_at),
  phase1_fingerprint:text(input.phase1_fingerprint||input.pool_fingerprint),
  candidate_count:rows.length,
  candidate_ids:allIds,
  pricing_candidate_count:pricingRows.length,
  pricing_candidate_ids:pricingIds,
  results:rows,
  production_writes:0,
  phase3_started:false,
  ready_for_phase3:true
 };
 const fingerprint=sha(payload);
 return {...payload,fingerprint,frozen:blockers.length===0,blockers};
}
function validateForPhase3(artifact={}){
 const rows=arr(artifact.results).map(canonicalResult);
 const ids=arr(artifact.candidate_ids).map(text);
 const pricingIds=arr(artifact.pricing_candidate_ids).map(text);
 const verifiedIds=rows.filter(x=>x.disposition==='VERIFIED').map(candidateId);
 const blockers=[];
 if(artifact.schema!==VERSION)blockers.push('PHASE2_ARTIFACT_SCHEMA_INVALID');
 if(artifact.phase!=='PHASE2')blockers.push('PHASE2_ARTIFACT_PHASE_INVALID');
 if(artifact.status!=='PHASE2_ACCEPTED')blockers.push('PHASE2_ARTIFACT_STATUS_INVALID');
 if(artifact.frozen!==true)blockers.push('PHASE2_ARTIFACT_NOT_FROZEN');
 if(artifact.ready_for_phase3!==true)blockers.push('PHASE2_ARTIFACT_NOT_READY_FOR_PHASE3');
 if(Number(artifact.production_writes||0)!==0)blockers.push('PHASE2_ARTIFACT_PRODUCTION_WRITES_NONZERO');
 if(artifact.phase3_started!==false)blockers.push('PHASE2_ARTIFACT_PHASE3_ALREADY_STARTED');
 if(!text(artifact.phase1_fingerprint))blockers.push('PHASE1_FINGERPRINT_REQUIRED');
 if(Number(artifact.candidate_count)!==rows.length)blockers.push('PHASE2_ARTIFACT_COUNT_MISMATCH');
 if(ids.length!==rows.length||new Set(ids).size!==ids.length)blockers.push('PHASE2_ARTIFACT_ID_SET_INVALID');
 if(rows.some((row,i)=>candidateId(row)!==ids[i]))blockers.push('PHASE2_ARTIFACT_RESULT_ID_MISMATCH');
 if(Number(artifact.pricing_candidate_count)!==pricingIds.length)blockers.push('PHASE2_PRICING_COUNT_MISMATCH');
 if(pricingIds.length!==verifiedIds.length||pricingIds.some((id,i)=>id!==verifiedIds[i]))blockers.push('PHASE2_PRICING_SET_MISMATCH');
 const expected=sha({
  schema:artifact.schema,phase:artifact.phase,status:artifact.status,month:text(artifact.month),accepted_at:text(artifact.accepted_at),
  phase1_fingerprint:text(artifact.phase1_fingerprint),candidate_count:rows.length,candidate_ids:ids,
  pricing_candidate_count:pricingIds.length,pricing_candidate_ids:pricingIds,results:rows,
  production_writes:0,phase3_started:false,ready_for_phase3:true
 });
 if(text(artifact.fingerprint)!==expected)blockers.push('PHASE2_ARTIFACT_FINGERPRINT_MISMATCH');
 return {version:VERSION,pass:blockers.length===0,blockers,candidate_count:rows.length,candidate_ids:ids,pricing_candidate_ids:pricingIds,fingerprint:text(artifact.fingerprint)};
}
module.exports={VERSION,text,arr,stable,sha,candidateId,canonicalResult,freezePhase2,validateForPhase3};
