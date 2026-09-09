'use strict';
const assert=require('node:assert/strict');
const closure=require('../lib/kk-discovery-closure-contract');
const monthly=require('../lib/kk-market-presentation-contract');
const planner=require('../lib/kk-planner-materialization-contract');
let count=0;
function test(name,fn){fn();count++;console.log('PASS '+name);}
const invalid=[undefined,null,'',false,true,-1,NaN,Infinity,'NaN','unknown','-1',0.5,Number.MAX_SAFE_INTEGER+1];
const passes=['PASS_A_OFFICIAL_UNIVERSE','PASS_B_OPPORTUNITY_KEYWORDS','PASS_C_REVERSE_COMPETITOR','PASS_D_NEGATIVE_CROSS_SOURCE_AUDIT'];
const zeroClosure={ready_lineage_gap:0,canonical_monthly_gap:0,unresolved_prepared_committing:0};
const zeroMorning={hidden_high_value_signals:0,explicit_hold_missing_next_watch:0,explicit_hold_overdue_next_watch:0,unresolved_prepared_committing:0};
const zeroMonthly={duplicate_event_key:0,canonical_monthly_gap:0,formula_ref_error:0,sort_order_pass:true,tier_mapping_pass:true,color_rule_present:true,week_separator_pass:true,full_row_integrity_pass:true};
test('closure requires evidence for every zero debt, not defaults',()=>{
  assert.equal(closure.verifierFinishClosure({}).can_finish,false);
  for(const field of Object.keys(zeroClosure))for(const value of invalid)assert.equal(closure.verifierFinishClosure({...zeroClosure,[field]:value}).can_finish,false,field+':'+value);
  assert.equal(closure.verifierFinishClosure(zeroClosure).can_finish,true);
});
test('morning readiness never converts unknown evidence to zero',()=>{
  for(const field of Object.keys(zeroMorning))for(const value of invalid)assert.equal(closure.morningRevenueClosure({...zeroMorning,[field]:value}).ready,false,field+':'+value);
  assert.equal(closure.morningRevenueClosure(zeroMorning).ready,true);
  assert.equal(closure.morningRevenueClosure({...zeroMorning,overdue_next_watch:1}).ready,false);
});
test('monthly commit requires typed counters and explicit true readbacks',()=>{
  assert.equal(monthly.monthlyNormalizerGate({}).can_commit,false);
  for(const field of ['duplicate_event_key','canonical_monthly_gap','formula_ref_error'])for(const value of invalid)assert.equal(monthly.monthlyNormalizerGate({...zeroMonthly,[field]:value}).can_commit,false);
  for(const field of ['sort_order_pass','tier_mapping_pass','color_rule_present','week_separator_pass','full_row_integrity_pass'])for(const value of [undefined,null,false,'FALSE','false','',0,'0',1])assert.equal(monthly.monthlyNormalizerGate({...zeroMonthly,[field]:value}).can_commit,false);
  assert.equal(monthly.monthlyNormalizerGate(zeroMonthly).can_commit,true);
});
test('non-numeric scanner coverage is never FULL or fake zero debt',()=>{
  const complete={executed_passes:passes,required_source_family_attempts:4,accounted_source_family_attempts:4,blocked_required_routes:0,unaccounted_signals:0};
  for(const field of ['required_source_family_attempts','accounted_source_family_attempts','blocked_required_routes','unaccounted_signals'])for(const value of invalid)assert.equal(closure.nightlyUltraDeepCompletion({...complete,[field]:value}).complete,false,field+':'+value);
  assert.equal(closure.nightlyUltraDeepCompletion(complete).complete,true);
  assert.equal(closure.nightlyUltraDeepCompletion({...complete,required_source_family_attempts:0}).complete,false);
  assert.equal(closure.nightlySourceDebtRetry({}).required,true);
  assert.deepEqual(closure.nightlySourceDebtRetry({}).next_windows,[]);
});
test('year-end closure does not treat unknown evidence as completion',()=>{
  const complete={executed_passes:passes,unaccounted_signals:0,unresolved_high_priority_backlog:0,cross_projection_gaps:0};
  for(const field of ['unaccounted_signals','unresolved_high_priority_backlog','cross_projection_gaps'])for(const value of invalid)assert.equal(closure.yearEndCompletion({...complete,[field]:value}).complete,false);
});
test('packet requires dual stable identity and duplicate ready packets are ambiguous',()=>{
  const c={event_family_id:'F',show_id:'S',work_packet_id:'WP',status:'READY_FOR_VERIFIER'};
  const p={...c,packet_status:'READY_FOR_VERIFIER'};
  assert.equal(closure.handoffReadiness(c,p).ready,true);
  for(const key of ['event_family_id','show_id','work_packet_id'])assert.equal(closure.handoffReadiness(c,{...p,[key]:''}).ready,false);
  assert.equal(closure.orphanReadyCandidates([c],[p,p]).length,1);
  assert.equal(closure.orphanReadyCandidates([c],[p]).length,0);
});
test('missing signal identity remains accounting debt',()=>{
  assert.equal(closure.signalAccounting([{}],[]).zero_unaccounted,false);
  assert.equal(closure.signalAccounting([{signal_id:'S'}],[{signal_id:'S',kind:'EXPLICIT_HOLD'}]).zero_unaccounted,true);
});
test('generic verification hold beats any numeric score, without an artist special-case',()=>{
  for(const status of ['HOLD','VERIFIED_HOLD','PENDING_VERIFICATION','CANCELLED','POSTPONED'])for(const score of [90,95,100])assert.equal(monthly.rentalOpportunityTier(score,status),'HOLD');
  assert.equal(monthly.rentalOpportunityTier(95,'ACTIVE'),'S+');
});
test('planner exact readback rejects extras, blanks and duplicated expectation',()=>{
  assert.equal(planner.plannerReadbackGate(['A'],[{plan_id:'A'},{plan_id:'B'}]).ok,false);
  assert.equal(planner.plannerReadbackGate(['A'],[{plan_id:'A'},{}]).ok,false);
  assert.equal(planner.plannerReadbackGate(['A','A'],[{plan_id:'A'}]).ok,false);
  assert.equal(planner.plannerReadbackGate(['A'],[{plan_id:'A'}]).ok,true);
});
test('missing watch read is not equivalent to an explicitly empty result',()=>{
  const now='2026-09-08T12:00:00+07:00';
  assert.equal(planner.dueWatchMaterializationGate({now}).ok,false);
  assert.equal(planner.dueWatchMaterializationGate({now,candidate_rows:[]}).ok,true);
});
test('unknown planner read or textual fallback permission is not executable evidence',()=>{
  assert.equal(planner.assessPlannerWindow({}).allowed_to_execute,false);
  assert.equal(planner.assessPlannerWindow({is_dedicated_window:true,current_plan_count:0,explicit_fallback:'FALSE',fallback_reason:'x'}).allowed_to_execute,false);
  assert.equal(planner.plannerDayHealth({}).healthy,false);
  assert.equal(planner.plannerDayHealth({dedicated_windows_due:2,dedicated_windows_with_current_plan:3,dedicated_windows_using_fallback:0}).healthy,false);
});
console.log(`${count} evidence-boundary invariant groups passed (local only)`);
