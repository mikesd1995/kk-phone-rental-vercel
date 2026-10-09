'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Exec=require('../server/kk-ultra-deep-provider-executor.js');

test('provider executor falls through zero-cost providers until evidence exists',async()=>{
  const r=await Exec.executeGapTask({source_tier:'SOCIAL',providers:['SEARXNG','DDGS_TRAFILATURA','EXA']},{providers:{
    SEARXNG:async()=>[],
    DDGS_TRAFILATURA:async()=>[{title:'Event',source_url:'https://example.com/event'}],
    EXA:async()=>{throw new Error('must not be called');}
  }});
  assert.equal(r.status,'EVIDENCE_FOUND'); assert.equal(r.provider,'DDGS_TRAFILATURA'); assert.equal(r.production_writes,0);
});

test('provider executor fails closed when no provider is bound',async()=>{
  const r=await Exec.executeGapTask({source_tier:'VENUE',providers:['SEARXNG','EXA']},{providers:{}});
  assert.equal(r.status,'GAP_UNRESOLVED'); assert.deepEqual(r.attempts.map(x=>x.status),['NOT_BOUND','NOT_BOUND']);
});

test('provider executor falls from DDG to Bing when DDG has no evidence',async()=>{
 const r=await Exec.executeGapTask({source_tier:'SOCIAL',providers:['DDG_HTML','BING_HTML']},{providers:{
   DDG_HTML:async()=>[],
   BING_HTML:async()=>[{title:'Fallback Event',source_url:'https://example.com/fallback'}]
 }});
 assert.equal(r.status,'EVIDENCE_FOUND');
 assert.equal(r.provider,'BING_HTML');
 assert.deepEqual(r.attempts.map(x=>x.status),['NO_EVIDENCE','EVIDENCE_FOUND']);
});

test('provider executor tries query variants independently before falling to the next provider',async()=>{
 const seen=[];
 const r=await Exec.executeGapTask({
   source_tier:'SOCIAL',
   query:'canonical event Bangkok Thailand',
   query_variants:['event alias Bangkok Thailand','second alias Bangkok Thailand'],
   providers:['DDG_HTML','BING_HTML']
 },{providers:{
   DDG_HTML:async task=>{seen.push('DDG:'+task.query);return task.query==='event alias Bangkok Thailand'?[{title:'Alias Event',source_url:'https://example.com/alias'}]:[];},
   BING_HTML:async task=>{seen.push('BING:'+task.query);return [{title:'Must not run',source_url:'https://example.com/bing'}];}
 }});
 assert.equal(r.status,'EVIDENCE_FOUND');
 assert.equal(r.provider,'DDG_HTML');
 assert.deepEqual(seen,['DDG:canonical event Bangkok Thailand','DDG:event alias Bangkok Thailand']);
 assert.deepEqual(r.attempts.map(x=>x.status),['NO_EVIDENCE','EVIDENCE_FOUND']);
 assert.equal(r.attempts[1].query,'event alias Bangkok Thailand');
});

test('queryVariants deduplicates canonical and alias queries while preserving order',()=>{
 assert.deepEqual(
   Exec.queryVariants({query:'A',query_variants:['A','B','B','C']}),
   ['A','B','C']
 );
});

test('taskConcurrency is bounded and configurable',()=>{
 assert.equal(Exec.taskConcurrency({concurrency:0}),Exec.DEFAULT_CONCURRENCY);
 assert.equal(Exec.taskConcurrency({concurrency:1}),1);
 assert.equal(Exec.taskConcurrency({concurrency:999}),Exec.MAX_CONCURRENCY);
});

test('executeGapPlan runs tasks concurrently but preserves result order',async()=>{
 let active=0,maxActive=0;
 const delays={a:30,b:5,c:15,d:1};
 const tasks=Object.keys(delays).map(id=>({source_id:id,source_tier:'SOCIAL',query:id,providers:['DDG_HTML']}));
 const out=await Exec.executeGapPlan({gap_tasks:tasks},{concurrency:2,providers:{
   DDG_HTML:async task=>{
     active++;maxActive=Math.max(maxActive,active);
     await new Promise(resolve=>setTimeout(resolve,delays[task.source_id]));
     active--;
     return [{title:task.source_id,source_url:'https://example.com/'+task.source_id}];
   }
 }});
 assert.equal(maxActive,2);
 assert.deepEqual(out.results.map(r=>r.candidates[0].title),['a','b','c','d']);
 assert.equal(out.status,'GAPS_RESOLVED');
 assert.equal(out.production_writes,0);
});


test('shared expired deadline prevents provider calls and preserves aligned incomplete task receipts',async()=>{
 let calls=0;
 const task={source_tier:'PUBLIC_CALENDAR',source_id:'month-202610',query:'Bangkok October',
  providers:['BING_RSS','DDG_HTML']};
 const result=await Exec.executeGapPlan({gap_tasks:[task,{...task,source_id:'second'}]},{
  deadlineMs:Date.now()-100,providers:{BING_RSS:async()=>{calls++;return [];}},concurrency:2
 });
 assert.equal(calls,0);
 assert.equal(result.status,'INCOMPLETE_TIME_BUDGET');
 assert.equal(result.results.length,2);
 assert.equal(result.deadline_exceeded_count,2);
 assert.deepEqual(result.results.map(r=>r.status),['TIME_BUDGET_EXCEEDED','TIME_BUDGET_EXCEEDED']);
 assert.equal(result.production_writes,0);
});
test('bounded executor retains completed attempt without classifying an interrupted source as exhausted',async()=>{
 let queries=0;
 const options={deadlineMs:Date.now()+60000,providers:{}};
 options.providers.BING_RSS=async()=>{
  queries++;options.deadlineMs=Date.now()-100;
  return [];
 };
 const result=await Exec.executeGapTask({
  source_tier:'PUBLIC_CALENDAR',source_id:'popradar',query:'primary search',
  query_variants:['fallback search'],providers:['BING_RSS']
 },options);
 assert.equal(queries,1);
 assert.equal(result.status,'TIME_BUDGET_EXCEEDED');
 assert.equal(result.attempts.length,1);
 assert.equal(result.attempts[0].status,'NO_EVIDENCE');
 assert.equal(result.production_writes,0);
});
