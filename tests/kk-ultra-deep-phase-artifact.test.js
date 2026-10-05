'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const A=require('../server/kk-ultra-deep-phase-artifact.js');

function input(){
 return {
  phase:'PHASE1',status:'PHASE1_ACCEPTED',month:'2026-10',accepted_at:'2026-10-05T13:00:00Z',production_writes:0,
  candidates:[
   {title:'Artist Concert',event_date:'2026-10-10',source_url:'https://official.example/event'},
   {title:'Brand x Artist Lucky Fan',event_date:'2026-10-11',source_urls:['https://brand.example/campaign','https://venue.example/event']}
  ]
 };
}

test('freeze derives stable candidate ids, provenance, exact count and fingerprint',()=>{
 const a=A.freezePhase1(input());
 const b=A.freezePhase1(input());
 assert.equal(a.frozen,true);
 assert.equal(a.candidate_count,2);
 assert.deepEqual(a.candidate_ids,b.candidate_ids);
 assert.equal(a.fingerprint,b.fingerprint);
 assert.ok(a.candidate_ids.every(x=>/^P1-[a-f0-9]{18}$/.test(x)));
 assert.equal(A.validateForPhase2(a).pass,true);
});

test('tampering with candidate pool is rejected by fingerprint validation',()=>{
 const a=A.freezePhase1(input());
 const tampered={...a,candidates:a.candidates.map((x,i)=>i?x:{...x,event_date:'2026-10-12'})};
 const checked=A.validateForPhase2(tampered);
 assert.equal(checked.pass,false);
 assert.ok(checked.blockers.includes('PHASE1_ARTIFACT_CANDIDATE_ID_MISMATCH')||checked.blockers.includes('PHASE1_ARTIFACT_FINGERPRINT_MISMATCH'));
});

test('source provenance is mandatory for Phase 2 handoff',()=>{
 const a=A.freezePhase1({...input(),candidates:[{title:'Unknown Event',event_date:'2026-10-12'}]});
 assert.equal(a.frozen,false);
 assert.ok(a.blockers.includes('CANDIDATE_SOURCE_PROVENANCE_REQUIRED'));
});
