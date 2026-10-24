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
  direct_rental_layout: Object.freeze(['brand','event_hashtag','venue','offer','dates','hook','cta_lead','booking_link','benefits','reach_hashtags']),
  direct_rental_layout_rule: 'Current preferred baseline is Brand → Event hashtag → Venue → Offer/price → Dates → Event-specific hook → UNIQUE booking lead sentence immediately before 👉 จองเลย: URL → Benefits → 3 verified closing hashtags. It is a quality baseline, not a rigid order gate; verified facts, brand-first identity, CTA and anti-repeat remain hard requirements.',
  handoff_line: '📱 รับ-คืนเครื่องหน้างาน + สอนใช้ก่อนเข้างาน',
  file_storage_line: '☁️ เก็บไฟล์ Google Drive ฟรี 30 วัน',
  booking_cta: '👉 จองเลย: https://kk-phone-rental.vercel.app/',
  hashtag_rule: 'Use only hashtags verified for the current event/artist/fandom context. Never synthesize a hashtag from an event name. By default put exactly 3 strongest verified closing hashtags at the end and do not duplicate #เช่ามือถือ or the main event hashtag already used above.',
  duplicate_fact_rule: 'Date and venue have one canonical information block. Do not repeat date/venue inside the hook unless timing itself is the verified marketing message (for example today, tomorrow, DAY 2, or last call).',
  promotion_rule: 'Include discounts or promotions only when they are current, explicitly approved, and verified for the post.',
  pricing_rule: 'Use only current approved pricing from verified business truth. Never infer, copy from stale examples, or invent a price.',
  brand_rule: 'Keep the brand line first and do not repeat it at the bottom of the post.',
  creative_freedom_rule: 'Do not force every post into one visual/text template. Preserve event-specific voice, organic pacing, vivid but concise language, and a natural transition back to the rental use case.',
  hard_gate_rule: 'Hard gates cover verified event facts, live approved price/inventory, verified hashtags, brand identity, booking CTA for commercial posts, recent-copy anti-repeat, three distinct internal candidates, QA and Selector PASS. Multi-event batches additionally require batch-level hook diversity QA before any winners are returned.'
});

const ANTI_REPEAT_CONTRACT = Object.freeze({
  recent_post_window: 12,
  direct_rental_variant_count: 3,
  all_post_variant_count: 3,
  public_output_count: 1,
  distinct_angle_rule: 'Each internal post candidate must use a substantively different primary angle and hook logic, not a synonym swap.',
  recent_copy_rule: 'Do not reuse recent hook/CTA wording, sentence skeletons, metaphors, or generic filler. Record if history covers confirmed X posts or only chat drafts; never call planned/assumed entries published.',
  factuality_rule: 'Novelty never permits invented event lore. If event-specific context is not verified, use neutral factual phrasing.',
  event_dna_minimum: 2,
  batch_hook_rule: 'For multi-event requests, final winners must use distinct hook AND CTA-lead architectures across the batch; do not repeat prepare-device, ticket-holder, countdown, scarcity, or capture-moment scaffolds more than twice.'
});

function bool(value) {
  return value === true;
}

function present(value) {
  return Boolean(cleanText(value));
}

function normalizeRecentPosts(input = {}) {
  const raw = [];
  if (Array.isArray(input.recent_posts)) raw.push(...input.recent_posts);
  if (Array.isArray(input.recent_hooks)) raw.push(...input.recent_hooks);

  const normalized = raw
    .map(item => {
      if (typeof item === 'string') return cleanText(item);
      if (!item || typeof item !== 'object') return '';
      return cleanText(item.copy || item.text || item.hook || item.content || '');
    })
    .filter(Boolean);

  const seen = new Set();
  return normalized.filter(item => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, ANTI_REPEAT_CONTRACT.recent_post_window);
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
  const eventThemeNotes = cleanText(input.event_theme_notes);
  const fandomNotes = cleanText(input.fandom_notes);
  const timingContext = cleanText(input.timing_context);
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
    const contextParts = [
      eventThemeNotes ? `event theme: ${eventThemeNotes}` : '',
      artist ? `artist: ${artist}` : '',
      fandomNotes ? `fandom: ${fandomNotes}` : '',
      timingContext ? `timing: ${timingContext}` : ''
    ].filter(Boolean);

    ideas.push(idea('direct-rental', {
      objective: 'conversion',
      content_pillar: 'direct_rental',
      content_angle: 'event_theme',
      alternate_angles: ['artist', 'fandom', 'convenience', 'trust'],
      sales_intent: 'direct',
      cta_type: 'book_now',
      hook_direction: contextParts.length
        ? `สร้าง hook เฉพาะ ${event} จากบริบทที่ verify แล้ว (${contextParts.join(' | ')}) และห้ามวนโครงจากโพสต์ล่าสุด`
        : `สร้าง hook เฉพาะชื่อ/คอนเซ็ปต์ที่ verify แล้วของ ${event}; ถ้าไม่มีบริบทเพิ่มให้ใช้ข้อเท็จจริงแบบกลาง ๆ แทนการแต่ง lore`,
      body_direction: `ใช้ราคา ${cleanText(input.price_display)} ที่ verify แล้ว ขึ้นชื่อร้านบรรทัดแรก ใช้ประโยชน์หลัก และ CTA เว็บตรงตาม copy contract`,
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
  const recentPosts = normalizeRecentPosts(input);
  const sourceNotes = [];
  if (present(input.seat_view_url)) {
    sourceNotes.push('Seat-view/simulator URL is a source reference only. Summarize in original words and confirm reuse rights before reposting screenshots or assets.');
  }

  return {
    schema_version: 'KK_CONTENT_AGENT_PLAN_V2',
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
    requested_intent: cleanText(input.requested_intent),
    commercial_truth_required: input.commercial_truth_required === true ||
      cleanText(input.requested_intent).toLowerCase() === 'direct_rental_x',
    event_context: {
      event_theme_notes: cleanText(input.event_theme_notes),
      fandom_notes: cleanText(input.fandom_notes),
      timing_context: cleanText(input.timing_context),
      event_dna: Array.isArray(input.event_dna) ? input.event_dna.map(cleanText).filter(Boolean) : [],
      creative_anchors: Array.isArray(input.creative_anchors) ? input.creative_anchors.map(cleanText).filter(Boolean) : []
    },
    readiness,
    content_mix_target: CONTENT_MIX_TARGET,
    mix_scope: 'Use as a rolling calendar target, not a requirement that every single idea batch be exactly 70/30.',
    copy_contract: COPY_CONTRACT,
    anti_repeat_contract: ANTI_REPEAT_CONTRACT,
    anti_repeat_context: {
      enabled: true,
      recent_post_count: recentPosts.length,
      recent_posts: recentPosts
    },
    allowed_pillars: CONTENT_PILLARS,
    allowed_angles: CONTENT_ANGLES,
    performance_context: performance,
    source_notes: sourceNotes,
    creative_ideas: ideas,
    generation_rules: [
      'Verified event truth and current approved pricing/inventory always outrank creative suggestions or historical performance.',
      'Do not invent event facts, venue, date, price, availability, promotion, hashtag status, artist lore, fandom lore, or event concept.',
      'Never synthesize hashtags from event names. Use only current verified hashtags supplied in the input.',
      'Do not repeat canonical date/venue facts in the hook when they already appear in the Date/Venue block, unless timing is intentionally the marketing message.',
      'Performance evidence is a nudge, not an automatic winner-selection system; preserve creative diversity.',
      'Useful/engagement content should lead with audience value. Add a rental mention only when it improves relevance.',
      'Direct rental copy is allowed only when readiness.commercial_ready is true.',
      'For every publishable KK social-post request, generate exactly three internal candidates with different primary angles and different hook structures. Do not expose all candidates to the owner.',
      'Each internal candidate must include selector metrics from 0–100 for hook_strength, event_fandom_relevance, timing_relevance, novelty, hashtag_relevance, readability, event_specificity, naturalness, non_template_feel, hook_originality, sales_pressure_balance, and commercial_relevance when the marketing objective is conversion.',
      'After QA, the selector chooses exactly one final post for Owner Review. Public output must contain only that winner unless the owner explicitly asks to inspect alternatives.',
      'For commercial rental posts, keep the KK brand first and include verified event hashtag, exact verified offer/price, canonical date/venue when supplied, and booking CTA. Do NOT force a single paragraph order; hook, offer, context, benefits and emoji may move when strategy supports it.',
      'Creative direction benchmark: event-specific and organic, vivid but concise, not overly salesy, with a natural transition from the event/fandom moment back to the rental use case. The liked Khom Khlang-style direction is a quality reference, not a phrase/template to copy.',
      'Do not make cosmetic rewrites: changing emoji, synonyms, or sentence order does not count as a distinct variant.',
      'Compare against anti_repeat_context.recent_posts and avoid repeated hooks AND CTA-lead sentence skeletons; distinguish verified real X posts from prior chat drafts and report coverage gaps.',
      'For owner X posts with cta_style=lead_then_book_link, write a distinct event-specific invitation line immediately before the canonical final line 👉 จองเลย: https://kk-phone-rental.vercel.app/; never put creative CTA wording after 👉.',
      'Before drafting, identify at least two verified Event DNA anchors when available (format, scene, special segment, artist/fandom context, stage concept, or timing-specific fact) and use them to differentiate the hook from generic rental copy.',
      'For multi-event batches, vary the hook architecture itself. Reusing structures such as “ใครมีบัตร...เตรียมเครื่อง...”, “อีกไม่กี่วัน...ล็อกคิว...”, or “เก็บทุกโมเมนต์...” across several events is a batch QA failure even when event names differ.',
      'All public copy requires owner review before publishing.'
    ]
  };
}

function buildGenerationPrompt(plan) {
  if (!plan || !['KK_CONTENT_AGENT_PLAN_V1', 'KK_CONTENT_AGENT_PLAN_V2'].includes(plan.schema_version)) {
    throw new Error('valid KK_CONTENT_AGENT_PLAN_V1 or V2 plan is required');
  }
  const performanceNudges = plan.performance_context.evidence_nudges || [];
  const antiRepeat = plan.anti_repeat_context || { enabled: false, recent_posts: [] };
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
    `Duplicate fact rule: ${plan.copy_contract.duplicate_fact_rule}`,
    `Direct-rental layout: ${JSON.stringify(plan.copy_contract.direct_rental_layout || [])}`,
    `Direct-rental layout rule: ${plan.copy_contract.direct_rental_layout_rule || ''}`,
    `Creative freedom rule: ${plan.copy_contract.creative_freedom_rule || ''}`,
    `Hard gate rule: ${plan.copy_contract.hard_gate_rule || ''}`,
    `Event context: ${JSON.stringify(plan.event_context || {})}`,
    `Performance nudges: ${JSON.stringify(performanceNudges)}`,
    `Ideas: ${JSON.stringify(plan.creative_ideas)}`,
    `Recent copy to avoid repeating: ${JSON.stringify(antiRepeat.recent_posts || [])}`,
    `Rules: ${JSON.stringify(plan.generation_rules)}`,
    'For every publishable KK social-post request, draft exactly 3 INTERNAL candidates; do not present all three as public output.',
    'Candidate 1, Candidate 2, and Candidate 3 must use different primary content angles and visibly different hook logic.',
    'For each candidate, include selector metrics (0–100): hook_strength, event_fandom_relevance, timing_relevance, novelty, hashtag_relevance, readability, event_specificity, naturalness, non_template_feel, hook_originality, sales_pressure_balance, and commercial_relevance when objective=conversion.',
    'The downstream selector will choose exactly one winner. Only that winner is shown to the owner.',
    'Do not reuse recent hook wording or sentence skeletons. Do not turn a blocked idea into publishable sales copy.'
  ].join('\n');
}

module.exports = {
  CONTENT_MIX_TARGET,
  CONTENT_PILLARS,
  CONTENT_ANGLES,
  COPY_CONTRACT,
  ANTI_REPEAT_CONTRACT,
  normalizeRecentPosts,
  validateInput,
  buildCreativePlan,
  buildGenerationPrompt
};
