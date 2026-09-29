// KK Phone Rental — Snapshot Contract Classifier v6
// Thin safety wrapper over v5 plus signed Admin session gate.
const {installRuntimeWarningTracer}=require('../server/runtime-warning-tracer');
installRuntimeWarningTracer('kk-admin-snapshot-v6');
const V5 = require('../server/legacy/kk-admin-snapshot-v5.js');
const AdminSecurity = require('../server/admin-session.js');
const AdminMakeGate = require('../server/admin-make-gate.js');
const AdminWriteControl = require('../server/admin-write-control-oidc.js');
const AdminGoogleWriter = require('./lib/admin-google-sheets-writer.js');

const ADAPTER_VERSION = 'admin-snapshot-contract-repair-v6';
const REQUIRED = ['events','bookings','current_bookings','assets'];

function requestAction(req){
  if(req.method==='GET'){
    const u=new URL(req.url||'/api/kk-admin','http://localhost');
    return String(u.searchParams.get('action')||'snapshot');
  }
  return '';
}

function classifyHealth(health){
  if(!health || typeof health!=='object') return null;
  const counts=health.counts||{};
  const nullKeys=REQUIRED.filter(k=>counts[k]===null || counts[k]===undefined);
  if(nullKeys.length===REQUIRED.length && !health.backend_version){
    return 'SNAPSHOT_CONTRACT_ALL_REQUIRED_ARRAYS_INVALID_AND_BACKEND_VERSION_MISSING';
  }
  if(nullKeys.length===REQUIRED.length){
    return 'SNAPSHOT_CONTRACT_ALL_REQUIRED_ARRAYS_INVALID';
  }
  if(nullKeys.length){
    return 'SNAPSHOT_CONTRACT_PARTIAL_REQUIRED_ARRAYS_INVALID:'+nullKeys.join(',');
  }
  return health.ok===false ? 'SNAPSHOT_VALIDATION_FAILED' : 'SNAPSHOT_CONTRACT_VALID';
}

function replyJson(res,status,body){
  res.statusCode=status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('X-KK-Admin-Write-Control','health-v1');
  res.end(JSON.stringify(body||{}));
}

function directWriterHealthPayload(control,writer){
  const controlOk=!!(control&&control.ok===true&&control.authenticated===true);
  const writerConfigured=!!(writer&&writer.configured===true);
  const writerEnabled=!!(writer&&writer.enabled===true);
  const writerOk=!!(writer&&writer.ok===true);
  return {
    ok:controlOk,
    stage:!controlOk?'CONTROL_UNAVAILABLE':(!writerConfigured?'WRITER_CREDENTIAL_PENDING':(!writerEnabled?'WRITER_DISABLED':(writerOk?'DIRECT_WRITER_READY':'WRITER_HEALTH_FAILED'))),
    write_control:control||{ok:false,error_code:'WRITE_CONTROL_UNAVAILABLE'},
    google_writer:writer||{ok:false,configured:false,enabled:false,error_code:'ADMIN_WRITER_UNAVAILABLE'},
    direct_writer_ready:controlOk&&writerConfigured&&writerEnabled&&writerOk,
    business_writes:0,
    google_sheet_writes:0
  };
}

async function handleDirectWriterHealth(res){
  const [control,writer]=await Promise.all([
    AdminWriteControl.health(),
    AdminGoogleWriter.health()
  ]);
  const body=directWriterHealthPayload(control,writer);
  return replyJson(res,body.ok?200:503,body);
}

function enrich(body){
  if(!body || typeof body!=='object') return body;
  body.snapshot_adapter_version=ADAPTER_VERSION;
  const health=body.data && body.data.counts ? body.data : body.snapshot_health;
  const classification=classifyHealth(health);
  if(health && classification){
    health.snapshot_adapter_version=ADAPTER_VERSION;
    health.contract_classification=classification;
    health.warnings=Array.isArray(health.warnings)?health.warnings:[];
    if(classification!=='SNAPSHOT_CONTRACT_VALID'){
      const note='Contract classifier: '+classification+'; inspect deployed Apps Script snapshot response before changing Sheet data.';
      if(!health.warnings.includes(note)) health.warnings.push(note);
    }
  }
  if(classification) body.contract_classification=classification;
  return body;
}

module.exports=async function handler(req,res){
  const gate=AdminSecurity.gateMode(req);
  if(gate==='make-verify') return AdminMakeGate.handleVerify(req,res);
  if(gate==='make-health') return AdminMakeGate.handleHealth(req,res);
  if(gate) return AdminSecurity.handleGate(req,res,gate);
  if(!AdminSecurity.authorizeApi(req,res)) return;

  const action=requestAction(req);
  if(req.method==='GET'&&action==='writeControlHealth'){
    return handleDirectWriterHealth(res);
  }
  let raw='';
  const originalEnd=res.end.bind(res);
  res.setHeader('X-KK-Snapshot-Adapter-Version',ADAPTER_VERSION);
  res.end=(chunk)=>{
    const text=chunk==null?'':String(chunk);
    try{
      const body=enrich(JSON.parse(text));
      res.setHeader('X-KK-Snapshot-Adapter-Version',ADAPTER_VERSION);
      return originalEnd(JSON.stringify(body));
    }catch(_){
      return originalEnd(chunk);
    }
  };
  await V5(req,res);
};

module.exports._test={classifyHealth,enrich,requestAction,directWriterHealthPayload,handleDirectWriterHealth};