'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const V2=require('../server/kk-ultra-deep-full-loop-v2.js');

function ready(){return V2.buildPlan({month:'2026-10',candidates:[{event_key:'existing',exists_in_canonical:true}]});}
function accept(plan,write={status:'COMPLETE',production_writes:0}){return V2.acceptance(plan,write,{exact_match:true});}

test('missing terminal evidence cannot become a completed zero-write run',()=>{
  for(const field of ['candidate_count','terminal_disposition_count','pending_candidate_count','decisions']){
    const plan=ready();delete plan[field];
    const result=accept(plan);
    assert.equal(result.status,'INCOMPLETE',field);
    assert.ok(result.blockers.includes('CANDIDATE_TERMINAL_COVERAGE_REQUIRED'),field);
  }
});

test('candidate counters must be nonnegative safe integers without coercion',()=>{
  for(const field of ['candidate_count','terminal_disposition_count','pending_candidate_count']){
    for(const value of [null,false,'0','',-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){
      assert.equal(accept({...ready(),[field]:value}).status,'INCOMPLETE',field+': '+String(value));
    }
  }
});

test('reported terminal totals must reconcile with actual candidate decisions',()=>{
  const cases=[
    {...ready(),candidate_count:2},
    {...ready(),terminal_disposition_count:0},
    {...ready(),decisions:[]},
    {...ready(),decisions:[{decision:'HOLD'}]},
    {...ready(),decisions:[{decision:'UNKNOWN'}]},
    {...ready(),decisions:[null]}
  ];
  for(const plan of cases) assert.equal(accept(plan).status,'INCOMPLETE');
});

test('write-count evidence cannot use absent coerced negative or fractional counts',()=>{
  for(const value of [undefined,null,false,'0','',-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){
    assert.equal(accept({...ready(),planned_mutation_count:value},{status:'COMPLETE',production_writes:value}).status,'INCOMPLETE',String(value));
  }
});

test('genuine no-change and owner-hidden dispositions remain terminal',()=>{
  assert.equal(accept(ready()).status,'COMPLETE');
  assert.equal(accept(V2.buildPlan({candidates:[]})).status,'COMPLETE');
  assert.equal(accept(V2.buildPlan({candidates:[{owner_hidden:true}]})).status,'COMPLETE');
});

test('mutation summaries cannot conceal missing or contradictory write evidence',()=>{
  const update=V2.buildPlan({candidates:[{exists_in_canonical:true,current_price:690,competitor_prices:[890]}]});
  const missing=ready();delete missing.mutations;
  const cases=[missing,
    {...update,planned_mutation_count:0},
    {...update,planned_mutation_count:0,mutations:[]},
    {...update,planned_mutation_count:0,mutations:[],decisions:update.decisions.map(d=>({...d,mutations:[]}))},
    {...ready(),decisions:[{decision:'NO_CHANGE'}]},
    {...ready(),planned_mutation_count:1,mutations:[{type:'UPDATE_PRICE'}],decisions:[{decision:'SKIP_HIDDEN',mutations:[{type:'UPDATE_PRICE'}]}]}
  ];
  for(const plan of cases){
    const result=accept(plan,{status:'COMPLETE',production_writes:plan.planned_mutation_count});
    assert.equal(result.status,'INCOMPLETE');
    assert.ok(result.blockers.includes('PLAN_MUTATION_EVIDENCE_REQUIRED'));
  }
});

test('verified update and create still require matching write count and readback',()=>{
  for(const candidate of [
    {exists_in_canonical:true,current_price:690,competitor_prices:[890]},
    {exact_event_verified:true,latest_official_poster_verified:true,latest_official_poster_url:'https://official.example/poster.jpg',governed_fallback_price:690}
  ]){
    const plan=V2.buildPlan({candidates:[candidate]});
    assert.equal(accept(plan,{status:'COMPLETE',production_writes:1}).status,'COMPLETE');
    assert.equal(accept(plan).status,'INCOMPLETE');
    assert.equal(V2.acceptance(plan,{status:'COMPLETE',production_writes:1},{exact_match:false}).status,'INCOMPLETE');
  }
});
