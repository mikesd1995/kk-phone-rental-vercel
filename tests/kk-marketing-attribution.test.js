'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const A=require('../server/kk-marketing-attribution.js');

function sellable(extra={}){
  return {event_id:'evt-lykn-2026',event:'LYKN',event_date:'2026-10-23',channel:'x',objective:'conversion',verified_event:true,verified_pricing:true,storefront_ready:true,inventory_available:true,inventory_remaining:1,...extra};
}

test('campaign id is deterministic and requires canonical event identity/date',()=>{
  const a=A.campaignId(sellable());
  assert.ok(a.startsWith('kk-evt-lykn-2026-20261023-x-'));
  assert.equal(a,A.campaignId(sellable()));
  assert.equal(A.campaignId({...sellable(),event_id:''}),'');
});

test('marketing queue fails closed on upstream truth and owner/date/inventory gates',()=>{
  assert.equal(A.buildQueueItem(sellable()).status,'READY_FOR_OWNER_REVIEW');
  for(const patch of [
    {verified_event:false},{verified_pricing:false},{storefront_ready:false},
    {owner_hidden:true},{tombstoned:true},{date_blocked:true},
    {inventory_available:false,inventory_remaining:0,lens_inventory_available:false}
  ]){
    assert.equal(A.buildQueueItem(sellable(patch)).status,'BLOCKED');
  }
});

test('lens-only remains truthful and does not claim phone inventory',()=>{
  const q=A.buildQueueItem(sellable({inventory_available:false,inventory_remaining:0,lens_inventory_available:true}));
  assert.equal(q.status,'READY_FOR_OWNER_REVIEW');
  assert.equal(q.eligibility.mode,'LENS_ONLY');
});

test('attribution counts only explicit campaign and booking linkage; actual revenue is completed only',()=>{
  const id=A.campaignId(sellable());
  const result=A.summarizeAttribution([
    {campaign_id:id,kind:'x_post'},
    {campaign_id:id,kind:'storefront_visit'},
    {campaign_id:id,kind:'storefront_visit'},
    {campaign_id:id,kind:'line_conversation'},
    {campaign_id:id,kind:'booking',booking_id:'b1',booking_status:'completed',revenue_thb:790},
    {campaign_id:id,kind:'booking',booking_id:'b2',booking_status:'confirmed',revenue_thb:990},
    {campaign_id:'other',kind:'booking',booking_id:'b3',booking_status:'completed',revenue_thb:9999},
    {campaign_id:id,kind:'booking',booking_status:'completed',revenue_thb:9999}
  ],{campaign_id:id});
  assert.equal(result.funnel.bookings,2);
  assert.equal(result.revenue.actual_thb,790);
  assert.equal(result.revenue.future_thb,990);
  assert.equal(result.revenue.forecast_thb,1780);
  assert.equal(result.conversion.visit_to_booking,1);
});

test('learning stays cold-start below evidence threshold and is advisory only',()=>{
  const id=A.campaignId(sellable());
  const one=A.summarizeAttribution([{campaign_id:id,kind:'booking',booking_id:'b1',booking_status:'completed',revenue_thb:790}],{campaign_id:id});
  assert.equal(A.learningSummary([one]).status,'RULE_BASED_COLD_START');
  const learned=A.learningSummary([one,{...one,campaign_id:'c2'},{...one,campaign_id:'c3'}]);
  assert.equal(learned.status,'EVIDENCE_AVAILABLE');
  assert.equal(learned.recommendations[0].authority,'ADVISORY_ONLY');
  assert.equal(A.SAFETY.production_writes,0);
  assert.equal(A.SAFETY.auto_publish,false);
});
