'use strict';
// Local-only, zero-business-write alternative to an overlong serverless FULL scan.
// Reports are discovery witnesses, NOT production-authorized FULL acceptance.
const crypto=require('node:crypto');
const Monthly=require('./kk-monthly-deep-scan-query-plan.js');
const Runner=require('./kk-ultra-deep-runtime-runner.js');
const Executor=require('./kk-ultra-deep-provider-executor.js');
const PublicWeb=require('./kk-ultra-deep-public-web-adapters.js');
const SourceRegistry=require('./kk-ultra-deep-source-registry.js');
const KnownMiss=require('./kk-ultra-deep-known-miss-regression.js');
const Reconciliation=require('./kk-ultra-deep-reconciliation.js');

const VERSION='KK_ULTRA_DEEP_LOCAL_READONLY_SHARDS_V2';
const FREE_PROVIDERS=Object.freeze([
 'OFFICIAL_DIRECT','RSS_OR_PUBLIC_FEED','LIVENATION_PUBLIC','BING_RSS',
 'DDG_HTML','BING_HTML','SEARXNG','DDGS_TRAFILATURA'
]);
function text(v){return String(v==null?'':v).trim();}
function month(input={}){
 const value=text(input.month);
 if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(value))throw new Error('READONLY_SHARD_MONTH_INVALID');
 return value;
}
function shardSize(input={}){
 const raw=Number(input.shard_size==null?12:input.shard_size);
 if(!Number.isInteger(raw)||raw<1||raw>25)throw new Error('READONLY_SHARD_SIZE_INVALID');
 return raw;
}
function plans(input={}){
 const mo=month(input),location=text(input.location)||'Bangkok Metropolitan Region Thailand';
 return {
  known_miss:Runner.buildKnownMissPlan({month:mo}),
  monthly:Monthly.build({month:mo,location}),
  reference:Runner.buildReferencePlan({month:mo,location})
 };
}
function manifest(input={}){
 const mo=month(input),location=text(input.location)||'Bangkok Metropolitan Region Thailand',size=shardSize(input);
 const groupPlans=plans({month:mo,location});
 const allTasks=[];
 for(const group of ['known_miss','monthly','reference']){
  (groupPlans[group].gap_tasks||[]).forEach((task,index)=>{
   allTasks.push({group,group_index:index,task_id:group+':'+index+':'+text(task.source_id),task});
  });
 }
 const fingerprint=crypto.createHash('sha256').update(JSON.stringify({
  version:VERSION,month:mo,location,shard_size:size,
  tasks:allTasks.map(x=>({task_id:x.task_id,task:x.task}))
 })).digest('hex');
 const shards=[];
 for(let start=0;start<allTasks.length;start+=size){
  shards.push({index:shards.length,start,end:Math.min(start+size,allTasks.length),
   count:Math.min(size,allTasks.length-start)});
 }
 return {version:VERSION,month:mo,location,shard_size:size,fingerprint,task_count:allTasks.length,
  groups:Object.fromEntries(['known_miss','monthly','reference'].map(x=>[x,groupPlans[x].gap_tasks.length])),
  shards,allTasks,groupPlans,production_writes:0,authoritative:false};
}
function safeProviders(options={}){
 const sources=options.providers||PublicWeb.createProviders(options.publicWebOptions||{});
 return Object.fromEntries(FREE_PROVIDERS.filter(p=>typeof sources[p]==='function').map(p=>[p,sources[p]]));
}
async function runShard(input={},options={}){
 if(options.read_only!==true)throw new Error('READONLY_SHARD_EXPLICIT_OPT_IN_REQUIRED');
 const m=manifest(input),index=Number(input.shard_index);
 if(!Number.isInteger(index)||index<0||index>=m.shards.length)throw new Error('READONLY_SHARD_INDEX_INVALID');
 const shard=m.shards[index],providers=safeProviders(options);
 const tasks=m.allTasks.slice(shard.start,shard.end).map(x=>({
  ...x.task,providers:(x.task.providers||[]).filter(p=>FREE_PROVIDERS.includes(p))
 }));
 const ms=Number(options.runtime_budget_ms||180000);
 const budget=Number.isFinite(ms)?Math.min(210000,Math.max(1000,Math.floor(ms))):180000;
 const result=await Executor.executeGapPlan({gap_tasks:tasks},{
  providers,deadline_ms:Date.now()+budget,concurrency:Math.min(4,Executor.MAX_CONCURRENCY)
 });
 const taskIds=m.allTasks.slice(shard.start,shard.end).map(x=>x.task_id);
 const proof=Runner.executionProof(result);
 return {
  version:VERSION,month:m.month,location:m.location,manifest_fingerprint:m.fingerprint,
  shard_index:index,shard_start:shard.start,shard_end:shard.end,task_ids:taskIds,
  results:result.results,executed_count:proof.executed_count,task_count:tasks.length,
  time_budget_exhausted:result.time_budget_exhausted===true,
  status:proof.complete&&!result.time_budget_exhausted?'SHARD_RECEIPTS_EXECUTED':'SHARD_INCOMPLETE',
  providers_bound:Object.keys(providers),
  full:false,authoritative:false,verifier_required:true,production_writes:0
 };
}
function combineReports(input={},reports=[]){
 const m=manifest(input),valid=new Map(),blockers=[];
 for(const report of Array.isArray(reports)?reports:[]){
  const idx=Number(report&&report.shard_index);
  const shard=m.shards[idx];
  if(!shard||valid.has(idx)||report.version!==VERSION||
   report.month!==m.month||report.location!==m.location||
   report.manifest_fingerprint!==m.fingerprint||
   Number(report.production_writes)!==0||
   report.authoritative!==false||report.full!==false||
   report.shard_start!==shard.start||report.shard_end!==shard.end||
   JSON.stringify(report.task_ids)!==JSON.stringify(m.allTasks.slice(shard.start,shard.end).map(x=>x.task_id))||
   !Array.isArray(report.results)||report.results.length!==shard.count)
    throw new Error('READONLY_SHARD_REPORT_INVALID_OR_DUPLICATE');
  if(report.time_budget_exhausted===true||report.status!=='SHARD_RECEIPTS_EXECUTED')
   blockers.push('SHARD_TIMEOUT_OR_INCOMPLETE');
  valid.set(idx,report);
 }
 if(valid.size!==m.shards.length)blockers.push('MISSING_SHARDS');
 const grouped={known_miss:[],monthly:[],reference:[]};
 for(const shard of m.shards){
  const report=valid.get(shard.index);
  if(!report)continue;
  for(let i=0;i<report.results.length;i++){
   const meta=m.allTasks[shard.start+i];
   grouped[meta.group][meta.group_index]=report.results[i];
  }
 }
 const proofs={};
 for(const group of Object.keys(grouped)){
  const rows=grouped[group];
  const expected=m.groupPlans[group].gap_tasks.length;
  const contiguous=rows.length===expected&&Array.from({length:expected},(_,i)=>rows[i]!=null).every(Boolean);
  proofs[group]=contiguous?Runner.executionProof({results:rows}):
   {complete:false,task_count:expected,executed_count:rows.filter(Boolean).length};
  if(!proofs[group].complete)blockers.push(group.toUpperCase()+'_INCOMPLETE');
 }
 const monthlyReceipts=Runner.sourceUniverseReceipts(m.groupPlans.monthly,{results:grouped.monthly});
 const universe=SourceRegistry.buildUniverseProof(monthlyReceipts);
 if(!universe.complete)blockers.push('SOURCE_UNIVERSE_INCOMPLETE');
 const discovered=Runner.flattenCandidates({results:grouped.monthly.filter(Boolean)});
 const reference=Runner.flattenCandidates({results:grouped.reference.filter(Boolean)});
 const knownCandidates=Runner.flattenCandidates({results:grouped.known_miss.filter(Boolean)});
 const scoped=Runner.scopeReferenceCandidates(reference,{month:m.month,location:m.location});
 const recovered=Runner.recoverEligibleReferenceCandidates(discovered,scoped);
 const reconciliation=Reconciliation.reconcileCandidateSets(recovered.candidates,scoped);
 const knownMiss=KnownMiss.evaluate([...knownCandidates,...discovered,...reference],[],{month:m.month,strict_live:true});
 if(!knownMiss.complete)blockers.push('KNOWN_MISS_LIVE_RECALL_INCOMPLETE');
 if(!reconciliation.complete)blockers.push('RECONCILIATION_GAPS_REMAIN');
 if(reconciliation.pending_source_date_count>0)blockers.push('REFERENCE_SOURCE_DATE_VERIFICATION_PENDING');
 const receipts_complete=blockers.length===0;
 return {
  version:VERSION,month:m.month,manifest_fingerprint:m.fingerprint,shard_count:m.shards.length,
  received_shards:valid.size,expected_tasks:m.task_count,proofs,
  source_universe:{complete:universe.complete,required:universe.required_source_count,passed:universe.passed_required_source_count,missing:universe.missing_required_sources},
  candidates:{discovered:discovered.length,reference:reference.length,recovered:recovered.recovered_count},
  known_miss_live:{complete:knownMiss.complete,passed:knownMiss.passed,case_count:knownMiss.case_count,missing_cases:knownMiss.missing_cases},
  reconciliation:{complete:reconciliation.complete,missing:reconciliation.reconciliation_gap_count,
    pending_source_date_count:reconciliation.pending_source_date_count||0},
  receipts_complete,blockers:[...new Set(blockers)],
  // A local merge has no signed production provider identity and cannot authorize
  // commercial, owner, booking, writer, or release gates.
  status:receipts_complete?'OFFLINE_DISCOVERY_RECEIPTS_READY_FOR_INDEPENDENT_VERIFICATION':'HOLD_OFFLINE_DISCOVERY_INCOMPLETE',
  full:false,release_eligible:false,authoritative:false,verifier_required:true,production_writes:0
 };
}
module.exports={VERSION,FREE_PROVIDERS,month,shardSize,plans,manifest,safeProviders,runShard,combineReports};
