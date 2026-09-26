'use strict';

const fs=require('node:fs');

function parseEnvFile(file){
  const out={};
  const raw=fs.readFileSync(file,'utf8');
  for(const line of raw.split(/\r?\n/)){
    if(!line || /^\s*#/.test(line)) continue;
    const m=line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if(!m) continue;
    let v=m[2].trim();
    if(v.startsWith('"') && v.endsWith('"')){
      try{ v=JSON.parse(v); }catch(_){ v=v.slice(1,-1); }
    }else if(v.startsWith("'") && v.endsWith("'")){
      v=v.slice(1,-1);
    }
    out[m[1]]=v;
  }
  return out;
}

function validateExecUrl(value){
  let u;
  try{u=new URL(String(value||''));}catch(_){throw new Error('APPS_SCRIPT_URL_INVALID');}
  if(u.protocol!=='https:' || u.hostname!=='script.google.com') throw new Error('APPS_SCRIPT_URL_INVALID_HOST');
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
    if(absolute>=beforeMs-90000 && absolute<=afterMs+90000) matches.push(offset);
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
  if(!value || typeof value!=='object') return out;
  for(const [key,v] of Object.entries(value)){
    const p=path?path+'.'+key:key;
    if(/time.?zone|timezone|trigger/i.test(key)){
      if(['string','number','boolean'].includes(typeof v) || v===null) out.push({path:p,value:v});
      else if(Array.isArray(v)) out.push({path:p,value:v.map(x=>['string','number','boolean'].includes(typeof x)?x:'[object]')});
      else out.push({path:p,value:'[object]'});
    }
    if(v && typeof v==='object' && !Array.isArray(v)) flattenDiagnosticFields(v,p,out);
  }
  return out;
}

async function run({envFile,fetchImpl=global.fetch,now=()=>Date.now()}){
  const env=parseEnvFile(envFile);
  const scriptUrl=validateExecUrl(env.KK_ADMIN_SCRIPT_URL);
  const apiKey=String(env.KK_ADMIN_API_KEY||'').trim();
  const sheetId=String(env.GOOGLE_SHEET_ID||'').trim();
  if(!apiKey) throw new Error('APPS_SCRIPT_API_KEY_MISSING');
  if(!sheetId) throw new Error('GOOGLE_SHEET_ID_MISSING');

  const before=now();
  const res=await fetchImpl(scriptUrl,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({action:'phase1Health',apiKey,frontendSheetId:sheetId}),
    redirect:'follow'
  });
  const after=now();
  const text=await res.text();
  let body={};
  try{body=JSON.parse(text);}catch(_){throw new Error('PHASE1_HEALTH_NON_JSON_HTTP_'+res.status);}
  if(!res.ok || body.ok!==true) throw new Error('PHASE1_HEALTH_REJECTED_HTTP_'+res.status);

  const d=(body&&body.data)||{};
  const generated=String(d.generated_at||'').trim();
  const inferred=inferOffsetMinutes(generated,before,after);
  const offset=inferred.offset_minutes;
  const explicit=flattenDiagnosticFields(d);
  const explicitZone=explicit.find(x=>/time.?zone|timezone/i.test(x.path) && typeof x.value==='string');
  const explicitTrigger=explicit.find(x=>/trigger/i.test(x.path) && JSON.stringify(x.value).includes('kkCleanupOldData30DaysAuto'));

  const report={
    schema:'KK_APPS_SCRIPT_TIMING_ZERO_WRITE_READBACK_V1',
    observed_at_utc:new Date(after).toISOString(),
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
      named_timezone_verified:!!explicitZone && String(explicitZone.value)==='Asia/Bangkok'
    },
    installed_triggers:{
      readback_exposed_by_phase1_health:explicit.some(x=>/trigger/i.test(x.path)),
      cleanup_trigger_verified:!!explicitTrigger,
      expected_handler:'kkCleanupOldData30DaysAuto',
      evidence_fields:explicit.filter(x=>/trigger/i.test(x.path))
    },
    safety:{
      action:'phase1Health',
      read_only:true,
      apps_script_writes:0,
      sheet_business_writes:0,
      trigger_mutations:0,
      timezone_mutations:0,
      secrets_logged:false
    }
  };

  if(report.phase1_health.spreadsheet_id!==sheetId || d.frontend_backend_same_sheet!==true){
    const e=new Error('APPS_SCRIPT_SHEET_IDENTITY_MISMATCH'); e.report=report; throw e;
  }
  if(offset!==420){
    const e=new Error('APPS_SCRIPT_EFFECTIVE_OFFSET_NOT_UTC_PLUS_7'); e.report=report; throw e;
  }
  return report;
}

async function main(){
  const envFile=process.argv[2];
  if(!envFile) throw new Error('Usage: node scripts/apps-script-timing-readback.js <vercel-env-file>');
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
module.exports={parseEnvFile,validateExecUrl,naiveLocalTimestampMs,inferOffsetMinutes,offsetLabel,flattenDiagnosticFields,run};
