'use strict';
const assert=require('assert');
const c=require('../lib/kk-investigate-contract');
let n=0; const ok=(v,m)=>{assert(v,m);n++;}; const eq=(a,b,m)=>{assert.deepStrictEqual(a,b,m);n++;};

let r=c.investigationStatus({incident_code:'TASK_DISABLED_AFTER'});
eq(r.stage,'INSUFFICIENT_EVIDENCE','missing facts/evidence fails closed');
ok(r.blockers.includes('OBSERVED_FACT_REQUIRED'),'observed fact required');
ok(r.blockers.includes('EVIDENCE_REFERENCE_REQUIRED'),'evidence ref required');

const base={incident_code:'TASK_DISABLED_AFTER',observed_facts:['task ON before run','task OFF after run'],evidence_refs:['reconciliation:798']};
r=c.investigationStatus(base);
eq(r.stage,'OBSERVED','evidence baseline reaches observed');
eq(r.actor,'UNKNOWN','actor stays unknown without proof');

r=c.investigationStatus({...base,mitigation_applied:true});
eq(r.stage,'MITIGATED_ROOT_CAUSE_OPEN','mitigation remains separate from root cause');
ok(r.mitigation_is_not_root_cause,'mitigation is explicitly not RCA closure');

r=c.investigationStatus({...base,actor:'scheduler',actor_proven:true,actor_evidence_refs:[]});
eq(r.actor,'UNKNOWN','actor claim without evidence remains unknown');
r=c.investigationStatus({...base,actor:'scheduler',actor_proven:true,actor_evidence_refs:['task-audit:actor']});
eq(r.actor,'scheduler','actor may be surfaced only with evidence');

r=c.investigationStatus({...base,falsifiable_hypothesis:'post-run control update disables task',disconfirming_test_performed:true});
eq(r.stage,'HYPOTHESIS_READY','hypothesis plus disconfirming test is ready');
r=c.investigationStatus({...base,falsifiable_hypothesis:'post-run control update disables task',disconfirming_test_performed:true,reproduced_or_mechanism_proven:true});
eq(r.stage,'MECHANISM_PROVEN','mechanism proof advances stage');
r=c.investigationStatus({...base,falsifiable_hypothesis:'post-run control update disables task',disconfirming_test_performed:true,reproduced_or_mechanism_proven:true,regression_test_added_or_updated:true,natural_retest_pass:true});
eq(r.stage,'REPAIR_VERIFIED','verified repair still not RCA closed without explicit claim');
r=c.investigationStatus({...base,root_cause_claim:'post-run control update disables task',falsifiable_hypothesis:'post-run control update disables task',disconfirming_test_performed:true,reproduced_or_mechanism_proven:true,regression_test_added_or_updated:true,natural_retest_pass:true});
eq(r.stage,'ROOT_CAUSE_CLOSED','full evidence can close RCA');
ok(r.root_cause_closed,'root cause closure flag true');

r=c.investigationStatus({...base,root_cause_claim:'scheduler bug'});
ok(!r.root_cause_closed,'unsupported root cause cannot close');
ok(r.blockers.includes('ROOT_CAUSE_REQUIRES_FALSIFIABLE_HYPOTHESIS'),'root cause needs falsifiable hypothesis');
ok(r.blockers.includes('ROOT_CAUSE_REQUIRES_MECHANISM_PROOF'),'root cause needs mechanism proof');

let a=c.repairAuthorization({...base,requested_action:'RE_ENABLE',mitigation_safe_and_reversible:true});
ok(a.allowed,'safe reversible mitigation is allowed with evidence baseline');
a=c.repairAuthorization({...base,requested_action:'RE_ENABLE',mitigation_safe_and_reversible:false});
ok(!a.allowed&&a.reasons.includes('MITIGATION_MUST_BE_SAFE_AND_REVERSIBLE'),'unsafe mitigation is denied');
a=c.repairAuthorization({...base,requested_action:'PERMANENT_FIX'});
ok(!a.allowed&&a.reasons.includes('MECHANISM_PROOF_REQUIRED_BEFORE_PERMANENT_FIX'),'permanent fix requires mechanism proof');
a=c.repairAuthorization({...base,requested_action:'CLOSE_INCIDENT'});
ok(!a.allowed&&a.reasons.includes('ROOT_CAUSE_NOT_CLOSED'),'incident cannot close early');
a=c.repairAuthorization({...base,requested_action:'MITIGATE',mitigation_safe_and_reversible:true,destructive_action:true,explicit_owner_approval:false});
ok(!a.allowed&&a.reasons.includes('OWNER_APPROVAL_REQUIRED_FOR_DESTRUCTIVE_ACTION'),'destructive action requires owner approval');

console.log(`kk-investigate-contract: ${n}/${n} PASS`);
