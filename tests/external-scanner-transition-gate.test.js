'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Gate=require('../server/external-scanner-transition-gate.js');

function base(){
  return {
    active_policy:{count:1,version:'v4.9.19'},
    native_scanner:{
      task_id:'6aacec5fa7f48191b439dbe2308b69cf',
      enabled:false,
      cadence:'RRULE:FREQ=HOURLY;BYMINUTE=0',
      timezone:'Asia/Bangkok'
    },
    production_readiness:{
      external_scanner_enabled:false,
      runtime_ledger_oidc_probe_enabled:false,
      scanner_execution_capable:false,
      business_writes_capable:false
    },
    oidc_acceptance:{
      result:'PASS_AND_ROLLED_BACK',
      probe:{
        authenticated:true,
        read_only:true,
        bounded_limit:1,
        business_writes:0,
        row_count:0
      },
      rollback:{
        ok:true,
        external_scanner_enabled:false,
        oidc_probe_enabled:false,
        scanner_execution_capable:false,
        business_writes_capable:false
      }
    },
    runtime_ledger:{
      project_ref:'zehlsagzrpromtfqqflt',
      project_status:'ACTIVE_HEALTHY',
      edge_function_active:true,
      edge_source_matches_repo:true,
      expectations:0,
      observations:0,
      task_state_events:0,
      incidents:0
    },
    controls:{
      new_native_scanner_tasks:0,
      watchdog_present:false,
      hf_production_enabled:false,
      machine_sot_mutations:0,
      business_writes:0
    }
  };
}

test('clean v4.9.19 baseline becomes only a next-policy candidate, never direct authorization',()=>{
  const r=Gate.evaluateTransitionPreflight(base());
  assert.equal(r.candidate_ready,true);
  assert.equal(r.classification,'WITNESS_TRANSITION_POLICY_CANDIDATE_READY');
  assert.equal(r.explicit_machine_sot_policy_change_required,true);
  assert.equal(r.witness_configuration_transition_authorized,false);
  assert.equal(r.scanner_runtime_execution_authorized,false);
  assert.equal(r.business_writes_authorized,false);
  assert.equal(r.hf_production_activation_authorized,false);
  assert.equal(r.production_cutover_authorized,false);
});

test('current live state without completed OIDC acceptance remains blocked',()=>{
  const s=base();
  s.oidc_acceptance={result:'NOT_RUN'};
  const r=Gate.evaluateTransitionPreflight(s);
  assert.equal(r.candidate_ready,false);
  assert.ok(r.blockers.includes('OIDC_PRODUCTION_ACCEPTANCE_NOT_PROVEN'));
});


test('OIDC bridge acceptance does not depend on static Supabase service-role configuration in Vercel',()=>{
  const s=base();
  s.production_readiness.runtime_ledger_enabled=false;
  s.production_readiness.runtime_ledger_configured=false;
  s.production_readiness.supabase_url_configured=false;
  s.production_readiness.supabase_server_key_configured=false;
  s.production_readiness.supabase_project_ref_configured=false;
  s.production_readiness.supabase_project_binding_matches=false;
  const r=Gate.evaluateTransitionPreflight(s);
  assert.equal(r.candidate_ready,true);
  assert.equal(r.classification,'WITNESS_TRANSITION_POLICY_CANDIDATE_READY');
});

test('native Scanner must remain explicitly OFF before any external witness transition',()=>{
  const s=base();
  s.native_scanner.enabled=true;
  const r=Gate.evaluateTransitionPreflight(s);
  assert.equal(r.candidate_ready,false);
  assert.ok(r.blockers.includes('NATIVE_SCANNER_NOT_EXPLICITLY_OFF'));
});

test('wrong Scanner identity or schedule fails closed',()=>{
  const s=base();
  s.native_scanner.task_id='different-task';
  s.native_scanner.cadence='RRULE:FREQ=HOURLY;BYMINUTE=5';
  s.native_scanner.timezone='UTC';
  const r=Gate.evaluateTransitionPreflight(s);
  assert.ok(r.blockers.includes('CANONICAL_SCANNER_ID_MISMATCH'));
  assert.ok(r.blockers.includes('NATIVE_SCANNER_CADENCE_DRIFT'));
  assert.ok(r.blockers.includes('NATIVE_SCANNER_TIMEZONE_DRIFT'));
});

test('OIDC probe must be exact read-only and rollback must restore fail-closed baseline',()=>{
  const s=base();
  s.oidc_acceptance.probe.business_writes=1;
  s.oidc_acceptance.rollback.oidc_probe_enabled=true;
  const r=Gate.evaluateTransitionPreflight(s);
  assert.equal(r.candidate_ready,false);
  assert.ok(r.blockers.includes('OIDC_PROBE_CONTRACT_NOT_EXACT'));
  assert.ok(r.blockers.includes('OIDC_ROLLBACK_NOT_PROVEN_FAIL_CLOSED'));
});

test('ledger project health, identity and deployed source parity are mandatory',()=>{
  const s=base();
  s.runtime_ledger.project_ref='unxangvmhjtlqmiiuurw';
  s.runtime_ledger.project_status='INACTIVE';
  s.runtime_ledger.edge_function_active=false;
  s.runtime_ledger.edge_source_matches_repo=false;
  const r=Gate.evaluateTransitionPreflight(s);
  assert.ok(r.blockers.includes('RUNTIME_LEDGER_PROJECT_REF_MISMATCH'));
  assert.ok(r.blockers.includes('RUNTIME_LEDGER_PROJECT_NOT_HEALTHY'));
  assert.ok(r.blockers.includes('OIDC_EDGE_FUNCTION_NOT_ACTIVE'));
  assert.ok(r.blockers.includes('OIDC_EDGE_SOURCE_DRIFT'));
});

test('initial witness transition requires a clean control-plane ledger baseline',()=>{
  const s=base();
  s.runtime_ledger.expectations=1;
  const r=Gate.evaluateTransitionPreflight(s);
  assert.equal(r.candidate_ready,false);
  assert.ok(r.blockers.includes('PRE_WITNESS_LEDGER_NOT_CLEAN'));
  assert.equal(r.ledger_rows.expectations,1);
});

test('watchdog, replacement native task, HF activation or business mutation block transition',()=>{
  const s=base();
  s.controls.new_native_scanner_tasks=1;
  s.controls.watchdog_present=true;
  s.controls.hf_production_enabled=true;
  s.controls.machine_sot_mutations=1;
  s.controls.business_writes=1;
  const r=Gate.evaluateTransitionPreflight(s);
  assert.ok(r.blockers.includes('NEW_NATIVE_SCANNER_TASK_PRESENT_OR_UNKNOWN'));
  assert.ok(r.blockers.includes('WATCHDOG_PRESENT_OR_UNKNOWN'));
  assert.ok(r.blockers.includes('HF_PRODUCTION_MUST_REMAIN_OFF'));
  assert.ok(r.blockers.includes('MACHINE_SOT_MUTATION_PRESENT_OR_UNKNOWN'));
  assert.ok(r.blockers.includes('BUSINESS_WRITE_PRESENT_OR_UNKNOWN'));
});

test('production baseline itself must remain incapable of Scanner execution and business writes',()=>{
  const s=base();
  s.production_readiness.external_scanner_enabled=true;
  s.production_readiness.scanner_execution_capable=true;
  s.production_readiness.business_writes_capable=true;
  s.production_readiness.runtime_ledger_oidc_probe_enabled=true;
  const r=Gate.evaluateTransitionPreflight(s);
  assert.ok(r.blockers.includes('EXTERNAL_SCANNER_BASELINE_NOT_OFF'));
  assert.ok(r.blockers.includes('SCANNER_EXECUTION_CAPABILITY_MUST_REMAIN_FALSE'));
  assert.ok(r.blockers.includes('BUSINESS_WRITES_CAPABILITY_MUST_REMAIN_FALSE'));
  assert.ok(r.blockers.includes('OIDC_PROBE_FLAG_BASELINE_NOT_ROLLED_BACK'));
});

test('policy ambiguity or a future policy version cannot be silently treated as v4.9.19 baseline evidence',()=>{
  const s=base();
  s.active_policy={count:2,version:'v4.9.20'};
  const r=Gate.evaluateTransitionPreflight(s);
  assert.ok(r.blockers.includes('ACTIVE_POLICY_NOT_EXACT1'));
  assert.ok(r.blockers.includes('BASELINE_POLICY_NOT_V419'));
});
