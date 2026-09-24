'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { SqliteRepository } = require('../sqlite-repository');
const { ControlPlane } = require('../control-plane');
const C = require('../contracts');
const { POLICY_LEVELS } = require('../../server/agent-governance-contract');
const { analyzeSnapshot, VERSION } = require('./reconcile');
const SCOPE = Object.freeze({workspace_id:'local-ops-pilot',project_id:'kk-phone-rental-observation'});
const AGENT = 'kk-ops-readonly';
const CAPABILITIES = ['platform.read','platform.task.write','platform.evidence.write'];
const VERSIONS = Object.freeze({policy_version:'local-ops-pilot-v1',project_pack_version:'1.0.0',workflow_version:VERSION,agent_version:'1.0.0',tool_contract_version:'1.0.0',capability_certificate_version:'1.0.0'});
const MARKER = 'kk-ops-local-state-v1';
function directory(value) {
  C.text(value); C.requireThat(!/^(?:[a-z]+:\/\/|\\\\|\/\/)/i.test(value), 'LOCAL_DIRECTORY_REQUIRED');
  const resolved = path.resolve(value);
  let cursor = resolved;
  while (true) {
    if (fs.existsSync(cursor)) C.requireThat(!fs.lstatSync(cursor).isSymbolicLink(), 'STATE_SYMLINK_DENIED');
    const parent = path.dirname(cursor); if (parent === cursor) break; cursor = parent;
  }
  return resolved;
}
function seed(repository, now) {
  repository.transaction(tx => {
    for (const level of POLICY_LEVELS) {
      const p = {...SCOPE,policy_id:'local:' + level,policy_version:VERSIONS.policy_version,scope:level,scope_id:{PLATFORM_HARD:'platform',WORKSPACE:SCOPE.workspace_id,PROJECT:SCOPE.project_id,WORKFLOW:'default',TASK:'default'}[level],policy_level:level,allow_capabilities:CAPABILITIES,deny_capabilities:[],permission_ceiling:'P2',created_at:now,activated_at:now,deprecated_at:null};
      p.content_hash = C.contentHash(p); tx.insert('policies',SCOPE,p.policy_id,p);
    }
    const cert = {...SCOPE,certificate_id:'local-host-certificate',subject_agent:AGENT,environment:'local',capabilities:CAPABILITIES,permission_ceiling:'P2',issued_by:'local-cli-host',issuer_type:'PLATFORM',issued_at:now,expires_at:new Date(Date.parse(now)+86400000).toISOString(),revoked_at:null,revoked_by:null,revocation_reason:null,certificate_version:VERSIONS.capability_certificate_version};
    cert.content_hash = C.contentHash(cert,['revoked_at','revoked_by','revocation_reason']); tx.insert('certificates',SCOPE,cert.certificate_id,cert);
    tx.insert('kill_switches',SCOPE,'current',{...SCOPE,observed_at:now,expires_at:new Date(Date.parse(now)+3600000).toISOString(),controls:{AGENT_EXECUTION:false,EXTERNAL_WRITE:true,PRODUCTION_WRITE:true,DEPLOYMENT:true,SCHEDULES:true}});
  });
}
function initializePilot(stateDirectory, {now = new Date().toISOString()} = {}) {
  C.utc(now); const dir = directory(stateDirectory);
  fs.mkdirSync(dir,{recursive:true});
  C.requireThat(fs.readdirSync(dir).length === 0,'STATE_DIRECTORY_NOT_EMPTY');
  const marker = path.join(dir,'pilot.json');
  fs.writeFileSync(marker,JSON.stringify({kind:MARKER,created_at:now}),{flag:'wx',mode:0o600});
  let repo;
  try { repo = new SqliteRepository({filename:path.join(dir,'pilot.sqlite')}); seed(repo,now); }
  finally { repo?.close(); }
  return {state_directory:dir,environment:'local',production_writes:0,provider_calls:0};
}
function runPilot({stateDirectory,snapshot,occurrenceId,expectedPolicyVersion,now = new Date().toISOString(),maxAgeMs = 3600000,budgetSteps = 4}) {
  C.utc(now); C.id(occurrenceId); C.requireThat(Number.isSafeInteger(budgetSteps) && budgetSteps >= 0 && budgetSteps <= 10,'BUDGET_INVALID');
  // Validate untrusted input before touching persistent task state.
  const report = analyzeSnapshot(snapshot,{now,expectedPolicyVersion,maxAgeMs});
  const dir = directory(stateDirectory); const marker = path.join(dir,'pilot.json'); const db = path.join(dir,'pilot.sqlite');
  C.requireThat(fs.existsSync(marker) && fs.existsSync(db),'LOCAL_PILOT_NOT_INITIALIZED');
  C.requireThat([marker,db].every(p => fs.lstatSync(p).isFile() && !fs.lstatSync(p).isSymbolicLink()),'STATE_SYMLINK_DENIED');
  C.requireThat(fs.statSync(marker).size <= 1024,'STATE_MARKER_INVALID');
  C.requireThat(JSON.parse(fs.readFileSync(marker,'utf8')).kind === MARKER,'STATE_MARKER_INVALID');
  const lockPath = path.join(dir,'worker.lock'); let lock;
  try { lock = fs.openSync(lockPath,'wx',0o600); } catch (e) { if(e.code==='EEXIST') C.fail('LOCAL_WORKER_BUSY_OR_RECOVERY_REQUIRED'); throw e; }
  let repo;
  try {
    repo = new SqliteRepository({filename:db});
    const service = new ControlPlane({repository:repo,...SCOPE,agent_id:AGENT,certificate_id:'local-host-certificate',clock:()=>now});
    const identity = C.changeHash({occurrenceId}); const taskId = 'ops-' + identity; const runId = 'run-' + identity;
    const requestHash = C.changeHash({snapshot,expectedPolicyVersion,maxAgeMs,budgetSteps,analyzer:VERSION});
    const budget = {steps:budgetSteps,tool_calls:0,retries:0,cost:0};
    service.createTask({...SCOPE,...VERSIONS,task_id:taskId,objective:'Read-only observation ' + requestHash,agent_role:AGENT,risk_class:'R1',permission_ceiling:'P2',requested_capabilities:CAPABILITIES,budget},'create-' + identity);
    let task = service.getTask(taskId,VERSIONS.policy_version);
    const checkpointId = 'cp-' + identity;
    if (task.status === 'SUCCEEDED') {
      const cp = repo.get('checkpoints',SCOPE,checkpointId);
      C.requireThat(cp && cp.checkpoint_hash === C.contentHash(cp,['checkpoint_hash']) && cp.checkpoint_payload.request_hash === requestHash,'CHECKPOINT_CORRUPT');
      return {replayed:true,historical_observation:true,task_id:taskId,run_id:runId,report:cp.checkpoint_payload.report};
    }
    C.requireThat(task.status === 'CREATED','RECOVERY_REQUIRED');
    for (const next of ['VALIDATING','READY','PLANNING']) task=service.transitionTask(taskId,task.version,next,VERSIONS.policy_version,next+'-'+identity);
    service.startRun(taskId,task.version,{...VERSIONS,run_id:runId,model_provider:'NONE',model_id:'deterministic-observation-no-model',skill_versions:[],budget},'start-'+identity);
    const charged=service.consumeBudget(taskId,runId,{steps:1,tool_calls:0,retries:0,cost:0},VERSIONS.policy_version,'analyze-'+identity);
    C.requireThat(!charged.stopped,'BUDGET_EXCEEDED');
    const evidence=service.recordEvidence({evidence_id:'evidence-'+identity,created_by_run_id:runId,source_type:'LOCAL_IMPORTED_SNAPSHOT',source_ref:'local-snapshot:'+C.changeHash(snapshot),observed_at:snapshot.observed_at,content_hash:C.changeHash(report),data_classification:'INTERNAL',reliability_class:'OBSERVED'},VERSIONS.policy_version,'evidence-'+identity);
    C.requireThat(!evidence.stopped,'BUDGET_EXCEEDED');
    service.saveCheckpoint(taskId,runId,{checkpoint_id:checkpointId,completed_steps:['snapshot-analysis'],pending_steps:[],checkpoint_payload:{request_hash:requestHash,report}},VERSIONS.policy_version,'checkpoint-'+identity);
    task=service.getTask(taskId,VERSIONS.policy_version);
    task=service.transitionTask(taskId,task.version,'EVALUATING',VERSIONS.policy_version,'evaluate-'+identity);
    service.transitionTask(taskId,task.version,'SUCCEEDED',VERSIONS.policy_version,'complete-'+identity);
    return {replayed:false,historical_observation:false,task_id:taskId,run_id:runId,report};
  } finally {
    repo?.close(); fs.closeSync(lock); fs.unlinkSync(lockPath);
  }
}
module.exports={initializePilot,runPilot,SCOPE,VERSIONS};
