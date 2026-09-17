'use strict';

const Bridge=require('./event-lineage-bridge.js');

function comparable(rows){
  return Bridge.validateLineageSet(rows)
    .map(row=>({
      mapping_version:row.mapping_version,
      event_family_id:row.event_family_id,
      tracker_show_id:row.tracker_show_id,
      show_instance_id:row.show_instance_id,
      event_date:row.event_date,
      core_event_id:row.core_event_id,
      lineage_key:row.lineage_key,
      mapping_status:row.mapping_status
    }))
    .sort((a,b)=>a.lineage_key.localeCompare(b.lineage_key));
}

function replayLineageSet(inputRows,options={}){
  const iterations=Number(options.iterations||10);
  if(!Number.isInteger(iterations)||iterations<1||iterations>1000){
    throw new Error('iterations must be an integer between 1 and 1000');
  }
  const baseline=comparable(inputRows||[]);
  const encoded=JSON.stringify(baseline);
  for(let i=1;i<iterations;i++){
    const next=JSON.stringify(comparable(inputRows||[]));
    if(next!==encoded) throw new Error(`lineage replay diverged at iteration ${i+1}`);
  }
  return {
    mapping_version:Bridge.MAPPING_VERSION,
    mapping_count:baseline.length,
    unique_lineage_keys:new Set(baseline.map(x=>x.lineage_key)).size,
    unique_show_instances:new Set(baseline.map(x=>x.show_instance_id)).size,
    unique_core_event_ids:new Set(baseline.map(x=>x.core_event_id)).size,
    iterations,
    deterministic:true,
    production_writes:0,
    records:baseline
  };
}

function dryRunResolve(inputRows,queries){
  const results=(queries||[]).map(query=>({
    query,
    core_event_id:Bridge.resolveCoreEventId(inputRows||[],query)
  }));
  return {results,production_writes:0};
}

module.exports={replayLineageSet,dryRunResolve};
