'use strict';

const crypto=require('node:crypto');

const VERSION='KK_ULTRA_DEEP_PHASE_ARTIFACT_V1';
function text(v){return String(v==null?'':v).trim();}
function stable(value){
 if(Array.isArray(value))return value.map(stable);
 if(!value||typeof value!=='object')return value;
 return Object.keys(value).sort().reduce((o,k)=>{o[k]=stable(value[k]);return o;},{});
}
function sha(value){return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');}
function candidateId(row={}){
 return text(row.candidate_id||row.show_id||row.event_key||row.id);
}
function freezePhase1(input={}){
 const rows=Array.isArray(input.candidates)?input.candidates:[];
 const ids=rows.map(candidateId);
 const blockers=[];
 if(input.phase!=='PHASE1')blockers.push('PHASE1_REQUIRED');
 if(input.status!=='PHASE1_ACCEPTED')blockers.push('PHASE1_ACCEPTANCE_REQUIRED');
 if(input.production_writes!==0)blockers.push('PRODUCTION_WRITES_MUST_BE_ZERO');
 if(!rows.length)blockers.push('CANDIDATE_MASTER_POOL_EMPTY');
 if(ids.some(x=>!x))blockers.push('CANDIDATE_ID_REQUIRED');
 if(new Set(ids).size!==ids.length)blockers.push('DUPLICATE_CANDIDATE_ID');
 const payload={
  schema:VERSION,
  phase:'PHASE1',
  month:text(input.month),
  accepted_at:text(input.accepted_at),
  candidate_count:rows.length,
  candidate_ids:ids,
  candidates:rows,
  production_writes:0
 };
 const fingerprint=sha(payload);
 return {...payload,fingerprint,frozen:blockers.length===0,blockers};
}
function validateForPhase2(artifact={}){
 const rows=Array.isArray(artifact.candidates)?artifact.candidates:[];
 const ids=Array.isArray(artifact.candidate_ids)?artifact.candidate_ids.map(text):[];
 const blockers=[];
 if(artifact.schema!==VERSION)blockers.push('PHASE1_ARTIFACT_SCHEMA_INVALID');
 if(artifact.phase!=='PHASE1')blockers.push('PHASE1_ARTIFACT_PHASE_INVALID');
 if(artifact.frozen!==true)blockers.push('PHASE1_ARTIFACT_NOT_FROZEN');
 if(artifact.production_writes!==0)blockers.push('PHASE1_ARTIFACT_PRODUCTION_WRITES_NONZERO');
 if(!rows.length)blockers.push('PHASE1_ARTIFACT_POOL_EMPTY');
 if(Number(artifact.candidate_count)!==rows.length)blockers.push('PHASE1_ARTIFACT_COUNT_MISMATCH');
 if(ids.length!==rows.length||new Set(ids).size!==ids.length)blockers.push('PHASE1_ARTIFACT_ID_SET_INVALID');
 const expected=sha({
  schema:artifact.schema,phase:artifact.phase,month:text(artifact.month),accepted_at:text(artifact.accepted_at),
  candidate_count:rows.length,candidate_ids:ids,candidates:rows,production_writes:0
 });
 if(text(artifact.fingerprint)!==expected)blockers.push('PHASE1_ARTIFACT_FINGERPRINT_MISMATCH');
 return {version:VERSION,pass:blockers.length===0,blockers,candidate_count:rows.length,candidate_ids:ids,fingerprint:text(artifact.fingerprint)};
}
module.exports={VERSION,text,stable,sha,candidateId,freezePhase1,validateForPhase2};
