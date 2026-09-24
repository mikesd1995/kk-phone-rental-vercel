'use strict';

const { cleanText, summarizePerformance } = require('./kk-content-performance.js');

const CONTENT_MIX_TARGET = Object.freeze({ useful_or_engagement: 0.70, sales_or_conversion: 0.30 });
const CONTENT_PILLARS = Object.freeze([
  'seat_view',
  'photo_tips',
  'event_info',
  'review_proof',
  'engagement',
  'direct_rental'
]);
const CONTENT_ANGLES = Object.freeze([
  'event_theme',
  'artist',
  'fandom',
  'seat_view',
  'lens_need',
  'problem_solution',
  'convenience',
  'trust'
]);

const COPY_CONTRACT = Object.freeze({
  brand_first_line: '📱 KK Phone Rental | #เช่ามือถือ',
  handoff_line: '📍 รับ-คืนหน้างาน + สอนใช้ก่อนเข้างาน',
  file_storage_line: '☁️ Google Drive 30 วัน',
  booking_cta: '👉 จองคิว / เช็กคิวว่าง https://kk-phone-rental.vercel.app/',
  hashtag_rule: 'Put 3–5 strongest event-relevant hashtags at the end. Prefer official event/artist/brand hashtags. Avoid unrelated or repetitive tags.',
  promotion_rule: 'Include discounts or promotions only when they are current, explicitly approved, and verified for the post.',
  pricing_rule: 'Use only current approved pricing from verified business truth. Never infer, copy from stale examples, or invent a price.',
  brand_rule: 'Do not repeat the brand line at the bottom of the post.'
});

function bool(value) {
  return value === true;
}

function present(value) {
  return Boolean(cleanText(value));
}

function validateInput(input = {}) {
  const eventBlockers = [];
  const commercialBlockers = [];

  if (!present(input.event)) eventBlockers.push('EVENT_NAME_MISSING');
  if (!bool(input.verified_event)) eventBlockers.push('EVENT_NOT_VERIFIED');

  if (!bool(input.verified_pricing)) commercialBlockers.push('PRICING_NOT_VERIFIED');
  if (!present(input.price_display)) commercialBlockers.push('PRICE_DISPLAY_MISSING');
  if (!bool(input.inventory_available)) commercialBlockers.push('INVENTORY_NOT_CONFIRMED_AVAILABLE');

  return {
    event_ready: eventBlockers.length === 0,
    commercial_ready: eventBlockers.length === 0 && commercialBlockers.length === 0,
    event_blockers: eventBlockers,
    commercial_blockers: [...eventBlockers, ...commercialBlockers]
  };
}

function idea(id, fields) {
  return {
    id,
    publishable: fields.publishable !== false,
    ...fields
  };
}

function buildCreativeIdeas(input, readiness) {
  const hasSeatView = present(input.seat_view_url) || present(input.seat_view_notes);
  const event = cleanText(input.event) || '[EVENT ต้องตรวจสอบก่อนใช้]';
  const venue = cleanText(input.venue);
  const artist = cleanText(input.artist);
  const ideas = [];

  ideas.push(idea('utility-awareness', {
    objective: 'awareness',
    content_pillar: hasSeatView ? 'seat_view' : 'event_info',
    content_angle: hasSeatView ? 'seat_view' : 'event_theme',
    sales_intent: 'none',
    cta_type: hasSeatView ? 'comment_zone' : 'none',
    hook_direction: hasSeatView
      ? `เริ่มจากคำถามที่แฟนคอนอยากรู้จริง เช่น โซนไหนของ ${venue || event} เห็นเวทีประมาณไหน`
      : `สรุปข้อมูลที่ช่วยตัดสินใจเกี่ยวกับ ${event} โดยยึดข้อมูลที่ตรวจสอบแล้วเท่านั้น`,
    body_direction: 'ให้ข้อมูลที่มีประโยชน์ก่อน ไม่ยัดขาย ไม่เขียนข้อเท็จจริงที่ยังไม่ได้ verify',
    asset_direction: hasSeatView ? 'ภาพ/ลิงก์ seat-view หรือ venue simulator ที่มีสิทธิ์ใช้ พร้อมอ้างต้นทาง' : 'ภาพงานหรือ venue ที่มีสิทธิ์ใช้',
    publishable: readiness.event_ready
  }));

  ideas.push(idea('education-lens', {
    objective: 'awareness',
    content_pillar: 'photo_tips',
    content_angle: 'lens_need',
    sales_intent: 'none',
    cta_type: 'none',
    hook_direction: `ตอบคำถามเชิงใช้งาน เช่น นั่งไกลแค่ไหนถึงเริ่มได้ประโยชน์จาก Lens ในงาน ${event}`,
    body_direction: 'อธิบายแบบมีเงื่อนไขตามระยะ/โซน ไม่รับประกันคุณภาพภาพจากข้อมูลที่ไม่มีหลักฐาน',
    asset_direction: 'ตัวอย่างการซูมหรือภาพอธิบายระยะที่ร้านมีสิทธิ์ใช้',
    publishable: readiness.event_ready
  }));

  ideas.push(idea('community-engagement', {
    objective: 'engagement',
    content_pillar: 'engagement',
    content_angle: artist ? 'fandom' : 'event_theme',
    sales_intent: 'none',
    cta_type: hasSeatView ? 'comment_zone' : 'send_zone',
    hook_direction: artist
      ? `เปิดบทสนทนากับแฟน ${artist} โดยถามโซน/โมเมนต์ที่อยากเก็บในงาน ${event}`
      : `ชวนคนไปงาน ${event} แชร์โซนหรือสิ่งที่กังวลเรื่องการถ่าย`,
    body_direction: 'ชวนตอบจริง ไม่ bait engagement และไม่แทรก hard sell',
    asset_direction: 'poll, text post หรือภาพผังที่มีแหล่งอ้างอิง',
    publishable: readiness.event_ready
  }));

  ideas.push(idea('soft-consideration', {
    objective: 'consideration',
    content_pillar: 'photo_tips',
    content_angle: 'problem_solution',
    sales_intent: 'soft',
    cta_type: 'send_zone',
    hook_direction: 'เริ่มจากปัญหาจริง เช่น โซนไกล/มือถือหลักซูมไม่พอ แล้วค่อยบอกว่าร้านช่วยดูความเหมาะสมให้ได้',
    body_direction: 'ช่วยประเมินก่อนขาย ถ้าข้อมูลราคา/คิวไม่พร้อม ห้ามระบุราคาและห้ามบอกว่ามีคิวแน่นอน',
    asset_direction: 'ภาพเปรียบเทียบเชิงอธิบายหรือ seat-view ที่อ้างแหล่งได้',
    publishable: readiness.event_ready
  }));

  if (readiness.commercial_ready) {
    ideas.push(idea('direct-rental', {
      objective: 'conversion',
      content_pillar: 'direct_rental',
      content_angle: 'convenience',
      sales_intent: 'direct',
      cta_type: 'book_now',
      hook_direction: `ขายตรงแบบสั้นและผูกกับ ${event} โดยใช้ราคา ${cleanText(input.price_display)} ที่ verify แล้ว`,
      body_direction: 'ขึ้นชื่อร้านบรรทัดแรก ใช้ข้อเสนอจริง ประโยชน์หลัก และ CTA เว็บตรงตาม copy contract',
      asset_direction: 'โปสเตอร์ธีมงาน/ศิลปิน/แฟนคลับที่ไม่หลุดธีมและมีสิทธิ์ใช้',
      publishable: true
    }));
  } else {
    ideas.push(idea('direct-rental-blocked', {
      objective: 'conversion',
      content_pillar: 'direct_rental',
      content_angle: 'convenience',
      sales_intent: 'direct',
      cta_type: 'book_now',
      hook_direction: 'ยังไม่สร้าง copy ขายตรงจนกว่าข้อมูล Event + ราคา + inventory จะผ่าน verification',
      body_direction: `BLOCKED: ${readiness.commercial_blockers.join(', ')}`,
      asset_direction: 'none',
      publishable: false
    }));
  }

  return ideas;
}

function buildCreativePlan(input = {}, performanceRows = []) {
  const readiness = validateInput(input);
  const objective = cleanText(input.primary_objective || 'awareness').toLowerCase();
  const performance = summarizePerformance(performanceRows, {
    objective: ['awareness', 'engagement', 'consideration', 'conversion'].includes(objective) ? objective : 'awareness',
    min_sample: Number.isInteger(input.minimum_performance_sample) ? input.minimum_performance_sample : 3
  });

  const ideas = buildCreativeIdeas(input, readiness);
  const sourceNotes = [];
  if (present(input.seat_view_url)) {
    sourceNotes.push('Seat-view/simulator URL is a source reference only. Summarize in original words and confirm reuse rights before reposting screenshots or assets.');
  }

  return {
    schema_version: 'KK_CONTENT_AGENT_PLAN_V1',
    mode: 'READ_ONLY_ADVISOR',
    human_approval_required: true,
    auto_publish: false,
    auto_spend: false,
    writes_machine_sot: false,
    changes_pricing: false,
    authoritative_event_writer: false,
    event: cleanText(input.event),
    artist: cleanText(input.artist),
    venue: cleanText(input.venue),
    readiness,
    content_mix_target: CONTENT_MIX_TARGET,
    mix_scope: 'Use as a rolling calendar target, not a requirement that every single idea batch be exactly 70/30.',
    copy_contract: COPY_CONTRACT,
    allowed_pillars: CONTENT_PILLARS,
    allowed_angles: CONTENT_ANGLES,
    performance_context: performance,
    source_notes: sourceNotes,
    creative_ideas: ideas,
    generation_rules: [
      'Verified event truth and current approved pricing/inventory always outrank creative suggestions or historical performance.',
      'Do not invent event facts, venue, date, price, availability, promotion, or hashtag status.',
      'Performance evidence is a nudge, not an automatic winner-selection system; preserve creative diversity.',
      'Useful/engagement content should lead with audience value. Add a rental mention only when it improves relevance.',
      'Direct rental copy is allowed only when readiness.commercial_ready is true.',
      'All public copy requires owner review before publishing.'
    ]
  };
}

function buildGenerationPrompt(plan) {
  if (!plan || plan.schema_version !== 'KK_CONTENT_AGENT_PLAN_V1') {
    throw new Error('valid KK_CONTENT_AGENT_PLAN_V1 plan is required');
  }
  const performanceNudges = plan.performance_context.evidence_nudges || [];
  return [
    'You are the KK Phone Rental creative drafting worker.',
    'Draft Thai X content only from the verified facts provided in this plan.',
    `Event: ${plan.event || '[not verified]'}`,
    `Artist: ${plan.artist || '[not provided]'}`,
    `Venue: ${plan.venue || '[not provided]'}`,
    `Commercial ready: ${plan.readiness.commercial_ready}`,
    `Brand first line for rental posts: ${plan.copy_contract.brand_first_line}`,
    `Handoff line: ${plan.copy_contract.handoff_line}`,
    `File storage line: ${plan.copy_contract.file_storage_line}`,
    `Booking CTA: ${plan.copy_contract.booking_cta}`,
    `Hashtag rule: ${plan.copy_contract.hashtag_rule}`,
    `Performance nudges: ${JSON.stringify(performanceNudges)}`,
    `Ideas: ${JSON.stringify(plan.creative_ideas)}`,
    `Rules: ${JSON.stringify(plan.generation_rules)}`,
    'Return differentiated drafts. Never turn a blocked idea into publishable sales copy.'
  ].join('\n');
}

module.exports = {
  CONTENT_MIX_TARGET,
  CONTENT_PILLARS,
  CONTENT_ANGLES,
  COPY_CONTRACT,
  validateInput,
  buildCreativePlan,
  buildGenerationPrompt
};
