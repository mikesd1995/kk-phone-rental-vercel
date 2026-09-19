// KK Phone Rental — Snapshot Contract Classifier v6
// Thin safety wrapper over v5 plus signed Admin session gate.
const V5 = require('./kk-admin-snapshot-v5.js');
const AdminSecurity = require('../server/admin-session.js');
const AdminMakeGate = require('../server/admin-make-gate.js');

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

module.exports._test={classifyHealth,enrich,requestAction};