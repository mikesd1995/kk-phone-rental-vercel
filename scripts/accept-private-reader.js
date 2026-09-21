#!/usr/bin/env node
'use strict';

const privateSheets=require('../api/lib/private-google-sheets');
const crmFreshness=require('../api/lib/crm-freshness');
const crmReconciliation=require('../api/lib/crm-reconciliation');

const DEFAULT_CORE_SHEET_ID='12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU';
const DEFAULT_CRM_SHEET_ID='1mmXkDAk3NJtyWqp7qC8ByQyEgKsTY5IO1ca9xLQijaU';

const DATASETS=[
  {name:'00_Rental_Dashboard',range:'A1:Z1000',requireData:true},
  {name:'_Rental_Dashboard_Data',range:'A1:Z1000',requireData:true},
  {name:'11_Customer_Stats',range:'A1:Z1000',requireData:false},
  {name:'12_Booking_Archive',range:'A1:Z1000',requireData:false},
  {name:'13_Event_Archive',range:'A1:Z1000',requireData:false},
  {name:'14_Event_Override_Archive',range:'A1:Z1000',requireData:false},
  {name:'15_Admin_Audit_Log',range:'A1:Z1000',requireData:false},
  {name:'16_Admin_Error_Log',range:'A1:Z1000',requireData:false}
];

function text(v){return String(v==null?'':v).trim();}
function datasetSet(value){
  return text(value).split(';').map(text).filter(Boolean).sort();
}
function sameStringSet(a,b){
  return JSON.stringify([...a].sort())===JSON.stringify([...b].sort());
}
function safeDatasetEvidence(result){
  return {
    ok:!!result.ok,
    code:text(result.code),
    core_row_count:Number(result.core_row_count||0),
    crm_row_count:Number(result.crm_row_count||0),
    core_hash:text(result.core_hash),
    crm_hash:text(result.crm_hash)
  };
}
function exitCodeFor(result){
  if(result==='PASS_PRIVATE_READER_RECONCILED') return 0;
  if(result==='BLOCKED_READER_NOT_CONFIGURED') return 78;
  if(result==='BLOCKED_SYNC_NOT_FRESH') return 2;
  if(result==='BLOCKED_MANIFEST_ID_MISMATCH') return 3;
  if(result==='BLOCKED_SYNC_COVERAGE_MISMATCH') return 4;
  if(result==='BLOCKED_RECONCILIATION') return 5;
  return 6;
}

async function runAcceptance({
  env=process.env,
  privateSheetsImpl=privateSheets,
  freshnessImpl=crmFreshness,
  reconciliationImpl=crmReconciliation,
  nowMs=Date.now()
}={}){
  const crmSheetId=text(env.KK_CRM_SHEET_ID)||DEFAULT_CRM_SHEET_ID;
  const coreSheetId=text(env.GOOGLE_SHEET_ID)||DEFAULT_CORE_SHEET_ID;
  const scopedEnv=Object.assign({},env,{KK_CRM_SHEET_ID:crmSheetId,GOOGLE_SHEET_ID:coreSheetId});
  const cfg=privateSheetsImpl.configState(scopedEnv);

  const evidence={
    schema:'KK_PRIVATE_READER_ACCEPTANCE_V1',
    mode:'READ_ONLY',
    core_sheet_id:coreSheetId,
    crm_sheet_id:crmSheetId,
    reader_configured:!!cfg.configured,
    auth_mode:text(cfg.authMode)||'none',
    required_scope:'spreadsheets.readonly',
    expected_dataset_count:DATASETS.length,
    network_reads:0,
    writes:0,
    result:'NOT_RUN'
  };

  if(!cfg.configured){
    evidence.result='BLOCKED_READER_NOT_CONFIGURED';
    return evidence;
  }

  try{
    const manifestValues=await privateSheetsImpl.readValues({
      sheetId:crmSheetId,
      range:'00_Data_Source_Manifest!A1:D40',
      env:scopedEnv
    });
    evidence.network_reads+=1;

    const maxAgeMin=freshnessImpl.maxAgeMinutes(scopedEnv);
    const freshness=freshnessImpl.assessManifest(manifestValues,{nowMs,maxAgeMin});
    const manifest=freshness.manifest||{};
    const manifestCore=text(manifest.core_sheet_id&&manifest.core_sheet_id.value);
    const manifestSecondary=text(manifest.secondary_sheet_id&&manifest.secondary_sheet_id.value);
    const manifestCoverage=datasetSet(manifest.sync_coverage&&manifest.sync_coverage.value);
    const expectedCoverage=DATASETS.map(x=>x.name).sort();

    evidence.manifest={
      architecture_version:text(manifest.architecture_version&&manifest.architecture_version.value),
      core_id_match:manifestCore===coreSheetId,
      crm_id_match:manifestSecondary===crmSheetId,
      coverage_match:sameStringSet(manifestCoverage,expectedCoverage),
      sync_status:text(freshness.code),
      sync_state:text(freshness.sync_state),
      last_synced_at:text(freshness.last_synced_at),
      sync_age_minutes:freshness.age_minutes,
      max_staleness_minutes:maxAgeMin,
      fresh:!!freshness.fresh
    };

    if(!evidence.manifest.core_id_match||!evidence.manifest.crm_id_match){
      evidence.result='BLOCKED_MANIFEST_ID_MISMATCH';
      return evidence;
    }
    if(!evidence.manifest.coverage_match){
      evidence.result='BLOCKED_SYNC_COVERAGE_MISMATCH';
      return evidence;
    }
    if(!freshness.fresh){
      evidence.result='BLOCKED_SYNC_NOT_FRESH';
      return evidence;
    }

    const named={};
    for(const dataset of DATASETS){
      const [coreValues,crmValues]=await Promise.all([
        reconciliationImpl.fetchPublicValues({
          sheetId:coreSheetId,
          sheet:dataset.name,
          range:dataset.range
        }),
        privateSheetsImpl.readValues({
          sheetId:crmSheetId,
          range:`${dataset.name}!${dataset.range}`,
          env:scopedEnv
        })
      ]);
      evidence.network_reads+=2;
      named[dataset.name]=reconciliationImpl.compare(coreValues,crmValues,{requireData:dataset.requireData});
    }

    const combined=reconciliationImpl.combine(named);
    evidence.reconciliation={
      ok:!!combined.ok,
      code:text(combined.code),
      failed_dataset:text(combined.failed_dataset),
      dataset_count:Object.keys(combined.datasets||{}).length,
      datasets:Object.fromEntries(
        Object.entries(combined.datasets||{}).map(([name,result])=>[name,safeDatasetEvidence(result)])
      )
    };

    evidence.result=combined.ok && evidence.reconciliation.dataset_count===DATASETS.length
      ? 'PASS_PRIVATE_READER_RECONCILED'
      : 'BLOCKED_RECONCILIATION';
    return evidence;
  }catch(err){
    evidence.error_code=text(err&&err.code)||'PRIVATE_READER_ACCEPTANCE_FAILED';
    evidence.result='BLOCKED_PRIVATE_READ_ERROR';
    return evidence;
  }
}

async function main(){
  const evidence=await runAcceptance();
  process.stdout.write(JSON.stringify(evidence,null,2)+'\n');
  process.exitCode=exitCodeFor(evidence.result);
}

if(require.main===module){
  main().catch(err=>{
    process.stdout.write(JSON.stringify({
      schema:'KK_PRIVATE_READER_ACCEPTANCE_V1',
      mode:'READ_ONLY',
      writes:0,
      result:'BLOCKED_PRIVATE_READ_ERROR',
      error_code:text(err&&err.code)||'PRIVATE_READER_ACCEPTANCE_FAILED'
    },null,2)+'\n');
    process.exitCode=6;
  });
}

module.exports={
  DEFAULT_CORE_SHEET_ID,
  DEFAULT_CRM_SHEET_ID,
  DATASETS,
  datasetSet,
  sameStringSet,
  safeDatasetEvidence,
  exitCodeFor,
  runAcceptance
};
