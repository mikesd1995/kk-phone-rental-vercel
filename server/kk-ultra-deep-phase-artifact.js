'use strict';

const crypto=require('node:crypto');

const VERSION='KK_ULTRA_DEEP_PHASE_ARTIFACT_V2';
function text(v){return String(v==null?'':v).trim();}
function stable(value){
 if(Array.isArray(value))return value.map(stable);
 if(!value||typeof value!=='object')return value;
 return Object.keys(value).sort().reduce((o,k)=>{o[k]=stable(value[k]);return o;},{});
}
function sha(value){return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');}
function norm(v){return text(v).toLowerCase().normalize('NFKC').replace(/[^a-z0-9\u0E00-\u0E7F]+/g,' ').replace(/\s+/g,' ').trim();}
function isoDate(v){
 const raw=text(v);
 const m=raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
 return m?m[1]+'-'+m[2]+'-'+m[3]:raw;
}
function explicitCandidateId(row={}){
 return text(row.candidate_id||row.show_id||row.event_key||row.id);
}
function deterministicCandidateId(row={}){
 const explicit=explicitCandidateId(row);
 if(explicit)return explicit;
 const identity={title:norm(row.title||row.event_name),event_date:isoDate(row.event_date||row.date)};
 if(!identity.title||!identity.event_date)return '';
 return 'P1-'+sha(identity).slice(0,18);
}
function sourceUrls(row={}){
 const values=[
  row.source_url,
  ...(Array.isArray(row.source_urls)?row.source_urls:[]),
  ...(Array.isArray(row.evidence_urls)?row.evidence_urls:[]),
  ...(Array.isArray(row.sources)?row.sources.map(x=>typeof x==='string'?x:(x&&x.url)):[])
 ];
 return [...new Set(values.map(text).filter(Boolean))].sort();
}
function canonicalCandidate(row={}){
 const candidate_id=deterministicCandidateId(row);
 return {...row,candidate_id,source_urls:sourceUrls(row)};
}
function candidateId(row={}){return deterministicCandidateId(row);}
function freezePhase1(input={}){
 const raw=Array.isArray(input.candidates)?input.candidates:[];
 const rows=raw.map(canonicalCandidate);
 const ids=rows.map(candidateId);
 const blockers=[];
 if(input.phase!=='PHASE1')blockers.push('PHASE1_REQUIRED');
 if(input.status!=='PHASE1_ACCEPTED')blockers.push('PHASE1_ACCEPTANCE_REQUIRED');
 if(input.production_writes!==0)blockers.push('PRODUCTION_WRITES_MUST_BE_ZERO');
 if(!rows.length)blockers.push('CANDIDATE_MASTER_POOL_EMPTY');
 if(ids.some(x=>!x))blockers.push('CANDIDATE_ID_REQUIRED');
 if(new Set(ids).size!==ids.length)blockers.push('DUPLICATE_CANDIDATE_ID');
 if(rows.some(x=>!x.source_urls.length))blockers.push('CANDIDATE_SOURCE_PROVENANCE_REQUIRED');
 const payload={
  schema:VERSION,
  phase:'PHASE1',
  status:'PHASE1_ACCEPTED',
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
 if(artifact.status!=='PHASE1_ACCEPTED')blockers.push('PHASE1_ARTIFACT_STATUS_INVALID');
 if(artifact.frozen!==true)blockers.push('PHASE1_ARTIFACT_NOT_FROZEN');
 if(artifact.production_writes!==0)blockers.push('PHASE1_ARTIFACT_PRODUCTION_WRITES_NONZERO');
 if(!rows.length)blockers.push('PHASE1_ARTIFACT_POOL_EMPTY');
 if(Number(artifact.candidate_count)!==rows.length)blockers.push('PHASE1_ARTIFACT_COUNT_MISMATCH');
 if(ids.length!==rows.length||new Set(ids).size!==ids.length)blockers.push('PHASE1_ARTIFACT_ID_SET_INVALID');
 if(rows.some((row,i)=>candidateId(row)!==ids[i]))blockers.push('PHASE1_ARTIFACT_CANDIDATE_ID_MISMATCH');
 if(rows.some(row=>!sourceUrls(row).length))blockers.push('PHASE1_ARTIFACT_SOURCE_PROVENANCE_MISSING');
 const expected=sha({
  schema:artifact.schema,phase:artifact.phase,status:artifact.status,month:text(artifact.month),accepted_at:text(artifact.accepted_at),
  candidate_count:rows.length,candidate_ids:ids,candidates:rows,production_writes:0
 });
 if(text(artifact.fingerprint)!==expected)blockers.push('PHASE1_ARTIFACT_FINGERPRINT_MISMATCH');
 return {version:VERSION,pass:blockers.length===0,blockers,candidate_count:rows.length,candidate_ids:ids,fingerprint:text(artifact.fingerprint)};
}
module.exports={VERSION,text,stable,sha,norm,isoDate,explicitCandidateId,deterministicCandidateId,sourceUrls,canonicalCandidate,candidateId,freezePhase1,validateForPhase2};
