'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Qa=require('../server/kk-content-qa-gate.js');
const Router=require('../server/kk-content-request-router.js');

const input={
  requested_intent:'direct_rental_x',
  sales_intent:'direct',
  commercial_truth_required:true,
  event_truth_required:true,
  event:'Example Concert',
  venue:'Example Hall',
  date_display:'3 ต.ค.',
  verified_event:true,
  verified_pricing:true,
  price_display:'vivo X300 Pro 690฿ | เพิ่ม Lens +200฿',
  inventory_available:true,
  recent_context_checked:true,
  recent_posts:[],
  event_dates_verified:true,
  event_dates:['3 ต.ค.'],
  day_statuses_verified:true,
  day_statuses:[{date_label:'3 ต.ค.',status:'available'}],
  official_event_hashtag:'#ExampleConcert',
  verified_hashtags:['#ExampleConcert','#ArtistExample','#FandomExample','#ExampleLive','#เช่ามือถือ']
};

function metrics(overrides={}){
  return {
    hook_strength:88,
    event_fandom_relevance:90,
    timing_relevance:82,
    novelty:88,
    hashtag_relevance:100,
    readability:92,
    commercial_relevance:88,
    event_specificity:92,
    naturalness:93,
    non_template_feel:91,
    hook_originality:90,
    sales_pressure_balance:92,
    ...overrides
  };
}

function flexiblePost(hook){
 return [
   '📱 KK Phone Rental | #เช่ามือถือ',
   '',
   hook,
   '',
   '💙 ฟรีประกันเครื่อง + ไม่ต้องวางมัดจำ',
   '',
   '🎤 vivo X300 Pro 690฿ | เพิ่ม Lens +200฿',
   '',
   '🔥 #ExampleConcert',
   '📍 Example Hall',
   '3 ต.ค. ✅ ว่าง',
   '',
   '👉 เลือกวันแล้วจองคิว',
   'kk-phone-rental.vercel.app',
   '',
   '#ArtistExample #FandomExample #ExampleLive'
 ].join('\n');
}

test('creative paragraph order can vary when business-critical facts remain correct',()=>{
  const result=Qa.validatePost(flexiblePost('จากในจอว่าน่าจำแล้ว รอบจริงน่าจะยิ่งมีโมเมนต์ให้เก็บอีกเยอะ ✨'),input);
  assert.equal(result.gate,'PASS');
  assert.equal(result.creative_layout_policy,'FLEXIBLE');
  assert.doesNotMatch(result.errors.join('|'),/ORDER/);
});

test('near-duplicate internal creative cores fail closed even when footer differs',()=>{
  const a=flexiblePost('คืนนี้เจอเมนแล้ว อย่าปล่อยให้โมเมนต์สำคัญหลุดไปจากเฟรม ✨');
  const b=flexiblePost('คืนนี้เจอเมนแล้ว อย่าปล่อยให้โมเมนต์สำคัญหลุดไปจากเฟรม 🔥');
  const c=flexiblePost('รอบนี้บรรยากาศของงานมาอีกโทนหนึ่ง ใครอยากเก็บทั้งเวทีและรีแอคชันเตรียมเครื่องไว้ก่อน');
  const result=Qa.validateVariants([
    {id:'a',angle:'event_theme',copy:a,metrics:metrics()},
    {id:'b',angle:'fandom',copy:b,metrics:metrics()},
    {id:'c',angle:'trust',copy:c,metrics:metrics()}
  ],input);
  assert.equal(result.gate,'BLOCKED');
  assert.match(result.errors.join('|'),/NEAR_DUPLICATE_INTERNAL_CANDIDATES/);
});

test('commercial copy blocks when verified price/date/venue or CTA is missing',()=>{
  const missingPrice=flexiblePost('Hook ราคา').replace('🎤 vivo X300 Pro 690฿ | เพิ่ม Lens +200฿\n\n','');
  const r1=Qa.validatePost(missingPrice,input);
  assert.equal(r1.gate,'BLOCKED');
  assert.match(r1.errors.join('|'),/VERIFIED_PRICE_NOT_IN_COPY/);

  const missingVenue=flexiblePost('Hook venue').replace('📍 Example Hall','');
  const r2=Qa.validatePost(missingVenue,input);
  assert.equal(r2.gate,'BLOCKED');
  assert.match(r2.errors.join('|'),/VENUE_NOT_IN_COPY/);

  const missingCta=flexiblePost('Hook CTA').replace('👉 เลือกวันแล้วจองคิว\n','');
  const r3=Qa.validatePost(missingCta,input);
  assert.equal(r3.gate,'BLOCKED');
  assert.match(r3.errors.join('|'),/BOOKING_CTA_MISSING/);
});

test('recent-copy near duplicate is blocked while fresh event-specific hook passes',()=>{
  const base='จากในจอว่าขลังแล้ว รอบจริงน่าจะยิ่งใกล้ชิดกว่าเดิม 🪷✨';
  const repeated=Qa.validatePost(flexiblePost(base),{...input,recent_posts:[base]});
  assert.equal(repeated.gate,'BLOCKED');
  assert.match(repeated.errors.join('|'),/RECENT_COPY_NEAR_DUPLICATE/);

  const fresh=Qa.validatePost(flexiblePost('งานนี้บรรยากาศต่างจากโพสต์ก่อนชัดเจน เน้นโมเมนต์ใกล้ชิดและจังหวะบนเวทีแทน 🪷'),{...input,recent_posts:[base]});
  assert.equal(fresh.gate,'PASS');
});

test('finalizer accepts three distinct owner-policy candidates and returns one winner',()=>{
  const candidates=[
    {id:'a',angle:'event_theme',copy:flexiblePost('ธีมงานรอบนี้มีภาพจำชัดตั้งแต่โปสเตอร์ ใครชอบเก็บบรรยากาศรอบเวทีน่าจะมีช็อตให้เล่นเยอะ'),metrics:metrics({hook_strength:86})},
    {id:'b',angle:'fandom',copy:flexiblePost('คืนนี้ไม่ได้มีแค่เวที แต่มีช่วงพิเศษที่แฟน ๆ ตั้งตารอ แรงเชียร์ของทั้งฮอลล์คือส่วนสำคัญของงาน ✨'),metrics:metrics({hook_strength:94,event_specificity:97,naturalness:96,non_template_feel:96,hook_originality:95})},
    {id:'c',angle:'trust',copy:flexiblePost('บริการรับและคืนที่งานช่วยลดขั้นตอนก่อนเริ่มโชว์ เหมาะกับคนที่อยากใช้เวลาในงานได้เต็มที่'),metrics:metrics({hook_strength:82,naturalness:88,non_template_feel:86})}
  ];
  const result=Router.finalizeGeneratedCandidates({
    candidates,
    input,
    marketingPlan:{objective:'awareness',measured_posts:0}
  });
  assert.equal(result.gate,'PASS');
  assert.equal(result.public_output_count,1);
  assert.equal(result.selection.winner.id,'b');
});
