'use strict';
const assert=require('assert');
const c=require('../lib/kk-runtime-acceptance-contract');
let n=0; const ok=(v,msg)=>{assert(v,msg);n++;}; const eq=(a,b,msg)=>{assert.deepStrictEqual(a,b,msg);n++;};

function healthy(overrides={}){
  return Object.assign({
    runner_type:'SCANNER',
    expected_occurrence:true,
    manual_trigger:false,
    task_enabled_before:true,
    task_enabled_after:true,
    scheduled_trigger_observed:true,
    lease_acquired:true,
    lease_version:101,
    previous_lease_version:100,
    duplicate_fence_observed:false,
    manifest_count:1,
    manifest_frozen_before_mutation:true,
    actual_runtime_evidence_count:3,
    legitimate_noop:false,
    terminal_manifest:true,
    lease_released:true,
    unresolved_prepared_committing:0,
    candidate_orphans:0,
    ai_orphans:0,
    unauthorized_outbound_claim:false
  },overrides);
}

let result=c.runtimeAcceptance(healthy());
ok(result.accepted&&result.status==='PASS','healthy natural occurrence passes');
eq(result.reasons,[],'healthy occurrence has no reasons');
result=c.runtimeAcceptance(healthy({task_enabled_before:'TRUE',task_enabled_after:'TRUE',scheduled_trigger_observed:'TRUE',lease_acquired:'TRUE',manifest_frozen_before_mutation:'TRUE',terminal_manifest:'TRUE',lease_released:'TRUE'}));
ok(result.accepted,'sheet-style TRUE strings are accepted as positive evidence');

result=c.runtimeAcceptance(healthy({expected_occurrence:false,task_enabled_before:false}));
eq(result.status,'NOT_DUE','not-due observation is not treated as a failure');

result=c.runtimeAcceptance(healthy({manual_trigger:true}));
ok(!result.accepted&&result.reasons.includes('MANUAL_RUN_NOT_NATURAL_PROOF'),'manual run cannot prove natural schedule');

result=c.runtimeAcceptance(healthy({task_enabled_before:false}));
ok(result.reasons.includes('TASK_DISABLED_BEFORE'),'disabled-before is explicit');
result=c.runtimeAcceptance(healthy({scheduled_trigger_observed:false}));
ok(result.reasons.includes('SCHEDULER_NOT_FIRED'),'missing scheduled trigger is explicit');
result=c.runtimeAcceptance(healthy({lease_acquired:false}));
ok(result.reasons.includes('LEASE_NOT_ACQUIRED'),'missing lease blocks runtime acceptance');
result=c.runtimeAcceptance(healthy({lease_version:100,previous_lease_version:100}));
ok(result.reasons.includes('NON_MONOTONIC_FENCE'),'equal lease version is not strictly monotonic');
result=c.runtimeAcceptance(healthy({lease_version:0,previous_lease_version:0}));
ok(result.reasons.includes('NON_MONOTONIC_FENCE'),'missing or zero fence version fails closed');
result=c.runtimeAcceptance(healthy({duplicate_fence_observed:true}));
ok(result.reasons.includes('DUPLICATE_FENCE'),'duplicate fence blocks acceptance');
result=c.runtimeAcceptance(healthy({manifest_count:0}));
ok(result.reasons.includes('MANIFEST_COUNT_NOT_ONE'),'zero manifest blocks acceptance');
result=c.runtimeAcceptance(healthy({manifest_count:2}));
ok(result.reasons.includes('MANIFEST_COUNT_NOT_ONE'),'multiple manifests block acceptance');
result=c.runtimeAcceptance(healthy({manifest_frozen_before_mutation:false}));
ok(result.reasons.includes('MANIFEST_NOT_FROZEN_PRE_MUTATION'),'late manifest blocks acceptance');
result=c.runtimeAcceptance(healthy({actual_runtime_evidence_count:0,legitimate_noop:false}));
ok(result.reasons.includes('NO_RUNTIME_EVIDENCE'),'empty work without governed no-op blocks acceptance');
result=c.runtimeAcceptance(healthy({actual_runtime_evidence_count:0,legitimate_noop:true}));
ok(result.accepted,'governed legitimate no-op can pass');
result=c.runtimeAcceptance(healthy({terminal_manifest:false}));
ok(result.reasons.includes('MANIFEST_NOT_TERMINAL'),'nonterminal manifest blocks acceptance');
result=c.runtimeAcceptance(healthy({lease_released:false}));
ok(result.reasons.includes('LEASE_NOT_RELEASED'),'stale active lease blocks acceptance');
result=c.runtimeAcceptance(healthy({unresolved_prepared_committing:2}));
ok(result.reasons.includes('UNRESOLVED_TRANSACTION'),'transaction debt blocks acceptance');
result=c.runtimeAcceptance(healthy({candidate_orphans:1}));
ok(result.reasons.includes('CANDIDATE_ORPHAN'),'Candidate orphan blocks acceptance');
result=c.runtimeAcceptance(healthy({ai_orphans:1}));
ok(result.reasons.includes('AI_ORPHAN'),'AI orphan blocks acceptance');
result=c.runtimeAcceptance(healthy({unauthorized_outbound_claim:true}));
ok(result.reasons.includes('UNAUTHORIZED_OUTBOUND_CLAIM'),'unauthorized outbound claim is P0');
eq(result.highest_severity,'P0','highest severity surfaces P0');
result=c.runtimeAcceptance(healthy({task_enabled_after:false}));
ok(result.reasons.includes('TASK_DISABLED_AFTER'),'post-run disable recurrence is explicit');

eq(c.incidentSeverity('UNRESOLVED_TRANSACTION'),'P1','transaction debt defaults P1');
eq(c.incidentSeverity('UNKNOWN_METADATA_ISSUE'),'P2','unknown issue defaults P2');

let sli=c.reliabilitySLI([healthy(),healthy({lease_released:false}),healthy({expected_occurrence:false})]);
eq(sli.expected,2,'SLI excludes not-due observations');
eq(sli.accepted,1,'SLI counts only accepted expected occurrences');
eq(sli.percent,50,'SLI percent is deterministic');

const scannerRuns=[];
for(let i=1;i<=6;i++) scannerRuns.push(healthy({runner_type:'SCANNER',lease_version:100+i,previous_lease_version:99+i}));
let soak=c.runnerSoak(scannerRuns,{runner_type:'SCANNER',min_consecutive:6});
ok(soak.stable&&soak.current_streak===6,'six clean natural Scanner runs satisfy minimum soak');

const manualRuns=scannerRuns.map((x,i)=>i===2?Object.assign({},x,{manual_rescue:true}):x);
soak=c.runnerSoak(manualRuns,{runner_type:'SCANNER',min_consecutive:6});
ok(!soak.stable&&soak.manual_rescues===1&&soak.current_streak===3,'manual rescue resets the active soak window');

const brokenRuns=scannerRuns.map((x,i)=>i===4?Object.assign({},x,{task_enabled_after:false}):x);
soak=c.runnerSoak(brokenRuns,{runner_type:'SCANNER',min_consecutive:6});
ok(!soak.stable&&soak.p0_failures===1&&soak.current_streak===1,'P0 failure resets the active soak window');

const recoveredRuns=[healthy({runner_type:'SCANNER',task_enabled_after:false,lease_version:90,previous_lease_version:89})];
for(let i=1;i<=6;i++) recoveredRuns.push(healthy({runner_type:'SCANNER',lease_version:110+i,previous_lease_version:109+i}));
soak=c.runnerSoak(recoveredRuns,{runner_type:'SCANNER',min_consecutive:6});
ok(soak.stable&&soak.current_streak===6&&soak.failures===1,'historical failure does not poison a later clean six-run soak');

const withNotDue=[healthy({runner_type:'SCANNER',expected_occurrence:false}),...scannerRuns];
soak=c.runnerSoak(withNotDue,{runner_type:'SCANNER',min_consecutive:6});
ok(soak.stable&&soak.observed===6,'NOT_DUE observations are excluded from soak continuity');

const verifierRuns=[];
for(let i=1;i<=6;i++) verifierRuns.push(healthy({runner_type:'VERIFIER',lease_version:200+i,previous_lease_version:199+i}));
let combined=c.combinedRunnerSoak([...scannerRuns,...verifierRuns],{min_consecutive:6});
ok(combined.stable&&combined.status==='CORE_RUNNERS_SOAK_PASS','Scanner and Verifier both require clean soak');
combined=c.combinedRunnerSoak([...scannerRuns,...verifierRuns.slice(0,5)],{min_consecutive:6});
ok(!combined.stable&&combined.verifier.current_streak===5,'five Verifier runs are insufficient');

let gate=c.releaseEvidenceGate({requirement_defined:true,architecture_approved:true,ready_for_implementation:true,implementation_pass:true,ci_pass:true});
eq(gate.gate,'KK-G3 CI_PASS','CI gate requires ordered requirement architecture implementation and CI');
gate=c.releaseEvidenceGate({requirement_defined:true,architecture_approved:true,ready_for_implementation:true,implementation_pass:true,ci_pass:true,runtime_pass:true});
eq(gate.gate,'KK-G4 RUNTIME_PASS','runtime proof advances to G4');
gate=c.releaseEvidenceGate({requirement_defined:true,architecture_approved:true,ready_for_implementation:true,implementation_pass:true,ci_pass:true,runtime_pass:true,provider_pass:true,production_stable:true});
eq(gate.gate,'KK-G6 PRODUCTION_STABLE','full evidence ladder reaches G6');
gate=c.releaseEvidenceGate({requirement_defined:false,architecture_approved:true,ready_for_implementation:true,implementation_pass:true,ci_pass:true,runtime_pass:true});
eq(gate.gate,'KK-G-1 NOT_READY','release ladder fails closed when requirement is undefined');
gate=c.releaseEvidenceGate({requirement_defined:true,architecture_approved:false,ready_for_implementation:true,implementation_pass:true,ci_pass:true,runtime_pass:true});
eq(gate.gate,'KK-G0 REQUIREMENT_DEFINED','release gates cannot skip architecture approval');

console.log(`kk-runtime-acceptance-contract: ${n}/${n} PASS`);
