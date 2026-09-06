'use strict';
const assert=require('assert');
const c=require('../lib/kk-discovery-closure-contract');
let n=0; const ok=(v,msg)=>{assert(v,msg);n++;}; const eq=(a,b,msg)=>{assert.deepStrictEqual(a,b,msg);n++;};

const wp=c.deterministicWorkPacketId('SHOW|x|20261001|S1','NEW_V497');
eq(wp,'WP|SHOW|x|20261001|S1|NEW_V497','deterministic packet id');
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

const alarms=c.competitorConsensusAlarms([
  {event_key:'event-new',competitor_business_id:'shop-a'},
  {event_key:'event-new',competitor_business_id:'shop-a'},
  {event_key:'event-new',competitor_business_id:'shop-b'},
  {event_key:'event-own',competitor_business_id:'kk',is_own_shop:true},
  {event_key:'event-known',competitor_business_id:'shop-c'}
],['event-known']);
eq(alarms.length,1,'two independent unknown-event businesses trigger one alarm');
eq(alarms[0].independent_competitor_count,2,'duplicate same shop counts once');

let accounting=c.signalAccounting([{signal_id:'s1',in_area:true},{signal_id:'s2',in_area:true},{signal_id:'s3',in_area:false}],[{signal_id:'s1',kind:'CANDIDATE_PACKET'},{signal_id:'s2',kind:'EXPLICIT_HOLD'}]);
ok(accounting.zero_unaccounted,'candidate and explicit hold account for in-area signals');
accounting=c.signalAccounting([{signal_id:'s1',in_area:true}],[]);
ok(!accounting.zero_unaccounted && accounting.unaccounted[0]==='s1','unaccounted signal blocks finish');

eq(c.yearEndCompletion({executed_passes:passes,unaccounted_signals:0,unresolved_high_priority_backlog:0,cross_projection_gaps:0,external_coverage_partial:true}).status,'PASS_WITH_PARTIAL_EXTERNAL_COVERAGE','partial external access remains honest completion');

eq(c.yearEndCompletion({executed_passes:passes.slice(0,3),unaccounted_signals:0,unresolved_high_priority_backlog:0,cross_projection_gaps:0}).status,'PARTIAL','missing pass blocks completion');

eq(c.yearEndCompletion({executed_passes:passes,unaccounted_signals:0,unresolved_high_priority_backlog:1,cross_projection_gaps:0}).status,'PARTIAL','undrained high-priority backlog blocks completion');

console.log(`kk-discovery-closure-contract: ${n}/${n} PASS`);
