'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Shard=require('../server/kk-ultra-deep-shard-checkpoint.js');
const Registry=require('../server/kk-ultra-deep-source-registry.js');
function plan(){
 return {gap_tasks:[
  {source_id:'official-events',source_tier:'OFFICIAL',query:'October official shows',query_variants:['October 2026 official'],providers:['BING_RSS']},
  {source_id:'source-b',source_tier:'TICKETING',query:'October ticketing',providers:['BING_RSS']},
  {source_id:'source-c',source_tier:'VENUE',query:'October venue',providers:['BING_RSS']},
  {source_id:'source-d',source_tier:'PUBLIC_CALENDAR',query:'October calendars',providers:['BING_RSS']},
  {source_id:'source-e',source_tier:'BRAND_SPONSOR',query:'October brand artist',providers:['BING_RSS']}
 ]};
}
const opts={month:'2026-10',phase:'DISCOVERY'};
const provider={BING_RSS:async()=>[]};
test('shard planning is deterministic and bounded and does not confuse month, phase or start',()=>{
 const a=Shard.selectShard(plan(),{...opts,start:0,limit:2});
 const b=Shard.selectShard(plan(),{...opts,start:2,limit:2});
 assert.equal(a.slice_count,2);
 assert.equal(a.next_start,2);
 assert.equal(b.next_start,4);
 assert.equal(a.plan_hash,b.plan_hash);
 assert.equal(a.production_writes,0);
 assert.equal(a.authoritative,false);
 assert.throws(()=>Shard.selectShard(plan(),{...opts,start:0,limit:17}),/SHARD_BATCH_LIMIT_INVALID/);
 assert.throws(()=>Shard.selectShard(plan(),{...opts,month:'2026-13'}),/SHARD_MONTH_INVALID/);
 assert.throws(()=>Shard.selectShard(plan(),{...opts,phase:'PRODUCTION_PUBLISH'}),/SHARD_PHASE_INVALID/);
});
test('independent deterministic shards resume by index and assemble only with every receipt',async()=>{
 const p=plan(),receipts=[];
 for(let start=0;start<p.gap_tasks.length;start+=2){
  receipts.push(await Shard.executeShard(p,{...opts,start,limit:2,providers:provider,deadlineMs:Date.now()+30000}));
 }
 const first=Shard.collect(p,{...opts,receipts:receipts.slice(0,1)});
 assert.equal(first.assembled,false);
 assert.deepEqual(first.missing_indexes,[2,3,4]);
 assert.equal(first.full,false);
 const resumed=Shard.collect(p,{...opts,receipts:receipts.slice().reverse()});
 assert.equal(resumed.assembled,true);
 assert.equal(resumed.status,'CHECKPOINT_ASSEMBLED_NOT_VERIFIED');
 assert.equal(resumed.completed_count,5);
 assert.equal(resumed.full,false);
 assert.equal(resumed.ready_for_verifier,false);
 assert.equal(resumed.production_writes,0);
});
test('source query, month, phase and receipt hashes are bound to exact plan fingerprint',async()=>{
 const p=plan(),r=await Shard.executeShard(p,{...opts,start:0,limit:2,providers:provider});
 let invalid=Shard.collect(p,{...opts,receipts:[{...r,month:'2026-09'}]});
 assert.equal(invalid.assembled,false);
 assert.ok(invalid.rejected.includes('SHARD_MANIFEST_MISMATCH'));
 invalid=Shard.collect(p,{...opts,receipts:[{...r,records:r.records.slice().reverse()}]});
 assert.ok(invalid.rejected.includes('SHARD_RECEIPT_TAMPERED'));
 const other={gap_tasks:p.gap_tasks.map((t,i)=>i===0?{...t,query:'unrelated weather'}:t)};
 invalid=Shard.collect(other,{...opts,receipts:[r]});
 assert.ok(invalid.rejected.includes('SHARD_MANIFEST_MISMATCH'));
 assert.equal(invalid.production_writes,0);
});
test('duplicate and incomplete shards never claim assembled/full even with prior successful query',async()=>{
 const p=plan(),r=await Shard.executeShard(p,{...opts,start:0,limit:2,providers:provider});
 const dup=Shard.collect(p,{...opts,receipts:[r,r]});
 assert.equal(dup.assembled,false);
 assert.ok(dup.rejected.includes('SHARD_DUPLICATE_TASK_INDEX'));
 const exp=await Shard.executeShard(p,{...opts,start:2,limit:2,providers:provider,deadlineMs:Date.now()-1});
 assert.equal(exp.records[0].result.status,'TIME_BUDGET_EXCEEDED');
 const rest=await Shard.executeShard(p,{...opts,start:4,limit:1,providers:provider});
 const partial=Shard.collect(p,{...opts,receipts:[r,exp,rest]});
 assert.equal(partial.assembled,false);
 assert.deepEqual(partial.incomplete_indexes,[2,3]);
 assert.equal(partial.received_count,5);
 assert.equal(partial.full,false);
});
test('all source-universe shards can be assembled yet remain non-authoritative until live OIDC and primary verifier',async()=>{
 const universe=Registry.buildUniversePlan({month:'2026-10'});
 const p={gap_tasks:universe.tasks};
 const opts2={month:'2026-10',phase:'SOURCE_UNIVERSE'};
 const receipts=[];
 for(let start=0;start<p.gap_tasks.length;start+=Shard.MAX_BATCH){
  receipts.push(await Shard.executeShard(p,{...opts2,start,limit:Shard.MAX_BATCH,providers:provider,deadlineMs:Date.now()+30000}));
 }
 const assembled=Shard.collect(p,{...opts2,receipts});
 assert.equal(assembled.assembled,true);
 const sourceProof=Shard.sourceUniverseProof(p,assembled);
 assert.equal(sourceProof.complete,true,'only indicates all planned source queries received successful no-evidence diagnostics');
 assert.equal(sourceProof.authoritative,false);
 assert.equal(sourceProof.ready_for_verifier,false);
 assert.equal(assembled.full,false);
 assert.equal(sourceProof.production_writes,0);
});
test('unknown query variant and forged success metadata cannot be replayed as a complete shard',async()=>{
 const p=plan(),receipt=await Shard.executeShard(p,{...opts,start:0,limit:2,providers:provider});
 const modified=JSON.parse(JSON.stringify(receipt));
 modified.records[0].result.attempts[0].query='sports betting unrelated to the source';
 const {receipt_hash,...withoutHash}=modified;
 modified.receipt_hash=Shard.digest(withoutHash); // untrusted actors can recompute a checksum
 const check=Shard.collect(p,{...opts,receipts:[modified]});
 assert.equal(check.assembled,false);
 assert.ok(check.rejected.includes('SHARD_RESULT_UNVERIFIED'));
});
