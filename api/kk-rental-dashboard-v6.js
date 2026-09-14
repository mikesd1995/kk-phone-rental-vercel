'use strict';

// KK Phone Rental — Rental Analytics v6
// Adds a freshness gate in front of the private CRM read model. A stale or
// incomplete CRM snapshot never silently replaces Core operational truth.
const v5Handler=require('./kk-rental-dashboard-v5');
const legacyHandler=require('./kk-rental-dashboard');
const privateSheets=require('./lib/private-google-sheets');
const crmFreshness=require('./lib/crm-freshness');

const DEFAULT_CRM_SHEET_ID='1mmXkDAk3NJtyWqp7qC8ByQyEgKsTY5IO1ca9xLQijaU';
const DEFAULT_CORE_SHEET_ID='12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU';

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
function captureLegacy(req){
  return new Promise(async(resolve,reject)=>{
    const headers={};
    const fake={statusCode:200,setHeader:(k,v)=>{headers[String(k).toLowerCase()]=v;},end:(body)=>resolve({status:fake.statusCode,headers,body:String(body||'')})};
    try{await legacyHandler(req,fake);}catch(err){reject(err);}
  });
}
async function coreFallback(req,res,reason,freshness){
  const legacy=await captureLegacy(req);
  let body={};
  try{body=JSON.parse(legacy.body||'{}');}
  catch(_){return json(res,legacy.status||500,{ok:false,error:'Invalid legacy analytics response'});}
  if(body&&body.ok&&body.data){
    body.data.data_source={
      mode:'core_fallback',
      private_reader:false,
      fallback_reason:reason||'CRM_FRESHNESS_NOT_READY',
      core_sheet_id:String(process.env.GOOGLE_SHEET_ID||DEFAULT_CORE_SHEET_ID).trim(),
      crm_sheet_id:String(process.env.KK_CRM_SHEET_ID||DEFAULT_CRM_SHEET_ID).trim(),
      crm_freshness:freshness?{
        code:freshness.code,
        last_synced_at:freshness.last_synced_at,
        age_minutes:freshness.age_minutes,
        max_age_minutes:freshness.max_age_minutes
      }:null
    };
  }
  return json(res,legacy.status||200,body);
}

module.exports=async function handler(req,res){
  if(req.method==='OPTIONS') return json(res,204,{});
  if(req.method!=='POST') return json(res,405,{ok:false,error:'Method not allowed'});
  const a=auth(req); if(!a.ok) return json(res,a.status,{ok:false,error:a.error});

  const crmSheetId=String(process.env.KK_CRM_SHEET_ID||DEFAULT_CRM_SHEET_ID).trim();
  const env=Object.assign({},process.env,{KK_CRM_SHEET_ID:crmSheetId});
  const cfg=privateSheets.configState(env);
  if(!cfg.configured) return v5Handler(req,res);

  const maxAgeMin=crmFreshness.maxAgeMinutes(env);
  try{
    const manifestValues=await privateSheets.readValues({sheetId:crmSheetId,range:'00_Data_Source_Manifest!A1:D25',env});
    const freshness=crmFreshness.assessManifest(manifestValues,{maxAgeMin});
    if(freshness.fresh) return v5Handler(req,res);
    if(String(process.env.KK_CRM_REQUIRE_PRIVATE||'').trim()==='1'){
      return json(res,503,{ok:false,error:'CRM read model is not fresh enough for private-only mode',error_code:freshness.code});
    }
    return coreFallback(req,res,freshness.code,freshness);
  }catch(err){
    const code=String((err&&err.code)||'CRM_MANIFEST_READ_FAILED');
    if(String(process.env.KK_CRM_REQUIRE_PRIVATE||'').trim()==='1'){
      return json(res,503,{ok:false,error:'CRM freshness check failed',error_code:code});
    }
    return coreFallback(req,res,code,null);
  }
};

module.exports._test={auth,coreFallback};
