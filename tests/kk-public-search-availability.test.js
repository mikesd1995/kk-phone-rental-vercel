'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../server/kk-ultra-deep-provider-executor.js');
const R=require('../server/kk-ultra-deep-runtime-runner.js');
function fresh(){const file=require.resolve('../server/kk-ultra-deep-public-web-adapters.js');delete require.cache[file];return require(file);}
function providers(A,fetchFn,extra={}){return A.createProviders({livenation_enabled:false,bing_rss_enabled:false,bing_enabled:false,ddg_min_interval_ms:0,searxng_endpoint:'',ddgs_trafilatura_enabled:false,fetchFn,...extra});}
const task={query:'neutral first',query_variants:['neutral second','neutral third'],providers:['DDG_HTML'],stop_condition:'EXHAUST_BOUNDED_VARIANTS_AND_RECORD_RECEIPTS'};
const challenge='<form id="challenge-form" action="//duckduckgo.com/anomaly.js" method="POST">Verify</form>';
async function proof(A,fetchFn,extra={}){const p=providers(A,fetchFn,extra),result=await E.executeGapTask(task,{providers:p});return {result,execution:R.executionProof({results:[result]})};}

test('HTTP202 challenge reports one provider failure and explicit circuit debt for later variants',async()=>{
 let calls=0;const out=await proof(fresh(),async()=>{calls++;return new Response(challenge,{status:202});});
 assert.equal(calls,1);assert.ok(out.result.attempts.every(row=>row.status==='PROVIDER_ERROR'));
 assert.deepEqual(out.result.attempts.map(row=>row.error_class),['HTTP_202','DDG_CIRCUIT_OPEN','DDG_CIRCUIT_OPEN']);assert.equal(out.execution.complete,false);
});

test('an HTTP200 active challenge form is an unavailable provider rather than a completed empty search',async()=>{
 for(const body of [challenge,'<form id="anomaly-form" method="POST">Check</form>','<form id=challenge-form method=POST>Check</form>']){
  let calls=0;const out=await proof(fresh(),async()=>{calls++;return new Response(body);});
  assert.equal(calls,1);assert.equal(out.result.attempts[0].error_class,'DDG_CHALLENGE');assert.equal(out.execution.complete,false);
 }
});

test('HTTP403 and abort retain explicit unavailable debt during the circuit cooldown',async()=>{
 for(const status of ['blocked','abort']){
  let calls=0;const out=await proof(fresh(),async()=>{calls++;if(status==='abort')throw Object.assign(new Error('fixture abort'),{name:'AbortError'});return new Response('',{status:403});});
  assert.equal(calls,1);assert.ok(out.result.attempts.every(row=>row.status==='PROVIDER_ERROR'));assert.equal(out.execution.complete,false);
 }
});

test('a throttled request rechecks the circuit before sending another GET',async()=>{
 const A=fresh();let calls=0;
 const fetchFn=async()=>{calls++;return new Response('',{status:calls===1?200:403});};
 await A.duckDuckGoHtml({query:'prime'},{fetchFn,ddg_min_interval_ms:30});
 const out=await Promise.allSettled([A.duckDuckGoHtml({query:'first'},{fetchFn,ddg_min_interval_ms:30}),A.duckDuckGoHtml({query:'queued'},{fetchFn,ddg_min_interval_ms:30})]);
 assert.equal(calls,2);assert.deepEqual(out.map(row=>row.reason.code).sort(),['DDG_CIRCUIT_OPEN','HTTP_403']);
});

test('a legitimate completed HTTP200 empty result remains NO_EVIDENCE with executed proof',async()=>{
 let calls=0;const out=await proof(fresh(),async()=>{calls++;return new Response('<form id="search_form"></form><p>No results found</p>');});
 assert.equal(calls,3);assert.ok(out.result.attempts.every(row=>row.status==='NO_EVIDENCE'));assert.equal(out.execution.complete,true);
});

test('challenge words or inert form markup cannot turn normal search evidence into a failure',async()=>{
 const A=fresh(),body='<!-- '+challenge+' --><script>const x="'+challenge+'"</script><form data-id="challenge-form"></form><a class="result__a" href="https://official.example/1">Captcha Concert 24 October 2026</a>';
 const p=providers(A,async()=>new Response(body)),out=await E.executeGapTask({query:'Captcha Concert',providers:['DDG_HTML']},{providers:p});
 assert.equal(out.status,'EVIDENCE_FOUND');assert.equal(out.candidates[0].event_date,'2026-10-24');
});

test('an unavailable DDG still allows the next existing bound provider to return evidence',async()=>{
 const A=fresh();let ddgCalls=0;
 const p=providers(A,async url=>{if(String(url).includes('duckduckgo')){ddgCalls++;return new Response(challenge,{status:202});}return new Response('<li class="b_algo"><a href="https://official.example/1">Aurora Concert 24 October 2026</a></li>');},{bing_enabled:true});
 const out=await E.executeGapTask({query:'Aurora Concert',providers:['DDG_HTML','BING_HTML']},{providers:p});
 assert.equal(out.provider,'BING_HTML');assert.equal(ddgCalls,1);assert.deepEqual(out.attempts.map(row=>row.status),['PROVIDER_ERROR','EVIDENCE_FOUND']);assert.equal(out.production_writes,0);
});

test('invalid cooldown options cannot disable suppression after a provider failure',async()=>{
 for(const value of ['invalid',NaN,Infinity]){
  let calls=0;const out=await proof(fresh(),async()=>{calls++;return new Response('',{status:403});},{ddg_circuit_ms:value});
  assert.equal(calls,1);assert.ok(out.result.attempts.every(row=>row.status==='PROVIDER_ERROR'));
 }
});

test('circuit skips do not extend cooldown and the next eligible completed request can rearm',async t=>{
 const A=fresh();let clock=1000,calls=0;t.mock.method(Date,'now',()=>clock);
 const fetchFn=async()=>{calls++;return new Response('',{status:calls===1?403:200});};
 await assert.rejects(A.duckDuckGoHtml({query:'first'},{fetchFn,ddg_min_interval_ms:0,ddg_circuit_ms:1000}),{code:'HTTP_403'});
 clock=1800;await assert.rejects(A.duckDuckGoHtml({query:'skip'},{fetchFn,ddg_min_interval_ms:0,ddg_circuit_ms:1000}),{code:'DDG_CIRCUIT_OPEN'});
 clock=2001;assert.deepEqual(await A.duckDuckGoHtml({query:'rearmed'},{fetchFn,ddg_min_interval_ms:0,ddg_circuit_ms:1000}),[]);assert.equal(calls,2);
});

test('only the actual form ID can identify a challenge, not strings inside attribute values',async()=>{
 const normal=['<form title="Ordinary id=\'challenge-form\' example" id="search_form"></form>','<form title="id=challenge-form/docs" id=search_form></form>','<div title="<form id=challenge-form>"></div>','<form id=" search_form " title="challenge-form"></form>','<form id="search_form" id="challenge-form"></form>'];
 for(const body of normal){const out=await proof(fresh(),async()=>new Response(body));assert.ok(out.result.attempts.every(row=>row.status==='NO_EVIDENCE'));assert.equal(out.execution.complete,true);}
});

test('encoded actual challenge IDs are rejected while raw-text and inert contexts stay normal',async()=>{
 for(const body of ['<form id="challenge&#45;form"></form>','<form title="<template>" id=challenge-form></form>','<form title="<script>" id=challenge-form></form>','<textarea><!--</textarea>--><form id=challenge-form></form>']){
  const encoded=await proof(fresh(),async()=>new Response(body));
  assert.equal(encoded.result.attempts[0].error_class,'DDG_CHALLENGE');assert.equal(encoded.execution.complete,false);
 }
 for(const tag of ['textarea','title','xmp','iframe','noembed','noframes','noscript','template']){
  const out=await proof(fresh(),async()=>new Response('<'+tag+'>'+challenge+'</'+tag+'>'));
  assert.ok(out.result.attempts.every(row=>row.status==='NO_EVIDENCE'));assert.equal(out.execution.complete,true);
 }
});
