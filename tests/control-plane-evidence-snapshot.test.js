'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const B=require('../server/control-plane-evidence-snapshot.js');

function input(){
  return {
    policy_versions:[
      {rule_id:'POLICY_VERSION',rule_value:'v4.9.18 VERIFIER BINARY ISOLATION',policy_version:'v4.9.18',active:false,row_number:316},
      {rule_id:'POLICY_VERSION',rule_value:'v4.9.19 CANONICAL MINIMAL LAUNCHER',policy_version:'v4.9.19',active:true,row_number:320}
    ],
    task_registry:[
      {
        id:B.CANONICAL_SCANNER_ID,
        title:'KK Discovery Scanner — Current Policy',
        schedule:'BEGIN:VEVENT\nRRULE:FREQ=HOURLY;BYMINUTE=0;BYSECOND=0\nEND:VEVENT',
        default_timezone:'Asia/Bangkok',
        is_enabled:false,
        prompt:'scanner live prompt',
        updated_at:'2026-09-18T13:03:52Z'
      },
      {
        id:B.CANONICAL_VERIFIER_ID,
        title:'KK GPT Verifier — Current Policy',
        schedule:'BEGIN:VEVENT\nRRULE:FREQ=HOURLY;BYMINUTE=30;BYSECOND=0\nEND:VEVENT',
        default_timezone:'Asia/Bangkok',
        is_enabled:false,
        prompt:'verifier live prompt',
        updated_at:'2026-09-18T15:35:48Z'
      }
    ],
    production_readiness:{
      external_scanner_enabled:false,
      runtime_ledger_oidc_probe_enabled:false,
      runtime_ledger_enabled:false,
      runtime_ledger_configured:false,
      ready_for_witness:false,
      scanner_execution_capable:false,
      business_writes_capable:false
    },
    oidc_acceptance:{result:'NOT_RUN'},
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
      new_native_verifier_tasks:0,
      watchdog_present:false,
      hf_production_enabled:false,
      machine_sot_mutations:0,
      business_writes:0,
      task_mutations:0
    }
  };
}

test('builds one unified sanitized snapshot for persistence and witness transition gates',()=>{
  const r=B.buildEvidenceSnapshot(input());
  assert.equal(r.usable,true);
  assert.equal(r.authority.active_policy.exact1,true);
  assert.equal(r.authority.active_policy.version,'v4.9.19');
  assert.equal(r.authority.canonical_scanner.exact1,true);
  assert.equal(r.authority.canonical_scanner.task.enabled,false);
  assert.equal(r.authority.canonical_verifier.task.enabled,false);
  assert.equal(r.persistence_snapshot.canonical_tasks.SCANNER.task_id,B.CANONICAL_SCANNER_ID);
  assert.equal(r.witness_transition_snapshot.active_policy.count,1);
  assert.match(r.evidence_digest_sha256,/^[0-9a-f]{64}$/);
});

test('raw task prompts are fingerprinted and never emitted',()=>{
  const r=B.buildEvidenceSnapshot(input());
  const serialized=JSON.stringify(r);
  assert.equal(serialized.includes('scanner live prompt'),false);
  assert.equal(serialized.includes('verifier live prompt'),false);
  assert.match(r.authority.canonical_scanner.task.prompt_fingerprint,/^[0-9a-f]{64}$/);
  assert.match(r.authority.canonical_verifier.task.prompt_fingerprint,/^[0-9a-f]{64}$/);
});

test('multiple active policy versions fail closed',()=>{
  const s=input();
  s.policy_versions[0].active=true;
  const r=B.buildEvidenceSnapshot(s);
  assert.equal(r.usable,false);
  assert.ok(r.blockers.includes('ACTIVE_POLICY_NOT_EXACT1'));
});

test('future active policy is not silently treated as v4.9.19 baseline',()=>{
  const s=input();
  s.policy_versions[1].policy_version='v4.9.20';
  s.policy_versions[1].rule_value='v4.9.20 DRAFT';
  const r=B.buildEvidenceSnapshot(s);
  assert.equal(r.usable,false);
  assert.ok(r.blockers.includes('ACTIVE_POLICY_NOT_V419_BASELINE'));
});

test('canonical Scanner or Verifier identity ambiguity fails closed',()=>{
  const s=input();
  s.task_registry.push({...s.task_registry[0]});
  const r=B.buildEvidenceSnapshot(s);
  assert.equal(r.usable,false);
  assert.ok(r.blockers.includes('CANONICAL_SCANNER_NOT_EXACT1'));
});

test('persistence occurrence task prompts are sanitized before output',()=>{
  const s=input();
  s.persistence_occurrences=[{
    role:'SCANNER',
    scheduled_at:'2026-09-21T03:00:00+07:00',
    task_before:{...s.task_registry[0],prompt:'sensitive before prompt'},
    task_after:{...s.task_registry[0],prompt:'sensitive after prompt'}
  }];
  const r=B.buildEvidenceSnapshot(s);
  const serialized=JSON.stringify(r.persistence_snapshot);
  assert.equal(serialized.includes('sensitive before prompt'),false);
  assert.equal(serialized.includes('sensitive after prompt'),false);
  assert.match(r.persistence_snapshot.occurrences[0].task_before.prompt_fingerprint,/^[0-9a-f]{64}$/);
});

test('same normalized evidence yields stable digest',()=>{
  const a=B.buildEvidenceSnapshot(input());
  const b=B.buildEvidenceSnapshot(input());
  assert.equal(a.evidence_digest_sha256,b.evidence_digest_sha256);
});
