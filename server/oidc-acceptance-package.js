'use strict';

const EXPECTED_PROJECT_ID='prj_snbAmpya7YGmOuMbv1o8T16ouxl6';
const EXPECTED_TEAM_ID='team_uaeOdVIjXMSW690ZM2wPuJyt';
const EXPECTED_PROJECT_NAME='kk-phone-rental-vercel';

function text(v){return String(v==null?'':v).trim();}
function bool(v){return v===true||v===false?v:null;}

function prepareOidcAcceptancePackage(input={}){
  const blockers=[];
  const mainSha=text(input.current_main_sha);
  const source=input.source_deployment||{};
  const repo=input.repository_gates||{};
  const baseline=input.production_readiness||{};

  if(!/^[0-9a-f]{40}$/i.test(mainSha)) blockers.push('CURRENT_MAIN_SHA_INVALID');
  if(text(input.project_id)!==EXPECTED_PROJECT_ID) blockers.push('PROJECT_ID_MISMATCH');
  if(text(input.team_id)!==EXPECTED_TEAM_ID) blockers.push('TEAM_ID_MISMATCH');
  if(text(input.project_name)!==EXPECTED_PROJECT_NAME) blockers.push('PROJECT_NAME_MISMATCH');

  if(bool(repo.persistence_auditor_merged)!==true) blockers.push('PERSISTENCE_AUDITOR_NOT_MERGED');
  if(bool(repo.transition_gate_merged)!==true) blockers.push('TRANSITION_GATE_NOT_MERGED');
  if(bool(repo.readiness_pack_merged)!==true) blockers.push('READINESS_PACK_NOT_MERGED');
  if(bool(repo.main_ci_pass)!==true) blockers.push('CURRENT_MAIN_CI_NOT_PASS');

  if(!text(source.id)) blockers.push('SOURCE_DEPLOYMENT_ID_MISSING');
  if(text(source.state).toUpperCase()!=='READY') blockers.push('SOURCE_DEPLOYMENT_NOT_READY');
  if(text(source.target).toLowerCase()!=='production') blockers.push('SOURCE_DEPLOYMENT_NOT_PRODUCTION');
  if(text(source.github_commit_ref)!=='main') blockers.push('SOURCE_DEPLOYMENT_NOT_MAIN');
  if(mainSha && text(source.github_commit_sha)!==mainSha) blockers.push('SOURCE_DEPLOYMENT_SHA_MISMATCH');

  if(bool(baseline.external_scanner_enabled)!==false) blockers.push('EXTERNAL_SCANNER_BASELINE_NOT_OFF');
  if(bool(baseline.runtime_ledger_oidc_probe_enabled)!==false) blockers.push('OIDC_PROBE_BASELINE_NOT_OFF');
  if(bool(baseline.scanner_execution_capable)!==false) blockers.push('SCANNER_EXECUTION_BASELINE_NOT_FALSE');
  if(bool(baseline.business_writes_capable)!==false) blockers.push('BUSINESS_WRITES_BASELINE_NOT_FALSE');

  const ready=blockers.length===0;
  return {
    generated_by:'oidc-acceptance-package-v2',
    project_id:EXPECTED_PROJECT_ID,
    team_id:EXPECTED_TEAM_ID,
    project_name:EXPECTED_PROJECT_NAME,
    current_main_sha:mainSha||null,
    source_deployment_id:text(source.id)||null,
    ready_to_execute:ready,
    classification:ready?'OIDC_ACCEPTANCE_PACKAGE_READY':'OIDC_ACCEPTANCE_PACKAGE_BLOCKED',
    blockers,
    execution_contract:{
      command_template:ready
        ?`node scripts/accept-oidc-production.js --source-deployment ${text(source.id)} --expected-sha ${mainSha}`
        :null,
      allowed_mutations:[
        'KK_RUNTIME_LEDGER_OIDC_PROBE_ENABLED=true',
        'PRODUCTION_REDEPLOY_EXACT_SOURCE',
        'ONE_BOUNDED_READ_ONLY_OIDC_PROBE',
        'KK_RUNTIME_LEDGER_OIDC_PROBE_ENABLED=false',
        'PRODUCTION_REDEPLOY_EXACT_SOURCE_ROLLBACK'
      ],
      prohibited_mutations:[
        'EXTERNAL_SCANNER_ENABLE',
        'SCANNER_EXECUTION',
        'BUSINESS_WRITE',
        'MACHINE_SOT_WRITE',
        'TASK_MUTATION',
        'HF_ACTIVATION'
      ]
    },
    required_success:{
      result:'PASS_AND_ROLLED_BACK',
      probe:{
        authenticated:true,
        read_only:true,
        bounded_limit:1,
        business_writes:0
      },
      rollback:{
        ok:true,
        external_scanner_enabled:false,
        oidc_probe_enabled:false,
        scanner_execution_capable:false,
        business_writes_capable:false
      }
    },
    production_cutover_authorized:false,
    witness_enable_authorized:false,
    scanner_execution_authorized:false,
    business_writes_authorized:false
  };
}

module.exports={
  EXPECTED_PROJECT_ID,
  EXPECTED_TEAM_ID,
  EXPECTED_PROJECT_NAME,
  prepareOidcAcceptancePackage
};
