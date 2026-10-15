'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const PERF = require('../server/kk-content-performance.js');
const AGENT = require('../server/kk-content-agent.js');
const ROUTER = require('../server/kk-content-request-router.js');

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
  assert.equal(AGENT.COPY_CONTRACT.handoff_line, '📱 รับ-คืนเครื่องหน้างาน + สอนใช้ก่อนเข้างาน');
  assert.equal(AGENT.COPY_CONTRACT.file_storage_line, '☁️ เก็บไฟล์ Google Drive ฟรี 30 วัน');
  assert.equal(AGENT.COPY_CONTRACT.booking_cta, '👉 เลือกวันแล้วจองคิว\nkk-phone-rental.vercel.app');
  assert.match(AGENT.COPY_CONTRACT.hashtag_rule, /exactly 3/i);
  assert.match(AGENT.COPY_CONTRACT.hashtag_rule, /Never synthesize/i);
  assert.match(AGENT.COPY_CONTRACT.duplicate_fact_rule, /Do not repeat date\/venue/i);
  assert.match(AGENT.COPY_CONTRACT.brand_rule, /(?:never|not) repeat/i);
  assert.deepEqual(
    AGENT.COPY_CONTRACT.direct_rental_layout,
    ['brand','event_hashtag','offer','date','venue','hook','benefits','booking_cta','reach_hashtags']
  );
  assert.match(AGENT.COPY_CONTRACT.direct_rental_layout_rule, /preferred baseline/i);
  assert.match(AGENT.COPY_CONTRACT.creative_freedom_rule, /Do not force every post/i);
  assert.match(AGENT.COPY_CONTRACT.hard_gate_rule, /Hard gates cover/i);
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
  assert.match(prompt, /Do not turn a blocked idea into publishable sales copy/);
  assert.match(prompt, /Commercial ready: false/);
});

test('invalid performance objective fails instead of guessing', () => {
  assert.throws(() => PERF.summarizePerformance([], {objective:'viral'}), /unsupported objective/);
});

test('anti-repeat context keeps recent copy and requires three distinct rental variants', () => {
  const plan = AGENT.buildCreativePlan({
    event:'Example Concert',
    verified_event:true,
    verified_pricing:true,
    price_display:'vivo X300 Pro 690฿ | เพิ่ม Lens +200฿',
    inventory_available:true,
    recent_posts:[
      'โลกของ Example กำลังจะเริ่มแล้ว',
      {hook:'ใครมีบัตรวันไหน ร้านเปิดคิวครบทุกวัน'}
    ]
  }, []);
  const prompt = AGENT.buildGenerationPrompt(plan);
  assert.equal(plan.anti_repeat_context.recent_post_count, 2);
  assert.equal(plan.anti_repeat_contract.direct_rental_variant_count, 3);
  assert.equal(plan.anti_repeat_contract.public_output_count, 1);
  assert.match(prompt, /3 INTERNAL candidates/i);
  assert.match(prompt, /โลกของ Example/);
  assert.match(prompt, /different primary content angles/i);
});

test('router recognizes Thai X rental requests and forces Content Strategy + Agent path', () => {
  assert.equal(
    ROUTER.detectContentIntent('ขอโพสปล่อยเช่างานนี้บน x INK WARUNTORN'),
    'direct_rental_x'
  );

  const routed = ROUTER.routeContentRequest({
    message:'ขอโพสปล่อยเช่างานนี้บน x INK WARUNTORN',
    input:{
      event:'INK WARUNTORN Synthphony Concert',
      verified_event:true,
      verified_pricing:true,
      price_display:'vivo X300 Pro 690฿ | เพิ่ม Lens +200฿',
      inventory_available:true
    }
  });

  assert.equal(routed.matched, true);
  assert.equal(routed.route, 'KK_MARKETING_TO_CONTENT_SINGLE_WINNER');
  assert.equal(routed.content_gate, 'PASS');
  assert.equal(routed.strategy_required, true);
  assert.equal(routed.content_agent_required, true);
  assert.equal(routed.qa_required, true);
  assert.equal(routed.selector_required, true);
  assert.equal(routed.selector_version, 'KK_CONTENT_SELECTOR_V2');
  assert.equal(routed.qa_gate_version, 'KK_CONTENT_QA_GATE_V3');
  assert.equal(routed.anti_repeat_required, true);
  assert.equal(routed.three_variant_engine_required, true);
  assert.equal(routed.internal_candidate_count, 3);
  assert.equal(routed.public_output_count, 1);
  assert.equal(routed.public_output_mode, 'SINGLE_FINAL_POST');
  assert.equal(routed.production_writes, 0);
  assert.equal(routed.publishes, 0);
});

test('router fail-closes direct rental when current commercial truth is incomplete', () => {
  const routed = ROUTER.routeContentRequest({
    message:'ขอโพสต์ปล่อยเช่างานนี้บน X',
    input:{
      event:'Example Concert',
      verified_event:true,
      verified_pricing:false,
      inventory_available:true
    }
  });
  assert.equal(routed.content_gate, 'BLOCKED');
  assert.equal(routed.plan.readiness.commercial_ready, false);
});

test('router does not hijack non-content requests', () => {
  const routed = ROUTER.routeContentRequest({
    message:'ตรวจสอบราคาคู่แข่งงานนี้แบบละเอียด'
  });
  assert.equal(routed.matched, false);
  assert.equal(routed.route, 'NO_CONTENT_AGENT');
  assert.equal(routed.content_gate, 'NOT_APPLICABLE');
});


test('finalizer exposes exactly one selected post after three candidates pass QA', () => {
  const input={
    event:'Example Concert',
    venue:'Example Hall',
    date_display:'3 ต.ค.',
    verified_event:true,
    verified_pricing:true,
    price_display:'vivo X300 Pro 690฿ | เพิ่ม Lens +200฿',
    inventory_available:true,
    official_event_hashtag:'#ExampleConcert',
    verified_hashtags:['#ExampleConcert','#ArtistExample','#เช่ามือถือ']
  };
  const post=hook=>`📱 KK Phone Rental | #เช่ามือถือ

🔥 #ExampleConcert

${hook}

🎤 vivo X300 Pro 690฿ | เพิ่ม Lens +200฿
📍 3 ต.ค. | Example Hall

💙 ฟรีประกันเครื่อง + ไม่ต้องวางมัดจำ
📍 รับ-คืนหน้างาน + สอนใช้ก่อนเข้างาน
☁️ เก็บไฟล์ Google Drive ฟรี 30 วัน
👉 จองคิว / เช็กคิวว่าง https://kk-phone-rental.vercel.app/

#ArtistExample`;
  const candidates=[
    {id:'a',angle:'event_theme',copy:post('Hook A'),metrics:{hook_strength:70,event_fandom_relevance:85,timing_relevance:70,novelty:80,hashtag_relevance:100,readability:90,event_specificity:90,naturalness:90,non_template_feel:88,hook_originality:86,sales_pressure_balance:90}},
    {id:'b',angle:'fandom',copy:post('Hook B'),metrics:{hook_strength:95,event_fandom_relevance:95,timing_relevance:80,novelty:90,hashtag_relevance:100,readability:92,event_specificity:90,naturalness:90,non_template_feel:88,hook_originality:86,sales_pressure_balance:90}},
    {id:'c',angle:'trust',copy:post('Hook C'),metrics:{hook_strength:75,event_fandom_relevance:80,timing_relevance:70,novelty:85,hashtag_relevance:100,readability:95,event_specificity:90,naturalness:90,non_template_feel:88,hook_originality:86,sales_pressure_balance:90}}
  ];
  const result=ROUTER.finalizeGeneratedCandidates({
    candidates,
    input,
    marketingPlan:{objective:'awareness',measured_posts:0}
  });
  assert.equal(result.gate,'PASS');
  assert.equal(result.public_output_count,1);
  assert.equal(result.final_post,post('Hook B'));
  assert.equal(result.selection.winner.id,'b');
});

test('finalizer blocks public output when any internal candidate fails QA', () => {
  const input={
    event:'Example Concert',
    venue:'Example Hall',
    date_display:'3 ต.ค.',
    verified_event:true,
    verified_pricing:true,
    price_display:'vivo X300 Pro 690฿ | เพิ่ม Lens +200฿',
    inventory_available:true,
    official_event_hashtag:'#ExampleConcert',
    verified_hashtags:['#ExampleConcert','#ArtistExample','#เช่ามือถือ']
  };
  const good=`📱 KK Phone Rental | #เช่ามือถือ

🔥 #ExampleConcert

Hook A

🎤 vivo X300 Pro 690฿ | เพิ่ม Lens +200฿
📍 3 ต.ค. | Example Hall

💙 ฟรีประกันเครื่อง + ไม่ต้องวางมัดจำ
📍 รับ-คืนหน้างาน + สอนใช้ก่อนเข้างาน
☁️ เก็บไฟล์ Google Drive ฟรี 30 วัน
👉 จองคิว / เช็กคิวว่าง https://kk-phone-rental.vercel.app/

#ArtistExample`;
  const bad=good.replace('Hook A','3 ต.ค. Hook duplicate date');
  const metrics={hook_strength:80,event_fandom_relevance:80,timing_relevance:80,novelty:80,hashtag_relevance:100,readability:90,event_specificity:90,naturalness:90,non_template_feel:88,hook_originality:86,sales_pressure_balance:90};
  const result=ROUTER.finalizeGeneratedCandidates({
    candidates:[
      {id:'a',angle:'event_theme',copy:good,metrics},
      {id:'b',angle:'fandom',copy:bad,metrics},
      {id:'c',angle:'trust',copy:good.replace('Hook A','Hook C'),metrics}
    ],
    input,
    marketingPlan:{objective:'awareness',measured_posts:0}
  });
  assert.equal(result.gate,'BLOCKED');
  assert.equal(result.blocker,'CONTENT_QA_FAILED');
  assert.equal(result.public_output_count,0);
  assert.equal(result.final_post,undefined);
});
