'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const Router=require('../server/kk-content-request-router.js');
const Qa=require('../server/kk-content-qa-gate.js');

function metrics(overrides={}){
  return {
    hook_strength:85,
    event_fandom_relevance:80,
    timing_relevance:78,
    novelty:84,
    hashtag_relevance:82,
    readability:90,
    ...overrides
  };
}

test('post intent detector covers rental, roundup, last-call, onsite, promo, repost and brand posts',()=>{
  const cases=[
    ['ขอโพสปล่อยเช่างานนี้บน X','direct_rental_x'],
    ['ขอโพสรวมงานอาทิตย์นี้บน X','content_draft'],
    ['ทำ Last Call โพสต์คืนนี้ให้หน่อย','content_draft'],
    ['ช่วยทำโพสต์ถึงหน้างานแล้ว','content_draft'],
    ['ช่วยเขียนโพสต์โปรโมชั่นงานนี้','content_draft'],
    ['ช่วยรีเฟรชโพสต์นี้หน่อย','content_draft'],
    ['ช่วยเขียนโพสต์ awareness ให้ KK Phone Rental','content_draft'],
    ['weekly roundup post for X','content_draft']
  ];
  for(const [message,expected] of cases){
    assert.equal(Router.detectContentIntent(message),expected,message);
  }
});

test('every matched post route is single-winner and selector-mandatory',()=>{
  const route=Router.routeContentRequest({
    message:'ขอโพสรวมงานอาทิตย์นี้บน X',
    input:{event:'Weekly roundup',verified_event:true,commercial_truth_required:false}
  });
  assert.equal(route.matched,true);
  assert.equal(route.selector_required,true);
  assert.equal(route.three_variant_engine_required,true);
  assert.equal(route.internal_candidate_count,3);
  assert.equal(route.public_output_count,1);
  assert.equal(route.public_output_mode,'SINGLE_FINAL_POST');
  assert.equal(route.commercial_truth_required,false);
  assert.match(route.generation_prompt,/exactly 3 INTERNAL candidates/i);
});

test('non-commercial brand posts can pass QA without inventing event, price or inventory truth',()=>{
  const input={commercial_truth_required:false,event_truth_required:false};
  const post='📱 KK Phone Rental | #เช่ามือถือ\n\nคืนนี้ขอชวนคุยเรื่องการเตรียมมือถือไปคอนแบบไม่ต้องรีบก่อนเข้างาน';
  const result=Qa.validatePost(post,input);
  assert.equal(result.gate,'PASS');
  assert.equal(result.commercial_truth_required,false);
  assert.equal(result.event_truth_required,false);
});

test('commercial posts remain fail-closed without verified price and inventory',()=>{
  const input={
    requested_intent:'direct_rental_x',
    event:'Example Concert',
    verified_event:true,
    official_event_hashtag:'#ExampleConcert',
    verified_hashtags:['#ExampleConcert']
  };
  const post='📱 KK Phone Rental | #เช่ามือถือ\n\n🔥 #ExampleConcert\n\n👉 จองคิว / เช็กคิวว่าง https://kk-phone-rental.vercel.app/';
  const result=Qa.validatePost(post,input);
  assert.equal(result.gate,'BLOCKED');
  assert.match(result.errors.join('|'),/PRICING_NOT_VERIFIED/);
  assert.match(result.errors.join('|'),/INVENTORY_NOT_CONFIRMED_AVAILABLE/);
});

test('generic post finalization still requires three QA-passing candidates and emits one winner',()=>{
  const base='📱 KK Phone Rental | #เช่ามือถือ\n\n';
  const candidates=[
    {id:'a',angle:'utility',copy:base+'เตรียมเครื่องก่อนวันงานแบบสบาย ๆ เริ่มจากเช็กพื้นที่ว่างและแบตเตอรี่',metrics:metrics({hook_strength:80})},
    {id:'b',angle:'community',copy:base+'ก่อนเข้าคอน คุณเช็กอะไรเป็นอย่างแรก: แบต พื้นที่ หรือกล้อง?',metrics:metrics({hook_strength:92,novelty:91})},
    {id:'c',angle:'trust',copy:base+'งานคอนสนุกขึ้นได้เมื่อเรื่องอุปกรณ์ถูกเตรียมไว้ล่วงหน้า ไม่ต้องแก้ปัญหาหน้างาน',metrics:metrics({hook_strength:84})}
  ];
  const result=Router.finalizeGeneratedCandidates({
    candidates,
    input:{commercial_truth_required:false,event_truth_required:false},
    marketingPlan:{objective:'awareness',measured_posts:0}
  });
  assert.equal(result.gate,'PASS');
  assert.equal(result.public_output_count,1);
  assert.equal(result.public_output_mode,'SINGLE_FINAL_POST');
  assert.equal(result.selection.internal_candidate_count,3);
  assert.ok(result.final_post);
});
