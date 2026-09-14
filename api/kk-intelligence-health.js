'use strict';

const privateSheets = require('./lib/private-google-sheets');

const DEFAULT_CRM_SHEET_ID = '1mmXkDAk3NJtyWqp7qC8ByQyEgKsTY5IO1ca9xLQijaU';
const DEFAULT_CORE_SHEET_ID = '12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU';

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

function manifestMap(values){
  const out={};
  for(const row of (values||[]).slice(1)){
    const key=String((row&&row[0])||'').trim();
    if(!key) continue;
    out[key]={value:String(row[1]||''),status:String(row[2]||''),note:String(row[3]||'')};
  }
  return out;
}

module.exports=async function handler(req,res){
  if(req.method==='OPTIONS') return json(res,204,{});
  if(req.method!=='POST') return json(res,405,{ok:false,error:'Method not allowed'});
  const a=auth(req); if(!a.ok) return json(res,a.status,{ok:false,error:a.error});

  const crmSheetId=String(process.env.KK_CRM_SHEET_ID||DEFAULT_CRM_SHEET_ID).trim();
  const coreSheetId=String(process.env.GOOGLE_SHEET_ID||DEFAULT_CORE_SHEET_ID).trim();
  const env=Object.assign({},process.env,{KK_CRM_SHEET_ID:crmSheetId});
  const cfg=privateSheets.configState(env);
  const base={
    core_sheet_id:coreSheetId,
    crm_sheet_id:crmSheetId,
    reader_configured:cfg.configured,
    auth_mode:cfg.authMode,
    runtime_cutover:false
  };

  if(!cfg.configured){
    return json(res,200,{ok:true,data:Object.assign(base,{
      status:'PENDING_SECURE_READER',
      core_status:'ACTIVE_SOT',
      crm_status:'SHADOW_PRIVATE',
      suggestion:'Configure a read-only Google service account and share only the CRM/Intelligence sheet with that service account. Do not make the CRM sheet public.'
    })});
  }

  const started=Date.now();
  try{
    const [manifestValues,kpiValues]=await Promise.all([
      privateSheets.readValues({sheetId:crmSheetId,range:'00_Data_Source_Manifest!A1:D25',env}),
      privateSheets.readValues({sheetId:crmSheetId,range:'00_Rental_Dashboard!B4:B4',env})
    ]);
    const manifest=manifestMap(manifestValues);
    const manifestSecondary=manifest.secondary_sheet_id && manifest.secondary_sheet_id.value;
    const manifestCore=manifest.core_sheet_id && manifest.core_sheet_id.value;
    const idMatch=(manifestSecondary===crmSheetId && manifestCore===coreSheetId);
    return json(res,200,{ok:true,data:Object.assign(base,{
      status:idMatch?'READY_PRIVATE_READ':'CHECK_MANIFEST',
      core_status:'ACTIVE_SOT',
      crm_status:'PRIVATE_READ_OK',
      runtime_cutover:false,
      latency_ms:Date.now()-started,
      manifest_id_match:idMatch,
      manifest_architecture:(manifest.architecture_version&&manifest.architecture_version.value)||'',
      manifest_runtime_cutover:(manifest.runtime_cutover&&manifest.runtime_cutover.value)||'',
      snapshot_kpi_unique_customers:String((kpiValues[0]&&kpiValues[0][0])||'')
    })});
  }catch(err){
    const code=String((err&&err.code)||'CRM_PRIVATE_READ_FAILED');
    return json(res,200,{ok:true,data:Object.assign(base,{
      status:'PRIVATE_READER_DEGRADED',
      core_status:'ACTIVE_SOT',
      crm_status:'READ_FAILED',
      runtime_cutover:false,
      latency_ms:Date.now()-started,
      error_code:code,
      suggestion:'Keep Core-only runtime. Verify service-account access to the private CRM sheet; do not open the sheet publicly.'
    })});
  }
};
