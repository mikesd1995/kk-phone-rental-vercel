'use strict';
const test=require('node:test'); const assert=require('node:assert/strict');
const G=require('../server/kk-ultra-deep-phase-handoff-gate.js');

test('Phase2 cannot advance without complete report and learning recovery',()=>{
 const r=G.evaluate({current_phase:'PHASE2',production_writes:0,candidate_pool_complete:true,phase_report_complete:false,learning_recovery_complete:false,phase_artifact_frozen:true,phase_artifact_fingerprint:'p2'});
 assert.equal(r.ready_for_next_phase,false);assert.equal(r.next_phase,'PHASE3');
});
test('Phase2 cannot advance from a verbal result without frozen artifact',()=>{
 const r=G.evaluate({current_phase:'PHASE2',production_writes:0,candidate_pool_complete:true,phase_report_complete:true,learning_recovery_complete:true});
 assert.equal(r.ready_for_next_phase,false);assert.ok(r.blockers.includes('CURRENT_PHASE_ARTIFACT_NOT_FROZEN'));
});
test('Phase2 clean handoff stops before Phase3',()=>{
 const r=G.evaluate({current_phase:'PHASE2',production_writes:0,candidate_pool_complete:true,phase_report_complete:true,learning_recovery_complete:true,phase_artifact_frozen:true,phase_artifact_fingerprint:'p2'});
 assert.equal(r.ready_for_next_phase,true);assert.equal(r.auto_start_next_phase,false);
});
test('Phase3 clean handoff requires immutable pricing artifact and still never auto-starts Phase4',()=>{
 const r=G.evaluate({current_phase:'PHASE3',production_writes:0,phase_report_complete:true,learning_recovery_complete:true,phase_artifact_frozen:true,phase_artifact_fingerprint:'p3'});
 assert.equal(r.ready_for_next_phase,true);assert.equal(r.next_phase,'PHASE4');assert.equal(r.auto_start_next_phase,false);
});
test('early phase writes fail closed',()=>{
 const r=G.evaluate({current_phase:'PHASE3',production_writes:1,phase_report_complete:true,learning_recovery_complete:true,phase_artifact_frozen:true,phase_artifact_fingerprint:'p3'});
 assert.ok(r.blockers.includes('EARLY_PHASE_PRODUCTION_WRITE_PROHIBITED'));
});
