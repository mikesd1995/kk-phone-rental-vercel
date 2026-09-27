'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Worker=require('../server/kk-full-discovery-worker.js');
const Watch=require('../server/discovery-source-watch-contract.js');
const NOW='2026-09-27T02:00:00.000Z';
function obs(id,url){return {observation_id:id,provider:'EXA',source_tier:'OFFICIAL',state:'NEW',source_url:url,observed_at:NOW,content_hash:Watch.sha256(id)}}
function result(candidate){return {authoritative:false,verifier_required:true,production_writes:0,final_truth_mutation:false,notification_sends:0,candidates:[candidate]}}
test('full worker normalizes, deduplicates and hands only to verifier',async()=>{
 const r=await Worker.runFullDiscovery({observations:[obs('a','https://a.example/events'),obs('b','https://b.example/events')],provider_results:[
  result({title:'Example Concert',event_date:'2026-10-10',venue:'Hall',artist:['A'],source_url:'https://a.example/event',confidence:.8}),
  result({title:' Example  Concert ',event_date:'2026-10-10',venue:'Hall',artist:['A'],source_url:'https://b.example/event',confidence:.9})
 ]},{sourceWatchOptions:{nowMs:Date.parse(NOW)}});
 assert.equal(r.status,'READY_FOR_VERIFIER');
 assert.equal(r.handoff.candidate_count,1);
 assert.equal(r.handoff.candidates[0].evidence.length,2);
 assert.equal(r.handoff.candidates[0].confidence,.9);
 assert.equal(r.production_writes,0);
 assert.equal(r.handoff.direct_business_write_allowed,false);
});
test('worker fail-closes without source observations',async()=>{
 const r=await Worker.runFullDiscovery({});
 assert.equal(r.status,'BLOCKED_NO_SOURCE_OBSERVATIONS');
 assert.equal(r.handoff,null);
});
test('worker does not fabricate candidates when provider fails',async()=>{
 const r=await Worker.runFullDiscovery({observations:[obs('a','https://a.example/events')]},{
  sourceWatchOptions:{nowMs:Date.parse(NOW)},
  discoverFn:async()=>{throw Object.assign(new Error('down'),{code:'UPSTREAM_DOWN'})}
 });
 assert.equal(r.status,'NO_NEW_CANDIDATES');
 assert.equal(r.handoff.candidate_count,0);
 assert.equal(r.production_writes,0);
});
