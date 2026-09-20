'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const P=require('../server/oidc-acceptance-package.js');

function ready(){
  const sha='d1912f9f3fa9602fc793976cd530eec479788cd2';
  return {
    current_main_sha:sha,
    project_id:P.EXPECTED_PROJECT_ID,
    team_id:P.EXPECTED_TEAM_ID,
    project_name:P.EXPECTED_PROJECT_NAME,
    repository_gates:{
      persistence_auditor_merged:true,
      transition_gate_merged:true,
      main_ci_pass:true
    },
    source_deployment:{
      id:'dpl_exact_current_main',
      state:'READY',
      target:'production',
      github_commit_ref:'main',
      github_commit_sha:sha
    },
    production_readiness:{
      external_scanner_enabled:false,
      runtime_ledger_oidc_probe_enabled:false,
      scanner_execution_capable:false,
      business_writes_capable:false
    }
  };
}

test('ready package pins exact current-main production artifact and bounded rollback contract',()=>{
  const r=P.prepareOidcAcceptancePackage(ready());
  assert.equal(r.ready_to_execute,true);
  assert.equal(r.classification,'OIDC_ACCEPTANCE_PACKAGE_READY');
  assert.match(r.execution_contract.command_template,/accept-oidc-production\.js/);
  assert.equal(r.required_success.result,'PASS_AND_ROLLED_BACK');
  assert.equal(r.required_success.probe.business_writes,0);
  assert.equal(r.required_success.rollback.oidc_probe_enabled,false);
  assert.equal(r.production_cutover_authorized,false);
  assert.equal(r.witness_enable_authorized,false);
});

test('current pre-merge state remains blocked even with healthy old production deployment',()=>{
  const s=ready();
  s.repository_gates.persistence_auditor_merged=false;
  s.repository_gates.transition_gate_merged=false;
  s.source_deployment.github_commit_sha='f88f8c0bf641b7ab0a37891f87a515477edaaa24';
  const r=P.prepareOidcAcceptancePackage(s);
  assert.equal(r.ready_to_execute,false);
  assert.ok(r.blockers.includes('PERSISTENCE_AUDITOR_NOT_MERGED'));
  assert.ok(r.blockers.includes('TRANSITION_GATE_NOT_MERGED'));
  assert.ok(r.blockers.includes('SOURCE_DEPLOYMENT_SHA_MISMATCH'));
  assert.equal(r.execution_contract.command_template,null);
});

test('preview deployment cannot substitute for exact current-main production source',()=>{
  const s=ready();
  s.source_deployment.target='preview';
  s.source_deployment.github_commit_ref='feature-branch';
  const r=P.prepareOidcAcceptancePackage(s);
  assert.equal(r.ready_to_execute,false);
  assert.ok(r.blockers.includes('SOURCE_DEPLOYMENT_NOT_PRODUCTION'));
  assert.ok(r.blockers.includes('SOURCE_DEPLOYMENT_NOT_MAIN'));
});

test('production baseline must remain fail closed before temporary OIDC probe activation',()=>{
  const s=ready();
  s.production_readiness.external_scanner_enabled=true;
  s.production_readiness.runtime_ledger_oidc_probe_enabled=true;
  s.production_readiness.scanner_execution_capable=true;
  s.production_readiness.business_writes_capable=true;
  const r=P.prepareOidcAcceptancePackage(s);
  assert.ok(r.blockers.includes('EXTERNAL_SCANNER_BASELINE_NOT_OFF'));
  assert.ok(r.blockers.includes('OIDC_PROBE_BASELINE_NOT_OFF'));
  assert.ok(r.blockers.includes('SCANNER_EXECUTION_BASELINE_NOT_FALSE'));
  assert.ok(r.blockers.includes('BUSINESS_WRITES_BASELINE_NOT_FALSE'));
});

test('wrong project or workspace identity is rejected',()=>{
  const s=ready();
  s.project_id='prj_wrong';
  s.team_id='team_wrong';
  s.project_name='other-project';
  const r=P.prepareOidcAcceptancePackage(s);
  assert.ok(r.blockers.includes('PROJECT_ID_MISMATCH'));
  assert.ok(r.blockers.includes('TEAM_ID_MISMATCH'));
  assert.ok(r.blockers.includes('PROJECT_NAME_MISMATCH'));
});
