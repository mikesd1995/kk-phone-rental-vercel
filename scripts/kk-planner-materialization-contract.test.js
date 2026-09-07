'use strict';
const assert=require('assert');
const c=require('../lib/kk-planner-materialization-contract');
let n=0;
const ok=(v,msg)=>{assert(v,msg);n++;};
const eq=(a,b,msg)=>{assert.deepStrictEqual(a,b,msg);n++;};

let r=c.assessPlannerWindow({is_dedicated_window:false,current_plan_count:0});
ok(r.compliant&&r.allowed_to_execute&&r.status==='NOT_REQUIRED','non-dedicated heartbeat does not require planner materialization');

r=c.assessPlannerWindow({is_dedicated_window:true,current_plan_count:2});
ok(r.compliant&&r.allowed_to_execute&&r.status==='MATERIALIZED','dedicated window with current plan is compliant');

r=c.assessPlannerWindow({is_dedicated_window:true,current_plan_count:0,explicit_fallback:true,fallback_reason:'planner API unavailable',recent_fallback_count:0});
ok(!r.compliant&&r.allowed_to_execute&&r.reliability_debt,'explicit fallback is executable exception but not compliant materialization');

r=c.assessPlannerWindow({is_dedicated_window:true,current_plan_count:0,explicit_fallback:true,fallback_reason:'planner API unavailable',recent_fallback_count:3});
ok(r.repeated_fallback,'repeated fallback is surfaced as recurrent reliability debt');

r=c.assessPlannerWindow({is_dedicated_window:true,current_plan_count:0,explicit_fallback:false});
ok(!r.allowed_to_execute&&r.status==='BLOCKED_NO_PLAN','dedicated window without plan or fallback evidence is blocked');

let rb=c.plannerReadbackGate(['PLAN|A','PLAN|B'],[{plan_id:'PLAN|A'},{plan_id:'PLAN|B'}]);
ok(rb.ok&&rb.missing.length===0,'exact planner readback passes matching unique plan IDs');
rb=c.plannerReadbackGate(['PLAN|A','PLAN|B'],[{plan_id:'PLAN|A'},{plan_id:'PLAN|A'}]);
ok(!rb.ok&&rb.duplicate_count===1&&rb.missing[0]==='PLAN|B','duplicate or missing planner identity fails readback');

let day=c.plannerDayHealth({dedicated_windows_due:3,dedicated_windows_with_current_plan:3,dedicated_windows_using_fallback:0});
ok(day.healthy&&day.status==='HEALTHY','all dedicated windows materialized is healthy');
day=c.plannerDayHealth({dedicated_windows_due:3,dedicated_windows_with_current_plan:0,dedicated_windows_using_fallback:3});
ok(!day.healthy&&day.status==='MATERIALIZATION_BROKEN'&&day.missing_plans===3,'zero planner rows across due dedicated windows is broken even with fallback');
day=c.plannerDayHealth({dedicated_windows_due:3,dedicated_windows_with_current_plan:2,dedicated_windows_using_fallback:1});
ok(!day.healthy&&day.status==='PARTIAL_MATERIALIZATION','partial planner materialization remains unhealthy');

eq(c.plannerDayHealth({dedicated_windows_due:0}).status,'NO_DEDICATED_WINDOWS_DUE','no dedicated window is not a planner failure');

let watch=c.dueWatchMaterializationGate({
  now:'2026-09-07T11:42:00+07:00',
  candidate_rows:[
    {status:'WATCHING',show_id:'SHOW|A',next_watch_at:'2026-09-07T11:00:00+07:00',required_for_current_policy:true},
    {status:'WATCHING',show_id:'SHOW|B',next_watch_at:'2026-09-07T13:00:00+07:00',required_for_current_policy:true}
  ],
  materialized_identity_keys:['SHOW|A']
});
ok(watch.ok&&watch.due_watch_count===1&&watch.materialized_due_count===1,'due policy-selected watch passes only after current-window materialization; future watch is not due');

watch=c.dueWatchMaterializationGate({
  now:'2026-09-07T11:42:00+07:00',
  candidate_rows:[{status:'WATCHING / AUTHORITY_HOLD',show_id:'SHOW|P0',next_watch_at:'2026-09-07T05:00:00+07:00',required_for_current_policy:true}],
  materialized_identity_keys:[]
});
ok(!watch.ok&&watch.status==='DUE_WATCH_MATERIALIZATION_GAP'&&watch.missing_materialization[0]==='SHOW|P0','overdue required watch without current materialization blocks clean completion');

watch=c.dueWatchMaterializationGate({
  now:'2026-09-07T11:42:00+07:00',
  candidate_rows:[{status:'WATCHING',show_id:'SHOW|LOW',next_watch_at:'2026-09-07T05:00:00+07:00',required_for_current_policy:false}],
  materialized_identity_keys:[]
});
ok(watch.ok&&watch.required_watch_count===0&&watch.due_watch_count===0,'policy selection remains external to the contract; non-required watches do not become hard-coded backlog policy');

watch=c.dueWatchMaterializationGate({
  now:'2026-09-07T11:42:00+07:00',
  candidate_rows:[{status:'WATCHING',next_watch_at:'2026-09-07T05:00:00+07:00',required_for_current_policy:true}],
  materialized_identity_keys:[]
});
ok(!watch.ok&&watch.missing_identity.length===1,'due required watch without stable identity fails closed');

watch=c.dueWatchMaterializationGate({
  now:'2026-09-07T11:42:00+07:00',
  candidate_rows:[{status:'WATCHING',show_id:'SHOW|BADTIME',next_watch_at:'not-a-time',required_for_current_policy:true}],
  materialized_identity_keys:['SHOW|BADTIME']
});
ok(!watch.ok&&watch.invalid_next_watch[0]==='SHOW|BADTIME','invalid required Next Watch timestamp cannot be treated as current hold coverage');

watch=c.dueWatchMaterializationGate({now:'bad-now',candidate_rows:[],materialized_identity_keys:[]});
ok(!watch.ok&&watch.status==='INVALID_NOW','invalid authoritative time fails closed');

console.log(`kk-planner-materialization-contract: ${n}/${n} PASS`);
