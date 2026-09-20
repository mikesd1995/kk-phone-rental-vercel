#!/usr/bin/env node
'use strict';

const fs=require('fs');
const path=require('path');
const Control=require('../server/control-plane-contract.js');
const Persistence=require('../server/control-plane-persistence.js');
const Replay=require('../server/event-lineage-replay.js');

function usage(){
  console.error('Usage: node scripts/kk-system-audit.js <snapshot.json>');
  console.error('Snapshot may contain manifest_headers, transaction_headers, canonical_tasks, occurrences, and lineage_rows.');
}

const file=process.argv[2];
if(!file){
  usage();
  process.exitCode=64;
}else{
  try{
    const input=JSON.parse(fs.readFileSync(path.resolve(process.cwd(),file),'utf8'));
    const report={generated_by:'kk-system-audit-v2',production_writes:0,task_mutations:0};
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
    console.log(JSON.stringify(report,null,2));
    const controlFailed=report.control_plane && !report.control_plane.pass;
    const persistenceFailed=report.control_plane_persistence && !report.control_plane_persistence.pass;
    process.exitCode=(controlFailed || persistenceFailed) ? 2 : 0;
  }catch(error){
    console.error(error && error.stack || String(error));
    process.exitCode=1;
  }
}
