'use strict';
/*
 * Governed scanner source batching. Caller must be a queue-claimed READ_ONLY
 * command using Supabase OIDC bridge. This module never claims authority to
 * publish or close a production run. Runtime can retry each bounded shard.
 */
const Monthly=require('./kk-monthly-deep-scan-query-plan.js');
const Runner=require('./kk-ultra-deep-runtime-runner.js');
const Shards=require('./kk-ultra-deep-shard-checkpoint.js');
const Bridge=require('./admin-write-control-oidc.js');
const VERSION='KK_ULTRA_DEEP_MONTH_SHARD_RUNNER_V1';
const PHASES=Object.freeze(['KNOWN_MISS','DISCOVERY','REFERENCE']);
function text(x){return String(x==null?'':x).trim();}
function phasePlans(input={}){
 const month=text(input.month);
 const discovery=Monthly.build(input), reference=Runner.buildReferencePlan({month,location:discovery.location});
 return {
  KNOWN_MISS:Runner.buildKnownMissPlan(month),
  DISCOVERY:discovery,
  REFERENCE:reference
 };
}
function safeReturn(status,more={}){
 return {version:VERSION,status,read_only:true,authoritative:false,
  publish_eligible:false,ready_for_verifier:false,
  production_writes:0,...more};
}
async function nextReadonlyShard(input={},options={}){
 const commandId=text(input.command_id),month=text(input.month);
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(commandId))
  return safeReturn('BLOCKED_COMMAND_ID_INVALID');
 const plans=phasePlans({month,location:input.location||'Bangkok Metropolitan Region Thailand'});
 const list=options.listImpl||Bridge.shardReceiptList;
 const store=options.storeImpl||Bridge.shardReceiptStore;
 const completed={};
 for(const phase of PHASES){
  const plan=plans[phase];
  const stored=await list(commandId,phase,options.bridgeOptions||{});
  if(!(stored&&stored.ok===true&&stored.authenticated===true&&
      Array.isArray(stored.receipts)&&stored.business_writes===0))
   return safeReturn('BLOCKED_SHARD_STORAGE_AUTH',{phase,month});
  // Bounded edge list currently returns at most 20; reject truncation.
  if(stored.receipts.length>=20)return safeReturn('BLOCKED_CHECKPOINT_LIST_PAGINATION',{phase,month});
  const checkpoint=Shards.collect(plan,{month,phase,receipts:stored.receipts});
  if(checkpoint.rejected.length||checkpoint.incomplete_indexes.length)
   return safeReturn('BLOCKED_INVALID_PERSISTED_RECEIPT',{phase,month,
    rejected:checkpoint.rejected,incomplete_indexes:checkpoint.incomplete_indexes});
  if(checkpoint.assembled){
    completed[phase]={results:checkpoint.results,production_writes:0};
    continue;
  }
  const start=checkpoint.missing_indexes[0];
  if(!Number.isSafeInteger(start))return safeReturn('BLOCKED_SHARD_CURSOR_INVALID',{phase,month});
  const expectedStart=Math.floor(start/Shards.MAX_BATCH)*Shards.MAX_BATCH;
  if(start!==expectedStart)return safeReturn('BLOCKED_SHARD_NONCONTIGUOUS_PROGRESS',{phase,month});
  const receipt=await Shards.executeShard(plan,{
   month,phase,start,limit:Shards.MAX_BATCH,
   providers:options.providers||{},
   deadlineMs:Date.now()+Math.min(20000,Math.max(1000,Number(options.shardBudgetMs)||18000)),
   concurrency:Math.min(4,Math.max(1,Number(options.concurrency)||4))
  });
  if(!receipt.records.every(x=>x.result.completed))
   return safeReturn('SHARD_INCOMPLETE_RETRY_SAME_CURSOR',{phase,month,
    start,unfinished:receipt.records.filter(x=>!x.result.completed).map(x=>x.index)});
  const persisted=await store(commandId,receipt,options.bridgeOptions||{});
  if(!(persisted&&persisted.ok===true&&persisted.authenticated===true&&
     persisted.business_writes===0&&['STORED','IDEMPOTENT_MATCH'].includes(persisted.status)))
   return safeReturn('BLOCKED_SHARD_NOT_PERSISTED',{phase,month,start});
  return safeReturn('SHARD_STORED_CONTINUE',{phase,month,
   start,end:receipt.end,next_start:receipt.end<plan.gap_tasks.length?receipt.end:null,
   receipt_hash:receipt.receipt_hash});
 }
 // Replay ALL persisted provider attempts through the original strict source
 // universe, historical known miss and reference reconciliation gates. This is
 // evidence preparation, not commercial approval or a production COMPLETE.
 const evidence=await Runner.runMonthlyFromCheckpoint({
   month,location:input.location||'Bangkok Metropolitan Region Thailand'
 },completed,{providers:options.providers||{},use_only_injected_providers:true,
   maxRuntimeMs:Math.min(16000,Math.max(2000,Number(options.replayBudgetMs)||12000))});
 return safeReturn('SHARDS_ASSEMBLED_NEEDS_VERIFIER',{month,
  source_evidence_status:evidence.status,
  source_evidence_full:evidence.full===true,
  source_blockers:(evidence.blockers||[]).slice(0,24),
  source_candidate_count:Number(evidence.candidate_count||0),
  // Actual Full Loop acceptance still requires verified detail and finance/owner gates.
  remaining:['LIVE_SOURCE_VALIDATION','KNOWN_MISS_LIVE_RECALL','EXTERNAL_DEMAND',
   'OWNER_BOOKING_TOMBSTONE_LOCK','INDEPENDENT_MARKET_PRICING','CORE_WEB_PUBLIC_READBACK']
 });
}
module.exports={VERSION,PHASES,phasePlans,safeReturn,nextReadonlyShard};
