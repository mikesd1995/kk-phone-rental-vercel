'use strict';

const privateSheets = require('./lib/private-google-sheets');
const crmFreshness = require('./lib/crm-freshness');
const crmReconciliation = require('./lib/crm-reconciliation');

const DEFAULT_CRM_SHEET_ID = '1mmXkDAk3NJtyWqp7qC8ByQyEgKsTY5IO1ca9xLQijaU';
const DEFAULT_CORE_SHEET_ID = '12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU';
const RUNTIME_DATASETS={
  rental_dashboard_data:{sheet:'_Rental_Dashboard_Data',range:'A1:O1000',privateRange:'_Rental_Dashboard_Data!A1:O1000',requireData:true},
  event_archive:{sheet:'13_Event_Archive',range:'A1:Z1000',privateRange:'13_Event_Archive!A1:Z1000',requireData:false}
};

function json(res,status,body){
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, max-age=0');
  res.end(JSON.stringify(body||{}));
}

function auth(req){
  const expected=String(process.env.KK_ADMIN_PIN||'').trim();
  const provided=String((req.headers&&req.headers['x-admin-pin'])||'').trim();
  if(!expected) return {ok:false,status:500,error:'KK_ADMIN_PIN is not configured'};
  if(provided!==expected) return {ok:false,status:401,error:'Invalid admin PIN'};
  return {ok:true};
}
function safeDatasetDiagnostics(reconciliation){
  if(!reconciliation || !reconciliation.datasets) return null;
  const out={};
  for(const [name,d] of Object.entries(reconciliation.datasets)){
    out[name]={code:d.code,core_row_count:d.core_row_count,crm_row_count:d.crm_row_count,core_hash:d.core_hash,crm_hash:d.crm_hash};
  }
  return out;
}
async function reconcileRuntimeDatasets({coreSheetId,crmSheetId,env}){
  const entries=Object.entries(RUNTIME_DATASETS);
  const reads=[];
  for(const [,cfg] of entries){
    reads.push(crmReconciliation.fetchPublicValues({sheetId:coreSheetId,sheet:cfg.sheet,range:cfg.range}));
    reads.push(privateSheets.readValues({sheetId:crmSheetId,range:cfg.privateRange,env}));
  }
  const values=await Promise.all(reads);
  const results={};
  entries.forEach(([name,cfg],i)=>{
    results[name]=crmReconciliation.compare(values[i*2],values[i*2+1],{requireData:cfg.requireData});
  });
  return crmReconciliation.combine(results);
}

module.exports=async function handler(req,res){
  if(req.method==='OPTIONS') return json(res,204,{});
  if(req.method!=='POST') return json(res,405,{ok:false,error:'Method not allowed'});
  const a=auth(req); if(!a.ok) return json(res,a.status,{ok:false,error:a.error});

  const crmSheetId=String(process.env.KK_CRM_SHEET_ID||DEFAULT_CRM_SHEET_ID).trim();
  const coreSheetId=String(process.env.GOOGLE_SHEET_ID||DEFAULT_CORE_SHEET_ID).trim();
  const env=Object.assign({},process.env,{KK_CRM_SHEET_ID:crmSheetId});
  const cfg=privateSheets.configState(env);
  const maxAgeMin=crmFreshness.maxAgeMinutes(env);
  const base={
    core_sheet_id:coreSheetId,
    crm_sheet_id:crmSheetId,
    reader_configured:cfg.configured,
    auth_mode:cfg.authMode,
    runtime_cutover:false,
    max_staleness_minutes:maxAgeMin
  };

  if(!cfg.configured){
    return json(res,200,{ok:true,data:Object.assign(base,{
      status:'PENDING_SECURE_READER',
      core_status:'ACTIVE_SOT',
      crm_status:'SHADOW_PRIVATE',
      private_analytics_eligible:false,
      reconciliation_status:'NOT_RUN_READER_PENDING',
      suggestion:'Configure a read-only Google service account and share only the CRM/Intelligence sheet with that service account. Do not make the CRM sheet public.'
    })});
  }

  const started=Date.now();
  try{
    const [manifestValues,kpiValues]=await Promise.all([
      privateSheets.readValues({sheetId:crmSheetId,range:'00_Data_Source_Manifest!A1:D30',env}),
      privateSheets.readValues({sheetId:crmSheetId,range:'00_Rental_Dashboard!B4:B4',env})
    ]);
    const freshness=crmFreshness.assessManifest(manifestValues,{maxAgeMin});
    const manifest=freshness.manifest;
    const manifestSecondary=manifest.secondary_sheet_id && manifest.secondary_sheet_id.value;
    const manifestCore=manifest.core_sheet_id && manifest.core_sheet_id.value;
    const idMatch=(manifestSecondary===crmSheetId && manifestCore===coreSheetId);

    let reconciliation=null;
    let reconciliationError='';
    if(idMatch && freshness.fresh){
      try{
        reconciliation=await reconcileRuntimeDatasets({coreSheetId,crmSheetId,env});
      }catch(err){
        reconciliationError=String((err&&err.code)||'CRM_RECONCILIATION_UNAVAILABLE');
      }
    }

    let status='CHECK_MANIFEST';
    if(idMatch && !freshness.fresh && freshness.code==='CRM_SYNC_STALE') status='CHECK_SYNC_STALE';
    else if(idMatch && !freshness.fresh) status='CHECK_SYNC_NOT_READY';
    else if(idMatch && freshness.fresh && reconciliationError) status='CHECK_RECON_UNAVAILABLE';
    else if(idMatch && freshness.fresh && reconciliation && !reconciliation.ok) status='CHECK_RECON_MISMATCH';
    else if(idMatch && freshness.fresh && reconciliation && reconciliation.ok) status='READY_PRIVATE_READ_RECONCILED';

    const eligible=!!(idMatch && freshness.fresh && reconciliation && reconciliation.ok && !reconciliationError);
    return json(res,200,{ok:true,data:Object.assign(base,{
      status,
      core_status:'ACTIVE_SOT',
      crm_status:'PRIVATE_READ_OK',
      runtime_cutover:false,
      private_analytics_eligible:eligible,
      latency_ms:Date.now()-started,
      manifest_id_match:idMatch,
      manifest_architecture:(manifest.architecture_version&&manifest.architecture_version.value)||'',
      manifest_runtime_cutover:(manifest.runtime_cutover&&manifest.runtime_cutover.value)||'',
      snapshot_kpi_unique_customers:String((kpiValues[0]&&kpiValues[0][0])||''),
      sync_status:freshness.code,
      last_synced_at:freshness.last_synced_at,
      sync_age_minutes:freshness.age_minutes,
      sync_state:freshness.sync_state,
      reconciliation_status:reconciliationError || (reconciliation&&reconciliation.code) || 'NOT_RUN_UNTIL_FRESH',
      failed_dataset:(reconciliation&&reconciliation.failed_dataset)||'',
      reconciliation_datasets:safeDatasetDiagnostics(reconciliation)
    })});
  }catch(err){
    const code=String((err&&err.code)||'CRM_PRIVATE_READ_FAILED');
    return json(res,200,{ok:true,data:Object.assign(base,{
      status:'PRIVATE_READER_DEGRADED',
      core_status:'ACTIVE_SOT',
      crm_status:'READ_FAILED',
      runtime_cutover:false,
      private_analytics_eligible:false,
      latency_ms:Date.now()-started,
      error_code:code,
      reconciliation_status:'NOT_RUN_PRIVATE_READ_FAILED',
      suggestion:'Keep Core-only runtime. Verify service-account access to the private CRM sheet; do not open the sheet publicly.'
    })});
  }
};

module.exports._test={reconcileRuntimeDatasets,RUNTIME_DATASETS};
