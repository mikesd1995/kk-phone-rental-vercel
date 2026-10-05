'use strict';

const crypto=require('node:crypto');

const VERSION='KK_ULTRA_DEEP_PHASE3_ARTIFACT_V1';
function text(v){return String(v==null?'':v).trim();}
function arr(v){return Array.isArray(v)?v:[];}
function stable(value){
 if(Array.isArray(value))return value.map(stable);
 if(!value||typeof value!=='object')return value;
 return Object.keys(value).sort().reduce((o,k)=>{o[k]=stable(value[k]);return o;},{});
}
function sha(value){return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');}
function candidateId(row={}){return text(row.candidate_id||row.event_key||row.id);}
function prices(v={}){
 return {
  phone:Number.isFinite(Number(v.phone))?Number(v.phone):null,
  bundle:Number.isFinite(Number(v.bundle))?Number(v.bundle):null,
  lens:Number.isFinite(Number(v.lens))?Number(v.lens):null
 };
}
function canonicalResult(row={}){
 return {
  candidate_id:candidateId(row),
  status:text(row.status),
  reason:text(row.reason),
  price_source:text(row.price_source),
  price_confidence:text(row.price_confidence),
  target_prices:prices(row.target_prices||{}),
  booking_count:Number(row.booking_count||0),
  adjustment:Number(row.adjustment||0),
  competitor_count:Number(row.competitor_count||0),
  package_parity:text(row.package_parity),
  evidence:arr(row.evidence).map(x=>({
   competitor_id:text(x&&x.competitor_id),
   package_type:text(x&&x.package_type),
   price:Number(x&&x.price)||0,
   source_url:text(x&&x.source_url),
   source_published_at:text(x&&x.source_published_at)
  }))
 };
}
function freezePhase3(input={}){
 const rows=arr(input.results).map(canonicalResult);
 const ids=rows.map(candidateId);
 const actionable=rows.filter(x=>['PRICE_READY','PRICE_LOCKED_BOOKING'].includes(x.status));
 const actionableIds=actionable.map(candidateId);
 const blockers=[];
 if(text(input.status)!=='PHASE3_ACCEPTED')blockers.push('PHASE3_ACCEPTED_REQUIRED');
 if(input.ready_for_phase4!==true)blockers.push('PHASE3_READY_FOR_PHASE4_REQUIRED');
 if(Number(input.production_writes||0)!==0)blockers.push('PHASE3_PRODUCTION_WRITES_MUST_BE_ZERO');
 if(input.phase4_started!==false)blockers.push('PHASE3_PHASE4_STARTED_MUST_BE_FALSE');
 if(!text(input.phase2_fingerprint))blockers.push('PHASE2_FINGERPRINT_REQUIRED');
 if(!rows.length)blockers.push('PHASE3_RESULT_SET_EMPTY');
 if(ids.some(x=>!x))blockers.push('PHASE3_CANDIDATE_ID_REQUIRED');
 if(new Set(ids).size!==ids.length)blockers.push('PHASE3_DUPLICATE_CANDIDATE_ID');
 if(rows.some(x=>x.status==='HOLD'))blockers.push('PHASE3_HOLD_PRESENT');
 if(actionable.some(x=>!x.target_prices.phone&&!x.target_prices.bundle))blockers.push('PHASE3_TARGET_PRICE_REQUIRED');
 const payload={
  schema:VERSION,
  phase:'PHASE3',
  status:'PHASE3_ACCEPTED',
  month:text(input.month),
  accepted_at:text(input.accepted_at),
  phase2_fingerprint:text(input.phase2_fingerprint),
  candidate_count:rows.length,
  candidate_ids:ids,
  actionable_candidate_count:actionable.length,
  actionable_candidate_ids:actionableIds,
  results:rows,
  production_writes:0,
  phase4_started:false,
  ready_for_phase4:true
 };
 const fingerprint=sha(payload);
 return {...payload,fingerprint,frozen:blockers.length===0,blockers};
}
function validateForPhase4(artifact={}){
 const rows=arr(artifact.results).map(canonicalResult);
 const ids=arr(artifact.candidate_ids).map(text);
 const actionableIds=arr(artifact.actionable_candidate_ids).map(text);
 const expectedActionable=rows.filter(x=>['PRICE_READY','PRICE_LOCKED_BOOKING'].includes(x.status)).map(candidateId);
 const blockers=[];
 if(artifact.schema!==VERSION)blockers.push('PHASE3_ARTIFACT_SCHEMA_INVALID');
 if(artifact.phase!=='PHASE3')blockers.push('PHASE3_ARTIFACT_PHASE_INVALID');
 if(artifact.status!=='PHASE3_ACCEPTED')blockers.push('PHASE3_ARTIFACT_STATUS_INVALID');
 if(artifact.frozen!==true)blockers.push('PHASE3_ARTIFACT_NOT_FROZEN');
 if(artifact.ready_for_phase4!==true)blockers.push('PHASE3_ARTIFACT_NOT_READY_FOR_PHASE4');
 if(Number(artifact.production_writes||0)!==0)blockers.push('PHASE3_ARTIFACT_PRODUCTION_WRITES_NONZERO');
 if(artifact.phase4_started!==false)blockers.push('PHASE3_ARTIFACT_PHASE4_ALREADY_STARTED');
 if(!text(artifact.phase2_fingerprint))blockers.push('PHASE2_FINGERPRINT_REQUIRED');
 if(Number(artifact.candidate_count)!==rows.length)blockers.push('PHASE3_ARTIFACT_COUNT_MISMATCH');
 if(ids.length!==rows.length||new Set(ids).size!==ids.length)blockers.push('PHASE3_ARTIFACT_ID_SET_INVALID');
 if(rows.some((row,i)=>candidateId(row)!==ids[i]))blockers.push('PHASE3_ARTIFACT_RESULT_ID_MISMATCH');
 if(Number(artifact.actionable_candidate_count)!==actionableIds.length)blockers.push('PHASE3_ACTIONABLE_COUNT_MISMATCH');
 if(actionableIds.length!==expectedActionable.length||actionableIds.some((id,i)=>id!==expectedActionable[i]))blockers.push('PHASE3_ACTIONABLE_SET_MISMATCH');
 const expected=sha({
  schema:artifact.schema,phase:artifact.phase,status:artifact.status,month:text(artifact.month),accepted_at:text(artifact.accepted_at),
  phase2_fingerprint:text(artifact.phase2_fingerprint),candidate_count:rows.length,candidate_ids:ids,
  actionable_candidate_count:actionableIds.length,actionable_candidate_ids:actionableIds,results:rows,
  production_writes:0,phase4_started:false,ready_for_phase4:true
 });
 if(text(artifact.fingerprint)!==expected)blockers.push('PHASE3_ARTIFACT_FINGERPRINT_MISMATCH');
 return {version:VERSION,pass:blockers.length===0,blockers,candidate_count:rows.length,candidate_ids:ids,actionable_candidate_ids:actionableIds,fingerprint:text(artifact.fingerprint)};
}
module.exports={VERSION,text,arr,stable,sha,candidateId,prices,canonicalResult,freezePhase3,validateForPhase4};
