'use strict';
const Bridge=require('../../server/event-lineage-bridge');
const NOW='2026-09-24T13:00:00.000Z';
function snapshot(){
  const e={event_family_id:'FAM|sample|20261010',tracker_show_id:'SHOW|sample|20261010|S1',event_date:'2026-10-10',event_name:'Sample',canonical_status:'VERIFIED',verifier_confirmed:true,in_area:true,rentable:true,identity_conflict:false,date_conflict:false,lifecycle_conflict:false,score:80,top_pick:false,owner_promote:false,remaining_phone_capacity:2};
  const surface=rows=>({status:'COMPLETE',observed_at:NOW,source_ref:'fixture:synthetic',rows});
  return {schema_version:'kk-ops-snapshot-v1',observed_at:NOW,policy:{version:'v4.9.36',active_versions:['v4.9.36'],observed_at:NOW,source_ref:'fixture:policy'},scope:{kind:'SELECTED_EVENT_FAMILY',family_id:e.event_family_id},surfaces:{canonical:surface([e]),monthly:surface([{event_family_id:e.event_family_id,tracker_show_id:e.tracker_show_id,event_date:e.event_date,event_name:e.event_name,status:'VERIFIED'}]),lineage:surface([Bridge.buildLineageRecord({...e,core_event_id:'EVT-SAMPLE'})]),core:surface([{event_id:'EVT-SAMPLE',event_name:'Sample',event_date:'2026-10-10',status:'open'}]),web_ready:surface([{event_id:'EVT-SAMPLE',event_name:'Sample',event_date:'2026-10-10',visibility:'SHOW'}])}};
}
module.exports={NOW,snapshot};
