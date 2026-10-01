'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const XSignal=require('../server/kk-x-signal-detector.js');
const Marketing=require('../server/kk-marketing-agent.js');
const Router=require('../server/kk-content-request-router.js');

const NOW='2026-10-01T09:45:00.000Z';

function signal(overrides={}){
  return {
    source_type:'official',
    source_name:'Official',
    published_at:'2026-10-01T08:45:00.000Z',
    observed_at:NOW,
    views:10000,
    views_label_confirmed:true,
    ...overrides
  };
}

test('unlabeled numeric fragments are ignored instead of treated as X metrics',()=>{
  const result=XSignal.normalizeSignal({
    source_type:'official',
    published_at:'2026-10-01T08:45:00.000Z',
    observed_at:NOW,
    views:96500,
    likes:151
  },{now:NOW});
  assert.equal(result.metrics.views,null);
  assert.equal(result.metrics.engagement_rate,null);
  assert.equal(result.metric_quality.ambiguous_numeric_fragments_ignored,true);
  assert.match(result.warnings.join('|'),/UNLABELED_VIEWS_IGNORED/);
});

test('explicitly labeled X metrics produce age-aware velocity and engagement',()=>{
  const result=XSignal.normalizeSignal(signal({
    views:12000,
    likes:360,
    reposts:120,
    replies:60,
    likes_label_confirmed:true,
    reposts_label_confirmed:true,
    replies_label_confirmed:true
  }),{now:NOW});
  assert.equal(result.freshness,'HOT');
  assert.equal(result.metrics.reach_velocity_per_hour,12000);
  assert.equal(result.metrics.engagement_count,540);
  assert.equal(Number(result.metrics.engagement_rate.toFixed(3)),0.045);
  assert.ok(result.scores.reach_momentum>0);
  assert.ok(result.scores.engagement_quality>0);
});

test('sub-hour posts use a one-hour velocity floor and are marked early-window',()=>{
  const result=XSignal.normalizeSignal(signal({
    published_at:'2026-10-01T09:35:00.000Z',
    views:600
  }),{now:NOW});
  assert.equal(result.early_window,true);
  assert.equal(result.metrics.reach_velocity_per_hour,600);
});

test('historical official reach is context only and does not inflate current priority',()=>{
  const summary=XSignal.summarizeEventSignals([
    signal({
      published_at:'2026-09-20T08:45:00.000Z',
      views:1900000
    })
  ],{now:NOW});
  assert.equal(summary.gate,'INSUFFICIENT_CURRENT_EVIDENCE');
  assert.equal(summary.priority_score,null);
  assert.equal(summary.dimensions.historical_scale_views,1900000);
});

test('official momentum and rental intent remain separate normalized dimensions',()=>{
  const summary=XSignal.summarizeEventSignals([
    signal({source_type:'official',views:100000}),
    signal({
      source_type:'rental_market',
      source_name:'Competitor rental',
      published_at:'2026-10-01T09:15:00.000Z',
      views:500
    })
  ],{now:NOW});
  assert.equal(summary.gate,'PASS');
  assert.ok(summary.dimensions.official_fandom_momentum>summary.dimensions.rental_ticket_intent);
  assert.ok(summary.dimensions.rental_ticket_intent>0);
  assert.match(summary.interpretation_rule,/Never compare or sum raw official\/fandom views directly/i);
});

test('zero phone inventory blocks direct rental even when stale boolean says available',()=>{
  const gate=XSignal.inventoryGate({
    inventory_available:true,
    inventory_remaining:0,
    lens_remaining:2
  });
  assert.equal(gate.gate,'BLOCKED_NO_PHONE_INVENTORY');
  assert.equal(gate.direct_phone_rental_eligible,false);
});

test('explicit lens-only offer is separated from phone-rental eligibility',()=>{
  const gate=XSignal.inventoryGate({
    inventory_available:true,
    inventory_remaining:0,
    lens_remaining:2,
    lens_only_offer:true
  });
  assert.equal(gate.gate,'LENS_ONLY');
  assert.equal(gate.direct_phone_rental_eligible,false);
});

test('marketing plan exposes normalized X-signal analysis without using historical scale as momentum',()=>{
  const plan=Marketing.plan({
    verified_event:true,
    verified_pricing:true,
    inventory_available:true,
    inventory_remaining:2,
    x_signals:[
      signal({source_type:'official',views:80000}),
      signal({
        source_type:'official',
        published_at:'2026-09-01T00:00:00.000Z',
        views:3000000
      })
    ],
    signal_observed_at:NOW
  },[]);
  assert.equal(plan.x_signal_contract.raw_cross_source_views_are_comparable,false);
  assert.equal(plan.x_signal_contract.historical_reach_affects_current_priority,false);
  assert.equal(plan.x_signal_analysis.gate,'PASS');
  assert.equal(plan.x_signal_analysis.dimensions.historical_scale_views,3000000);
  assert.ok(plan.x_signal_analysis.priority_score>0);
});

test('content router fail-closes a direct rental post when remaining phone inventory is zero',()=>{
  const routed=Router.routeContentRequest({
    message:'ขอโพสปล่อยเช่างานนี้บน X',
    input:{
      event:'Sold Out Phone Event',
      venue:'Hall',
      verified_event:true,
      verified_pricing:true,
      price_display:'vivo X300 Pro 690฿',
      inventory_available:true,
      inventory_remaining:0
    }
  });
  assert.equal(routed.content_gate,'BLOCKED');
  assert.equal(routed.plan.readiness.commercial_ready,false);
  assert.match(routed.plan.readiness.commercial_blockers.join('|'),/INVENTORY_NOT_CONFIRMED_AVAILABLE/);
  assert.equal(routed.marketing_plan.campaign_mode,'HOLD_NO_PHONE_INVENTORY');
});
