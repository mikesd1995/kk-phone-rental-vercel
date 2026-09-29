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

const RUNTIME_SCOPE_ALIASES=Object.freeze({
  CORE:new Set(['CORE','CORE_SHARED_WRITER']),
  SCANNER:new Set(['SCANNER','SCANNER_GLOBAL']),
  VERIFIER:new Set(['VERIFIER','VERIFIER_GLOBAL'])
});

function runtimeScopeMatches(record,role){
  const normalized=text(role).toUpperCase();
  const aliases=RUNTIME_SCOPE_ALIASES[normalized];
  return !!aliases && aliases.has(recordRole(record));
}

function lockShapeProblems(record){
  const required=[
    ['holder_run_id','holderRunId','Holder Run ID','run_id','runId','Run ID'],
    ['status','Status'],
    ['acquired_at','acquiredAt','Acquired At'],
    ['lease_until','leaseUntil','Lease Until'],
    ['lease_version','leaseVersion','Lease Version'],
    ['fencing_token','fencingToken','Fencing Token']
  ];
  const labels=['run_id','status','acquired_at','lease_until','lease_version','fencing_token'];
  const missing=[];
  required.forEach((keys,index)=>{
    if(!text(value(record,...keys))) missing.push(labels[index]);
  });
  return missing;
}

function malformedRuntimeLocks(rows,roles){
  const allowed=new Set((roles||[]).map(x=>text(x).toUpperCase()));
  return (rows||[]).filter(row=>{
    const role=recordRole(row);
    if(allowed.size && !allowed.has(role)) return false;
    return recordRunId(row) && lockShapeProblems(row).length>0;
  }).map(row=>({
    run_id:recordRunId(row),
    role:recordRole(row),
    missing:lockShapeProblems(row)
  }));
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

  const coreLocks=(input.core_locks||[]).filter(row=>runtimeScopeMatches(row,'CORE'));
  const roleLocks=(input.role_locks||[]).filter(row=>runtimeScopeMatches(row,role));
  const malformed=malformedRuntimeLocks(
    [...coreLocks,...roleLocks],
    [...RUNTIME_SCOPE_ALIASES.CORE,...RUNTIME_SCOPE_ALIASES[role]]
  );
  const common=commonRuntimeIds(coreLocks,roleLocks);

  const result={
    role,
    scheduled_at:input.scheduled_at||null,
    task_before_enabled:beforeEnabled,
    task_after_enabled:afterEnabled,
    launcher_advanced:launched,
    runtime_run_id:null,
    runtime_boundary_proven:false,
    runtime_proven:false,
    runtime_body_classification:null,
    task_persistence_classification:null,
    task_persistence_ok:null,
    acceptance_candidate:false,
    classification:null,
    blockers:[],
    persistence_blockers:[]
  };

  if(!beforeEnabled){
    result.classification='TASK_OFF_BEFORE_BOUNDARY';
    result.blockers.push('canonical recurring task was OFF before the scheduled boundary');
    return result;
  }

  if(malformed.length){
    result.classification='MALFORMED_RUNTIME_LOCK_RECORD';
    result.blockers.push(...malformed.map(x=>
      `${x.role} lock ${x.run_id} missing: ${x.missing.join(',')}`
    ));
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

  result.runtime_boundary_proven=true;
  result.task_persistence_ok=afterEnabled;
  result.task_persistence_classification=afterEnabled
    ? 'TASK_REMAINED_ON_AFTER_RUNTIME_BOUNDARY'
    : 'TASK_PERSISTENCE_FAILED_AFTER_RUNTIME_BOUNDARY';
  if(!afterEnabled){
    result.persistence_blockers.push('canonical recurring task did not remain ON after a proven runtime boundary');
  }

  const manifests=(input.manifests||[]).filter(row=>
    recordRunId(row)===runId && recordRole(row)===role
  );
  if(manifests.length!==1){
    result.classification='RUNTIME_MANIFEST_IDENTITY_NOT_EXACT1';
    result.runtime_body_classification=result.classification;
    result.blockers.push(`expected one ${role} Manifest for runtime, found ${manifests.length}`);
    return result;
  }

  if(!TERMINAL_MANIFEST_STATUSES.has(recordStatus(manifests[0]))){
    result.classification='RUNTIME_MANIFEST_NOT_TERMINAL';
    result.runtime_body_classification=result.classification;
    result.blockers.push('Manifest is not in an accepted terminal state');
    return result;
  }

  const ownedCore=coreLocks.filter(row=>recordRunId(row)===runId);
  const ownedRole=roleLocks.filter(row=>recordRunId(row)===runId);
  if([...ownedCore,...ownedRole].some(row=>recordStatus(row)!=='RELEASED')){
    result.classification='RUNTIME_LOCKS_NOT_RELEASED';
    result.runtime_body_classification=result.classification;
    result.blockers.push('owned CORE/role lock did not exact-read RELEASED');
    return result;
  }

  const unresolved=unresolvedTransactions(input.transactions||[],runId);
  if(unresolved.length){
    result.classification='RUNTIME_TRANSACTION_UNRESOLVED';
    result.runtime_body_classification=result.classification;
    result.blockers.push(`unresolved PREPARED/COMMITTING transactions: ${unresolved.length}`);
    return result;
  }

  result.runtime_proven=true;
  result.runtime_body_classification='RUNTIME_BODY_TERMINAL_CLEAN';

  if(!afterEnabled){
    result.classification='TASK_PERSISTENCE_FAILED_AFTER_RUNTIME';
    result.blockers.push('runtime completed but canonical recurring task did not remain ON');
    return result;
  }

  result.acceptance_candidate=true;
  result.classification='PASS_ACCEPTANCE_CANDIDATE';
  return result;
}


const SCANNER_DUE_BUCKETS = Object.freeze({
  p0_preemption:'ACTIVE_P0',
  current_pack:'RESERVED_CURRENT_PACK',
  missed_pack_catch_forward:'ELIGIBLE_CATCH_FORWARD',
  regression_debt:'OPEN_REGRESSION_DEBT'
});

const SCANNER_DUE_ORDER = Object.freeze([
  'p0_preemption',
  'current_pack',
  'missed_pack_catch_forward',
  'regression_debt'
]);

function manifestIdentity(record={}){
  return {
    manifest_id:text(value(record,'manifest_id','manifestId','Manifest ID')),
    run_id:recordRunId(record),
    role:recordRole(record),
    fencing_token:text(value(record,'fencing_token','fencingToken','Fencing Token'))
  };
}

function evaluateManifestAppendReadback(input={}){
  const expected=manifestIdentity(input.expected||{});
  const missing=Object.entries(expected).filter(([,v])=>!v).map(([k])=>k);
  if(missing.length){
    throw new Error('expected Manifest immutable identity missing: '+missing.join(','));
  }

  const maxAttempts=input.max_attempts===undefined ? 3 : Number(input.max_attempts);
  if(!Number.isInteger(maxAttempts) || maxAttempts<1 || maxAttempts>5){
    throw new Error('max_attempts must be an integer from 1 to 5');
  }

  const attempts=input.attempts;
  if(!Array.isArray(attempts) || attempts.length===0){
    return {
      ok:false,
      classification:'MANIFEST_READBACK_ATTEMPTS_MISSING',
      attempts_observed:0,
      max_attempts:maxAttempts
    };
  }
  if(attempts.length>maxAttempts){
    return {
      ok:false,
      classification:'MANIFEST_READBACK_BOUND_EXCEEDED',
      attempts_observed:attempts.length,
      max_attempts:maxAttempts
    };
  }

  for(let index=0;index<attempts.length;index+=1){
    const rows=attempts[index];
    if(!Array.isArray(rows)){
      return {
        ok:false,
        classification:'MANIFEST_READBACK_ATTEMPT_INVALID',
        attempt:index+1,
        max_attempts:maxAttempts
      };
    }
    if(rows.length===0) continue;
    if(rows.length!==1){
      return {
        ok:false,
        classification:'MANIFEST_READBACK_NOT_EXACT1',
        attempt:index+1,
        row_count:rows.length,
        max_attempts:maxAttempts
      };
    }

    const actual=manifestIdentity(rows[0]);
    const mismatch=Object.keys(expected).filter(key=>actual[key]!==expected[key]);
    if(mismatch.length){
      return {
        ok:false,
        classification:'MANIFEST_READBACK_IDENTITY_MISMATCH',
        attempt:index+1,
        mismatch_fields:mismatch,
        max_attempts:maxAttempts
      };
    }

    return {
      ok:true,
      classification:'MANIFEST_READBACK_CONFIRMED',
      attempt:index+1,
      row_count:1,
      max_attempts:maxAttempts
    };
  }

  return {
    ok:false,
    classification:'MANIFEST_READBACK_NOT_VISIBLE_WITHIN_BOUND',
    attempts_observed:attempts.length,
    max_attempts:maxAttempts
  };
}

function scannerDueRecord(row,bucket,occurrenceId){
  const workId=text(value(row,'work_id','workId','Work ID'));
  const evidenceId=text(value(row,'evidence_id','evidenceId','Evidence ID'));
  const targetOccurrenceId=text(value(row,'target_occurrence_id','targetOccurrenceId','Target Occurrence ID'));
  const sourceState=text(value(row,'source_state','sourceState','Source State')).toUpperCase();
  const dueValue=value(row,'due','Due');
  const due=dueValue===true || text(dueValue).toUpperCase()==='TRUE';
  const expectedState=SCANNER_DUE_BUCKETS[bucket];
  const problems=[];
  if(!workId) problems.push('work_id');
  if(!evidenceId) problems.push('evidence_id');
  if(!targetOccurrenceId) problems.push('target_occurrence_id');
  if(targetOccurrenceId && targetOccurrenceId!==occurrenceId) problems.push('target_occurrence_mismatch');
  if(!due) problems.push('due_not_true');
  if(sourceState!==expectedState) problems.push('source_state_mismatch');
  return {
    work_id:workId,
    category:bucket,
    evidence_id:evidenceId,
    target_occurrence_id:targetOccurrenceId,
    source_state:sourceState,
    problems
  };
}

function resolveScannerDueWorkDenominator(input={}){
  const occurrenceId=text(input.occurrence_id);
  if(!occurrenceId) throw new Error('occurrence_id is required');

  const buckets=input.buckets;
  if(!buckets || typeof buckets!=='object' || Array.isArray(buckets)){
    return {
      ok:false,
      classification:'SCANNER_DUE_WORK_BUCKETS_MISSING',
      denominator:null,
      planner:null,
      blockers:['buckets object is required']
    };
  }

  const supplied=Object.keys(buckets);
  const unknown=supplied.filter(key=>!SCANNER_DUE_ORDER.includes(key));
  if(unknown.length){
    return {
      ok:false,
      classification:'SCANNER_DUE_WORK_BUCKET_UNKNOWN',
      denominator:null,
      planner:null,
      blockers:unknown.map(key=>'unknown due-work bucket: '+key)
    };
  }

  const missing=SCANNER_DUE_ORDER.filter(key=>!Object.prototype.hasOwnProperty.call(buckets,key));
  if(missing.length){
    return {
      ok:false,
      classification:'SCANNER_DUE_WORK_BUCKET_MISSING',
      denominator:null,
      planner:null,
      blockers:missing.map(key=>'missing explicit due-work bucket: '+key)
    };
  }

  const planner=[];
  const blockers=[];
  const seen=new Map();
  const bucketCounts={};

  for(const bucket of SCANNER_DUE_ORDER){
    const rows=buckets[bucket];
    if(!Array.isArray(rows)){
      blockers.push(bucket+' must be an array');
      bucketCounts[bucket]=null;
      continue;
    }
    bucketCounts[bucket]=rows.length;
    for(const row of rows){
      const normalized=scannerDueRecord(row||{},bucket,occurrenceId);
      if(normalized.problems.length){
        blockers.push(
          bucket+':'+(normalized.work_id||'<blank>')+' invalid '+normalized.problems.join(',')
        );
        continue;
      }
      if(seen.has(normalized.work_id)){
        blockers.push(
          'duplicate work_id '+normalized.work_id+' across '+seen.get(normalized.work_id)+' and '+bucket
        );
        continue;
      }
      seen.set(normalized.work_id,bucket);
      planner.push(normalized);
    }
  }

  if(blockers.length){
    return {
      ok:false,
      classification:'SCANNER_DUE_WORK_EVIDENCE_INVALID',
      denominator:null,
      planner:null,
      bucket_counts:bucketCounts,
      blockers
    };
  }

  planner.sort((a,b)=>{
    const priority=SCANNER_DUE_ORDER.indexOf(a.category)-SCANNER_DUE_ORDER.indexOf(b.category);
    if(priority!==0) return priority;
    return a.work_id.localeCompare(b.work_id);
  });

  if(planner.length===0){
    return {
      ok:true,
      classification:'SCANNER_DUE_WORK_EVIDENCED_NO_OP',
      denominator:0,
      planner:[],
      bucket_counts:bucketCounts,
      blockers:[]
    };
  }

  return {
    ok:true,
    classification:'SCANNER_DUE_WORK_RESOLVED',
    denominator:planner.length,
    planner,
    bucket_counts:bucketCounts,
    blockers:[]
  };
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
  RUNTIME_SCOPE_ALIASES,
  SCANNER_DUE_BUCKETS,
  SCANNER_DUE_ORDER,
  assertManifestHeaders,
  assertTransactionHeaders,
  assertStrictlyMonotonicFence,
  lockShapeProblems,
  malformedRuntimeLocks,
  runtimeScopeMatches,
  evaluateManifestAppendReadback,
  resolveScannerDueWorkDenominator,
  analyzeNaturalOccurrence,
  auditSnapshot
};
