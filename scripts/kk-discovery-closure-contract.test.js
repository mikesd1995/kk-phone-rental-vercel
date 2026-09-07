'use strict';
const assert=require('assert');
const c=require('../lib/kk-discovery-closure-contract');
let n=0; const ok=(v,msg)=>{assert(v,msg);n++;}; const eq=(a,b,msg)=>{assert.deepStrictEqual(a,b,msg);n++;};

const wp=c.deterministicWorkPacketId('SHOW|x|20261001|S1','NEW_V498');
eq(wp,'WP|SHOW|x|20261001|S1|NEW_V498','deterministic packet id');
const candidate={status:'READY_FOR_VERIFIER',event_family_id:'FAM|x',show_id:'SHOW|x|S1',work_packet_id:wp};
const packet={packet_status:'READY_FOR_VERIFIER',event_family_id:'FAM|x',show_id:'SHOW|x|S1',work_packet_id:wp};
ok(c.handoffReadiness(candidate,packet).ready,'matching packet permits READY');
ok(!c.handoffReadiness(candidate,Object.assign({},packet,{work_packet_id:'WP|other'})).ready,'packet mismatch blocks READY');
eq(c.orphanReadyCandidates([candidate],[packet]).length,0,'matched READY has no orphan');
eq(c.orphanReadyCandidates([candidate],[]).length,1,'READY without packet is orphan');
ok(c.keyedMutationGate(candidate,packet,{require_work_packet:true}).ok,'stable identity gate passes exact keys');
ok(!c.keyedMutationGate(candidate,Object.assign({},packet,{show_id:'SHOW|other'}),{require_work_packet:true}).ok,'stable identity gate rejects shifted show');
ok(c.verifierFinishClosure({ready_lineage_gap:0,canonical_monthly_gap:0,unresolved_prepared_committing:0}).can_finish,'zero closure gaps permits finish');
ok(!c.verifierFinishClosure({ready_lineage_gap:1}).can_finish,'ready lineage gap blocks finish');

const passes=['PASS_A_OFFICIAL_UNIVERSE','PASS_B_OPPORTUNITY_KEYWORDS','PASS_C_REVERSE_COMPETITOR','PASS_D_NEGATIVE_CROSS_SOURCE_AUDIT'];
eq(c.multipassCoverage(passes).status,'FULL','all four discovery passes required');
eq(c.multipassCoverage(passes.slice(0,3)).status,'PARTIAL','missing pass is partial');
let coverage=c.sourceSectionCoverage({root_access:true,required_sections:['catalog','detail'],attempted_sections:[]});
ok(coverage.root_only && coverage.status==='PARTIAL','root only never full');
coverage=c.sourceSectionCoverage({required_sections:['catalog','detail'],attempted_sections:['catalog','detail']});
eq(coverage.status,'FULL','all required sections attempted');
coverage=c.sourceSectionCoverage({required_sections:['catalog','detail'],attempted_sections:['catalog'],blocked_sections:['detail']});
eq(coverage.status,'PARTIAL','blocked required section stays partial');

const alarms=c.competitorConsensusAlarms([{event_key:'event-new',competitor_business_id:'shop-a'},{event_key:'event-new',competitor_business_id:'shop-a'},{event_key:'event-new',competitor_business_id:'shop-b'},{event_key:'event-own',competitor_business_id:'kk',is_own_shop:true},{event_key:'event-known',competitor_business_id:'shop-c'}],['event-known']);
eq(alarms.length,1,'two independent unknown-event businesses trigger one alarm');
eq(alarms[0].independent_competitor_count,2,'duplicate same shop counts once');

let accounting=c.signalAccounting([{signal_id:'s1',in_area:true},{signal_id:'s2',in_area:true},{signal_id:'s3',in_area:false}],[{signal_id:'s1',kind:'CANDIDATE_PACKET'},{signal_id:'s2',kind:'EXPLICIT_HOLD'}]);
ok(accounting.zero_unaccounted,'candidate and explicit hold account for in-area signals');
accounting=c.signalAccounting([{signal_id:'s1',in_area:true}],[]);
ok(!accounting.zero_unaccounted && accounting.unaccounted[0]==='s1','unaccounted signal blocks finish');

eq(c.yearEndCompletion({executed_passes:passes,unaccounted_signals:0,unresolved_high_priority_backlog:0,cross_projection_gaps:0,external_coverage_partial:true}).status,'PASS_WITH_PARTIAL_EXTERNAL_COVERAGE','partial external access remains honest completion');
eq(c.yearEndCompletion({executed_passes:passes.slice(0,3),unaccounted_signals:0,unresolved_high_priority_backlog:0,cross_projection_gaps:0}).status,'PARTIAL','missing pass blocks completion');

let nightly=c.nightlyUltraDeepCompletion({executed_passes:passes,required_source_family_attempts:12,accounted_source_family_attempts:12,blocked_required_routes:0,unaccounted_signals:0});
eq(nightly.status,'FULL','nightly full requires all passes attempts and zero debt');
nightly=c.nightlyUltraDeepCompletion({executed_passes:passes,required_source_family_attempts:12,accounted_source_family_attempts:12,blocked_required_routes:1,unaccounted_signals:0});
eq(nightly.status,'PARTIAL','blocked required route keeps nightly partial');
eq(nightly.coverage_debt,1,'blocked route creates explicit debt');
ok(c.nightlySourceDebtRetry({coverage_debt:1}).required,'coverage debt requires retry ladder');
eq(c.nightlySourceDebtRetry({coverage_debt:1}).next_windows.length,2,'debt retains 03 and 06 retry windows');

eq(c.morningRevenueClosure({hidden_high_value_signals:0,explicit_hold_missing_next_watch:0,explicit_hold_overdue_next_watch:0,unresolved_prepared_committing:0}).status,'READY','morning closes only with zero hidden backlog and current watch lineage');
eq(c.morningRevenueClosure({hidden_high_value_signals:1}).status,'HOLD','hidden high-value signal blocks morning readiness');
let morning=c.morningRevenueClosure({explicit_hold_overdue_next_watch:1});
ok(!morning.ready&&morning.status==='HOLD'&&morning.reasons.includes('HOLD_NEXT_WATCH_OVERDUE'),'expired Next Watch cannot satisfy morning high-value hold closure');
morning=c.morningRevenueClosure({overdue_next_watch:2});
ok(!morning.ready&&morning.reasons.includes('HOLD_NEXT_WATCH_OVERDUE'),'legacy/current caller alias for overdue watch remains fail-closed');
ok(c.nightlyPriceRefreshRequired({priority_class:'P1',is_new_event:true,days_until_event:7,exact_bundle_missing:true}),'new near-term P1 missing exact bundle triggers targeted price refresh');
ok(!c.nightlyPriceRefreshRequired({priority_class:'P2',is_new_event:true,days_until_event:7,exact_bundle_missing:true}),'P2 does not trigger v4.9.8 targeted overnight price rule');
ok(!c.nightlyPriceRefreshRequired({priority_class:'P1',is_new_event:true,days_until_event:30,exact_bundle_missing:true}),'far P1 does not trigger overnight near-term price refresh');

console.log(`kk-discovery-closure-contract: ${n}/${n} PASS`);
