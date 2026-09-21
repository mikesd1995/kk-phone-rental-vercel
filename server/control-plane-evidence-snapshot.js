'use strict';

const crypto=require('node:crypto');

const CANONICAL_SCANNER_ID='6aacec5fa7f48191b439dbe2308b69cf';
const CANONICAL_VERIFIER_ID='6aacec85e5508191b26894565fbc3787';
const CANONICAL_TIMEZONE='Asia/Bangkok';

function text(v){ return String(v==null?'':v).trim(); }
function strictBool(v){ return v===true||v===false?v:null; }
function sha256(v){ return crypto.createHash('sha256').update(String(v),'utf8').digest('hex'); }

function canonicalJson(value){
  if(Array.isArray(value)) return '['+value.map(canonicalJson).join(',')+']';
  if(value&&typeof value==='object'){
    return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonicalJson(value[k])).join(',')+'}';
  }
  return JSON.stringify(value);
}

function taskFingerprint(task={}){
  const explicit=text(task.prompt_fingerprint||task.promptFingerprint||task.prompt_hash||task.promptHash);
  if(explicit) return explicit;
  if(task.prompt===undefined||task.prompt===null) return '';
  return sha256(String(task.prompt));
}

function normalizeTask(task={}){
  return {
    task_id:text(task.task_id||task.jawbone_id||task.id),
    title:text(task.title),
    cadence:text(task.cadence||task.schedule),
    timezone:text(task.timezone||task.default_timezone||task.time_zone),
    enabled:strictBool(task.enabled!==undefined?task.enabled:task.is_enabled),
    prompt_fingerprint:taskFingerprint(task),
    updated_at:text(task.updated_at)||null,
    last_run_time:text(task.last_run_time)||null
  };
}

function normalizePolicyRows(rows=[]){
  return (Array.isArray(rows)?rows:[]).map(row=>({
    rule_id:text(row.rule_id||row.ruleId||row['Rule ID']),
    rule_value:text(row.rule_value||row.ruleValue||row['Rule / Value']),
    policy_version:text(row.policy_version||row.policyVersion||row['Policy Version']),
    active:strictBool(row.active!==undefined?row.active:row.Active),
    row_number:Number.isInteger(row.row_number)?row.row_number:null
  }));
}

function activePolicyEvidence(rows=[]){
  const normalized=normalizePolicyRows(rows);
  const versions=normalized.filter(r=>r.rule_id==='POLICY_VERSION');
  const active=versions.filter(r=>r.active===true);
  return {
    policy_version_rows:versions.length,
    active_count:active.length,
    exact1:active.length===1,
    version:active.length===1?active[0].policy_version:'',
    rule_value:active.length===1?active[0].rule_value:'',
    row_number:active.length===1?active[0].row_number:null
  };
}

function exactTask(tasks,id){
  const matches=(Array.isArray(tasks)?tasks:[]).map(normalizeTask).filter(t=>t.task_id===id);
  return {
    count:matches.length,
    exact1:matches.length===1,
    task:matches.length===1?matches[0]:null
  };
}

function sanitizeReadiness(r={}){
  return {
    external_scanner_enabled:strictBool(r.external_scanner_enabled),
    runtime_ledger_oidc_probe_enabled:strictBool(r.runtime_ledger_oidc_probe_enabled),
    runtime_ledger_enabled:strictBool(r.runtime_ledger_enabled),
    runtime_ledger_configured:strictBool(r.runtime_ledger_configured),
    ready_for_witness:strictBool(r.ready_for_witness),
    scanner_execution_capable:strictBool(r.scanner_execution_capable),
    business_writes_capable:strictBool(r.business_writes_capable)
  };
}

function sanitizeOidc(a={}){
  const p=a.probe||{};
  const rb=a.rollback||{};
  return {
    result:text(a.result),
    source_deployment_id:text(a.source_deployment_id)||null,
    expected_commit_sha:text(a.expected_commit_sha)||null,
    probe:{
      authenticated:strictBool(p.authenticated),
      read_only:strictBool(p.read_only),
      bounded_limit:Number.isInteger(p.bounded_limit)?p.bounded_limit:null,
      business_writes:Number.isInteger(p.business_writes)?p.business_writes:null,
      row_count:Number.isInteger(p.row_count)?p.row_count:null
    },
    rollback:{
      ok:strictBool(rb.ok),
      external_scanner_enabled:strictBool(rb.external_scanner_enabled),
      oidc_probe_enabled:strictBool(rb.oidc_probe_enabled),
      scanner_execution_capable:strictBool(rb.scanner_execution_capable),
      business_writes_capable:strictBool(rb.business_writes_capable)
    }
  };
}

function sanitizeLedger(l={}){
  const num=k=>Number.isInteger(l[k])?l[k]:null;
  return {
    project_ref:text(l.project_ref),
    project_status:text(l.project_status),
    edge_function_active:strictBool(l.edge_function_active),
    edge_source_matches_repo:strictBool(l.edge_source_matches_repo),
    expectations:num('expectations'),
    observations:num('observations'),
    task_state_events:num('task_state_events'),
    incidents:num('incidents')
  };
}

function sanitizeControls(c={}){
  const num=k=>Number.isInteger(c[k])?c[k]:null;
  return {
    new_native_scanner_tasks:num('new_native_scanner_tasks'),
    new_native_verifier_tasks:num('new_native_verifier_tasks'),
    watchdog_present:strictBool(c.watchdog_present),
    hf_production_enabled:strictBool(c.hf_production_enabled),
    machine_sot_mutations:num('machine_sot_mutations'),
    business_writes:num('business_writes'),
    task_mutations:num('task_mutations')
  };
}

function sanitizeOccurrence(item={}){
  const out={...item};
  if(out.task_before) out.task_before=normalizeTask(out.task_before);
  if(out.task_after) out.task_after=normalizeTask(out.task_after);
  delete out.prompt;
  return out;
}

function buildEvidenceSnapshot(input={}){
  const policy=activePolicyEvidence(input.policy_versions||[]);
  const scanner=exactTask(input.task_registry||[],CANONICAL_SCANNER_ID);
  const verifier=exactTask(input.task_registry||[],CANONICAL_VERIFIER_ID);
  const readiness=sanitizeReadiness(input.production_readiness||{});
  const oidc=sanitizeOidc(input.oidc_acceptance||{});
  const ledger=sanitizeLedger(input.runtime_ledger||{});
  const controls=sanitizeControls(input.controls||{});

  const blockers=[];
  if(!policy.exact1) blockers.push('ACTIVE_POLICY_NOT_EXACT1');
  if(policy.exact1 && policy.version!=='v4.9.19') blockers.push('ACTIVE_POLICY_NOT_V419_BASELINE');
  if(!scanner.exact1) blockers.push('CANONICAL_SCANNER_NOT_EXACT1');
  if(!verifier.exact1) blockers.push('CANONICAL_VERIFIER_NOT_EXACT1');
  if(scanner.exact1 && scanner.task.timezone!==CANONICAL_TIMEZONE) blockers.push('SCANNER_TIMEZONE_DRIFT');
  if(verifier.exact1 && verifier.task.timezone!==CANONICAL_TIMEZONE) blockers.push('VERIFIER_TIMEZONE_DRIFT');

  const snapshot={
    generated_by:'control-plane-evidence-snapshot-v1',
    authority:{
      active_policy:policy,
      canonical_scanner:scanner,
      canonical_verifier:verifier
    },
    production_readiness:readiness,
    oidc_acceptance:oidc,
    runtime_ledger:ledger,
    controls,
    persistence_snapshot:{
      canonical_tasks:{
        SCANNER:scanner.task,
        VERIFIER:verifier.task
      },
      occurrences:(Array.isArray(input.persistence_occurrences)?input.persistence_occurrences:[]).map(sanitizeOccurrence)
    },
    witness_transition_snapshot:{
      active_policy:{count:policy.active_count,version:policy.version},
      native_scanner:scanner.task,
      production_readiness:readiness,
      oidc_acceptance:oidc,
      runtime_ledger:ledger,
      controls:{
        new_native_scanner_tasks:controls.new_native_scanner_tasks,
        watchdog_present:controls.watchdog_present,
        hf_production_enabled:controls.hf_production_enabled,
        machine_sot_mutations:controls.machine_sot_mutations,
        business_writes:controls.business_writes
      }
    },
    blockers,
    usable: blockers.length===0
  };

  return {
    ...snapshot,
    evidence_digest_sha256:sha256(canonicalJson(snapshot))
  };
}

module.exports={
  CANONICAL_SCANNER_ID,
  CANONICAL_VERIFIER_ID,
  CANONICAL_TIMEZONE,
  sha256,
  canonicalJson,
  taskFingerprint,
  normalizeTask,
  activePolicyEvidence,
  buildEvidenceSnapshot
};
