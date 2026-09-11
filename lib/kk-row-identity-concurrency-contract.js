'use strict';

function text(v){ return String(v == null ? '' : v).trim(); }
function upper(v){ return text(v).toUpperCase(); }
function num(v){ const n=Number(v); return Number.isFinite(n)?n:0; }
function bool(v){ return v===true || upper(v)==='TRUE'; }

const FAILURE_SEVERITY=Object.freeze({
  NON_ATOMIC_APPEND:'P0',
  COMPUTED_LAST_ROW_WRITE:'P0',
  IMMUTABLE_IDENTITY_NOT_BOUND:'P0',
  IDENTITY_REBIND_REQUIRED:'P0',
  IDENTITY_MATCH_COUNT_NOT_ONE:'P0',
  IDENTITY_DRIFT:'P0',
  CACHED_ROW_AUTHORITY:'P0',
  EXACT_READBACK_REQUIRED:'P0',
  SHARED_LOCK_NON_ATOMIC_APPEND:'P0',
  SHARED_LOCK_COUNT_NOT_ONE:'P0',
  SHARED_LOCK_NOT_OWNED:'P0',
  SHARED_LOCK_IDENTITY_NOT_PROVEN:'P0',
  OWN_ROLE_LOCK_COUNT_NOT_ONE:'P0',
  OWN_ROLE_LOCK_NOT_OWNED:'P0',
  CROSS_ROLE_ACTIVE_CONFLICT:'P0',
  PROTECTED_WRITE_BEFORE_SHARED_GATE:'P0'
});

function failureSeverity(code){ return FAILURE_SEVERITY[upper(code)] || 'P2'; }

function resultFromReasons(reasons){
  const unique=Array.from(new Set(reasons));
  const rank={P0:3,P1:2,P2:1};
  let highest=null;
  for(const reason of unique){
    const severity=failureSeverity(reason);
    if(!highest || rank[severity]>rank[highest]) highest=severity;
  }
  return {
    accepted:unique.length===0,
    status:unique.length===0?'PASS':'DENY',
    reasons:unique,
    highest_severity:highest
  };
}

function recordIdentityGate(input={}){
  const operation=upper(input.operation || 'UPDATE');
  const creation=operation==='CREATE';
  const release=operation==='RELEASE';
  const reasons=[];

  if(creation){
    const atomic=bool(input.atomic_append) || upper(input.creation_mode)==='ATOMIC_APPEND';
    if(!atomic) reasons.push('NON_ATOMIC_APPEND');
    if(bool(input.computed_last_row_write)) reasons.push('COMPUTED_LAST_ROW_WRITE');
    if(!bool(input.immutable_identity_bound)) reasons.push('IMMUTABLE_IDENTITY_NOT_BOUND');
    if(num(input.identity_match_count)!==1) reasons.push('IDENTITY_MATCH_COUNT_NOT_ONE');
    if(!bool(input.exact_readback)) reasons.push('EXACT_READBACK_REQUIRED');
  } else {
    if(bool(input.cached_row_used_as_authority)) reasons.push('CACHED_ROW_AUTHORITY');
    if(!bool(input.rebind_performed)) reasons.push('IDENTITY_REBIND_REQUIRED');
    if(num(input.identity_match_count)!==1) reasons.push('IDENTITY_MATCH_COUNT_NOT_ONE');
    if(!bool(input.identity_unchanged)) reasons.push('IDENTITY_DRIFT');
    if(!bool(input.exact_readback)) reasons.push('EXACT_READBACK_REQUIRED');
  }

  const result=resultFromReasons(reasons);
  return Object.assign(result,{
    operation,
    creation,
    release,
    physical_row_may_change:true,
    cached_row_authority_allowed:false
  });
}

function sharedWriterGate(input={}){
  const reasons=[];
  const atomic=bool(input.shared_lock_atomic_append) || upper(input.shared_lock_creation_mode)==='ATOMIC_APPEND';
  if(!atomic) reasons.push('SHARED_LOCK_NON_ATOMIC_APPEND');
  if(num(input.shared_lock_count)!==1) reasons.push('SHARED_LOCK_COUNT_NOT_ONE');
  if(!bool(input.shared_lock_owned)) reasons.push('SHARED_LOCK_NOT_OWNED');
  if(!bool(input.shared_lock_identity_proven)) reasons.push('SHARED_LOCK_IDENTITY_NOT_PROVEN');
  if(num(input.own_role_lock_count)!==1) reasons.push('OWN_ROLE_LOCK_COUNT_NOT_ONE');
  if(!bool(input.own_role_lock_owned)) reasons.push('OWN_ROLE_LOCK_NOT_OWNED');
  if(bool(input.other_role_active_after_acquire)) reasons.push('CROSS_ROLE_ACTIVE_CONFLICT');
  if(bool(input.protected_write_before_shared_gate)) reasons.push('PROTECTED_WRITE_BEFORE_SHARED_GATE');
  return resultFromReasons(reasons);
}

function protectedWriteGate(input={}){
  const shared=sharedWriterGate(input.shared || {});
  const record=recordIdentityGate(input.record || {});
  const reasons=[...shared.reasons,...record.reasons];
  const combined=resultFromReasons(reasons);
  return Object.assign(combined,{shared,record});
}

function concurrencyDecision(input={}){
  const scanner=sharedWriterGate(input.scanner || {});
  const verifier=sharedWriterGate(input.verifier || {});
  const admitted=[];
  if(scanner.accepted) admitted.push('SCANNER');
  if(verifier.accepted) admitted.push('VERIFIER');
  const safe=admitted.length<=1;
  return {
    safe,
    status:safe?'SERIALIZED':'DUAL_WRITER_DENY',
    admitted,
    scanner,
    verifier
  };
}

module.exports={
  FAILURE_SEVERITY,
  failureSeverity,
  recordIdentityGate,
  sharedWriterGate,
  protectedWriteGate,
  concurrencyDecision
};
