'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Selector=require('../server/kk-content-selector.js');

function candidate(id,angle,metrics,extra={}){
 return {id,angle,copy:'copy '+id,qa_gate:'PASS',metrics,...extra};
}
const strong={
 hook_strength:92,
 event_fandom_relevance:95,
 timing_relevance:82,
 novelty:88,
 hashtag_relevance:100,
 readability:90
};
const medium={
 hook_strength:80,
 event_fandom_relevance:82,
 timing_relevance:75,
 novelty:76,
 hashtag_relevance:95,
 readability:86
};

test('awareness selector emits one winner from three internal QA-passing candidates',()=>{
 const result=Selector.selectWinner([
   candidate('a','event_theme',medium),
   candidate('b','fandom',strong),
   candidate('c','trust',{...medium,hook_strength:72})
 ],{objective:'awareness',measured_posts:0});
 assert.equal(result.gate,'PASS');
 assert.equal(result.public_output_mode,'SINGLE_FINAL_POST');
 assert.equal(result.internal_candidate_count,3);
 assert.equal(result.public_output_count,1);
 assert.equal(result.winner.id,'b');
 assert.equal(result.evidence_state,'RULE_BASED_COLD_START');
});

test('conversion profile requires commercial relevance metric',()=>{
 const candidates=[
   candidate('a','event_theme',strong),
   candidate('b','fandom',strong),
   candidate('c','trust',strong)
 ];
 const result=Selector.selectWinner(candidates,{objective:'conversion',measured_posts:0});
 assert.equal(result.gate,'BLOCKED');
 assert.match(result.scored_candidates[0].errors.join('|'),/METRIC_MISSING:commercial_relevance/);
});

test('selector excludes QA-blocked candidates even if their metric scores are high',()=>{
 const high={...strong,hook_strength:100};
 const result=Selector.selectWinner([
   candidate('a','event_theme',medium),
   candidate('b','fandom',high,{qa_gate:'BLOCKED'}),
   candidate('c','trust',{...medium,hook_strength:70})
 ],{objective:'awareness',measured_posts:0});
 assert.equal(result.gate,'PASS');
 assert.equal(result.winner.id,'a');
 assert.equal(result.scored_candidates.find(x=>x.id==='b').eligible,false);
});

test('selector fails closed unless exactly three internal candidates exist',()=>{
 const result=Selector.selectWinner([candidate('a','event_theme',strong)],{objective:'awareness'});
 assert.equal(result.gate,'BLOCKED');
 assert.match(result.errors.join('|'),/EXACTLY_3_INTERNAL_CANDIDATES_REQUIRED/);
});

test('performance support only nudges selection after minimum measured evidence exists',()=>{
 const a=candidate('a','event_theme',medium,{performance_support:100});
 const b=candidate('b','fandom',{...medium,hook_strength:82},{performance_support:0});
 const c=candidate('c','trust',{...medium,hook_strength:70},{performance_support:50});
 const cold=Selector.selectWinner([a,b,c],{objective:'awareness',measured_posts:0});
 const informed=Selector.selectWinner([a,b,c],{objective:'awareness',measured_posts:3});
 assert.equal(cold.evidence_state,'RULE_BASED_COLD_START');
 assert.equal(informed.evidence_state,'PERFORMANCE_INFORMED');
 assert.ok(informed.scored_candidates.find(x=>x.id==='a').score > cold.scored_candidates.find(x=>x.id==='a').score);
});
