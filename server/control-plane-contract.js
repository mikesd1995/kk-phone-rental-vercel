'use strict';

const MANIFEST_HEADERS = [
  'Manifest ID','Run ID','Role','Created At','Frozen At','Policy Version','Policy Snapshot',
  'Service Area','Horizon Days','Quiet Hours','Required SLO','Due Event Count','P0/P1 Count',
  'Eligible Source Count','Deep Budget','Light Budget','Budget Notes','Fencing Token','Status',
  'Finished At','Policy Drift','Notes'
];

const TRANSACTION_HEADERS = [
  'Transaction ID','Run ID','Show ID','Tx Type','Status','Prepared At','Before Snapshot',
  'Planned Writes','Validation Checks','Commit Started At','Committed At','Readback Summary',
  'Compensation Required','Compensation Status','Error','Notes','Fencing Token','Recovery State',
  'Recovery Due At','Recovery Attempts','Recovery Owner Run ID','Last Recovery At','Recovery Result'
];

const TERMINAL_MANIFEST_STATUSES = new Set([
  'FINISHED','FINISHED_PARTIAL','BLOCKED','FAILED','NO_OPERATIONAL_PACKET'
]);

function text(value){
  return String(value == null ? '' : value).trim();
}

function value(record, ...keys){
  for(const key of keys){
    if(record && record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

function recordRunId(record){
  return text(value(record,'run_id','runId','Run ID','holder_run_id','holderRunId','Holder Run ID'));
}

function recordStatus(record){
  return text(value(record,'status','Status')).toUpperCase();
}

function recordRole(record){
  return text(value(record,'role','Role','scope_key','scopeKey','Scope Key')).toUpperCase();
}

function exactHeaderCheck(actual, expected, label){
  if(!Array.isArray(actual)) throw new Error(label + ' headers must be an array');
  if(actual.length !== expected.length){
    throw new Error(`${label} header count mismatch: expected ${expected.length}, got ${actual.length}`);
  }
  const seen = new Set();
  actual.forEach((header,index)=>{
    const h=text(header);
    if(!h) throw new Error(`${label} header ${index+1} is blank`);
    if(seen.has(h)) throw new Error(`${label} duplicate header: ${h}`);
    seen.add(h);
    if(h !== expected[index]){
      throw new Error(`${label} header mismatch at ${index+1}: expected "${expected[index]}", got "${h}"`);
    }
  });
  return true;
}

function assertManifestHeaders(headers){
  return exactHeaderCheck(headers,MANIFEST_HEADERS,'Manifest');
}

function assertTransactionHeaders(headers){
  return exactHeaderCheck(headers,TRANSACTION_HEADERS,'WriteTransaction');
}

function assertStrictlyMonotonicFence(priorVersions,nextVersion){
  const parsed=(priorVersions||[]).map(Number).filter(Number.isFinite);
  const next=Number(nextVersion);
  if(!Number.isFinite(next)) throw new Error('next fence version must be numeric');
  const max=parsed.length ? Math.max(...parsed) : 0;
  if(next !== max+1) throw new Error(`fence must equal max+1: max=${max}, next=${next}`);
  return true;
}

function launcherAdvanced(before,after,scheduledAt){
  const b=text(before);
  const a=text(after);
  if(!a || a===b) return false;
  if(!scheduledAt) return true;
  const afterMs=Date.parse(a);
  const scheduledMs=Date.parse(scheduledAt);
  if(Number.isNaN(afterMs) || Number.isNaN(scheduledMs)) return true;
  return afterMs >= scheduledMs;
}

function commonRuntimeIds(coreLocks,roleLocks){
  const core=new Map();
  const role=new Map();
  for(const row of coreLocks||[]){
    const id=recordRunId(row);
    if(id) core.set(id,(core.get(id)||0)+1);
  }
  for(const row of roleLocks||[]){
    const id=recordRunId(row);
    if(id) role.set(id,(role.get(id)||0)+1);
  }
  return [...core.keys()].filter(id=>role.has(id)).map(id=>({
    run_id:id,
    core_count:core.get(id),
    role_count:role.get(id)
  }));
}

function unresolvedTransactions(rows,runId){
  return (rows||[]).filter(row=>{
    if(runId && recordRunId(row)!==runId) return false;
    return ['PREPARED','COMMITTING'].includes(recordStatus(row));
  });
}

function analyzeNaturalOccurrence(input={}){
  const role=text(input.role).toUpperCase();
  if(!['SCANNER','VERIFIER'].includes(role)) throw new Error('role must be SCANNER or VERIFIER');

  const beforeEnabled=Boolean(value(input.task_before||{},'enabled','is_enabled','isEnabled'));
  const afterEnabled=Boolean(value(input.task_after||{},'enabled','is_enabled','isEnabled'));
  const launched=launcherAdvanced(input.launcher_before,input.launcher_after,input.scheduled_at);

  const coreLocks=(input.core_locks||[]).filter(row=>recordRole(row)==='CORE');
  const roleLocks=(input.role_locks||[]).filter(row=>recordRole(row)===role);
  const common=commonRuntimeIds(coreLocks,roleLocks);

  const result={
    role,
    scheduled_at:input.scheduled_at||null,
    task_before_enabled:beforeEnabled,
    task_after_enabled:afterEnabled,
    launcher_advanced:launched,
    runtime_run_id:null,
    runtime_proven:false,
    acceptance_candidate:false,
    classification:null,
    blockers:[]
  };

  if(!beforeEnabled){
    result.classification='TASK_OFF_BEFORE_BOUNDARY';
    result.blockers.push('canonical recurring task was OFF before the scheduled boundary');
    return result;
  }

  if(common.length===0){
    result.classification=launched
      ? 'LAUNCHER_METADATA_ADVANCED_RUNTIME_BOUNDARY_MISSING'
      : 'NO_LAUNCHER_NO_RUNTIME';
    result.blockers.push('no exact CORE_SHARED_WRITER + role-lock runtime boundary');
    return result;
  }

  if(common.length!==1 || common[0].core_count!==1 || common[0].role_count!==1){
    result.classification='RUNTIME_BOUNDARY_AMBIGUOUS';
    result.blockers.push('runtime lock identity is not exact1');
    return result;
  }

  const runId=common[0].run_id;
  result.runtime_run_id=runId;

  if(!launched){
    result.classification='RUNTIME_BOUNDARY_WITHOUT_LAUNCHER_METADATA';
    result.blockers.push('Machine-SOT runtime exists but canonical launcher metadata did not advance');
    return result;
  }

  const manifests=(input.manifests||[]).filter(row=>
    recordRunId(row)===runId && recordRole(row)===role
  );
  if(manifests.length!==1){
    result.classification='RUNTIME_MANIFEST_IDENTITY_NOT_EXACT1';
    result.blockers.push(`expected one ${role} Manifest for runtime, found ${manifests.length}`);
    return result;
  }

  if(!TERMINAL_MANIFEST_STATUSES.has(recordStatus(manifests[0]))){
    result.classification='RUNTIME_MANIFEST_NOT_TERMINAL';
    result.blockers.push('Manifest is not in an accepted terminal state');
    return result;
  }

  const ownedCore=coreLocks.filter(row=>recordRunId(row)===runId);
  const ownedRole=roleLocks.filter(row=>recordRunId(row)===runId);
  if([...ownedCore,...ownedRole].some(row=>recordStatus(row)!=='RELEASED')){
    result.classification='RUNTIME_LOCKS_NOT_RELEASED';
    result.blockers.push('owned CORE/role lock did not exact-read RELEASED');
    return result;
  }

  const unresolved=unresolvedTransactions(input.transactions||[],runId);
  if(unresolved.length){
    result.classification='RUNTIME_TRANSACTION_UNRESOLVED';
    result.blockers.push(`unresolved PREPARED/COMMITTING transactions: ${unresolved.length}`);
    return result;
  }

  result.runtime_proven=true;

  if(!afterEnabled){
    result.classification='TASK_PERSISTENCE_FAILED_AFTER_RUNTIME';
    result.blockers.push('runtime completed but canonical recurring task did not remain ON');
    return result;
  }

  result.acceptance_candidate=true;
  result.classification='PASS_ACCEPTANCE_CANDIDATE';
  return result;
}

function auditSnapshot(snapshot={}){
  if(snapshot.manifest_headers) assertManifestHeaders(snapshot.manifest_headers);
  if(snapshot.transaction_headers) assertTransactionHeaders(snapshot.transaction_headers);

  const occurrences=(snapshot.occurrences||[]).map(analyzeNaturalOccurrence);
  const summary={
    schema_manifest: snapshot.manifest_headers ? 'PASS' : 'NOT_SUPPLIED',
    schema_transaction: snapshot.transaction_headers ? 'PASS' : 'NOT_SUPPLIED',
    occurrences,
    scanner_acceptance_candidates:occurrences.filter(x=>x.role==='SCANNER'&&x.acceptance_candidate).length,
    verifier_acceptance_candidates:occurrences.filter(x=>x.role==='VERIFIER'&&x.acceptance_candidate).length
  };
  summary.pass=occurrences.length>0 && occurrences.every(x=>x.acceptance_candidate);
  return summary;
}

module.exports={
  MANIFEST_HEADERS,
  TRANSACTION_HEADERS,
  TERMINAL_MANIFEST_STATUSES,
  assertManifestHeaders,
  assertTransactionHeaders,
  assertStrictlyMonotonicFence,
  analyzeNaturalOccurrence,
  auditSnapshot
};
