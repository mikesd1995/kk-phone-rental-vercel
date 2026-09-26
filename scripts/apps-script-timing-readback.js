'use strict';

const fs=require('node:fs');
const crypto=require('node:crypto');

function parseEnvFile(file){
  const out={};
  const raw=fs.readFileSync(file,'utf8');
  for(const line of raw.split(/\r?\n/)){
    if(!line || /^\s*#/.test(line)) continue;
    const m=line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if(!m) continue;
    let v=m[2].trim();
    if(v.startsWith('"') && v.endsWith('"')){
      try{v=JSON.parse(v);}catch(_){v=v.slice(1,-1);}
    }else if(v.startsWith("'") && v.endsWith("'")){
      v=v.slice(1,-1);
    }
    out[m[1]]=v;
  }
  return out;
}

function safeConfigDiagnostics(env){
  const rawUrl=String(env&&env.KK_ADMIN_SCRIPT_URL||'').trim();
  const apiKey=String(env&&env.KK_ADMIN_API_KEY||'').trim();
  const sheetId=String(env&&env.GOOGLE_SHEET_ID||'').trim();
  let parsed=null;
  try{parsed=new URL(rawUrl);}catch(_){}
  let pathKind='unparseable';
  if(parsed){
    if(/^\/macros\/s\/[^/]+\/exec$/.test(parsed.pathname)) pathKind='canonical_exec';
    else if(/\/dev$/.test(parsed.pathname)) pathKind='dev';
    else if(/\/exec\/?$/.test(parsed.pathname)) pathKind='exec_noncanonical';
    else pathKind='other';
  }
  let decoded=null;
  try{decoded=new URL(decodeURIComponent(rawUrl));}catch(_){}
  return {
    kk_admin_script_url_present:!!rawUrl,
    kk_admin_script_url_length:rawUrl.length,
    kk_admin_script_url_https:!!parsed&&parsed.protocol==='https:',
    kk_admin_script_url_starts_http:/^http:/i.test(rawUrl),
    kk_admin_script_url_starts_https:/^https:/i.test(rawUrl),
    kk_admin_script_url_contains_scheme_separator:rawUrl.includes('://'),
    kk_admin_script_url_contains_whitespace:/\s/.test(rawUrl),
    kk_admin_script_url_contains_backslash:rawUrl.includes(String.fromCharCode(92)),
    kk_admin_script_url_contains_dollar:rawUrl.includes(String.fromCharCode(36)),
    kk_admin_script_url_host:parsed?parsed.hostname:'',
    kk_admin_script_url_path_kind:pathKind,
    kk_admin_script_url_decode_once_host:decoded?decoded.hostname:'',
    kk_admin_script_url_sha256:rawUrl?crypto.createHash('sha256').update(rawUrl).digest('hex'):'',
    kk_admin_api_key_present:!!apiKey,
    kk_admin_api_key_length:apiKey.length,
    google_sheet_id_present:!!sheetId,
    google_sheet_id_length:sheetId.length
  };
}

function validateExecUrl(value){
  let u;
  try{u=new URL(String(value||''));}catch(_){throw new Error('APPS_SCRIPT_URL_INVALID');}
  if(u.protocol!=='https:'||u.hostname!=='script.google.com') throw new Error('APPS_SCRIPT_URL_INVALID_HOST');
  if(!/^\/macros\/s\/[^/]+\/exec$/.test(u.pathname)) throw new Error('APPS_SCRIPT_URL_NOT_EXEC');
  if(u.search||u.hash||u.username||u.password) throw new Error('APPS_SCRIPT_URL_NOT_CANONICAL');
  return u.toString();
}

function naiveLocalTimestampMs(value){
  const m=String(value||'').trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/);
  if(!m) return NaN;
  return Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]),Number(m[4]),Number(m[5]),Number(m[6]));
}

function inferOffsetMinutes(localStamp,beforeMs,afterMs){
  const localMs=naiveLocalTimestampMs(localStamp);
  if(!Number.isFinite(localMs)) return {matches:[],offset_minutes:null};
  const matches=[];
  for(let offset=-12*60;offset<=14*60;offset+=15){
    const absolute=localMs-offset*60000;
    if(absolute>=beforeMs-90000&&absolute<=afterMs+90000) matches.push(offset);
  }
  return {matches,offset_minutes:matches.length===1?matches[0]:null};
}

function offsetLabel(mins){
  if(!Number.isFinite(mins)) return '';
  const sign=mins>=0?'+':'-';
  const n=Math.abs(mins);
  return sign+String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
}

function flattenDiagnosticFields(value,path='',out=[]){
  if(!value||typeof value!=='object') return out;
  for(const [key,v] of Object.entries(value)){
    const p=path?path+'.'+key:key;
    if(/time.?zone|timezone|trigger/i.test(key)){
      if(['string','number','boolean'].includes(typeof v)||v===null) out.push({path:p,value:v});
      else if(Array.isArray(v)) out.push({path:p,value:v.map(x=>['string','number','boolean'].includes(typeof x)?x:'[object]')});
      else out.push({path:p,value:'[object]'});
    }
    if(v&&typeof v==='object'&&!Array.isArray(v)) flattenDiagnosticFields(v,p,out);
  }
  return out;
}

function blockedReport(errorCode,config,nowMs){
  return {
    schema:'KK_APPS_SCRIPT_TIMING_ZERO_WRITE_READBACK_V1',
    observed_at_utc:new Date(nowMs).toISOString(),
    status:'CONFIG_BLOCKED',
    error_code:String(errorCode||'UNKNOWN'),
    config,
    timing:{effective_utc_plus_7_verified:false,named_timezone_explicitly_exposed:false,named_timezone_verified:false},
    installed_triggers:{readback_exposed_by_phase1_health:false,cleanup_trigger_verified:false,expected_handler:'kkCleanupOldData30DaysAuto',evidence_fields:[]},
    safety:{action:'none',read_only:true,apps_script_writes:0,sheet_business_writes:0,trigger_mutations:0,timezone_mutations:0,secrets_logged:false}
  };
}

async function run({envFile,envObject,fetchImpl=global.fetch,now=()=>Date.now()}){
  const env=envObject || (envFile==='--process-env' ? process.env : parseEnvFile(envFile));
  const config=safeConfigDiagnostics(env);
  let scriptUrl;
  try{scriptUrl=validateExecUrl(env.KK_ADMIN_SCRIPT_URL);}
  catch(err){
    err.report=blockedReport(err&&err.message,config,now());
    throw err;
  }

  const apiKey=String(env.KK_ADMIN_API_KEY||'').trim();
  const sheetId=String(env.GOOGLE_SHEET_ID||'').trim();
  if(!apiKey){
    const err=new Error('APPS_SCRIPT_API_KEY_MISSING');
    err.report=blockedReport(err.message,config,now());
    throw err;
  }
  if(!sheetId){
    const err=new Error('GOOGLE_SHEET_ID_MISSING');
    err.report=blockedReport(err.message,config,now());
    throw err;
  }

  const before=now();
  const res=await fetchImpl(scriptUrl,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'phase1Health',apiKey,frontendSheetId:sheetId}),
    redirect:'follow'
  });
  const after=now();
  const responseText=await res.text();
  let body={};
  try{body=JSON.parse(responseText);}
  catch(_){
    const err=new Error('PHASE1_HEALTH_NON_JSON_HTTP_'+res.status);
    err.report=blockedReport(err.message,config,after);
    err.report.status='READBACK_BLOCKED';
    err.report.safety.action='phase1Health';
    throw err;
  }
  if(!res.ok||body.ok!==true){
    const err=new Error('PHASE1_HEALTH_REJECTED_HTTP_'+res.status);
    err.report=blockedReport(err.message,config,after);
    err.report.status='READBACK_BLOCKED';
    err.report.safety.action='phase1Health';
    throw err;
  }

  const d=(body&&body.data)||{};
  const generated=String(d.generated_at||'').trim();
  const inferred=inferOffsetMinutes(generated,before,after);
  const offset=inferred.offset_minutes;
  const explicit=flattenDiagnosticFields(d);
  const explicitZone=explicit.find(x=>/time.?zone|timezone/i.test(x.path)&&typeof x.value==='string');
  const explicitTrigger=explicit.find(x=>/trigger/i.test(x.path)&&JSON.stringify(x.value).includes('kkCleanupOldData30DaysAuto'));

  const report={
    schema:'KK_APPS_SCRIPT_TIMING_ZERO_WRITE_READBACK_V1',
    observed_at_utc:new Date(after).toISOString(),
    status:'READBACK_COMPLETE',
    config,
    request_window_utc:{started_at:new Date(before).toISOString(),finished_at:new Date(after).toISOString(),latency_ms:after-before},
    phase1_health:{
      ok:true,
      admin_api_version:String(body.admin_api_version||d.admin_api_version||''),
      spreadsheet_id:String(d.spreadsheet_id||''),
      frontend_sheet_id:String(d.frontend_sheet_id||''),
      frontend_backend_same_sheet:d.frontend_backend_same_sheet===true,
      generated_at:generated,
      response_keys:Object.keys(d).sort()
    },
    timing:{
      inferred_offset_minutes:offset,
      inferred_offset:offsetLabel(offset),
      offset_candidates_minutes:inferred.matches,
      effective_utc_plus_7_verified:offset===420,
      named_timezone_explicitly_exposed:!!explicitZone,
      named_timezone:explicitZone?String(explicitZone.value):'',
      named_timezone_verified:!!explicitZone&&String(explicitZone.value)==='Asia/Bangkok'
    },
    installed_triggers:{
      readback_exposed_by_phase1_health:explicit.some(x=>/trigger/i.test(x.path)),
      cleanup_trigger_verified:!!explicitTrigger,
      expected_handler:'kkCleanupOldData30DaysAuto',
      evidence_fields:explicit.filter(x=>/trigger/i.test(x.path))
    },
    safety:{action:'phase1Health',read_only:true,apps_script_writes:0,sheet_business_writes:0,trigger_mutations:0,timezone_mutations:0,secrets_logged:false}
  };

  if(report.phase1_health.spreadsheet_id!==sheetId||d.frontend_backend_same_sheet!==true){
    const err=new Error('APPS_SCRIPT_SHEET_IDENTITY_MISMATCH');
    err.report=report;
    throw err;
  }
  if(offset!==420){
    const err=new Error('APPS_SCRIPT_EFFECTIVE_OFFSET_NOT_UTC_PLUS_7');
    err.report=report;
    throw err;
  }
  return report;
}

async function main(){
  const envFile=process.argv[2];
  if(!envFile) throw new Error('Usage: node scripts/apps-script-timing-readback.js <vercel-env-file|--process-env>');
  try{
    const report=await run({envFile});
    process.stdout.write(JSON.stringify(report,null,2)+'\n');
  }catch(err){
    if(err&&err.report) process.stdout.write(JSON.stringify(err.report,null,2)+'\n');
    console.error(String(err&&err.message||err));
    process.exitCode=1;
  }
}

if(require.main===module) main();
module.exports={parseEnvFile,safeConfigDiagnostics,validateExecUrl,naiveLocalTimestampMs,inferOffsetMinutes,offsetLabel,flattenDiagnosticFields,blockedReport,run};
