'use strict';

const GENERIC_EXPECTED_MARKERS=new Set([
  'FROZEN_DEFINITION_BOUNDARY',
  'GENERIC_ASSERTION_BOUNDARY',
  'SAFE_BRANCH'
]);

function text(value){
  return String(value==null?'':value).trim();
}

function upper(value){
  return text(value).toUpperCase();
}

function truthy(value){
  return value===true || ['1','TRUE','YES','ON'].includes(upper(value));
}

function normalized(value){
  return text(value).replace(/\s+/g,' ').trim();
}

function numberOrNull(value){
  const raw=text(value);
  if(!raw) return null;
  const n=Number(raw);
  return Number.isFinite(n)?n:null;
}

function isGenericActual(value){
  const v=upper(value);
  return /^CANARY[_-]?\d+_SAFE_BRANCH_ASSERTED$/.test(v)
    || v==='SAFE_BRANCH_ASSERTED'
    || v==='GENERIC_ASSERTION_PASS';
}

function isGenericEvidence(value){
  const v=upper(value);
  return !v
    || v.includes('INDEPENDENT SYNTHETIC ASSERTION EXECUTED FROM FROZEN')
    || v==='CURRENT_RUN_ASSERTION_EVIDENCE'
    || v==='GENERIC_ASSERTION_EVIDENCE';
}

function expectedDecisionBound(def,workspaceExpected){
  const id=text(def&&def.test_id);
  const expected=normalized(def&&def.expected_result);
  const actual=normalized(workspaceExpected);
  if(expected && actual===expected) return true;
  const legacyMarkers=new Set([
    `FROZEN DEFINITION ${upper(id)}`,
    `FROZEN_DEFINITION:${upper(id)}`
  ]);
  return !!id && legacyMarkers.has(upper(actual));
}

function uniqueNonblank(values){
  const cleaned=values.map(text);
  return cleaned.every(Boolean) && new Set(cleaned).size===cleaned.length;
}

function countMap(values){
  const map=new Map();
  for(const value of values){
    const key=text(value);
    map.set(key,(map.get(key)||0)+1);
  }
  return map;
}

function isoMs(value){
  const ms=Date.parse(text(value));
  return Number.isFinite(ms)?ms:null;
}

function provenanceAudit(provenance={},runId=''){
  const reasons=[];
  const taskId=text(provenance.task_id);
  const expectedTaskId=text(provenance.expected_task_id);
  const taskTitle=text(provenance.task_title);
  const expectedTaskTitle=text(provenance.expected_task_title);
  const taskLastRun=isoMs(provenance.task_last_run_time);
  const runAt=isoMs(provenance.run_at);
  const scheduledAt=isoMs(provenance.scheduled_at);
  const taskEnabledBefore=provenance.task_enabled_before===true;
  const taskEnabledAfter=provenance.task_enabled_after===true;
  const maxWindowMinutes=Number.isFinite(Number(provenance.max_window_minutes))
    ? Math.max(1,Math.min(120,Number(provenance.max_window_minutes)))
    : 30;
  const maxWindowMs=maxWindowMinutes*60*1000;

  if(!taskId) reasons.push('TASK_ID_MISSING');
  if(expectedTaskId && taskId!==expectedTaskId) reasons.push('TASK_ID_MISMATCH');
  if(expectedTaskTitle && taskTitle!==expectedTaskTitle) reasons.push('TASK_TITLE_MISMATCH');
  if(!taskEnabledBefore) reasons.push('TASK_NOT_PROVEN_ON_BEFORE_RUN');
  if(!taskEnabledAfter) reasons.push('TASK_NOT_PROVEN_ON_AFTER_RUN');

  if(runAt==null || scheduledAt==null){
    reasons.push('RUN_AT_OR_SCHEDULED_AT_INVALID');
  }else if(Math.abs(runAt-scheduledAt)>maxWindowMs){
    reasons.push('RUN_NOT_BOUND_TO_SCHEDULED_WINDOW');
  }

  if(taskLastRun==null || runAt==null){
    reasons.push('TASK_LAST_RUN_OR_RUN_AT_INVALID');
  }else if(Math.abs(taskLastRun-runAt)>maxWindowMs){
    reasons.push('TASK_LAST_RUN_NOT_BOUND_TO_RUN_WINDOW');
  }

  if(runId && text(provenance.run_id)!==runId){
    reasons.push('PROVENANCE_RUN_ID_MISMATCH');
  }

  return {
    natural_runtime_attribution:reasons.length===0,
    reasons,
    optional_evidence:{
      matching_lock_count:Number.isInteger(Number(provenance.matching_lock_count))
        ? Number(provenance.matching_lock_count)
        : null,
      matching_reconciliation_count:Number.isInteger(Number(provenance.matching_reconciliation_count))
        ? Number(provenance.matching_reconciliation_count)
        : null
    }
  };
}

function auditCanarySnapshot(input={}){
  const definitions=Array.isArray(input.definitions)?input.definitions:[];
  const workspace=Array.isArray(input.workspace)?input.workspace:[];
  const enabled=definitions.filter(row=>truthy(row.enabled));

  const structuralErrors=[];
  const assertionErrors=[];
  const writeErrors=[];

  if(input.definition_snapshot_frozen!==true){
    structuralErrors.push('DEFINITION_SNAPSHOT_NOT_PROVEN_FROZEN');
  }
  if(input.definition_snapshot_drift!==false){
    structuralErrors.push('DEFINITION_SNAPSHOT_DRIFT_STATE_NOT_CLEAN');
  }

  const testIds=enabled.map(row=>text(row.test_id));
  const namespaces=enabled.map(row=>text(row.isolation_namespace));
  if(enabled.length===0) structuralErrors.push('NO_ENABLED_DEFINITIONS');
  if(!uniqueNonblank(testIds)) structuralErrors.push('ENABLED_TEST_IDS_MUST_BE_NONBLANK_UNIQUE');
  if(!uniqueNonblank(namespaces)) structuralErrors.push('ENABLED_ISOLATION_NAMESPACES_MUST_BE_NONBLANK_UNIQUE');

  const definitionRunIds=[...new Set(enabled.map(row=>text(row.last_run_id)).filter(Boolean))];
  if(definitionRunIds.length!==1) structuralErrors.push('ENABLED_DEFINITIONS_REQUIRE_EXACTLY_ONE_LAST_RUN_ID');
  const runId=text(input.run_id)||definitionRunIds[0]||'';
  if(runId && definitionRunIds.length===1 && definitionRunIds[0]!==runId){
    structuralErrors.push('RUN_ID_MISMATCH_WITH_DEFINITIONS');
  }

  const runWorkspace=workspace.filter(row=>!runId || text(row.run_id)===runId);
  const workspaceIds=runWorkspace.map(row=>text(row.test_id));
  if(runWorkspace.length!==enabled.length) structuralErrors.push('ENABLED_COUNT_MUST_EQUAL_WORKSPACE_COUNT');
  if(!uniqueNonblank(workspaceIds)) structuralErrors.push('WORKSPACE_TEST_IDS_MUST_BE_NONBLANK_UNIQUE');

  const expectedCounts=countMap(testIds);
  const actualCounts=countMap(workspaceIds);
  for(const id of new Set([...expectedCounts.keys(),...actualCounts.keys()])){
    if((expectedCounts.get(id)||0)!==(actualCounts.get(id)||0)){
      structuralErrors.push(`WORKSPACE_TEST_SET_MISMATCH:${id||'<blank>'}`);
    }
  }

  const workspaceById=new Map(runWorkspace.map(row=>[text(row.test_id),row]));
  for(const def of enabled){
    const id=text(def.test_id);
    const ws=workspaceById.get(id);
    const expectedResult=normalized(def.expected_result);
    const namespace=text(def.isolation_namespace);

    if(upper(def.last_result)!=='PASS'){
      assertionErrors.push(`${id}:SUITE_LAST_RESULT_NOT_PASS`);
    }
    if(!upper(def.actual_result).includes('CANARY_SYNTHETIC_PASS')){
      assertionErrors.push(`${id}:SUITE_SYNTHETIC_PASS_MARKER_MISSING`);
    }

    if(numberOrNull(def.production_writes)!==0){
      writeErrors.push(`${id}:SUITE_PRODUCTION_WRITES_NOT_ZERO`);
    }

    if(!ws) continue;

    if(text(ws.run_id)!==runId){
      structuralErrors.push(`${id}:WORKSPACE_RUN_ID_MISMATCH`);
    }
    if(namespace && !(text(ws.synthetic_entity_id)===namespace || text(ws.synthetic_entity_id).startsWith(namespace+'|'))){
      assertionErrors.push(`${id}:SYNTHETIC_ENTITY_NOT_BOUND_TO_ISOLATION_NAMESPACE`);
    }

    const wsExpected=normalized(ws.expected_decision);
    if(!expectedResult){
      assertionErrors.push(`${id}:DEFINITION_EXPECTED_RESULT_MISSING`);
    }else if(!expectedDecisionBound(def,ws.expected_decision)){
      assertionErrors.push(`${id}:EXPECTED_DECISION_NOT_BOUND_TO_FROZEN_DEFINITION`);
    }
    if(GENERIC_EXPECTED_MARKERS.has(upper(ws.expected_decision))){
      assertionErrors.push(`${id}:GENERIC_EXPECTED_DECISION_REJECTED`);
    }
    if(!text(ws.input_state) || upper(ws.input_state).startsWith('ISOLATED CURRENT-RUN SCENARIO BRANCH FOR')){
      assertionErrors.push(`${id}:SCENARIO_SPECIFIC_INPUT_STATE_REQUIRED`);
    }
    if(isGenericEvidence(ws.synthetic_evidence)){
      assertionErrors.push(`${id}:SCENARIO_SPECIFIC_SYNTHETIC_EVIDENCE_REQUIRED`);
    }
    if(!text(ws.actual_decision) || isGenericActual(ws.actual_decision)){
      assertionErrors.push(`${id}:SCENARIO_SPECIFIC_ACTUAL_DECISION_REQUIRED`);
    }else if(normalized(ws.actual_decision)===wsExpected){
      assertionErrors.push(`${id}:ACTUAL_DECISION_MUST_BE_INDEPENDENT_OF_EXPECTED_TEXT`);
    }
    if(upper(ws.result)!=='PASS'){
      assertionErrors.push(`${id}:WORKSPACE_RESULT_NOT_PASS`);
    }
    if(numberOrNull(ws.actual_write_count)!==0){
      writeErrors.push(`${id}:WORKSPACE_PRODUCTION_WRITES_NOT_ZERO`);
    }
    if(!upper(ws.expected_write_boundary).includes('PRODUCTION=0')){
      writeErrors.push(`${id}:ZERO_WRITE_BOUNDARY_NOT_EXPLICIT`);
    }
  }

  const structuralCompleteness=structuralErrors.length===0;
  const zeroProductionWrites=writeErrors.length===0;
  const scenarioSpecificAssertions=assertionErrors.length===0;
  const syntheticAcceptance=structuralCompleteness && zeroProductionWrites && scenarioSpecificAssertions;

  const provenance=provenanceAudit(input.provenance||{},runId);
  let classification='CANARY_ACCEPTANCE_FAIL';
  if(structuralCompleteness && zeroProductionWrites && !scenarioSpecificAssertions){
    classification='CANARY_STRUCTURAL_PASS_ASSERTION_EVIDENCE_REJECTED';
  }else if(syntheticAcceptance && !provenance.natural_runtime_attribution){
    classification='CANARY_SYNTHETIC_ACCEPTED_RUNTIME_UNATTRIBUTED';
  }else if(syntheticAcceptance && provenance.natural_runtime_attribution){
    classification='CANARY_SYNTHETIC_ACCEPTED_NATURAL_ATTRIBUTED';
  }

  return {
    ok:syntheticAcceptance,
    run_id:runId||null,
    enabled_definition_count:enabled.length,
    workspace_count:runWorkspace.length,
    structural_completeness:structuralCompleteness,
    scenario_specific_assertions:scenarioSpecificAssertions,
    zero_production_writes:zeroProductionWrites,
    synthetic_acceptance:syntheticAcceptance,
    natural_runtime_attribution:provenance.natural_runtime_attribution,
    classification,
    structural_errors:structuralErrors,
    assertion_errors:assertionErrors,
    write_errors:writeErrors,
    provenance_reasons:provenance.reasons,
    provenance_optional_evidence:provenance.optional_evidence,
    production_or_provider_proof:false,
    production_cutover_authorized:false
  };
}

module.exports={
  auditCanarySnapshot,
  provenanceAudit,
  isGenericActual,
  isGenericEvidence,
  expectedDecisionBound
};
