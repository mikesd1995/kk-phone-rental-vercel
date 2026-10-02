'use strict';

const VERSION='KK_ULTRA_DEEP_PRODUCTION_RESULT_GATE_V1';
const SAFE_TERMINAL_DISPOSITIONS=Object.freeze(new Set([
  'SKIPPED_BOOKING_DATE',
  'SKIPPED_EVENT_HISTORY',
  'SKIPPED_OWNER_HIDDEN'
]));

function text(v){return String(v==null?'':v).trim();}
function statuses(rows=[]){return (Array.isArray(rows)?rows:[]).map(row=>text(row&&row.status).toUpperCase());}
function exactSingleBlocker(acceptance={},wanted=''){
  const rows=Array.isArray(acceptance.blockers)?acceptance.blockers.map(text).filter(Boolean):[];
  return rows.length===1&&rows[0]===wanted;
}
function zeroCounts(counts={}){
  return ['total','created_verified','updated_verified','no_change','update_ready','promotion_ready','quarantined_verified']
    .every(key=>Number(counts&&counts[key]||0)===0);
}

function evaluate({response={},commercial={},expectedRunId='',expectedSha=''}={}){
  const blockers=[];
  const result=response&&response.result||{};
  const acceptance=result.acceptance||{};
  const auth=response&&response.auth||{};
  const verifiedCount=Number(commercial&&commercial.verifier&&commercial.verifier.verified_count||0);
  const dispositions=Array.isArray(result.dispositions)?result.dispositions:[];
  const dispositionStatuses=statuses(dispositions);

  if(response.ok!==true) blockers.push('PRODUCTION_RESPONSE_NOT_OK');
  if(auth.verified!==true) blockers.push('OIDC_AUTH_NOT_VERIFIED');
  if(expectedRunId&&text(auth.run_id)!==text(expectedRunId)) blockers.push('OIDC_RUN_ID_MISMATCH');
  if(expectedSha&&text(auth.sha)!==text(expectedSha)) blockers.push('OIDC_SHA_MISMATCH');

  if(result.status==='COMPLETE'&&acceptance.complete===true&&blockers.length===0){
    return {
      version:VERSION,
      complete:true,
      status:'COMPLETE',
      completion_mode:text(acceptance.completion_mode)||'PRODUCTION_RUNTIME_COMPLETE',
      production_writes:Number(result.production_writes||0),
      verified_candidate_count:verifiedCount,
      terminal_disposition_count:dispositions.length,
      blockers:[]
    };
  }

  const legacySafeNoop=
    result.version==='KK_ULTRA_DEEP_PRODUCTION_RUNTIME_V2' &&
    result.status==='INCOMPLETE' &&
    Number(result.production_writes||0)===0 &&
    Array.isArray(result.blockers) && result.blockers.length===0 &&
    acceptance.version==='KK_ULTRA_DEEP_FULL_LOOP_COMPLETION_GATE_V1' &&
    acceptance.complete===false &&
    exactSingleBlocker(acceptance,'NO_VERIFIED_CANDIDATES') &&
    zeroCounts(result.counts||{}) &&
    verifiedCount>0 &&
    dispositions.length===verifiedCount &&
    dispositionStatuses.every(status=>SAFE_TERMINAL_DISPOSITIONS.has(status));

  if(legacySafeNoop&&blockers.length===0){
    return {
      version:VERSION,
      complete:true,
      status:'COMPLETE',
      completion_mode:'LEGACY_V20_SAFE_NOOP_TERMINAL_DISPOSITIONS',
      production_writes:0,
      verified_candidate_count:verifiedCount,
      terminal_disposition_count:dispositions.length,
      disposition_statuses:[...new Set(dispositionStatuses)],
      blockers:[]
    };
  }

  if(Number(result.production_writes||0)!==0 && result.status!=='COMPLETE') blockers.push('NONZERO_WRITES_WITHOUT_RUNTIME_COMPLETE');
  if(verifiedCount<=0) blockers.push('VERIFIED_CANDIDATE_COUNT_MISSING');
  if(dispositions.length!==verifiedCount) blockers.push('TERMINAL_DISPOSITION_COVERAGE_MISMATCH');
  if(dispositionStatuses.some(status=>!SAFE_TERMINAL_DISPOSITIONS.has(status))) blockers.push('UNSAFE_TERMINAL_DISPOSITION');
  if(!exactSingleBlocker(acceptance,'NO_VERIFIED_CANDIDATES')&&result.status!=='COMPLETE') blockers.push('LEGACY_ACCEPTANCE_SHAPE_MISMATCH');

  return {
    version:VERSION,
    complete:false,
    status:'BLOCKED',
    completion_mode:'FAIL_CLOSED',
    production_writes:Number(result.production_writes||0),
    verified_candidate_count:verifiedCount,
    terminal_disposition_count:dispositions.length,
    disposition_statuses:[...new Set(dispositionStatuses)],
    blockers:[...new Set(blockers)]
  };
}

module.exports={VERSION,SAFE_TERMINAL_DISPOSITIONS,text,statuses,exactSingleBlocker,zeroCounts,evaluate};
