#!/usr/bin/env node
'use strict';

// One-shot zero-write live acceptance on the canonical public-GViz read path.
// Sensitive rows are processed in ephemeral memory only. No response payload,
// personal data, booking identifiers, source URLs or sheets are logged.
const F=require('../server/admin-sheet-fallback.js');
const SnapshotHealth=require('../admin/snapshot-health.js');
const SHEET_ID='12Z3e_T89jVr5tR5_0tEOSRLrarB-s0YwHgUTRQq6SZU';

async function accept({buildSnapshot=F.buildSnapshot,assess=SnapshotHealth.assess}={}){
  // Production currently runs the public GViz reader; do not silently use CI
  // credentials or enable a private transport in this probe.
  const snapshot=await buildSnapshot({sheetId:SHEET_ID,env:{},cache:false});
  const health=assess(snapshot);
  const required=['events','bookings','current_bookings','assets'];
  const arraysValid=required.every(x=>Array.isArray(snapshot[x]));
  const sourceOk=snapshot.snapshot_source==='direct-sheet-gviz-readonly-fallback';
  const safe=snapshot.write_actions_enabled===false && snapshot.degraded_read_only===true;
  const nonempty=Array.isArray(snapshot.events)&&snapshot.events.length>0 &&
    Array.isArray(snapshot.bookings)&&snapshot.bookings.length>0 &&
    Array.isArray(snapshot.assets)&&snapshot.assets.length>0;
  return {
    ok:!!(arraysValid&&sourceOk&&safe&&nonempty&&health.ok),
    schema_valid:arraysValid,
    source_valid:sourceOk,
    write_guard_valid:safe,
    nonempty:nonempty,
    snapshot_health_valid:health.ok===true,
    counts:{
      events:Array.isArray(snapshot.events)?snapshot.events.length:0,
      bookings:Array.isArray(snapshot.bookings)?snapshot.bookings.length:0,
      current_bookings:Array.isArray(snapshot.current_bookings)?snapshot.current_bookings.length:0,
      assets:Array.isArray(snapshot.assets)?snapshot.assets.length:0
    }
  };
}
async function main(){
  let report;
  try{report=await accept();}
  catch(_){
    // Do not log error.messages: third-party transport errors can echo private
    // spreadsheet URLs or response fragments.
    console.error('ADMIN_GVIZ_LIVE_SNAPSHOT_ACCEPTANCE_FAILED');
    process.exitCode=1;return;
  }
  console.log(JSON.stringify(report));
  if(!report.ok)process.exitCode=1;
}
if(require.main===module)main();
module.exports={accept};
