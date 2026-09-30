'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Runner=require('../server/kk-ultra-deep-runtime-runner.js');
const KnownMiss=require('../server/kk-ultra-deep-known-miss-regression.js');

test('runtime runner fails closed when no unknown-URL search provider is bound',async()=>{
 const out=await Runner.runMonthlyUltraDeep({month:'2026-10',location:'Bangkok Thailand'},{publicWebOptions:{searxng_endpoint:'',ddg_enabled:false,bing_enabled:false}});
 assert.equal(out.status,'HOLD_FOR_COVERAGE');
 assert.equal(out.full,false);
 assert.ok(out.blockers.includes('UNKNOWN_URL_SEARCH_NOT_BOUND'));
 assert.equal(out.production_writes,0);
});

test('runtime runner can prove FULL only from machine execution, tier evidence and independent reference evidence',async()=>{
 const byCase=new Map(KnownMiss.CORPUS.map(c=>['knownmiss:'+c.case_id,c]));
 const provider=async task=>{
   if(byCase.has(task.source_id)){
     const k=byCase.get(task.source_id);
     return [{title:k.title,event_date:k.event_date,source_url:'https://proof.example/'+task.source_id,evidence_text:k.title}];
   }
   return [{title:'Shared Reference Event',event_date:'2026-10-20',source_url:'https://proof.example/'+(task.source_id||task.source_tier||'generic')}];
 };
 const out=await Runner.runMonthlyUltraDeep({month:'2026-10',location:'Bangkok Thailand'},{
   providers:{OFFICIAL_DIRECT:provider,RSS_OR_PUBLIC_FEED:provider,SEARXNG:provider},
   publicWebOptions:{searxng_endpoint:'',ddg_enabled:false,bing_enabled:false}
 });
 assert.equal(out.status,'READY_FOR_VERIFIER');
 assert.equal(out.full,true);
 assert.equal(out.provider_binding.unknown_url_search_bound,true);
 assert.equal(out.source_universe.execution_complete,true);
 assert.equal(out.source_tier_evidence.complete,true);
 assert.equal(out.reference_proof.complete,true);
 assert.ok(out.reference_proof.reference_candidate_count>0);
 assert.equal(out.reconciliation.reconciliation_gap_count,0);
 assert.equal(out.known_miss_regression.complete,true);
 assert.equal(out.production_writes,0);
 assert.equal(out.verifier_required,true);
});

test('empty reference sweep can never produce FULL',async()=>{
 const provider=async task=>{
   if(String(task.source_id||'').startsWith('reference-'))return [];
   return [{title:'Evidence '+(task.source_tier||'x'),source_url:'https://proof.example/'+(task.source_id||task.source_tier||'x')}];
 };
 const out=await Runner.runMonthlyUltraDeep({month:'2026-10',location:'Bangkok Thailand'},{
   providers:{OFFICIAL_DIRECT:provider,RSS_OR_PUBLIC_FEED:provider,SEARXNG:provider},
   publicWebOptions:{searxng_endpoint:'',ddg_enabled:false,bing_enabled:false}
 });
 assert.equal(out.full,false);
 assert.equal(out.reference_proof.complete,false);
 assert.ok(out.blockers.includes('REFERENCE_SWEEP_EMPTY_OR_UNHEALTHY'));
});
