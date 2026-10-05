'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Query=require('../server/kk-monthly-deep-scan-query-plan.js');
const Registry=require('../server/kk-ultra-deep-source-registry.js');
const V2=require('../server/kk-ultra-deep-full-loop-v2.js');

test('BL GL and fandom long-tail lanes are mandatory discovery vocabulary',()=>{
 const blob=JSON.stringify(Query.TIER_TERMS);
 for(const term of ['BL GL','final ep','first ep','รวมพล','บวงสรวง','lucky fan','top spender','fansign']) assert.ok(blob.toLowerCase().includes(term.toLowerCase()),term);
});

test('priority BL GL agency ecosystems are required source-universe members',()=>{
 const rows=Registry.REGISTRY.ARTIST_AGENCY;
 for(const id of ['gmmtv','domundi-mandee','change2561','idolfactory','channel3-bl-gl']){
  const row=rows.find(x=>x.source_id===id);assert.ok(row,id);assert.equal(row.required,true,id);
 }
});

test('full-loop acceptance fails when any candidate is still pending commercial or publish/readback disposition',()=>{
 const plan={status:'READY',planned_mutation_count:1,candidate_count:2,terminal_disposition_count:1,pending_candidate_count:1};
 const result=V2.acceptance(plan,{status:'COMPLETE',production_writes:1},{exact_match:true});
 assert.equal(result.status,'INCOMPLETE');
 assert.ok(result.blockers.includes('CANDIDATE_TERMINAL_COVERAGE_REQUIRED'));
});
