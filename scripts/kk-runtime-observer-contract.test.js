'use strict';
const assert=require('assert');
const c=require('../lib/kk-runtime-observer-contract');
let n=0; const ok=(v,m)=>{assert(v,m);n++;}; const eq=(a,b,m)=>{assert.deepStrictEqual(a,b,m);n++;};

function healthy(){return {
  manual_trigger:false,task_enabled_before:true,task_enabled_after:true,lease_acquired:true,
  lease_version:11,previous_lease_version:10,duplicate_fence_observed:false,manifest_count:1,
  manifest_frozen_before_mutation:true,actual_runtime_evidence_count:1,legitimate_noop:false,
  terminal_manifest:true,lease_released:true,unresolved_prepared_committing:0,candidate_orphans:0,
  ai_orphans:0,unauthorized_outbound_claim:false
};}

let r=c.observeExpectedOccurrence({expected_occurrence:false});
eq(r.status,'NOT_DUE','not due is excluded');
r=c.observeExpectedOccurrence({expected_at_ms:0,now_ms:1000});
eq(r.status,'INVALID_OBSERVATION','time base is required');

r=c.observeExpectedOccurrence({expected_at_ms:1000,now_ms:1200,grace_ms:500});
eq(r.status,'PENDING_WITHIN_GRACE','missing run within grace is pending');
ok(!r.incident,'pending within grace is not incident');

r=c.observeExpectedOccurrence({expected_at_ms:1000,now_ms:2000,grace_ms:500});
eq(r.status,'INCIDENT','missing run beyond grace is incident');
ok(r.reasons.includes('SCHEDULER_NOT_FIRED'),'missing trigger classified');

r=c.observeExpectedOccurrence({expected_at_ms:1000,observed_at_ms:1100,now_ms:1200,grace_ms:500,runtime_input:healthy()});
eq(r.status,'PASS','healthy observed runtime passes');
ok(r.acceptance.accepted,'runtime acceptance reused');

r=c.observeExpectedOccurrence({expected_at_ms:1000,observed_at_ms:1800,now_ms:1800,grace_ms:500,runtime_input:healthy()});
eq(r.status,'INCIDENT','late run beyond grace is incident');
ok(r.reasons.includes('TRIGGER_LATE_BEYOND_GRACE'),'lateness surfaced');

r=c.observeExpectedOccurrence({expected_at_ms:1000,observed_at_ms:1100,now_ms:1200,grace_ms:500,runtime_input:{...healthy(),lease_released:false}});
eq(r.status,'INCIDENT','failed runtime invariant is incident');
ok(r.reasons.includes('LEASE_NOT_RELEASED'),'acceptance reason carried through');

let t=c.taskTransition({enabled_before:true,enabled_after:false});
ok(t.incident&&t.code==='TASK_DISABLED_AFTER','ON to OFF transition is detected');
t=c.taskTransition({enabled_before:false,enabled_after:false});
ok(t.incident&&t.code==='TASK_DISABLED_BEFORE','disabled before detected');
t=c.taskTransition({enabled_before:'TRUE',enabled_after:'TRUE'});
ok(!t.incident,'sheet TRUE strings supported');

const pass=c.observeExpectedOccurrence({expected_at_ms:1000,observed_at_ms:1100,now_ms:1200,grace_ms:500,runtime_input:healthy()});
const fail=c.observeExpectedOccurrence({expected_at_ms:2000,now_ms:3000,grace_ms:500});
const pending=c.observeExpectedOccurrence({expected_at_ms:4000,now_ms:4200,grace_ms:500});
let slo=c.runnerSlo([pass,fail,pending],{target_ratio:0.5});
eq(slo.evaluated,2,'pending excluded from SLO denominator');
eq(slo.passed,1,'one pass counted');
eq(slo.percent,50,'SLO percent deterministic');
ok(!slo.target_met,'P0 incident fails target even at numeric threshold');
slo=c.runnerSlo([pass,pass],{target_ratio:0.99});
ok(slo.target_met&&slo.percent===100,'clean window meets SLO');

let h=c.closureHealth({unresolved_prepared_committing:0,stale_active_leases:0,running_manifests_past_deadline:0,candidate_orphans:0,ai_orphans:0});
ok(h.healthy&&h.status==='HEALTHY','zero closure debt is healthy');
h=c.closureHealth({stale_active_leases:1,ai_orphans:2});
ok(!h.healthy&&h.reasons.includes('STALE_ACTIVE_LEASE')&&h.reasons.includes('AI_ORPHAN'),'closure debt is surfaced');

console.log(`kk-runtime-observer-contract: ${n}/${n} PASS`);
