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


test('expired query deadline prevents provider calls and remains an unexecuted gap',async()=>{
 let calls=0;
 const plan={gap_tasks:[{source_tier:'SOCIAL',providers:['BING_RSS'],query:'Bangkok Oct 2026'}]};
 const out=await Exec.executeGapPlan(plan,{providers:{BING_RSS:async()=>{calls++;return [{title:'Fake Concert',source_url:'https://example.org/fake'}];}},deadline_ms:Date.now()-1000});
 assert.equal(calls,0);
 assert.equal(out.status,'GAPS_REMAIN');
 assert.equal(out.time_budget_exhausted,true);
 assert.equal(out.results[0].status,'GAP_UNRESOLVED');
 assert.equal(out.results[0].attempts[0].status,'TIME_BUDGET_EXHAUSTED');
 assert.equal(out.production_writes,0);
});

test('partial query execution does not disguise a later exhausted deadline as FULL',async()=>{
 let now=10; const realNow=Date.now;
 try{
  Date.now=()=>now;
  let first=true;
  const out=await Exec.executeGapTask({source_tier:'SOCIAL',providers:['BING_RSS'],query:'A',query_variants:['B']},{
   providers:{BING_RSS:async()=>{if(first){first=false;now=30;}return [];}},
   deadline_ms:20
  });
  assert.equal(out.status,'GAP_UNRESOLVED');
  assert.equal(out.time_budget_exhausted,true);
  assert.deepEqual(out.attempts.map(x=>x.status),['NO_EVIDENCE','TIME_BUDGET_EXHAUSTED']);
  assert.equal(out.production_writes,0);
 }finally{Date.now=realNow;}
});
