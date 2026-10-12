'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Runner=require('../server/kk-ultra-deep-month-shard-runner.js');
const command_id='123e4567-e89b-42d3-a456-426614174000';
function fixture(){
 const stored=new Map(),calls=[];
 const listImpl=async(id,phase)=>{
  calls.push({type:'list',id,phase});
  return {ok:true,authenticated:true,business_writes:0,receipts:stored.get(phase)||[]};
 };
 const storeImpl=async(id,receipt)=>{
  calls.push({type:'store',id,phase:receipt.phase,start:receipt.start});
  const a=stored.get(receipt.phase)||[];
  a.push(receipt);stored.set(receipt.phase,a);
  return {ok:true,authenticated:true,business_writes:0,status:'STORED'};
 };
 const providers={BING_RSS:async()=>[]};
 return {stored,calls,listImpl,storeImpl,providers};
}
test('read-only monthly execution requires queue command ID and OIDC storage authorization',async()=>{
 const f=fixture();
 const r=await Runner.nextReadonlyShard({command_id:'forged',month:'2026-10'},f);
 assert.equal(r.status,'BLOCKED_COMMAND_ID_INVALID');
 assert.equal(r.production_writes,0);
 assert.equal(f.calls.length,0);
 const blocked=await Runner.nextReadonlyShard({command_id,month:'2026-10'},{
  ...f,listImpl:async()=>({ok:true,authenticated:false,business_writes:0,receipts:[]})
 });
 assert.equal(blocked.status,'BLOCKED_SHARD_STORAGE_AUTH');
 assert.equal(blocked.production_writes,0);
});
test('resuming read-only monthly shards never restarts an accepted saved source segment',async()=>{
 const f=fixture(),args={command_id,month:'2026-10'};
 const first=await Runner.nextReadonlyShard(args,f);
 assert.equal(first.status,'SHARD_STORED_CONTINUE');
 assert.equal(first.phase,'KNOWN_MISS');
 assert.equal(first.start,0);
 assert.equal(first.end,16);
 const second=await Runner.nextReadonlyShard(args,f);
 assert.equal(second.status,'SHARD_STORED_CONTINUE');
 assert.equal(second.phase,'KNOWN_MISS');
 assert.equal(second.start,16);
 assert.equal(f.stored.get('KNOWN_MISS').length,2);
 assert.equal(f.calls.filter(x=>x.type==='store').length,2);
 assert.equal(first.production_writes,0);
});
test('a fully replayed monthly checkpoint never authorizes Verifier, publishing or business changes',async()=>{
 const f=fixture(),args={command_id,month:'2026-10'};
 let latest;
 for(let i=0;i<50;i++){
  latest=await Runner.nextReadonlyShard(args,f);
  if(latest.status==='SHARDS_ASSEMBLED_NEEDS_VERIFIER')break;
  assert.equal(latest.status,'SHARD_STORED_CONTINUE',JSON.stringify(latest));
  assert.equal(latest.production_writes,0);
 }
 assert.equal(latest.status,'SHARDS_ASSEMBLED_NEEDS_VERIFIER');
 assert.equal(latest.ready_for_verifier,false);
 assert.equal(latest.source_evidence_status,'HOLD_FOR_COVERAGE');
 assert.equal(latest.source_evidence_full,false);
 assert.ok(latest.source_blockers.length>0);
 assert.equal(latest.publish_eligible,false);
 assert.equal(latest.authoritative,false);
 assert.equal(latest.production_writes,0);
 assert.ok(f.stored.get('KNOWN_MISS').length>0);
 assert.ok(f.stored.get('DISCOVERY').length>0);
 assert.ok(f.stored.get('REFERENCE').length>0);
 assert.equal(latest.remaining.includes('OWNER_BOOKING_TOMBSTONE_LOCK'),true);
});
test('a persistent wrong-month receipt stops resume before new provider calls',async()=>{
 const f=fixture(),args={command_id,month:'2026-10'};
 const first=await Runner.nextReadonlyShard(args,f);
 assert.equal(first.status,'SHARD_STORED_CONTINUE');
 const records=f.stored.get('KNOWN_MISS');
 records[0]={...records[0],month:'2026-09'};
 const before=f.calls.filter(x=>x.type==='store').length;
 const result=await Runner.nextReadonlyShard(args,f);
 assert.equal(result.status,'BLOCKED_INVALID_PERSISTED_RECEIPT');
 assert.ok(result.rejected.includes('SHARD_MANIFEST_MISMATCH'));
 assert.equal(f.calls.filter(x=>x.type==='store').length,before);
});
