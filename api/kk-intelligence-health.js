'use strict';

const privateSheets = require('./lib/private-google-sheets');
const crmFreshness = require('./lib/crm-freshness');
const crmReconciliation = require('./lib/crm-reconciliation');
const CorePrivacy = require('../server/core-sheet-private-reader.js');
const AdminSecurity = require('../server/admin-session.js');
const ProjectMemoryLedger = require('../server/kk-project-memory-ledger.js');
const OpenAiStagingProbe = require('../server/kk-openai-staging-probe.js');

const DEFAULT_CRM_SHEET_ID = '1mmXkDAk3NJtyWqp7qC8ByQyEgKsTY5IO1ca9xLQijaU';
const DEFAULT_CORE_SHEET_ID = '12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU';
const RUNTIME_DATASETS={
  rental_dashboard_data:{sheet:'_Rental_Dashboard_Data',range:'A1:O',privateRange:'_Rental_Dashboard_Data!A1:O',requireData:true},
  event_archive:{sheet:'13_Event_Archive',range:'A1:Z',privateRange:'13_Event_Archive!A1:Z',requireData:false}
};

const EXPECTED_APPS_SCRIPT_VERSION='v16.7.0_CRM_PRO_PHASE3_9_5_13_FULL_BACKEND_AUDIT';
const APPS_SCRIPT_TIMING_CACHE_TTL_MS=5*60*1000;
const APPS_SCRIPT_TIMING_FAILURE_CACHE_TTL_MS=30*1000;
function timingCacheTtl(payload){return payload&&payload.status==='READBACK_COMPLETE'?APPS_SCRIPT_TIMING_CACHE_TTL_MS:APPS_SCRIPT_TIMING_FAILURE_CACHE_TTL_MS;}
let appsScriptTimingCache={expiresAt:0,payload:null};

function canonicalAppsScriptExecUrl(value){
  let u;
  try{u=new URL(String(value||'').trim());}catch(_){return '';}
  if(u.protocol!=='https:'||u.hostname!=='script.google.com') return '';
  if(!/^\/macros\/s\/[^/]+\/exec$/.test(u.pathname)) return '';
  if(u.search||u.hash||u.username||u.password) return '';
  return u.toString();
}
function naiveLocalTimestampMs(value){
  const m=String(value||'').trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/);
  if(!m) return NaN;
  return Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]),Number(m[4]),Number(m[5]),Number(m[6]));
}
function inferOffsetMinutes(localStamp,beforeMs,afterMs){
  const localMs=naiveLocalTimestampMs(localStamp);
  if(!Number.isFinite(localMs)) return null;
  const matches=[];
  for(let offset=-12*60;offset<=14*60;offset+=15){
    const absolute=localMs-offset*60000;
    if(absolute>=beforeMs-90000&&absolute<=afterMs+90000) matches.push(offset);
  }
  return matches.length===1?matches[0]:null;
}
function offsetLabel(mins){
  if(!Number.isFinite(mins)) return '';
  const sign=mins>=0?'+':'-';
  const n=Math.abs(mins);
  return sign+String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
}
function safeTimingPayload(status,errorCode,extra){
  return Object.assign({
    status:String(status||'READBACK_BLOCKED'),
    error_code:String(errorCode||''),
    evidence_source:'production Apps Script phase1Health.generated_at',
    effective_utc_offset:'',
    effective_utc_plus_7_verified:false,
    backend_sheet_identity_verified:false,
    expected_admin_api_version:EXPECTED_APPS_SCRIPT_VERSION,
    admin_api_version:'',
    admin_api_version_verified:false,
    source_equivalence:'UNVERIFIED',
    named_project_timezone:'UNVERIFIED',
    installed_triggers:'UNVERIFIED',
    installed_trigger_count:null,
    cleanup_trigger:'UNVERIFIED',
    cleanup_trigger_count:null,
    cleanup_trigger_schedule:'UNVERIFIED',
    safety:{read_only:true,apps_script_writes:0,sheet_business_writes:0,trigger_mutations:0,timezone_mutations:0,secrets_exposed:false}
  },extra||{});
}
async function appsScriptTimingReadback({env=process.env,fetchImpl=global.fetch,now=()=>Date.now(),timeoutMs=10000}={}){
  const scriptUrl=canonicalAppsScriptExecUrl(env.KK_ADMIN_SCRIPT_URL);
  const apiKey=String(env.KK_ADMIN_API_KEY||'').trim();
  const sheetId=String(env.GOOGLE_SHEET_ID||DEFAULT_CORE_SHEET_ID).trim();
  if(!scriptUrl||!apiKey||!sheetId){
    return safeTimingPayload('CONFIG_BLOCKED','APPS_SCRIPT_TIMING_CONFIG_UNAVAILABLE');
  }
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  const before=now();
  try{
    const res=await fetchImpl(scriptUrl,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:'phase1Health',apiKey,frontendSheetId:sheetId}),
      redirect:'follow',
      signal:controller.signal
    });
    const after=now();
    const text=await res.text();
    let body;
    try{body=JSON.parse(text);}catch(_){
      return safeTimingPayload('READBACK_BLOCKED','PHASE1_HEALTH_NON_JSON');
    }
    if(!res.ok||body.ok!==true){
      return safeTimingPayload('READBACK_BLOCKED','PHASE1_HEALTH_REJECTED');
    }
    const d=body&&body.data||{};
    const offset=inferOffsetMinutes(String(d.generated_at||''),before,after);
    const identity=String(d.spreadsheet_id||'')===sheetId && d.frontend_backend_same_sheet===true;
    const adminApiVersion=String(d.admin_api_version||'').trim();
    const projectTimezone=String(d.project_timezone||'').trim();
    const triggerRows=Array.isArray(d.installed_triggers)?d.installed_triggers:[];
    const triggerCount=Number.isFinite(Number(d.installed_trigger_count))?Number(d.installed_trigger_count):null;
    const cleanupPresent=typeof d.cleanup_trigger_present==='boolean'?d.cleanup_trigger_present:null;
    const cleanupCount=Number.isFinite(Number(d.cleanup_trigger_count))?Number(d.cleanup_trigger_count):null;
    return safeTimingPayload('READBACK_COMPLETE','',{
      effective_utc_offset:offsetLabel(offset),
      effective_utc_plus_7_verified:offset===420,
      backend_sheet_identity_verified:identity,
      admin_api_version:adminApiVersion,
      admin_api_version_verified:adminApiVersion===EXPECTED_APPS_SCRIPT_VERSION,
      named_project_timezone:projectTimezone||'UNVERIFIED',
      installed_triggers:triggerRows.length||triggerCount===0?'VERIFIED_READBACK':'UNVERIFIED',
      installed_trigger_count:triggerCount,
      cleanup_trigger:cleanupPresent===true?'VERIFIED_PRESENT_SCHEDULE_UNVERIFIED':cleanupPresent===false?'VERIFIED_ABSENT':'UNVERIFIED',
      cleanup_trigger_count:cleanupCount,
      cleanup_trigger_schedule:String(d.cleanup_trigger_schedule||'UNVERIFIED')
    });
  }catch(err){
    return safeTimingPayload('READBACK_BLOCKED',err&&err.name==='AbortError'?'PHASE1_HEALTH_TIMEOUT':'PHASE1_HEALTH_TRANSPORT_FAILED');
  }finally{
    clearTimeout(timer);
  }
}
function timingProbeRequested(req){
  try{
    const u=new URL(String(req&&req.url||'/api/kk-intelligence-health'),'https://kk.invalid');
    return u.searchParams.get('mode')==='apps-script-timing';
  }catch(_){return false;}
}
function projectMemoryProbeRequested(req){
  try{
    const u=new URL(String(req&&req.url||'/api/kk-intelligence-health'),'https://kk.invalid');
    return u.searchParams.get('mode')==='project-memory';
  }catch(_){return false;}
}
async function projectMemoryRuntimeReadback({env=process.env,fetchImpl=global.fetch,getTokenImpl}={}){
  const cfg=ProjectMemoryLedger.configState(env);
  const base={
    enabled:cfg.enabled===true,
    configured:cfg.configured===true,
    direct_configured:cfg.direct_configured===true,
    oidc_candidate:cfg.oidc_candidate===true,
    project_binding_matches:cfg.project_binding_matches===true,
    runtime_mode:String(cfg.mode||'disabled'),
    table:String(cfg.table||''),
    read_only:true,
    business_writes:0,
    secrets_exposed:false
  };
  if(!cfg.enabled) return Object.assign(base,{status:'DISABLED',error_code:'',sampled_rows:0,durable_memory_present:false});
  try{
    const result=await ProjectMemoryLedger.listEvents({env,fetchImpl,getTokenImpl,limit:1});
    const rows=Array.isArray(result.rows)?result.rows:[];
    return Object.assign(base,{
      status:'READBACK_COMPLETE',
      error_code:'',
      runtime_mode:String(result.mode||cfg.mode||''),
      sampled_rows:rows.length,
      durable_memory_present:rows.length>0
    });
  }catch(err){
    return Object.assign(base,{
      status:'READBACK_BLOCKED',
      error_code:String(err&&(err.code||err.name)||'PROJECT_MEMORY_LEDGER_READ_FAILED'),
      sampled_rows:0,
      durable_memory_present:false
    });
  }
}

function json(res,status,body){
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, max-age=0');
  res.end(JSON.stringify(body||{}));
}

function auth(req){
  if(AdminSecurity.isAuthorizedRequest(req)||AdminSecurity.hasValidSession(req)||AdminSecurity.hasValidLegacyPin(req)) return {ok:true};
  const expected=String(process.env.KK_ADMIN_PIN||'').trim();
  if(!expected) return {ok:false,status:500,error:'KK_ADMIN_PIN is not configured'};
  return {ok:false,status:401,error:'Invalid admin PIN'};
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
  if(req.method==='OPTIONS') return json(res,204,{});
  if(req.method==='POST' && OpenAiStagingProbe.requested(req)) return OpenAiStagingProbe.handle(req,res,{json});
  if(req.method==='GET' && timingProbeRequested(req)){
    const now=Date.now();
    if(appsScriptTimingCache.payload && appsScriptTimingCache.expiresAt>now){
      res.setHeader('X-KK-Timing-Cache','HIT');
      return json(res,200,{ok:true,data:appsScriptTimingCache.payload});
    }
    const payload=await appsScriptTimingReadback();
    appsScriptTimingCache={payload,expiresAt:now+timingCacheTtl(payload)};
    res.setHeader('X-KK-Timing-Cache','MISS');
    return json(res,200,{ok:true,data:payload});
  }
  if(req.method==='GET' && projectMemoryProbeRequested(req)){
    const payload=await projectMemoryRuntimeReadback();
    return json(res,payload.status==='READBACK_COMPLETE'?200:503,{ok:payload.status==='READBACK_COMPLETE',data:payload});
  }
  if(req.method!=='POST') return json(res,405,{ok:false,error:'Method not allowed'});
  if(!AdminSecurity.authorizeApi(req,res)) return;

  const crmSheetId=String(process.env.KK_CRM_SHEET_ID||DEFAULT_CRM_SHEET_ID).trim();
  const coreSheetId=String(process.env.GOOGLE_SHEET_ID||DEFAULT_CORE_SHEET_ID).trim();
  const env=Object.assign({},process.env,{KK_CRM_SHEET_ID:crmSheetId});
  // Core and private CRM are independent workbook identities after the Core cutover.
  const cfg=privateSheets.configState(CorePrivacy.enabled(env)?Object.assign({},env,{GOOGLE_SHEET_ID:''}):env);
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

module.exports._test={
  reconcileRuntimeDatasets,RUNTIME_DATASETS,EXPECTED_APPS_SCRIPT_VERSION,APPS_SCRIPT_TIMING_CACHE_TTL_MS,APPS_SCRIPT_TIMING_FAILURE_CACHE_TTL_MS,timingCacheTtl,
  canonicalAppsScriptExecUrl,naiveLocalTimestampMs,inferOffsetMinutes,offsetLabel,
  safeTimingPayload,appsScriptTimingReadback,timingProbeRequested,
  projectMemoryProbeRequested,projectMemoryRuntimeReadback,
  resetTimingCache(){appsScriptTimingCache={expiresAt:0,payload:null};}
};
