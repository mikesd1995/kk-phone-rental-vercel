'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const S=require('../server/kk-ultra-deep-readonly-shards.js');
const M={month:'2026-10',location:'Bangkok Metropolitan Region Thailand',shard_size:12};

test('144 October-scoped tasks have deterministic 12-shard manifest and stable fingerprint',()=>{
 const a=S.manifest(M),b=S.manifest(M);
 assert.equal(a.task_count,144);
 assert.equal(a.shards.length,12);
 assert.deepEqual(a.groups,{known_miss:27,monthly:111,reference:6});
 assert.equal(a.fingerprint,b.fingerprint);
 assert.equal(a.shards[0].start,0);
 assert.equal(a.shards[11].end,144);
 assert.notEqual(a.fingerprint,S.manifest({...M,month:'2026-11'}).fingerprint);
 assert.notEqual(a.fingerprint,S.manifest({...M,shard_size:10}).fingerprint);
 assert.equal(a.production_writes,0);
});

test('free provider whitelist refuses EXA even if injected, and standalone shard never publishes',async()=>{
 let paid=0,free=0;
 const output=await S.runShard({...M,shard_index:0},{
  read_only:true,providers:{
   BING_RSS:async task=>{free++;return [{title:task.query,event_date:'2026-10-21',source_url:'https://example.org/event'}];},
   EXA:async()=>{paid++;throw Error('paid provider must not be invoked');}
  },runtime_budget_ms:5000
 });
 assert.equal(paid,0);
 assert.equal(free,12);
 assert.deepEqual(output.providers_bound,['BING_RSS']);
 assert.equal(output.executed_count,12);
 assert.equal(output.status,'SHARD_RECEIPTS_EXECUTED');
 assert.equal(output.full,false);
 assert.equal(output.authoritative,false);
 assert.equal(output.production_writes,0);
});

test('a missing shard yields HOLD with exact manifest and missing work instead of fake FULL',async()=>{
 const output=await S.runShard({...M,shard_index:0},{read_only:true,
  providers:{BING_RSS:async()=>[]},runtime_budget_ms:5000});
 const report=S.combineReports(M,[output]);
 assert.equal(report.received_shards,1);
 assert.equal(report.status,'HOLD_OFFLINE_DISCOVERY_INCOMPLETE');
 assert.ok(report.blockers.includes('MISSING_SHARDS'));
 assert.ok(report.blockers.includes('MONTHLY_INCOMPLETE'));
 assert.equal(report.release_eligible,false);
 assert.equal(report.full,false);
 assert.equal(report.production_writes,0);
});

test('expired source evidence or explicit production-write value is never accepted',async()=>{
 const output=await S.runShard({...M,shard_index:0},{read_only:true,
  providers:{BING_RSS:async()=>[]},runtime_budget_ms:5000});
 assert.throws(()=>S.combineReports(M,[{...output,manifest_fingerprint:'tampered'}]),
  /READONLY_SHARD_REPORT_INVALID_OR_DUPLICATE/);
 assert.throws(()=>S.combineReports(M,[{...output,production_writes:1}]),
  /READONLY_SHARD_REPORT_INVALID_OR_DUPLICATE/);
 assert.throws(()=>S.combineReports(M,[{...output,full:true}]),
  /READONLY_SHARD_REPORT_INVALID_OR_DUPLICATE/);
 assert.throws(()=>S.combineReports(M,[output,output]),
  /READONLY_SHARD_REPORT_INVALID_OR_DUPLICATE/);
});

test('shard execution cannot proceed without explicit read-only permission',async()=>{
 await assert.rejects(()=>S.runShard({...M,shard_index:0},{}),
  /READONLY_SHARD_EXPLICIT_OPT_IN_REQUIRED/);
 await assert.rejects(()=>S.runShard({...M,shard_index:99},{read_only:true}),
  /READONLY_SHARD_INDEX_INVALID/);
 assert.throws(()=>S.manifest({...M,month:'not-a-month'}),/READONLY_SHARD_MONTH_INVALID/);
});

test('even all artificially executed shards cannot authorize commercial or production release',async()=>{
 const reports=[];
 for(const shard of S.manifest(M).shards){
  reports.push(await S.runShard({...M,shard_index:shard.index},{read_only:true,
   providers:{BING_RSS:async task=>[{title:'Synthetic '+(task.source_id||task.query),
     event_date:'2026-10-21',source_url:'https://synthetic.example/'+shard.index+'/'+task.query.length}]},
   runtime_budget_ms:5000
  }));
 }
 const report=S.combineReports(M,reports);
 assert.equal(report.received_shards,12);
 assert.equal(report.expected_tasks,144);
 assert.equal(report.full,false);
 assert.equal(report.authoritative,false);
 assert.equal(report.release_eligible,false);
 assert.equal(report.production_writes,0);
});


test('local CLI defaults to explicit flags and does not implicitly execute a scan on import',()=>{
 const CLI=require('../scripts/kk-ultra-deep-local-readonly-shards.js');
 assert.deepEqual(CLI.parseArgs(['--month','2026-10','--plan']),{month:'2026-10',plan:true});
 assert.deepEqual(CLI.parseArgs(['--month','2026-10','--run-all','--size','12']),{month:'2026-10','run-all':true,size:'12'});
 assert.equal(CLI.filename(2),'readonly-shard-002.json');
 assert.throws(()=>CLI.parseArgs(['--execute-writes']),/INVALID_SHARD_OPTION/);
});


test('a partial shard timeout is explicitly incomplete even after earlier provider attempts',async()=>{
 const receipt=await S.runShard({...M,shard_index:0},{read_only:true,
  providers:{BING_RSS:async task=>[{title:task.query,
   event_date:'2026-10-21',source_url:'https://example.org/event'}]},runtime_budget_ms:5000});
 const interrupted={...receipt,status:'SHARD_INCOMPLETE',time_budget_exhausted:true};
 const report=S.combineReports(M,[interrupted]);
 assert.ok(report.blockers.includes('SHARD_TIMEOUT_OR_INCOMPLETE'));
 assert.equal(report.receipts_complete,false);
 assert.equal(report.full,false);
 assert.equal(report.release_eligible,false);
});

test('all 12 offline source receipts still HOLD when an eligible independent event is missing its date',async()=>{
 const cases=require('../server/kk-ultra-deep-known-miss-regression.js').CORPUS;
 const byCase=new Map(cases.map(c=>['knownmiss:'+c.case_id,c]));
 const provider=async task=>{
  const hit=byCase.get(task.source_id);
  if(hit)return [{title:hit.title,event_date:hit.event_date,
   source_url:'https://proof.example/'+task.source_id}];
  if(task.source_id==='reference-6')return [{
   title:'ATLAS RISING UP FANMEET BANGKOK',
   event_date:null,venue:'BITEC LIVE Bangkok',
   source_url:'https://www.eventpop.me/e/2100/atlas-rising-up'
  }];
  return [{title:'Shared Reference Concert Bangkok',event_date:'2026-10-20',
   source_url:'https://proof.example/'+(task.source_id||'generic')}];
 };
 const reports=[];
 for(const shard of S.manifest(M).shards){
  reports.push(await S.runShard({...M,shard_index:shard.index},
   {read_only:true,providers:{BING_RSS:provider},runtime_budget_ms:5000}));
 }
 const merged=S.combineReports(M,reports);
 assert.equal(merged.received_shards,12);
 assert.equal(merged.reconciliation.pending_source_date_count,1);
 assert.ok(merged.blockers.includes('REFERENCE_SOURCE_DATE_VERIFICATION_PENDING'));
 assert.equal(merged.status,'HOLD_OFFLINE_DISCOVERY_INCOMPLETE');
 assert.equal(merged.receipts_complete,false);
 assert.equal(merged.full,false);
 assert.equal(merged.release_eligible,false);
 assert.equal(merged.production_writes,0);
});
