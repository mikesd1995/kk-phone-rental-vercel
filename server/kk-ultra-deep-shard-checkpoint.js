'use strict';
/*
 * Zero-business-write monthly discovery sharding.
 * A shard receipt is a diagnostic artifact, NOT an authorized production
 * scan/publish receipt. Only a separately authenticated service may persist
 * these envelopes; the Full Loop verifier must still check live sources.
 */
const crypto=require('node:crypto');
const Executor=require('./kk-ultra-deep-provider-executor.js');
const Registry=require('./kk-ultra-deep-source-registry.js');
const VERSION='KK_ULTRA_DEEP_SHARD_CHECKPOINT_V1';
const MAX_BATCH=16;
function text(v){return String(v==null?'':v).trim();}
function fail(code){throw Object.assign(new Error(code),{code});}
function digest(value){return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');}
function monthOk(month){return /^20[0-9]{2}-(0[1-9]|1[0-2])$/.test(month);}
function taskIdentity(task={},index=0){
 return {index,source_id:text(task.source_id)||null,source_tier:text(task.source_tier),
  query:text(task.query),query_variants:Executor.queryVariants(task).filter(Boolean),
  providers:(Array.isArray(task.providers)?task.providers:[]).map(text),
  required:task.required===true};
}
function normalizePlan(plan={},month){
 if(!monthOk(text(month)))fail('SHARD_MONTH_INVALID');
 const tasks=Array.isArray(plan.gap_tasks)?plan.gap_tasks:null;
 if(!tasks||!tasks.length)fail('SHARD_PLAN_EMPTY');
 if(tasks.length>2000)fail('SHARD_PLAN_OVERSIZE');
 return tasks.map((task,i)=>taskIdentity(task,i));
}
function planFingerprint(plan={},month,phase){
 const normalized=normalizePlan(plan,month);
 if(!/^(KNOWN_MISS|DISCOVERY|REFERENCE|SOURCE_UNIVERSE)$/.test(text(phase)))fail('SHARD_PHASE_INVALID');
 return digest({version:VERSION,month,phase,tasks:normalized});
}
function selectShard(plan={},options={}){
 const month=text(options.month),phase=text(options.phase);
 const normalized=normalizePlan(plan,month);
 const start=options.start===undefined?0:Number(options.start);
 const batchSize=options.limit===undefined?MAX_BATCH:Number(options.limit);
 if(!Number.isSafeInteger(start)||start<0||start>=normalized.length)fail('SHARD_START_INVALID');
 if(!Number.isSafeInteger(batchSize)||batchSize<1||batchSize>MAX_BATCH)fail('SHARD_BATCH_LIMIT_INVALID');
 const end=Math.min(start+batchSize,normalized.length);
 const plan_hash=planFingerprint(plan,month,phase);
 return {version:VERSION,month,phase,plan_hash,start,end,task_count:normalized.length,
  slice_count:end-start,next_start:end<normalized.length?end:null,
  tasks:(plan.gap_tasks||[]).slice(start,end),production_writes:0,authoritative:false};
}
function acceptableExecution(result={},task={}){
 if(result.status==='TIME_BUDGET_EXCEEDED')return false;
 const queries=new Set(Executor.queryVariants(task).filter(Boolean));
 const allowedProviders=new Set((Array.isArray(task.providers)?task.providers:[]).map(x=>text(x).toUpperCase()));
 const attempts=Array.isArray(result.attempts)?result.attempts:[];
 const successful=attempts.filter(a=>['NO_EVIDENCE','EVIDENCE_FOUND'].includes(text(a.status).toUpperCase()));
 // A single legitimate query cannot launder an unrelated/forged successful attempt.
 if(!successful.length || successful.some(a=>
   !Executor.ALLOWED_PROVIDERS.has(text(a.provider).toUpperCase()) ||
   !allowedProviders.has(text(a.provider).toUpperCase()) ||
   !queries.has(text(a.query))))return false;
 if(result.status==='EVIDENCE_FOUND' &&
   !(Array.isArray(result.candidates)&&result.candidates.length>0))return false;
 return true;
}
function receiptResult(result={},task={}){
 // Preserve canonical public URL candidates for later independent verification.
 const attempts=Array.isArray(result.attempts)?result.attempts.map(a=>({
  provider:text(a.provider),status:text(a.status),query:text(a.query),
  count:Number.isFinite(Number(a.count))?Math.max(0,Math.floor(Number(a.count))):0
 })):[];
 const candidates=Array.isArray(result.candidates)?result.candidates.map(c=>({
  title:text(c.title),event_date:text(c.event_date),event_time:text(c.event_time),
  venue:text(c.venue),source_url:text(c.source_url),
  artist:Array.isArray(c.artist)?c.artist.map(text).slice(0,20):[]
 })):[];
 return {status:text(result.status)||'MISSING',provider:text(result.provider)||null,
  attempts,candidates,source_tier:text(task.source_tier),
  completed:acceptableExecution(result,task),production_writes:0};
}
function buildShardReceipt(slice={},execution={}){
 if(!slice||slice.version!==VERSION||!monthOk(text(slice.month)))fail('SHARD_SLICE_INVALID');
 const results=Array.isArray(execution.results)?execution.results:[];
 if(results.length!==slice.slice_count)fail('SHARD_RESULT_COUNT_MISMATCH');
 const records=results.map((r,i)=>({
  index:slice.start+i,
  task_hash:digest(taskIdentity(slice.tasks[i],slice.start+i)),
  result:receiptResult(r,slice.tasks[i])
 }));
 const envelope={version:VERSION,month:slice.month,phase:slice.phase,
  plan_hash:slice.plan_hash,start:slice.start,end:slice.end,
  task_count:slice.task_count,records,production_writes:0,authoritative:false,
  // Diagnostic only: never treat this digest as a signature/authentication.
  authority:'UNTRUSTED_SCAN_RECEIPT_REQUIRES_OIDC_AND_PRIMARY_SOURCE_VERIFICATION'};
 return {...envelope,receipt_hash:digest(envelope)};
}
async function executeShard(plan={},options={}){
 const slice=selectShard(plan,options);
 const remaining=options.deadlineMs;
 const execution=await Executor.executeGapPlan({gap_tasks:slice.tasks},{
  providers:options.providers||{},concurrency:options.concurrency||Executor.DEFAULT_CONCURRENCY,
  deadlineMs:remaining
 });
 return buildShardReceipt(slice,execution);
}
function collect(plan={},options={}){
 const month=text(options.month),phase=text(options.phase),
  normalized=normalizePlan(plan,month),expectedHash=planFingerprint(plan,month,phase),
  supplied=Array.isArray(options.receipts)?options.receipts:[];
 if(supplied.length>2000)fail('SHARD_RECEIPT_COUNT_OVERSIZE');
 const ordered=new Array(normalized.length);
 const rejected=[];
 for(const envelope of supplied){
  if(!envelope||envelope.version!==VERSION||envelope.month!==month||
   envelope.phase!==phase||envelope.plan_hash!==expectedHash||
   envelope.task_count!==normalized.length ||
   envelope.production_writes!==0||envelope.authoritative!==false){
   rejected.push('SHARD_MANIFEST_MISMATCH');continue;
  }
  const {receipt_hash,...withoutHash}=envelope;
  if(receipt_hash!==digest(withoutHash)){rejected.push('SHARD_RECEIPT_TAMPERED');continue;}
  if(!Number.isSafeInteger(envelope.start)||!Number.isSafeInteger(envelope.end)||
   envelope.start<0||envelope.end>normalized.length||
   envelope.end<=envelope.start||
   !Array.isArray(envelope.records)||
   envelope.records.length!==envelope.end-envelope.start){
   rejected.push('SHARD_RANGE_INVALID');continue;
  }
  for(let i=0;i<envelope.records.length;i++){
   const rec=envelope.records[i],index=envelope.start+i;
   const expectedTask=(plan.gap_tasks||[])[index];
   if(!rec||rec.index!==index||rec.task_hash!==digest(taskIdentity(expectedTask,index))||
     !rec.result||rec.result.production_writes!==0){
    rejected.push('SHARD_TASK_IDENTITY_MISMATCH');continue;
   }
   if(ordered[index]){rejected.push('SHARD_DUPLICATE_TASK_INDEX');continue;}
   const normalizedResult=receiptResult(rec.result,expectedTask);
   if(rec.result.completed!==normalizedResult.completed ||
     JSON.stringify(normalizedResult)!==JSON.stringify(rec.result)){
    rejected.push('SHARD_RESULT_UNVERIFIED');continue;
   }
   ordered[index]=rec.result;
  }
 }
 const missing=normalized.flatMap((_,i)=>!ordered[i]?[i]:[]);
 const incomplete=normalized.flatMap((_,i)=>ordered[i]&&!ordered[i].completed?[i]:[]);
 const assembled=!rejected.length&&!missing.length&&!incomplete.length;
 return {version:VERSION,month,phase,plan_hash:expectedHash,
  task_count:normalized.length,received_count:ordered.filter(Boolean).length,
  completed_count:ordered.filter(r=>r&&r.completed).length,missing_indexes:missing,
  incomplete_indexes:incomplete,rejected,assembled,
  status:assembled?'CHECKPOINT_ASSEMBLED_NOT_VERIFIED':'CHECKPOINT_INCOMPLETE',
  // Never promote provenance envelopes directly to monthly FULL/READY.
  full:false,ready_for_verifier:false,production_writes:0,authoritative:false,
  results:ordered};
}
function sourceUniverseProof(plan={},checkpoint={}){
 if(checkpoint.phase!=='SOURCE_UNIVERSE'||!checkpoint.assembled||
  !Array.isArray(checkpoint.results))return {
   complete:false,blockers:['SOURCE_SHARDS_NOT_ASSEMBLED'],production_writes:0};
 const receipts=(plan.gap_tasks||[]).map((task,i)=>{
  const result=checkpoint.results[i],attempts=result.attempts.filter(a=>['NO_EVIDENCE','EVIDENCE_FOUND'].includes(a.status));
  return {source_id:text(task.source_id),task_source_id:text(task.source_id),
   month:checkpoint.month,planned_query:text(task.query),
   query_variants:Executor.queryVariants(task).slice(1),
   executed:result.completed,provider:result.provider||text(attempts[0]&&attempts[0].provider),
   status:result.candidates.length?'EVIDENCE_FOUND':'NO_EVIDENCE',
   candidate_count:result.candidates.length,attempts};
 });
 const proof=Registry.buildUniverseProof(receipts,{strict_live:true,month:checkpoint.month});
 return {...proof,checkpoint_status:checkpoint.status,
  authoritative:false,ready_for_verifier:false,production_writes:0};
}
module.exports={VERSION,MAX_BATCH,digest,taskIdentity,planFingerprint,selectShard,
 acceptableExecution,receiptResult,buildShardReceipt,executeShard,collect,sourceUniverseProof};
