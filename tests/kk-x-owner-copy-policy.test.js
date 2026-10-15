'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Policy=require('../server/kk-x-owner-copy-policy.js');
const Router=require('../server/kk-content-request-router.js');

const input={
  requested_intent:'direct_rental_x',
  event:'Example Fan Party',
  model_display:'vivo X300 Pro',
  price_display:'vivo X300 Pro 790฿ | + Lens รวม 990฿',
  verified_event:true,
  verified_pricing:true,
  inventory_available:true,
  verified_hashtags:['#เช่ามือถือ','#ExampleFanParty','#ExampleArtist','#ExampleFans','#ExampleLive'],
  recent_context_checked:true,
  recent_posts:[],
  day_statuses_verified:true,
  event_dates_verified:true,
  event_dates:['30 ต.ค.','31 ต.ค.'],
  day_statuses:[
    {date_label:'30 ต.ค.',status:'available'},
    {date_label:'31 ต.ค.',status:'full'}
  ]
};
function copy(hook='คืนพิเศษที่ได้เจอศิลปินในธีมฮาโลวีน 🎃'){
  return [
    '📱 KK Phone Rental | #เช่ามือถือ',
    '',
    '🎃 งาน #ExampleFanParty',
    '',
    '🎶 '+input.price_display,
    '📍 Example Hall',
    '',
    hook,
    '',
    '30 ต.ค. ✅ ว่าง',
    '31 ต.ค. ❌ เต็ม',
    '',
    '💙 ฟรีประกันเครื่อง + ฟอล X ร้าน ไม่ต้องวางมัดจำ',
    '📱 รับ-คืนหน้างาน + สอนใช้ก่อนเข้างาน',
    '☁️ Google Drive ฟรี 30 วัน',
    '',
    '👉 เลือกวันแล้วจองคิว',
    'kk-phone-rental.vercel.app',
    '#ExampleArtist #ExampleFans #ExampleLive'
  ].join('\n');
}
function fail(post,change={},pattern){
  const res=Policy.validatePost(post,{...input,...change});
  assert.equal(res.gate,'BLOCKED');
  assert.match(res.errors.join('|'),pattern);
}
test('passes verified full and available dates without remaining counts',()=>{
  const r=Policy.validatePost(copy(),input);
  assert.equal(r.gate,'PASS');
  assert.equal(r.day_statuses_checked,2);
});
test('blocks unsupported availability, absent evidence, and wrong status',()=>{
  fail(copy(),{day_statuses_verified:false},/DAY_STATUS_EVIDENCE_REQUIRED/);
  fail(copy(),{day_statuses:[]},/DAY_STATUS_LIST_REQUIRED/);
  fail(copy().replace('31 ต.ค. ❌ เต็ม','31 ต.ค. ✅ ว่าง'),{},/DAY_STATUS_MISSING_OR_WRONG|DAY_STATUS_CONTRADICTS_SOURCE/);
  fail(copy()+'\n1 พ.ย. ✅ ว่าง',{},/UNVERIFIED_DAY_STATUS/);
});
test('blocks repeated brand or model in prose and quantity or urgency claims',()=>{
  fail(copy().replace('คืนพิเศษ','KK คืนพิเศษ'),{},/BRAND_REPEATED_IN_BODY/);
  fail(copy().replace('คืนพิเศษ','vivo X300 Pro คืนพิเศษ'),{},/MODEL_ONLY_ON_PRICE_LINE/);
  fail(copy().replace('คืนพิเศษ','เหลือ 1 เครื่อง คืนพิเศษ'),{},/STOCK_QUANTITY_OR_SCARCITY_FORBIDDEN/);
  fail(copy().replace('คืนพิเศษ','เครื่องว่าง 1\/2 คืนพิเศษ'),{},/STOCK_QUANTITY_OR_SCARCITY_FORBIDDEN/);
});
test('Premium longform accepts a tailored booking CTA and rejects missing or multiple CTAs',()=>{
  const personal=copy().replace('👉 เลือกวันแล้วจองคิว','👉 มีบัตรคืนฮาโลวีนแล้ว จองคิวรับเครื่องให้ตรงวันได้เลย');
  assert.equal(Policy.validatePost(personal,input).gate,'PASS');
  fail(copy().replace('👉 เลือกวันแล้วจองคิว','👉 ขอบคุณที่ติดตาม'),{},/SINGLE_EVENT_CTA_REQUIRED/);
  fail(copy()+'\n👉 จองคิวเพิ่มอีกครั้ง',{},/SINGLE_EVENT_CTA_REQUIRED/);
  const long=copy().replace('คืนพิเศษที่ได้เจอศิลปินในธีมฮาโลวีน 🎃',
    'คืนพิเศษที่ได้เจอศิลปินในธีมฮาโลวีน 🎃 '.repeat(24));
  assert.equal(Policy.validatePost(long,input).gate,'PASS');
});
test('enforces five DISTINCT verified hashtags, not five repeated tags',()=>{
  fail(copy().replace('#ExampleArtist #ExampleFans #ExampleLive','#ExampleArtist'),{},/FIVE_DISTINCT_HASHTAGS_REQUIRED/);
  fail(copy().replace('#ExampleLive','#NotVerified'),{},/UNVERIFIED_HASHTAG/);
});
test('official event hashtag is required in the event section, not only in the footer',()=>{
  fail(copy().replace('🎃 งาน #ExampleFanParty','🎃 งาน Example Fan Party'),{},/OFFICIAL_EVENT_HASHTAG_REQUIRED/);
  fail(copy(),{official_event_hashtag:'#AnotherEvent',verified_hashtags:[...input.verified_hashtags,'#AnotherEvent']},/OFFICIAL_EVENT_HASHTAG_REQUIRED/);
});
test('three distinct source-verified hashtags must close the post',()=>{
  fail(copy().replace('#ExampleArtist #ExampleFans #ExampleLive','#ExampleArtist #ExampleFans\\n#ExampleLive'),{},/THREE_VERIFIED_CLOSING_HASHTAGS_REQUIRED/);
  fail(copy().replace('#ExampleArtist #ExampleFans #ExampleLive','#ExampleArtist #ExampleFans #ExampleFans'),{},/THREE_VERIFIED_CLOSING_HASHTAGS_REQUIRED/);
  fail(copy().replace('#ExampleArtist #ExampleFans #ExampleLive','#ExampleArtist #ExampleFans #ExampleFanParty'),{},/THREE_VERIFIED_CLOSING_HASHTAGS_REQUIRED/);
  fail(copy()+'\\nติดต่อทางเว็บไซต์',{},/THREE_VERIFIED_CLOSING_HASHTAGS_REQUIRED/);
});
test('owner-hidden and closed days are excluded instead of being falsely labeled full',()=>{
  for(const state of ['closed','hidden','hide','owner_closed','locked']){
    const source=[{date_label:'30 ต.ค.',status:'available'},{date_label:'31 ต.ค.',status:state}];
    const filtered=copy().replace('31 ต.ค. ❌ เต็ม\\n','');
    assert.equal(Policy.validatePost(filtered,{...input,day_statuses:source}).gate,'PASS',state);
    fail(copy(),{day_statuses:source},/LOCKED_DAY_MENTION_FORBIDDEN/);
    fail(copy().replace('31 ต.ค. ❌ เต็ม','31 ต.ค. ✅ ว่าง'),
      {day_statuses:source},/LOCKED_DAY_MENTION_FORBIDDEN/);
  }
});
test('multi-day event remains sellable on unlocked date while all locked or event-level locked fails closed',()=>{
  const partial={...input,day_statuses:[{date_label:'30 ต.ค.',status:'available'},{date_label:'31 ต.ค.',status:'owner_closed'}]};
  assert.equal(Policy.validatePost(copy().replace('31 ต.ค. ❌ เต็ม\\n',''),partial).gate,'PASS');
  const allLocked={...partial,day_statuses:[{date_label:'30 ต.ค.',status:'hidden'},{date_label:'31 ต.ค.',status:'owner_closed'}]};
  fail(copy().replace('30 ต.ค. ✅ ว่าง\\n','').replace('31 ต.ค. ❌ เต็ม\\n',''),allLocked,/NO_AVAILABLE_DATE_FOR_PROMOTION/);
  fail(copy(),{...input,owner_event_locked:true},/EVENT_LOCKED_OR_HIDDEN/);
  fail(copy(),{...input,owner_event_hidden:true},/EVENT_LOCKED_OR_HIDDEN/);
});
test('unknown or unverified day cannot be relabeled as full',()=>{
  fail(copy(),{day_statuses:[{date_label:'30 ต.ค.',status:'available'},{date_label:'31 ต.ค.',status:'unknown'}]},/DAY_STATUS_INVALID/);
  fail(copy(),{day_statuses_verified:false},/DAY_STATUS_EVIDENCE_REQUIRED/);
});
test('all three internal candidates must pass before selector',()=>{
  const candidates=[{copy:copy('Halloween theme เน้นบรรยากาศพิเศษ')},
    {copy:copy('บรรยากาศ Fan Party ที่ได้เจอแฟนด้อม')},
    {copy:copy('ความสะดวกของบริการรับคืนเครื่องหน้าสถานที่')}];
  assert.equal(Policy.validateVariants(candidates,input).gate,'PASS');
  candidates[1].copy=candidates[1].copy.replace('30 ต.ค. ✅ ว่าง','30 ต.ค. ❌ เต็ม');
  assert.equal(Policy.validateVariants(candidates,input).gate,'BLOCKED');
});
test('finalization blocks forbidden copy before regular QA and selection',()=>{
  const bad=[
    {id:'a',angle:'event_theme',copy:copy('KK โพสต์ซ้ำ')},
    {id:'b',angle:'fandom',copy:copy('แยกมุมแฟนด้อม')},
    {id:'c',angle:'trust',copy:copy('แยกมุมความสะดวก')}
  ];
  const result=Router.finalizeGeneratedCandidates({candidates:bad,input,marketingPlan:{objective:'conversion'}});
  assert.equal(result.gate,'BLOCKED');
  assert.equal(result.blocker,'OWNER_X_COPY_POLICY_FAILED');
  assert.equal(result.public_output_count,0);
  assert.equal(result.owner_x_qa.gate,'BLOCKED');
});
test('direct rental cannot bypass pricing verification by setting commercial_truth_required false',()=>{
  assert.equal(Router.commercialTruthRequired('direct_rental_x',{commercial_truth_required:false}),true);
});
