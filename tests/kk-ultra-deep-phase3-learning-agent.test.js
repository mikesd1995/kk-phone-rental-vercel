'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const L=require('../server/kk-ultra-deep-phase3-learning-agent.js');

test('Phase3 learning changes strategy by miss class rather than hardcoding event',()=>{
 const out=L.learn({
  candidates:[{candidate_id:'c1',title:'Example Fan Event',event_date:'2026-10-20',artist:['Artist A'],event_type:'FANMEETING'}],
  misses:[
   {candidate_id:'c1',miss_class:'STALE_PRICE_GAP'},
   {candidate_id:'c1',miss_class:'PACKAGE_AMBIGUITY'},
   {candidate_id:'c1',miss_class:'NO_EXACT_PRICE_GAP'}
  ]
 });
 assert.ok(out.mandatory_expansion.includes('FRESH_PRICE_TIMESTAMP_RECOVERY'));
 assert.ok(out.mandatory_expansion.includes('PACKAGE_SEMANTIC_RECONCILIATION'));
 assert.ok(out.mandatory_expansion.includes('EXPAND_COMPETITOR_UNIVERSE'));
 assert.ok(out.extra_queries_by_candidate.c1.some(q=>q.includes('ล่าสุด')));
 assert.equal(out.production_writes,0);
});
