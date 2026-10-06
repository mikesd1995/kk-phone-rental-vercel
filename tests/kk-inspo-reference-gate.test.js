'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Gate=require('../server/kk-inspo-reference-gate.js');

test('major redesign requires Inspo evidence while bugfix does not',()=>{
 assert.equal(Gate.classify({kind:'redesign'}).required,true);
 assert.equal(Gate.classify({kind:'bugfix'}).required,false);
 assert.equal(Gate.validateEvidence({kind:'bugfix'}).status,'NOT_REQUIRED');
});

test('major redesign fails closed without useful reference evidence',()=>{
 const r=Gate.validateEvidence({kind:'redesign',inspo_evidence:{provider:'Nutlope/inspo',brief:'mobile concert rental'}});
 assert.equal(r.status,'BLOCKED');
 assert.ok(r.blockers.includes('INSPO_REFERENCE_SET_TOO_SMALL'));
 assert.ok(r.blockers.includes('INSPO_ADOPTED_PATTERNS_MISSING'));
 assert.ok(r.blockers.includes('INSPO_REJECTED_PATTERNS_MISSING'));
});

test('reference gate passes bounded evidence and stays nonauthoritative',()=>{
 const r=Gate.validateEvidence({kind:'redesign',inspo_evidence:{
   provider:'Nutlope/inspo',brief:'mobile-first poster-led event rental storefront',
   references:['ref-a','ref-b','ref-c'],
   patterns_adopt:['poster-first hierarchy','quiet utility chrome'],
   patterns_reject:['generic SaaS hero','multiple loud CTAs']
 }});
 assert.equal(r.status,'PASS');
 assert.equal(r.provider.authority,'REFERENCE_ONLY');
 assert.equal(r.production_writes,0);
});

test('verbatim copying and business-truth authority are blocked',()=>{
 const r=Gate.validateEvidence({kind:'redesign',inspo_evidence:{
   provider:'Nutlope/inspo',brief:'x',references:['a','b','c'],patterns_adopt:['a'],patterns_reject:['b'],
   copy_component_verbatim:true,business_truth_authority:true
 }});
 assert.equal(r.status,'BLOCKED');
 assert.ok(r.blockers.includes('REFERENCE_COPYING_NOT_ALLOWED'));
 assert.ok(r.blockers.includes('INSPO_CANNOT_AUTHOR_BUSINESS_TRUTH'));
});
