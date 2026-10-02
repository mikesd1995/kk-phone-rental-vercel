'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Gate=require('../scripts/kk-ultra-deep-production-result-gate.js');

function incidentResponse(overrides={}){
 const response={
  ok:true,
  auth:{verified:true,run_id:'37046911003',sha:'4f4697cae345882bfc019d710b67b9d66151e8ff'},
  result:{
   version:'KK_ULTRA_DEEP_PRODUCTION_RUNTIME_V2',
   status:'INCOMPLETE',
   production_writes:0,
   blockers:[],
   counts:{total:0,created_verified:0,updated_verified:0,no_change:0,update_ready:0,promotion_ready:0,quarantined_verified:0},
   dispositions:[
    {event_key:'A',status:'SKIPPED_BOOKING_DATE'},
    {event_key:'B',status:'SKIPPED_BOOKING_DATE'},
    {event_key:'C',status:'SKIPPED_EVENT_HISTORY'},
    {event_key:'D',status:'SKIPPED_EVENT_HISTORY'},
    {event_key:'E',status:'SKIPPED_EVENT_HISTORY'},
    {event_key:'F',status:'SKIPPED_EVENT_HISTORY'},
    {event_key:'G',status:'SKIPPED_EVENT_HISTORY'},
    {event_key:'H',status:'SKIPPED_BOOKING_DATE'}
   ],
   acceptance:{
    version:'KK_ULTRA_DEEP_FULL_LOOP_COMPLETION_GATE_V1',
    status:'BLOCKED_INCOMPLETE_FULL_LOOP',
    complete:false,
    blockers:['NO_VERIFIED_CANDIDATES'],
    candidates:[],
    production_completion_claim_allowed:false
   }
  }
 };
 return Object.assign(response,overrides);
}
const commercial={verifier:{verified_count:8}};

test('accepts the exact V20 fully-accounted zero-write incident as safe no-op complete',()=>{
 const r=Gate.evaluate({
  response:incidentResponse(),
  commercial,
  expectedRunId:'37046911003',
  expectedSha:'4f4697cae345882bfc019d710b67b9d66151e8ff'
 });
 assert.equal(r.complete,true);
 assert.equal(r.status,'COMPLETE');
 assert.equal(r.completion_mode,'LEGACY_V20_SAFE_NOOP_TERMINAL_DISPOSITIONS');
 assert.equal(r.production_writes,0);
 assert.equal(r.terminal_disposition_count,8);
});

test('does not accept safe no-op when one verified candidate is unaccounted for',()=>{
 const response=incidentResponse();
 response.result.dispositions.pop();
 const r=Gate.evaluate({response,commercial,expectedRunId:'37046911003',expectedSha:'4f4697cae345882bfc019d710b67b9d66151e8ff'});
 assert.equal(r.complete,false);
 assert.ok(r.blockers.includes('TERMINAL_DISPOSITION_COVERAGE_MISMATCH'));
});

test('does not accept ambiguous or unknown terminal disposition',()=>{
 const response=incidentResponse();
 response.result.dispositions[0].status='HOLD_AMBIGUOUS_EXISTING';
 const r=Gate.evaluate({response,commercial,expectedRunId:'37046911003',expectedSha:'4f4697cae345882bfc019d710b67b9d66151e8ff'});
 assert.equal(r.complete,false);
 assert.ok(r.blockers.includes('UNSAFE_TERMINAL_DISPOSITION'));
});

test('does not accept zero-write proof with wrong OIDC run or SHA',()=>{
 const r=Gate.evaluate({response:incidentResponse(),commercial,expectedRunId:'other-run',expectedSha:'other-sha'});
 assert.equal(r.complete,false);
 assert.ok(r.blockers.includes('OIDC_RUN_ID_MISMATCH'));
 assert.ok(r.blockers.includes('OIDC_SHA_MISMATCH'));
});

test('native V21 runtime COMPLETE remains accepted',()=>{
 const response={
  ok:true,
  auth:{verified:true,run_id:'R',sha:'S'},
  result:{
   version:'KK_ULTRA_DEEP_PRODUCTION_RUNTIME_V2',
   status:'COMPLETE',
   production_writes:0,
   blockers:[],
   dispositions:[],
   acceptance:{version:'KK_ULTRA_DEEP_FULL_LOOP_COMPLETION_GATE_V2',complete:true,completion_mode:'SAFE_NOOP_TERMINAL_DISPOSITIONS',blockers:[]}
  }
 };
 const r=Gate.evaluate({response,commercial:{verifier:{verified_count:0}},expectedRunId:'R',expectedSha:'S'});
 assert.equal(r.complete,true);
 assert.equal(r.completion_mode,'SAFE_NOOP_TERMINAL_DISPOSITIONS');
});
