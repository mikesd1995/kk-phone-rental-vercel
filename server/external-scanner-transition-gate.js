'use strict';

const BASELINE_POLICY_VERSION='v4.9.19';
const CANONICAL_SCANNER_ID='6aacec5fa7f48191b439dbe2308b69cf';
const CANONICAL_LEDGER_PROJECT_REF='zehlsagzrpromtfqqflt';
const CANONICAL_SCANNER_CADENCE='HOURLY_TOP_OF_HOUR';
const CANONICAL_TIMEZONE='Asia/Bangkok';
const NEXT_POLICY_LABEL='v4.9.20 EXTERNAL SCANNER WITNESS TRANSITION';

function text(value){
  return String(value==null?'':value).trim();
}

function bool(value){
  return value===true || value===false ? value : null;
}

function nonNegativeInt(value){
  const n=Number(value);
  return Number.isInteger(n) && n>=0 ? n : null;
}

function canonicalScannerCadence(value){
  const raw=text(value);
  if(!raw) return false;
  const lines=raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  let rruleLine=lines.find(line=>line.startsWith('RRULE:')) || (raw.startsWith('RRULE:')?raw:'');
  if(!rruleLine) return false;
  const spec=rruleLine.slice('RRULE:'.length);
  const fields={};
  for(const piece of spec.split(';')){
    const idx=piece.indexOf('=');
    if(idx<=0) return false;
    const key=piece.slice(0,idx).trim().toUpperCase();
    const val=piece.slice(idx+1).trim().toUpperCase();
    if(!key || !val || Object.prototype.hasOwnProperty.call(fields,key)) return false;
    fields[key]=val;
  }
  if(fields.FREQ!=='HOURLY') return false;
  if(fields.BYMINUTE!=='0') return false;
  if(fields.BYSECOND!==undefined && fields.BYSECOND!=='0') return false;
  if(fields.INTERVAL!==undefined && fields.INTERVAL!=='1') return false;
  const allowed=new Set(['FREQ','BYMINUTE','BYSECOND','INTERVAL']);
  if(Object.keys(fields).some(key=>!allowed.has(key))) return false;
  return true;
}

function allZeroLedgerRows(ledger={}){
  const fields=['expectations','observations','task_state_events','incidents'];
  const counts={};
  for(const field of fields){
    counts[field]=nonNegativeInt(ledger[field]);
  }
  return {
    ok:fields.every(field=>counts[field]===0),
    counts
  };
}

function evaluateTransitionPreflight(snapshot={}){
  const blockers=[];
  const policy=snapshot.active_policy||{};
  const scanner=snapshot.native_scanner||{};
  const readiness=snapshot.production_readiness||{};
  const oidc=snapshot.oidc_acceptance||{};
  const ledger=snapshot.runtime_ledger||{};
  const controls=snapshot.controls||{};

  if(Number(policy.count)!==1){
    blockers.push('ACTIVE_POLICY_NOT_EXACT1');
  }
  if(text(policy.version)!==BASELINE_POLICY_VERSION){
    blockers.push('BASELINE_POLICY_NOT_V419');
  }

  if(text(scanner.task_id)!==CANONICAL_SCANNER_ID){
    blockers.push('CANONICAL_SCANNER_ID_MISMATCH');
  }
  if(bool(scanner.enabled)!==false){
    blockers.push('NATIVE_SCANNER_NOT_EXPLICITLY_OFF');
  }
  if(!canonicalScannerCadence(scanner.cadence)){
    blockers.push('NATIVE_SCANNER_CADENCE_DRIFT');
  }
  if(text(scanner.timezone)!==CANONICAL_TIMEZONE){
    blockers.push('NATIVE_SCANNER_TIMEZONE_DRIFT');
  }

  if(bool(readiness.external_scanner_enabled)!==false){
    blockers.push('EXTERNAL_SCANNER_BASELINE_NOT_OFF');
  }
  if(bool(readiness.scanner_execution_capable)!==false){
    blockers.push('SCANNER_EXECUTION_CAPABILITY_MUST_REMAIN_FALSE');
  }
  if(bool(readiness.business_writes_capable)!==false){
    blockers.push('BUSINESS_WRITES_CAPABILITY_MUST_REMAIN_FALSE');
  }
  if(bool(readiness.runtime_ledger_oidc_probe_enabled)!==false){
    blockers.push('OIDC_PROBE_FLAG_BASELINE_NOT_ROLLED_BACK');
  }

  if(text(oidc.result)!=='PASS_AND_ROLLED_BACK'){
    blockers.push('OIDC_PRODUCTION_ACCEPTANCE_NOT_PROVEN');
  }else{
    const probe=oidc.probe||{};
    const rollback=oidc.rollback||{};
    if(
      bool(probe.authenticated)!==true ||
      bool(probe.read_only)!==true ||
      Number(probe.bounded_limit)!==1 ||
      Number(probe.business_writes)!==0
    ){
      blockers.push('OIDC_PROBE_CONTRACT_NOT_EXACT');
    }
    if(
      bool(rollback.ok)!==true ||
      bool(rollback.external_scanner_enabled)!==false ||
      bool(rollback.oidc_probe_enabled)!==false ||
      bool(rollback.scanner_execution_capable)!==false ||
      bool(rollback.business_writes_capable)!==false
    ){
      blockers.push('OIDC_ROLLBACK_NOT_PROVEN_FAIL_CLOSED');
    }
  }

  if(text(ledger.project_ref)!==CANONICAL_LEDGER_PROJECT_REF){
    blockers.push('RUNTIME_LEDGER_PROJECT_REF_MISMATCH');
  }
  if(text(ledger.project_status)!=='ACTIVE_HEALTHY'){
    blockers.push('RUNTIME_LEDGER_PROJECT_NOT_HEALTHY');
  }
  if(bool(ledger.edge_function_active)!==true){
    blockers.push('OIDC_EDGE_FUNCTION_NOT_ACTIVE');
  }
  if(bool(ledger.edge_source_matches_repo)!==true){
    blockers.push('OIDC_EDGE_SOURCE_DRIFT');
  }
  const ledgerRows=allZeroLedgerRows(ledger);
  if(!ledgerRows.ok){
    blockers.push('PRE_WITNESS_LEDGER_NOT_CLEAN');
  }

  if(nonNegativeInt(controls.new_native_scanner_tasks)!==0){
    blockers.push('NEW_NATIVE_SCANNER_TASK_PRESENT_OR_UNKNOWN');
  }
  if(bool(controls.watchdog_present)!==false){
    blockers.push('WATCHDOG_PRESENT_OR_UNKNOWN');
  }
  if(bool(controls.hf_production_enabled)!==false){
    blockers.push('HF_PRODUCTION_MUST_REMAIN_OFF');
  }
  if(nonNegativeInt(controls.machine_sot_mutations)!==0){
    blockers.push('MACHINE_SOT_MUTATION_PRESENT_OR_UNKNOWN');
  }
  if(nonNegativeInt(controls.business_writes)!==0){
    blockers.push('BUSINESS_WRITE_PRESENT_OR_UNKNOWN');
  }

  const candidateReady=blockers.length===0;
  return {
    generated_by:'external-scanner-transition-gate-v1',
    baseline_policy_version:BASELINE_POLICY_VERSION,
    canonical_scanner_id:CANONICAL_SCANNER_ID,
    canonical_runtime_ledger_project_ref:CANONICAL_LEDGER_PROJECT_REF,
    next_policy_label:NEXT_POLICY_LABEL,
    candidate_ready:candidateReady,
    classification:candidateReady
      ?'WITNESS_TRANSITION_POLICY_CANDIDATE_READY'
      :'WITNESS_TRANSITION_POLICY_CANDIDATE_BLOCKED',
    blockers,
    ledger_rows:ledgerRows.counts,
    explicit_machine_sot_policy_change_required:true,
    witness_configuration_transition_authorized:false,
    scanner_runtime_execution_authorized:false,
    business_writes_authorized:false,
    hf_production_activation_authorized:false,
    production_cutover_authorized:false
  };
}

module.exports={
  BASELINE_POLICY_VERSION,
  CANONICAL_SCANNER_ID,
  CANONICAL_LEDGER_PROJECT_REF,
  CANONICAL_SCANNER_CADENCE,
  CANONICAL_TIMEZONE,
  canonicalScannerCadence,
  NEXT_POLICY_LABEL,
  evaluateTransitionPreflight
};
