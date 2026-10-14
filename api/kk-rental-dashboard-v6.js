'use strict';

// KK Phone Rental — Rental Analytics v6 / Phase 2C.1
// Private CRM analytics require freshness plus live reconciliation for every
// CRM dataset consumed by the private runtime path. Any mismatch falls back
// to Core unless strict private-only acceptance is enabled.
const v5Handler=require('../server/legacy/kk-rental-dashboard-v5');
const legacyHandler=require('../server/rental-dashboard-core.js');
const privateSheets=require('./lib/private-google-sheets');
const crmFreshness=require('./lib/crm-freshness');
const crmReconciliation=require('./lib/crm-reconciliation');
const CorePrivacy=require('../server/core-sheet-private-reader.js');
const AdminSecurity=require('../server/admin-session.js');

const DEFAULT_CRM_SHEET_ID='1mmXkDAk3NJtyWqp7qC8ByQyEgKsTY5IO1ca9xLQijaU';
const DEFAULT_CORE_SHEET_ID='12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU';
const RUNTIME_DATASETS={
  rental_dashboard_data:{sheet:'_Rental_Dashboard_Data',range:'A1:O',privateRange:'_Rental_Dashboard_Data!A1:O',requireData:true},
  event_archive:{sheet:'13_Event_Archive',range:'A1:Z',privateRange:'13_Event_Archive!A1:Z',requireData:false}
};

function json(res,status,body){
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, max-age=0');
  res.end(JSON.stringify(body||{}));
}
function auth(req){
  if(AdminSecurity.isAuthorizedRequest(req)) return {ok:true};
  const expected=String(process.env.KK_ADMIN_PIN||'').trim();
  const provided=String((req.headers&&req.headers['x-admin-pin'])||'').trim();
  if(!expected) return {ok:false,status:500,error:'KK_ADMIN_PIN is not configured'};
  if(provided!==expected) return {ok:false,status:401,error:'Invalid admin PIN'};
  return {ok:true};
}
function captureLegacy(req){
  return new Promise(async(resolve,reject)=>{
    const headers={};
    const fake={statusCode:200,setHeader:(k,v)=>{headers[String(k).toLowerCase()]=v;},end:(body)=>resolve({status:fake.statusCode,headers,body:String(body||'')})};
    try{await legacyHandler(req,fake);}catch(err){reject(err);}
  });
}
function safeDatasetDiagnostics(reconciliation){
  if(!reconciliation || !reconciliation.datasets) return null;
  const out={};
  for(const [name,d] of Object.entries(reconciliation.datasets)){
    out[name]={code:d.code,core_row_count:d.core_row_count,crm_row_count:d.crm_row_count,core_hash:d.core_hash,crm_hash:d.crm_hash};
  }
  return out;
}
async function coreFallback(req,res,reason,freshness,reconciliation){
  const legacy=await captureLegacy(req);
  let body={};
  try{body=JSON.parse(legacy.body||'{}');}
  catch(_){return json(res,legacy.status||500,{ok:false,error:'Invalid legacy analytics response'});}
  if(body&&body.ok&&body.data){
    body.data.data_source={
      mode:'core_fallback',
      private_reader:false,
      fallback_reason:reason||'CRM_PRIVATE_READ_NOT_READY',
      core_sheet_id:String(process.env.GOOGLE_SHEET_ID||DEFAULT_CORE_SHEET_ID).trim(),
      crm_sheet_id:String(process.env.KK_CRM_SHEET_ID||DEFAULT_CRM_SHEET_ID).trim(),
      crm_freshness:freshness?{
        code:freshness.code,
        last_synced_at:freshness.last_synced_at,
        age_minutes:freshness.age_minutes,
        max_age_minutes:freshness.max_age_minutes
      }:null,
      crm_reconciliation:reconciliation?{
        code:reconciliation.code,
        failed_dataset:reconciliation.failed_dataset||'',
        datasets:safeDatasetDiagnostics(reconciliation)
      }:null
    };
  }
  return json(res,legacy.status||200,body);
}
function strictPrivate(){return String(process.env.KK_CRM_REQUIRE_PRIVATE||'').trim()==='1';}

async function reconcileRuntimeDatasets({coreSheetId,crmSheetId,env}){
  const entries=Object.entries(RUNTIME_DATASETS);
  const reads=[];
  for(const [,cfg] of entries){
    reads.push(CorePrivacy.enabled(env)
      ? CorePrivacy.readValues({sheetId:coreSheetId,sheet:cfg.sheet,range:cfg.range,env})
      : crmReconciliation.fetchPublicValues({sheetId:coreSheetId,sheet:cfg.sheet,range:cfg.range}));
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
  if(!AdminSecurity.authorizeApi(req,res)) return;
  if(req.method==='OPTIONS') return json(res,204,{});
  if(req.method!=='POST') return json(res,405,{ok:false,error:'Method not allowed'});
  const a=auth(req); if(!a.ok) return json(res,a.status,{ok:false,error:a.error});

  const crmSheetId=String(process.env.KK_CRM_SHEET_ID||DEFAULT_CRM_SHEET_ID).trim();
  const coreSheetId=String(process.env.GOOGLE_SHEET_ID||DEFAULT_CORE_SHEET_ID).trim();
  const env=Object.assign({},process.env,{KK_CRM_SHEET_ID:crmSheetId});
  const cfg=privateSheets.configState(CorePrivacy.enabled(env)?Object.assign({},env,{GOOGLE_SHEET_ID:''}):env);
  if(!cfg.configured) return coreFallback(req,res,'CRM_READER_NOT_CONFIGURED',null,null);

  const maxAgeMin=crmFreshness.maxAgeMinutes(env);
  let freshness=null;
  try{
    const manifestValues=await privateSheets.readValues({sheetId:crmSheetId,range:'00_Data_Source_Manifest!A1:D30',env});
    freshness=crmFreshness.assessManifest(manifestValues,{maxAgeMin});
    if(!freshness.fresh){
      if(strictPrivate()) return json(res,503,{ok:false,error:'CRM read model is not fresh enough for private-only mode',error_code:freshness.code});
      return coreFallback(req,res,freshness.code,freshness,null);
    }
  }catch(err){
    const code=String((err&&err.code)||'CRM_MANIFEST_READ_FAILED');
    if(strictPrivate()) return json(res,503,{ok:false,error:'CRM freshness check failed',error_code:code});
    return coreFallback(req,res,code,null,null);
  }

  try{
    const reconciliation=await reconcileRuntimeDatasets({coreSheetId,crmSheetId,env});
    if(!reconciliation.ok){
      if(strictPrivate()){
        return json(res,503,{ok:false,error:'CRM read model failed Core reconciliation',error_code:reconciliation.code,failed_dataset:reconciliation.failed_dataset,datasets:safeDatasetDiagnostics(reconciliation)});
      }
      return coreFallback(req,res,reconciliation.code,freshness,reconciliation);
    }
    return v5Handler(req,res);
  }catch(err){
    const code=String((err&&err.code)||'CRM_RECONCILIATION_UNAVAILABLE');
    if(strictPrivate()) return json(res,503,{ok:false,error:'CRM reconciliation check failed',error_code:code});
    return coreFallback(req,res,code,freshness,null);
  }
};

module.exports._test={auth,coreFallback,strictPrivate,reconcileRuntimeDatasets,RUNTIME_DATASETS};