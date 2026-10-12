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
    '#ExampleFanParty'
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
test('short standard CTA required; long legacy CTA blocked',()=>{
  fail(copy().replace('👉 เลือกวันแล้วจองคิว','👉 จองคิว / เช็กคิวว่าง'),{},/SHORT_CTA_REQUIRED/);
});
test('full vs owner-closed are distinct statuses',()=>{
  const status=[{date_label:'30 ต.ค.',status:'available'},{date_label:'31 ต.ค.',status:'closed'}];
  assert.equal(Policy.validatePost(copy().replace('31 ต.ค. ❌ เต็ม','31 ต.ค. 🚫 ปิด'),{...input,day_statuses:status}).gate,'PASS');
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
