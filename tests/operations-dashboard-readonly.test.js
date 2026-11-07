'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Ops=require('../admin/operations-dashboard.js');
const NOW=new Date('2026-11-07T09:00:00.000Z');
const mk=(over={})=>({
  ok:true,data:{generated_at:NOW.toISOString(),snapshot_source:'private-service-account',fallback_reader:'private-service-account',
  events:[{event_id:'EVT-20261203-BTS-ARIRANG',event_name:'BTS World Tour',event_date:'2026-12-03'}],
  web_ready:[{event_id:'EVT-20261203-BTS-ARIRANG',event_name:'BTS World Tour',event_date:'2026-12-03',venue:'Rajamangala',poster_image_url:'https://example.org/poster.jpg',available_phone_count:0,available_lens_count:1,action_for_web:'show'}],
  web_packages:[{event_id:'EVT-20261203-BTS-ARIRANG',package_id:'P1',package_type:'phone_only',price:1190,available_count:0,package_status:'full'}, {event_id:'EVT-20261203-BTS-ARIRANG',package_id:'P2',package_type:'phone_lens_bundle',price:1490,available_count:0,package_status:'full'},{event_id:'EVT-20261203-BTS-ARIRANG',package_id:'P3',package_type:'lens_only',price:390,available_count:1,package_status:'available'}],
  bookings:[{event_id:'EVT-20261203-BTS-ARIRANG',booking_status:'confirmed',customer_name:'PRIVATE_NAME',customer_phone:'0980000000',amount_received:9999}],
  visibility_locks:[{event_id:'EVT-20261203-BTS-ARIRANG',lock_state:'SEEN_CORE'}],...over}});
test('lens-only cannot reopen fully booked phones',()=>{
  const x=Ops.normalize(mk(),NOW).records[0];assert.equal(x.web,'show');assert.equal(x.phoneReady,false);assert.equal(x.bundleReady,false);assert.equal(x.bookings,1);assert.ok(x.qa.some(v=>v.includes('สถานะเปิด')));assert.ok(x.gate.includes('มือถือ/แพ็กเกจไม่พร้อม'));
});
test('public/old source is held',()=>{
  const old=Ops.normalize(mk({generated_at:'2026-01-01T00:00:00Z',fallback_reader:'public-gviz'}),NOW);assert.equal(old.meta.fresh,false);assert.equal(old.meta.viaPublic,true);assert.ok(old.records[0].gate.includes('Snapshot ไม่สด'));
});
test('incomplete sources fail closed',()=>{
  const bad=mk();delete bad.data.bookings;assert.throws(()=>Ops.normalize(bad,NOW),/SOURCE_INCOMPLETE:bookings/);
  assert.throws(()=>Ops.normalize(mk({web_packages:[]}),NOW),/SOURCE_EMPTY/);
});
test('duplicate IDs fail closed',()=>{const d=mk();d.data.web_ready.push({...d.data.web_ready[0]});assert.throws(()=>Ops.normalize(d,NOW),/DUPLICATE_EVENT_ID/)});
test('PII is never copied to projection',()=>{
 const out=JSON.stringify(Ops.normalize(mk(),NOW));assert.doesNotMatch(out,/PRIVATE_NAME|0980000000|9999|customer_name|customer_phone|amount_received/);
});
test('owner lock and ambiguous model block',()=>{
  const d=mk({visibility_locks:[{event_id:'EVT-20261203-BTS-ARIRANG',lock_state:'LOCKED'}]});assert.ok(Ops.normalize(d,NOW).records[0].gate.includes('Owner Lock'));
  const ambiguous=mk();ambiguous.data.web_packages.push({...ambiguous.data.web_packages[0],package_id:'P4'});assert.equal(Ops.normalize(ambiguous,NOW).records[0].ambiguous,true);
});
test('dates and posters validated',()=>{
  assert.equal(Ops.isoDate('31/02/2026'),'');assert.equal(Ops.isoDate('03/12/2026'),'2026-12-03');assert.equal(Ops.safePoster('javascript:alert(1)'),'');assert.equal(Ops.safePoster('http://unsafe.example'),'');assert.equal(Ops.bangkokClock(new Date('2026-11-07T09:04:00Z')),'2026-11-07T16:04');
});
test('all post candidates remain unverified without real X log',()=>{
  const row=Ops.normalize(mk(),NOW).records[0];assert.ok(row.gate.includes('ยังไม่ยืนยัน Production และ X Post Log สด'));
});
test('no Owner Lock evidence is not considered release-safe',()=>{
  const row=Ops.normalize(mk({visibility_locks:[]}),NOW).records[0];
  assert.ok(row.gate.includes('Owner Locks ไม่มีหลักฐาน'));
});
test('unknown booking status cannot imply zero active customers',()=>{
  const x=Ops.normalize(mk({bookings:[{event_id:'EVT-20261203-BTS-ARIRANG',booking_status:'unexpected_future_value'}]}),NOW).records[0];
  assert.equal(x.bookings,null);assert.equal(x.bookingTotal,null);
  assert.ok(x.gate.includes('สถานะ Booking ไม่รู้จัก'));
});
