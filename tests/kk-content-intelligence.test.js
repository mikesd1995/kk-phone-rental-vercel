'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const PERF = require('../server/kk-content-performance.js');
const AGENT = require('../server/kk-content-agent.js');

const performanceRows = [
  {Status:'measured', Content_Pillar:'seat_view', Content_Angle:'seat_view', Impressions:10000, Engagements:500, Profile_Visits:100, Link_Clicks:50, Bookings:1},
  {Status:'measured', Content_Pillar:'seat_view', Content_Angle:'seat_view', Impressions:8000, Engagements:320, Profile_Visits:70, Link_Clicks:30, Bookings:1},
  {Status:'measured', Content_Pillar:'seat_view', Content_Angle:'seat_view', Impressions:12000, Engagements:600, Profile_Visits:120, Link_Clicks:60, Bookings:2},
  {Status:'measured', Content_Pillar:'direct_rental', Content_Angle:'convenience', Impressions:2000, Engagements:20, Profile_Visits:15, Link_Clicks:10, Bookings:1}
];

test('performance summary calculates objective metrics from measured posts', () => {
  const result = PERF.summarizePerformance(performanceRows, {objective:'engagement'});
  const seat = result.by_pillar.find(item => item.value === 'seat_view');
  assert.ok(seat);
  assert.equal(seat.sample_count, 3);
  assert.equal(seat.enough_evidence, true);
  assert.equal(Number(seat.engagement_rate.toFixed(4)), Number((1420 / 30000).toFixed(4)));
  assert.equal(result.evidence_nudges[0].value, 'seat_view');
});

test('small samples remain visible but are marked low confidence', () => {
  const result = PERF.summarizePerformance([
    {Status:'measured', Content_Pillar:'review_proof', Content_Angle:'trust', Impressions:9000, Engagements:900}
  ], {objective:'awareness', min_sample:3});
  assert.equal(result.by_pillar[0].confidence, 'low');
  assert.equal(result.by_pillar[0].enough_evidence, false);
  assert.equal(result.evidence_nudges.length, 0);
});

test('agent blocks direct rental when event, pricing or inventory is unverified', () => {
  const plan = AGENT.buildCreativePlan({
    event:'Example Concert',
    verified_event:true,
    verified_pricing:false,
    inventory_available:true
  }, []);
  assert.equal(plan.readiness.commercial_ready, false);
  const direct = plan.creative_ideas.find(item => item.id === 'direct-rental-blocked');
  assert.ok(direct);
  assert.equal(direct.publishable, false);
  assert.match(direct.body_direction, /PRICING_NOT_VERIFIED/);
});

test('agent allows direct rental only with verified event, price display and confirmed inventory', () => {
  const plan = AGENT.buildCreativePlan({
    event:'Example Concert',
    venue:'Example Hall',
    verified_event:true,
    verified_pricing:true,
    price_display:'vivo X300 Pro 690฿ | เพิ่ม Lens +200฿',
    inventory_available:true
  }, performanceRows);
  assert.equal(plan.readiness.commercial_ready, true);
  const direct = plan.creative_ideas.find(item => item.id === 'direct-rental');
  assert.ok(direct);
  assert.equal(direct.publishable, true);
  assert.equal(direct.sales_intent, 'direct');
});

test('agent is permanently advisory and zero-write by contract', () => {
  const plan = AGENT.buildCreativePlan({event:'Example', verified_event:false}, []);
  assert.equal(plan.mode, 'READ_ONLY_ADVISOR');
  assert.equal(plan.human_approval_required, true);
  assert.equal(plan.auto_publish, false);
  assert.equal(plan.auto_spend, false);
  assert.equal(plan.writes_machine_sot, false);
  assert.equal(plan.changes_pricing, false);
  assert.equal(plan.authoritative_event_writer, false);
});

test('copy contract preserves current KK X brand and CTA conventions', () => {
  assert.equal(AGENT.COPY_CONTRACT.brand_first_line, '📱 KK Phone Rental | #เช่ามือถือ');
  assert.equal(AGENT.COPY_CONTRACT.handoff_line, '📍 รับ-คืนหน้างาน + สอนใช้ก่อนเข้างาน');
  assert.equal(AGENT.COPY_CONTRACT.file_storage_line, '☁️ Google Drive 30 วัน');
  assert.equal(AGENT.COPY_CONTRACT.booking_cta, '👉 จองคิว / เช็กคิวว่าง https://kk-phone-rental.vercel.app/');
  assert.match(AGENT.COPY_CONTRACT.hashtag_rule, /3–5/);
  assert.match(AGENT.COPY_CONTRACT.brand_rule, /not repeat/i);
});

test('70/30 is a rolling calendar target, not a forced per-batch quota', () => {
  const plan = AGENT.buildCreativePlan({event:'Example', verified_event:false}, []);
  assert.equal(plan.content_mix_target.useful_or_engagement, 0.70);
  assert.equal(plan.content_mix_target.sales_or_conversion, 0.30);
  assert.match(plan.mix_scope, /rolling calendar/i);
});

test('seat-view source is treated as reference and screenshot reuse requires rights check', () => {
  const plan = AGENT.buildCreativePlan({
    event:'Example',
    verified_event:true,
    seat_view_url:'https://example.com/venue-view'
  }, []);
  assert.equal(plan.source_notes.length, 1);
  assert.match(plan.source_notes[0], /reuse rights/i);
});

test('generation prompt cannot silently promote a blocked idea', () => {
  const plan = AGENT.buildCreativePlan({event:'Example', verified_event:false}, []);
  const prompt = AGENT.buildGenerationPrompt(plan);
  assert.match(prompt, /Never turn a blocked idea into publishable sales copy/);
  assert.match(prompt, /Commercial ready: false/);
});

test('invalid performance objective fails instead of guessing', () => {
  assert.throws(() => PERF.summarizePerformance([], {objective:'viral'}), /unsupported objective/);
});
