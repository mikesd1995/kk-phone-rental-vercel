'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Runtime=require('../server/kk-ultra-deep-phase2-runtime.js');
const Artifact=require('../server/kk-ultra-deep-phase-artifact.js');

function response(body){
 return {ok:true,headers:{get:()=>null},text:async()=>body};
}

test('freezes and deterministically deduplicates same event/date across source mirrors',()=>{
 const out=Runtime.freezeCandidatePool([
  {title:'Artist Concert',event_date:'2026-10-10',source_url:'https://example.com/a'},
  {title:'Artist Concert',event_date:'2026-10-10',source_url:'https://example.org/b'}
 ]);
 assert.equal(out.pool.length,1);
 assert.equal(out.expected_candidate_ids.length,1);
 assert.equal(out.pool[0].source_urls.length,2);
 assert.match(out.fingerprint,/^[a-f0-9]{64}$/);
});

test('Phase 2 runtime accepts authoritative event identity without requiring poster',async()=>{
 const body=`<html><head><script type="application/ld+json">
 {"@type":"MusicEvent","name":"Artist Concert","startDate":"2026-10-10","location":{"@type":"Place","name":"Union Hall"}}
 </script></head><body>Artist Concert</body></html>`;
 const out=await Runtime.run({
  month:'2026-10',location:'Bangkok Thailand',max_rounds:3,
  candidates:[{title:'Artist Concert',event_date:'2026-10-10',source_url:'https://official.example/events/artist-concert'}]
 },{fetchFn:async()=>response(body),providers:{}});
 assert.equal(out.status,'PHASE2_ACCEPTED');
 assert.equal(out.ready_for_phase3,true);
 assert.equal(out.results[0].disposition,'VERIFIED');
 assert.equal(out.production_writes,0);
 assert.equal(out.phase3_started,false);
 assert.equal(out.phase2_artifact.frozen,true);
 assert.deepEqual(out.phase2_artifact.pricing_candidate_ids,[out.results[0].candidate_id]);
 assert.match(out.phase2_artifact.fingerprint,/^[a-f0-9]{64}$/);
});

test('Learning recovery retries VERIFY_REQUIRED against expanded official-source search',async()=>{
 const original='https://www.facebook.com/example/posts/123';
 const official='https://artist.example/events/concert';
 const officialBody=`<html><head><script type="application/ld+json">
 {"@type":"MusicEvent","name":"Artist Concert","startDate":"2026-10-10","location":{"@type":"Place","name":"Union Hall"}}
 </script></head><body>Artist Concert Union Hall</body></html>`;
 const fetchFn=async(url)=>{
  if(String(url)===official)return response(officialBody);
  return response('<html><body>Artist Concert</body></html>');
 };
 const providers={
  DDGS_TRAFILATURA:async()=>[{title:'Artist Concert',event_date:'2026-10-10',source_url:official}]
 };
 const out=await Runtime.run({
  month:'2026-10',location:'Bangkok Thailand',max_rounds:3,
  candidates:[{title:'Artist Concert',event_date:'2026-10-10',source_url:original}]
 },{fetchFn,providers});
 assert.equal(out.status,'PHASE2_ACCEPTED');
 assert.equal(out.results[0].disposition,'VERIFIED');
 assert.ok(out.rounds.some(x=>x.learning_miss_classes.includes('OFFICIAL_SOURCE_GAP')));
 assert.equal(out.production_writes,0);
});


test('Phase 2 consumes exact frozen Phase 1 candidate IDs and fingerprint',async()=>{
 const artifact=Artifact.freezePhase1({
  phase:'PHASE1',status:'PHASE1_ACCEPTED',month:'2026-10',production_writes:0,
  candidates:[{title:'Artist Concert',event_date:'2026-10-10',source_url:'https://official.example/events/artist-concert'}]
 });
 const body=`<html><head><script type="application/ld+json">
 {"@type":"MusicEvent","name":"Artist Concert","startDate":"2026-10-10","location":{"@type":"Place","name":"Union Hall"}}
 </script></head><body>Artist Concert</body></html>`;
 const out=await Runtime.run({phase1_artifact:artifact,location:'Bangkok Thailand'},{fetchFn:async()=>response(body),providers:{}});
 assert.equal(out.status,'PHASE2_ACCEPTED');
 assert.equal(out.pool_source,'PHASE1_ARTIFACT');
 assert.equal(out.pool_fingerprint,artifact.fingerprint);
 assert.deepEqual(out.expected_candidate_ids,artifact.candidate_ids);
 assert.equal(out.results[0].candidate_id,artifact.candidate_ids[0]);
});

test('tampered Phase 1 artifact fails closed before verification',async()=>{
 const artifact=Artifact.freezePhase1({
  phase:'PHASE1',status:'PHASE1_ACCEPTED',month:'2026-10',production_writes:0,
  candidates:[{title:'Artist Concert',event_date:'2026-10-10',source_url:'https://official.example/events/artist-concert'}]
 });
 const tampered={...artifact,candidates:[{...artifact.candidates[0],event_date:'2026-10-11'}]};
 const out=await Runtime.run({phase1_artifact:tampered,location:'Bangkok Thailand'},{fetchFn:async()=>{throw new Error('must not fetch')}});
 assert.equal(out.status,'PHASE2_HOLD');
 assert.equal(out.candidate_master_pool_frozen,false);
 assert.equal(out.ready_for_phase3,false);
 assert.ok(out.gate.blockers.includes('PHASE1_ARTIFACT_CANDIDATE_ID_MISMATCH')||out.gate.blockers.includes('PHASE1_ARTIFACT_FINGERPRINT_MISMATCH'));
});
