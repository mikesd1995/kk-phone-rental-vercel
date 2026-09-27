'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const path=require('path');
const Signals=require('../server/kk-operating-partner-signals.js');

const NOW=Date.parse('2026-09-27T11:45:00+07:00');

function base(overrides={}){
  return {
    signal_id:'sig_evt_001',
    signal_type:'event_demand',
    subject_ref:'EVT-DEMO-001',
    observed_at:'2026-09-27T11:30:00+07:00',
    source_class:'OFFICIAL',
    source_ref:'SRC-EVT-001',
    confidence:90,
    metrics:{demand_score:88,content_reach_score:84,source_count:3,official_source_count:2},
    ...overrides
  };
}

test('signal contract accepts fresh bounded evidence',()=>{
  const checked=Signals.normalizeSignal(base(),{nowMs:NOW});
  assert.deepEqual(checked.errors,[]);
  assert.equal(checked.signal.freshness.status,'FRESH');
  assert.equal(checked.signal.metrics.demand_score,88);
  assert.equal(checked.signal.production_writes,0);
  assert.equal(checked.signal.advisory_only,true);
});

test('signal contract fails closed on stale inventory evidence',()=>{
  const checked=Signals.normalizeSignal(base({
    signal_id:'sig_inv_001',
    signal_type:'inventory_capacity',
    observed_at:'2026-09-27T09:00:00+07:00',
    source_class:'VERIFIED_INTERNAL',
    source_ref:'SRC-INV-001',
    metrics:{inventory_fit_score:90,capacity_total:3,capacity_available:2,utilization_rate:0.333}
  }),{nowMs:NOW});
  assert.deepEqual(checked.errors,[]);
  assert.equal(checked.signal.freshness.status,'STALE');
  assert.equal(checked.signal.freshness.fresh,false);
});

test('signal contract rejects PII-like subject identifiers',()=>{
  for(const ref of ['0999999999','name@example.com','+66999999999']){
    const checked=Signals.normalizeSignal(base({subject_ref:ref}),{nowMs:NOW});
    assert.ok(checked.errors.includes('SUBJECT_REF_UNSAFE'),ref);
  }
  assert.equal(Signals.safeRef('EVT-2026-001'),true);
});

test('unknown and non-numeric metrics are dropped instead of entering reasoning',()=>{
  const checked=Signals.normalizeSignal(base({
    signal_type:'content_performance',
    source_class:'MEASURED_ANALYTICS',
    metrics:{
      content_reach_score:92,
      impressions:18000,
      phone:'0999999999',
      arbitrary_text:'do not keep'
    }
  }),{nowMs:NOW});
  assert.deepEqual(checked.errors,[]);
  assert.deepEqual(checked.signal.metrics,{content_reach_score:92,impressions:18000});
  assert.deepEqual(checked.signal.dropped_metrics,['arbitrary_text','phone']);
});

test('portfolio uses only fresh valid evidence and maps canonical scores',()=>{
  const result=Signals.opportunityInputs([
    base(),
    base({
      signal_id:'sig_market_001',
      signal_type:'competitor_market',
      observed_at:'2026-09-27T10:00:00+07:00',
      source_class:'COMPETITOR_EVIDENCE',
      source_ref:'SRC-MKT-001',
      confidence:80,
      metrics:{competition_gap_score:82,margin_signal_score:74,exact_price_sample_count:4}
    }),
    base({
      signal_id:'sig_inv_stale',
      signal_type:'inventory_capacity',
      observed_at:'2026-09-27T08:00:00+07:00',
      source_class:'VERIFIED_INTERNAL',
      source_ref:'SRC-INV-OLD',
      confidence:99,
      metrics:{inventory_fit_score:100}
    })
  ],{nowMs:NOW});
  assert.equal(result.valid_signal_count,2);
  assert.equal(result.rejected_signal_count,1);
  assert.equal(result.subjects.length,1);
  assert.deepEqual(result.subjects[0].signals,{
    demand_signal:88,
    content_reach:84,
    competition_gap:82,
    margin_signal:74
  });
  assert.equal(result.production_writes,0);
});

test('higher-confidence signal wins for the same canonical opportunity score',()=>{
  const result=Signals.opportunityInputs([
    base({signal_id:'sig_low',confidence:60,metrics:{demand_score:70}}),
    base({signal_id:'sig_high',confidence:95,source_ref:'SRC-EVT-002',metrics:{demand_score:91}})
  ],{nowMs:NOW});
  assert.equal(result.subjects[0].signals.demand_signal,91);
});

test('source matrix is explicit about current wiring gaps',()=>{
  const root=path.join(__dirname,'..');
  const matrix=JSON.parse(fs.readFileSync(path.join(root,'config','kk-operating-partner-signal-sources-v1.json'),'utf8'));
  const byId=Object.fromEntries(matrix.sources.map(x=>[x.id,x]));
  assert.equal(byId.verified_event_truth.current_state,'AVAILABLE_EXISTING');
  assert.equal(byId.content_performance.current_state,'AVAILABLE_EXISTING');
  assert.equal(byId.competitor_market.current_state,'ADAPTER_NEEDED');
  assert.equal(byId.customer_cohorts.current_state,'ADAPTER_NEEDED');
  assert.equal(byId.storefront_behavior.current_state,'NOT_WIRED');
  assert.ok(matrix.sources.every(x=>x.pii_allowed===false));
});

test('checked-in signal benchmark cases remain deterministic',()=>{
  const root=path.join(__dirname,'..');
  const fixture=JSON.parse(fs.readFileSync(path.join(root,'tests','fixtures','kk-operating-partner-signal-benchmark.json'),'utf8'));
  const nowMs=Date.parse(fixture.now);
  for(const item of fixture.cases){
    const checked=Signals.normalizeSignal(item.signal,{nowMs});
    let actual='ACCEPT';
    if(checked.errors.length) actual='INVALID';
    else if(!checked.signal.freshness.fresh) actual='STALE';
    else if(checked.signal.dropped_metrics.length) actual='ACCEPT_WITH_DROP';
    assert.equal(actual,item.expect,item.name);
  }
});
