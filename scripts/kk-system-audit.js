#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const Control=require('../server/control-plane-contract.js');
const Persistence=require('../server/control-plane-persistence.js');
const Replay=require('../server/event-lineage-replay.js');
const Reliability=require('../server/kk-reliability-learning-agent.js');
const Orchestration=require('../server/kk-agent-orchestration.js');

function usage(){
  console.error('Usage: node scripts/kk-system-audit.js <snapshot.json>');
  console.error('Snapshot may contain manifest_headers, transaction_headers, canonical_tasks, occurrences, lineage_rows, and reliability_observations/incidents.');
}

async function main(){
  const file=process.argv[2];
  if(!file){
    usage();
    process.exitCode=64;
    return;
  }

  try{
    const input=JSON.parse(fs.readFileSync(path.resolve(process.cwd(),file),'utf8'));
    const report={
      generated_by:'kk-system-audit-v3',
      production_writes:0,
      task_mutations:0,
      policy_mutations:0,
      provider_sends:0
    };

    if(input.manifest_headers || input.transaction_headers || input.occurrences){
      report.control_plane=Control.auditSnapshot(input);
    }
    if(input.canonical_tasks && input.occurrences){
      report.control_plane_persistence=Persistence.auditPersistenceSnapshot(input,{required:6});
    }
    if(input.lineage_rows){
      report.event_bridge=Replay.replayLineageSet(input.lineage_rows,{iterations:10});
      delete report.event_bridge.records;
    }

    let agentEvidenceFailed=false;
    const reliabilityObservations=input.reliability_observations || input.incidents;
    if(Array.isArray(reliabilityObservations)){
      report.reliability_learning=Reliability.analyzeReliability(reliabilityObservations,{
        incident_history:Array.isArray(input.incident_history) ? input.incident_history : []
      });
      report.agent_orchestration=await Orchestration.recordExecution({
        intent:'reliability_audit',
        invoked_agents:['kk-reliability-learning'],
        input:{
          observations:reliabilityObservations,
          incident_history:Array.isArray(input.incident_history) ? input.incident_history : []
        },
        output:report.reliability_learning,
        correlation_id:String(input.run_id||input.audit_id||'system-audit'),
        gate_status:'RECORDED',
        owner_review_required:false
      });
      agentEvidenceFailed=!report.agent_orchestration.pass;
    }

    console.log(JSON.stringify(report,null,2));
    const controlFailed=report.control_plane && !report.control_plane.pass;
    const persistenceFailed=report.control_plane_persistence && !report.control_plane_persistence.pass;
    process.exitCode=(controlFailed || persistenceFailed || agentEvidenceFailed) ? 2 : 0;
  }catch(error){
    console.error(error && error.stack || String(error));
    process.exitCode=1;
  }
}

main();
