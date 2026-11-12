'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Ops=require('../admin/operations-dashboard.js');
const NOW=new Date('2026-11-07T09:00:00.000Z');
const mk=(over={})=>({
  ok:true,data:{projection_version:'kk-admin-ops-projection-v1',generated_at:NOW.toISOString(),snapshot_source:'private-service-account',fallback_reader:'private-service-account',
  events:[{event_id:'EVT-20261203-BTS-ARIRANG',event_name:'BTS World Tour',event_date:'2026-12-03',status:'open',active_on_web:true}],
  web_ready:[{event_id:'EVT-20261203-BTS-ARIRANG',event_name:'BTS World Tour',event_date:'2026-12-03',venue:'Rajamangala',poster_image_url:'https://example.org/poster.jpg',available_phone_count:0,available_lens_count:1,action_for_web:'show'}],
  web_packages:[{event_id:'EVT-20261203-BTS-ARIRANG',package_id:'P1',package_type:'phone_only',price:1190,available_count:0,package_status:'full'}, {event_id:'EVT-20261203-BTS-ARIRANG',package_id:'P2',package_type:'phone_lens_bundle',price:1490,available_count:0,package_status:'full'},{event_id:'EVT-20261203-BTS-ARIRANG',package_id:'P3',package_type:'lens_only',price:390,available_count:1,package_status:'available'}],
  bookings:[{booking_id:'BK-20261203-001',event_id:'EVT-20261203-BTS-ARIRANG',booking_status:'confirmed',customer_name:'PRIVATE_NAME',customer_phone:'0980000000',amount_received:9999}],
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
  const x=Ops.normalize(mk({bookings:[{event_id:'EVT-20261203-BTS-ARIRANG',booking_id:'BK-20261203-001',booking_status:'unexpected_future_value'}]}),NOW).records[0];
  assert.equal(x.bookings,null);assert.equal(x.bookingTotal,null);
  assert.ok(x.gate.includes('Booking ไม่ครบ/ID ซ้ำ/สถานะไม่รู้จัก'));
});


test('empty lock state is HOLD rather than falsely permitted',()=>{
  const row=Ops.normalize(mk({visibility_locks:[{event_id:'EVT-20261203-BTS-ARIRANG',lock_state:''}]}),NOW).records[0];
  assert.ok(row.gate.includes('Owner Locks ไม่มีหลักฐาน'));
  assert.equal(row.lock,'UNKNOWN');
});
test('duplicate underlying Event IDs cannot be silently overwritten',()=>{
  const x=mk();x.data.events.push({...x.data.events[0],event_name:'Conflicting event'});
  assert.throws(()=>Ops.normalize(x,NOW),/DUPLICATE_EVENT_ID/);
});
test('duplicate Web Package IDs cannot silently change pricing truth',()=>{
  const x=mk();x.data.web_packages.push({...x.data.web_packages[0],available_count:5});
  assert.throws(()=>Ops.normalize(x,NOW),/DUPLICATE_PACKAGE_ID/);
});
test('duplicate or missing Booking identity blocks verified booking counts',()=>{
  const x=mk();x.data.bookings.push({...x.data.bookings[0],booking_status:'cancelled'});
  const row=Ops.normalize(x,NOW).records[0];
  assert.equal(row.bookingTotal,null);assert.equal(row.bookings,null);
  assert.ok(row.gate.includes('Booking ไม่ครบ/ID ซ้ำ/สถานะไม่รู้จัก'));
  const y=mk({bookings:[{event_id:'EVT-20261203-BTS-ARIRANG',booking_status:'confirmed'}]});
  assert.equal(Ops.normalize(y,NOW).records[0].bookingTotal,null);
});
test('fractional, negative and unsafe stock counts are HOLD',()=>{
  const x=mk();x.data.web_ready[0].available_phone_count=0.5;
  x.data.web_packages[0]={...x.data.web_packages[0],available_count:0.5,package_status:'available'};
  const row=Ops.normalize(x,NOW).records[0];
  assert.equal(row.stock,null);assert.equal(row.phoneReady,false);
  assert.ok(row.gate.includes('มือถือ/แพ็กเกจไม่พร้อม'));
  assert.ok(row.qa.some(v=>v.includes('สถานะเปิด')));
  for(const bad of [-1,1e99,'Infinity']){
    const y=mk();y.data.web_ready[0].available_phone_count=bad;
    assert.equal(Ops.normalize(y,NOW).records[0].stock,null);
  }
});

// Regression: package stock alone cannot override 08_Web_Ready phone inventory.
test('positive bundle stock with zero Web Ready phone count stays unavailable',()=>{
  const x=mk();
  x.data.web_packages[0].available_count=2;x.data.web_packages[0].package_status='available';
  x.data.web_packages[1].available_count=2;x.data.web_packages[1].package_status='available';
  const row=Ops.normalize(x,NOW).records[0];
  assert.equal(row.stock,0);assert.equal(row.phoneReady,false);assert.equal(row.bundleReady,false);
  assert.ok(row.gate.includes('มือถือ/แพ็กเกจไม่พร้อม'));
});

test('primary Apps Script lacking Owner Locks can show read-only rows, but each row is HOLD',()=>{
  const x=mk();delete x.data.visibility_locks;
  const output=Ops.normalize(x,NOW);
  assert.equal(output.records.length,1);
  assert.equal(output.meta.locksAvailable,false);
  assert.equal(output.records[0].lock,'UNKNOWN');
  assert.ok(output.records[0].gate.includes('Owner Locks ไม่มีหลักฐาน'));
});
test('timezone-less Apps Script generated_at is interpreted in Bangkok time, not browser timezone',()=>{
  const output=Ops.normalize(mk({generated_at:'2026-11-07T16:00:00'}),NOW);
  assert.equal(output.meta.fresh,true);
  assert.equal(output.meta.generatedAt,'2026-11-07T09:00:00.000Z');
});

// Core and derived visibility are independent safety authorities.
test('Core hidden cannot look rent-ready merely because Web Ready and packages say show',()=>{
  const d=mk();d.data.events[0].active_on_web=false;
  d.data.web_ready[0].available_phone_count=2;
  d.data.web_packages[0].available_count=2;d.data.web_packages[0].package_status='available';
  const x=Ops.normalize(d,NOW).records[0];
  assert.equal(x.phoneReady,false);
  assert.ok(x.qa.some(y=>y.includes('Core')));
  assert.ok(x.gate.some(y=>y.includes('Core')));
});
test('orphan Web Ready event is HOLD instead of treated as verified Core event',()=>{
  const d=mk();d.data.events[0].event_id='EVT-DIFFERENT';
  d.data.web_ready[0].available_phone_count=2;
  d.data.web_packages[0].available_count=2;d.data.web_packages[0].package_status='available';
  const x=Ops.normalize(d,NOW).records[0];
  assert.equal(x.phoneReady,false);
  assert.ok(x.qa.some(y=>y.includes('Core')));
});
test('web-hidden events cannot advertise phone ready despite available packages',()=>{
  const d=mk();d.data.web_ready[0].action_for_web='hide';d.data.web_ready[0].available_phone_count=2;
  d.data.web_packages[0].available_count=2;d.data.web_packages[0].package_status='available';
  const x=Ops.normalize(d,NOW).records[0];
  assert.equal(x.phoneReady,false);
  assert.ok(x.gate.includes('หน้าร้านไม่เปิด'));
});
test('Core closed event cannot advertise phone ready on contradictory derived show',()=>{
  const d=mk();d.data.events[0].status='closed';d.data.web_ready[0].available_phone_count=2;
  d.data.web_packages[0].available_count=2;d.data.web_packages[0].package_status='available';
  const x=Ops.normalize(d,NOW).records[0];
  assert.equal(x.phoneReady,false);
  assert.ok(x.qa.some(y=>y.includes('Core')));
});
test('Core event date mismatch is visibly flagged and blocks post draft gate',()=>{
 const d=mk();d.data.events[0].event_date='2026-12-04';
 d.data.web_ready[0].available_phone_count=2;
 d.data.web_packages[0].available_count=2;d.data.web_packages[0].package_status='available';
 const x=Ops.normalize(d,NOW).records[0];
 assert.equal(x.phoneReady,false);
 assert.ok(x.qa.some(y=>y.includes('วันที่/สถานที่')));
 assert.ok(x.gate.includes('โปสเตอร์/วันที่'));
});

test('Core venue drift cannot look rent-ready with positive package stock',()=>{
 const d=mk();d.data.events[0].venue='Different Venue';d.data.web_ready[0].venue='Rajamangala';
 d.data.web_ready[0].available_phone_count=2;d.data.web_packages[0].available_count=2;d.data.web_packages[0].package_status='available';
 const x=Ops.normalize(d,NOW).records[0];
 assert.equal(x.phoneReady,false);
 assert.ok(x.qa.some(v=>v.includes('วันที่/สถานที่')));
});

test('reject unfiltered raw Admin response even when its other arrays look valid',()=>{
 const source=mk();delete source.data.projection_version;
 assert.throws(()=>Ops.normalize(source,NOW),/OPS_PROJECTION_REQUIRED/);
});

// R14: a positive inventory number must not imply rentable-ready if the
// independent Core/Web Ready venue identity is missing or unconfirmed.
test('missing Core or Web Ready venue fails closed despite positive phone inventory',()=>{
 for(const missing of ['core','web']){
  const d=mk();d.data.events[0].venue='Rajamangala';
  d.data.web_ready[0].venue='Rajamangala';
  d.data.web_ready[0].available_phone_count=2;
  for(const p of d.data.web_packages.slice(0,2)){p.available_count=2;p.package_status='available';}
  if(missing==='core')delete d.data.events[0].venue;
  else delete d.data.web_ready[0].venue;
  const row=Ops.normalize(d,NOW).records[0];
  assert.equal(row.phoneReady,false,missing+' cannot look ready');
  assert.equal(row.bundleReady,false,missing+' cannot look bundle ready');
  assert.ok(row.qa.some(x=>x.includes('วันที่/สถานที่')));
  assert.ok(row.gate.includes('โปสเตอร์/วันที่'));
 }
});
test('placeholder venue is unverified even when both sources agree',()=>{
 const d=mk();d.data.events[0].venue='รอยืนยัน';d.data.web_ready[0].venue='รอยืนยัน';
 d.data.web_ready[0].available_phone_count=2;
 for(const p of d.data.web_packages.slice(0,2)){p.available_count=2;p.package_status='available';}
 const row=Ops.normalize(d,NOW).records[0];
 assert.equal(row.phoneReady,false);assert.equal(row.bundleReady,false);
 assert.ok(row.gate.includes('โปสเตอร์/วันที่'));
});
test('matching verified venues do not falsely suppress positive phone readiness',()=>{
 const d=mk();d.data.events[0].venue='Rajamangala';d.data.web_ready[0].venue='Rajamangala';
 d.data.web_ready[0].available_phone_count=2;
 for(const p of d.data.web_packages.slice(0,2)){p.available_count=2;p.package_status='available';}
 const row=Ops.normalize(d,NOW).records[0];
 assert.equal(row.phoneReady,true);assert.equal(row.bundleReady,true);
 assert.ok(!row.gate.includes('โปสเตอร์/วันที่'));
 assert.ok(row.gate.includes('ยังไม่ยืนยัน Production และ X Post Log สด'));
});

// R15: prevent a stale or public-derived snapshot from showing false "พร้อม" stock.
function positiveStockFixture(over={}) {
 const d=mk(over);
 d.data.events[0].venue='Rajamangala';
 d.data.web_ready[0].venue='Rajamangala';
 d.data.web_ready[0].available_phone_count=2;
 for(const p of d.data.web_packages.slice(0,2)){p.available_count=2;p.package_status='available';}
 return d;
}
test('stale private snapshot must not claim available phone or bundle despite positive inventory',()=>{
 const d=positiveStockFixture({generated_at:'2026-01-01T00:00:00Z'});
 const x=Ops.normalize(d,NOW);
 assert.equal(x.meta.fresh,false);
 assert.equal(x.records[0].stock,2);
 assert.equal(x.records[0].phoneReady,false);
 assert.equal(x.records[0].bundleReady,false);
 assert.ok(x.records[0].qa.some(q=>q.includes('Reader ไม่ผ่าน')));
 assert.ok(x.records[0].gate.includes('Snapshot ไม่สด'));
});
test('fresh public GViz fallback must not claim available phone or bundle',()=>{
 const d=positiveStockFixture({fallback_reader:'public-gviz',snapshot_source:'public-gviz'});
 const x=Ops.normalize(d,NOW);
 assert.equal(x.meta.fresh,true);
 assert.equal(x.meta.viaPublic,true);
 assert.equal(x.records[0].phoneReady,false);
 assert.equal(x.records[0].bundleReady,false);
 assert.ok(x.records[0].gate.includes('Source เป็น public GViz fallback'));
});
test('missing Web Ready date fails closed even when Core and Event ID contain date',()=>{
 const d=positiveStockFixture();
 delete d.data.web_ready[0].event_date;
 const x=Ops.normalize(d,NOW);
 assert.equal(x.records[0].phoneReady,false);
 assert.equal(x.records[0].bundleReady,false);
 assert.ok(x.records[0].qa.some(q=>q.includes('วันที่/สถานที่')));
});
test('fresh private source with matching Core and Web Ready dates remains readable',()=>{
 const d=positiveStockFixture();
 const x=Ops.normalize(d,NOW);
 assert.equal(x.meta.fresh,true);
 assert.equal(x.meta.viaPublic,false);
 assert.equal(x.records[0].phoneReady,true);
 assert.equal(x.records[0].bundleReady,true);
});

test('ready inventory does not override missing, locked or conflicting Owner Locks',()=>{
 for(const locks of [undefined,[],[{event_id:'EVT-20261203-BTS-ARIRANG',lock_state:''}],[{event_id:'EVT-20261203-BTS-ARIRANG',lock_state:'LOCKED'}],[{event_id:'EVT-20261203-BTS-ARIRANG',lock_state:'REOPENED'},{event_id:'EVT-20261203-BTS-ARIRANG',lock_state:'SEEN_CORE'}]]){
  const d=positiveStockFixture();
  if(locks===undefined)delete d.data.visibility_locks;
  else d.data.visibility_locks=locks;
  const row=Ops.normalize(d,NOW).records[0];
  assert.equal(row.stock,2,'keep audit stock count');
  assert.equal(row.phoneReady,false,'do not claim bookable phone without verified Owner Lock');
  assert.equal(row.bundleReady,false,'do not claim bookable bundle without verified Owner Lock');
  assert.ok(row.gate.some(g=>g.includes('Owner Lock')),'explicit Owner Lock gate');
 }
});
test('ready inventory cannot hide unknown Booking status, missing identity or duplicate identity',()=>{
 for(const bookings of [
  [{event_id:'EVT-20261203-BTS-ARIRANG',booking_id:'X1',booking_status:'unknown_future_status'}],
  [{event_id:'EVT-20261203-BTS-ARIRANG',booking_status:'confirmed'}],
  [{event_id:'EVT-20261203-BTS-ARIRANG',booking_id:'X1',booking_status:'confirmed'},{event_id:'EVT-20261203-BTS-ARIRANG',booking_id:'X1',booking_status:'cancelled'}]
 ]){
  const d=positiveStockFixture({bookings});
  const row=Ops.normalize(d,NOW).records[0];
  assert.equal(row.phoneReady,false);
  assert.equal(row.bundleReady,false);
  assert.equal(row.bookings,null);
  assert.ok(row.gate.includes('Booking ไม่ครบ/ID ซ้ำ/สถานะไม่รู้จัก'));
 }
});
test('ready inventory is withheld when active price or package identity is ambiguous',()=>{
 const missingPrice=positiveStockFixture();
 missingPrice.data.web_packages[1].price=null;
 let row=Ops.normalize(missingPrice,NOW).records[0];
 assert.equal(row.phoneReady,false);assert.equal(row.bundleReady,false);
 const duplicates=positiveStockFixture();
 duplicates.data.web_packages.push({...duplicates.data.web_packages[0],package_id:'P4'});
 row=Ops.normalize(duplicates,NOW).records[0];
 assert.equal(row.ambiguous,true);assert.equal(row.phoneReady,false);assert.equal(row.bundleReady,false);
});
test('fresh verified private source retains availability while unverified advertising stays HOLD',()=>{
 const row=Ops.normalize(positiveStockFixture(),NOW).records[0];
 assert.equal(row.phoneReady,true);assert.equal(row.bundleReady,true);
 assert.ok(row.gate.includes('ยังไม่ยืนยัน Production และ X Post Log สด'));
});

test('Owner Lock and Booking verification problems are tracked as separate QA worklists',()=>{
 const noLock=positiveStockFixture({visibility_locks:[]});
 const lockRow=Ops.normalize(noLock,NOW).records[0];
 assert.ok(lockRow.qa.some(x=>x.includes('Owner Locks')));
 assert.equal(lockRow.phoneReady,false);
 const badBooking=positiveStockFixture({bookings:[{event_id:'EVT-20261203-BTS-ARIRANG',booking_id:'QA1',booking_status:'not_recognized'}]});
 const bookingRow=Ops.normalize(badBooking,NOW).records[0];
 assert.ok(bookingRow.qa.some(x=>x.includes('Booking ตรวจไม่ผ่าน')));
 assert.equal(bookingRow.phoneReady,false);
});


// R18: source identity is a separate fail-closed availability authority.
test('fresh unknown or mismatched transport cannot claim rentable stock',()=>{
 const cases=[
  {fallback_reader:''},
  {fallback_reader:'unrecognized-reader'},
  {snapshot_source:''},
  {snapshot_source:'direct-sheet-gviz-readonly-fallback'},
  {fallback_reader:'private-owner-apps-script',snapshot_source:'private-service-account'},
  {fallback_reader:'private-service-account',snapshot_source:'direct-sheet-private-owner-apps-script-readonly-fallback'},
  {fallback_reader:'private-service-account',snapshot_source:'public-gviz'}
 ];
 for(const over of cases){
  const out=Ops.normalize(positiveStockFixture(over),NOW);
  const row=out.records[0];
  assert.equal(out.meta.privateSourceVerified,false,'unverified '+JSON.stringify(over));
  assert.equal(row.stock,2,'retain read-only audit aggregate');
  assert.equal(row.phoneReady,false);
  assert.equal(row.bundleReady,false);
  assert.ok(row.gate.some(x=>x.includes('Source ')),'visible HOLD reason');
  assert.ok(row.qa.some(x=>x.includes('Reader ไม่ผ่าน')),'visible QA worklist');
 }
});
test('matching authenticated private transport preserves positive controls',()=>{
 for(const [fallback_reader,snapshot_source] of [
  ['private-service-account','direct-sheet-private-service-account-readonly-fallback'],
  ['private-owner-apps-script','direct-sheet-private-owner-apps-script-readonly-fallback']
 ]){
  const out=Ops.normalize(positiveStockFixture({fallback_reader,snapshot_source}),NOW);
  assert.equal(out.meta.privateSourceVerified,true);
  assert.equal(out.records[0].phoneReady,true);
  assert.equal(out.records[0].bundleReady,true);
  assert.ok(out.records[0].gate.includes('ยังไม่ยืนยัน Production และ X Post Log สด'));
 }
});


// R19 live source has 471 canonical event IDs; a fixed 450 cap hid 21.
test('bounded table pages retain the 471st event and never silently cap at 450',()=>{
 const rows=Array.from({length:471},(_,i)=>({event_id:'SYNTHETIC-'+i}));
 assert.equal(Ops.pageRows(rows).length,150);
 assert.equal(Ops.pageRows(rows,300).length,300);
 assert.equal(Ops.pageRows(rows,450).length,450);
 assert.equal(Ops.pageRows(rows,600).length,471);
 assert.equal(Ops.pageRows(rows,600)[470],rows[470]);
 assert.equal(Ops.pageRows(rows,-12).length,150);
});
test('table and calendar have explicit load-more controls and filter reset',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const root=path.resolve(__dirname,'..');
 const html=fs.readFileSync(path.join(root,'admin/operations-dashboard.html'),'utf8');
 const code=fs.readFileSync(path.join(root,'admin/operations-dashboard.js'),'utf8');
 assert.ok(html.includes('id="tableCount"'));
 assert.ok(html.includes('id="showMore"'));
 assert.ok(code.includes("more.addEventListener('click',next)"));
 assert.ok(code.includes("state.tableLimit=TABLE_PAGE_SIZE"));
 assert.ok(!code.includes('rows.slice(0,450)'));
});


// R20: prevent an active orphan Booking from silently disappearing and
// reopening unrelated phone inventory when its event identity is corrupted.
test('an active booking without event ID fails closed for all availability',()=>{
 const d=positiveStockFixture({bookings:[
  {booking_id:'SYNTHETIC_ORPHAN',event_id:'',booking_status:'confirmed'},
  {booking_id:'SYNTHETIC_VALID',event_id:'EVT-20261203-BTS-ARIRANG',booking_status:'confirmed'}
 ]});
 const x=Ops.normalize(d,NOW);
 assert.equal(x.meta.unassignedActiveBooking,true);
 assert.equal(x.meta.complete,false);
 assert.equal(x.records[0].stock,2,'retain read-only audit stock number');
 assert.equal(x.records[0].bookings,null,'cannot assert verified active count');
 assert.equal(x.records[0].bookingTotal,null);
 assert.equal(x.records[0].phoneReady,false);
 assert.equal(x.records[0].bundleReady,false);
 assert.ok(x.records[0].gate.includes('Booking ไม่ผูกกับงานหลัก'));
 assert.ok(x.records[0].qa.some(q=>q.includes('Booking ตรวจไม่ผ่าน')));
});
test('active booking referencing an absent Core or Web Ready event holds all availability',()=>{
 for(const status of ['confirmed','uploaded','unrecognized_future_status']){
  const d=positiveStockFixture({bookings:[{
   booking_id:'SYNTHETIC_ABSENT_EVENT',event_id:'EVT-20991231-NOT-IN-SOURCE',booking_status:status
  }]});
  const x=Ops.normalize(d,NOW);
  assert.equal(x.meta.unassignedActiveBooking,true);
  assert.equal(x.records[0].phoneReady,false);
  assert.equal(x.records[0].bookingTotal,null);
 }
});
test('closed orphan booking and blank ancillary rows do not create false global HOLD',()=>{
 for(const status of ['cancelled','completed','']){
  const d=positiveStockFixture({bookings:[{
   booking_id:'SYNTHETIC_NONACTIVE',event_id:'',booking_status:status
  }]});
  const x=Ops.normalize(d,NOW);
  assert.equal(x.meta.unassignedActiveBooking,false);
  assert.equal(x.records[0].phoneReady,true);
  assert.equal(x.records[0].bundleReady,true);
  assert.equal(x.records[0].bookings,0);
 }
});


// R21: Real canonical Web Ready source has 45 historically-dated SHOW events.
// Such records remain audit-visible but must never claim current rentable stock.
function r21FixtureOnDate(date){
 const d=positiveStockFixture();
 const id='EVT-'+date.replace(/-/g,'')+'-QA-PAST-SAFETY';
 d.data.events[0].event_id=id;
 d.data.events[0].event_date=date;
 d.data.web_ready[0].event_id=id;
 d.data.web_ready[0].event_date=date;
 d.data.web_ready[0].event_date_text=date;
 for(const p of d.data.web_packages)p.event_id=id;
 for(const b of d.data.bookings)b.event_id=id;
 for(const lock of d.data.visibility_locks)lock.event_id=id;
 return d;
}
test('historical SHOW with verified private origin and positive stock cannot appear rentable',()=>{
 const x=Ops.normalize(r21FixtureOnDate('2026-11-06'),NOW);
 const r=x.records[0];
 assert.equal(x.meta.fresh,true,'source must be fresh to isolate date safety');
 assert.equal(x.meta.privateSourceVerified,true);
 assert.equal(r.web,'show');
 assert.equal(r.stock,2,'retain source count for audit');
 assert.equal(r.phoneReady,false);
 assert.equal(r.bundleReady,false);
 assert.ok(r.qa.includes('งานผ่านวันที่แล้ว'));
 assert.ok(r.gate.includes('วันที่งานผ่านไปแล้ว'));
 assert.ok(!r.gate.includes('โปสเตอร์/วันที่'),'date identity is valid and not the blocker');
});
test('today and future SHOW remain ready if all other checks pass',()=>{
 for(const date of ['2026-11-07','2026-11-08']){
  const x=Ops.normalize(r21FixtureOnDate(date),NOW).records[0];
  assert.equal(x.phoneReady,true,'valid upcoming source on '+date);
  assert.equal(x.bundleReady,true);
  assert.ok(!x.qa.includes('งานผ่านวันที่แล้ว'));
 }
});
test('past-day HOLD transitions at midnight in Asia/Bangkok, never UTC midnight',()=>{
 const before=new Date('2026-11-06T16:59:00.000Z');
 const after=new Date('2026-11-06T17:01:00.000Z');
 const a=r21FixtureOnDate('2026-11-06');a.data.generated_at=before.toISOString();
 const b=r21FixtureOnDate('2026-11-06');b.data.generated_at=after.toISOString();
 assert.equal(Ops.normalize(a,before).records[0].phoneReady,true);
 assert.equal(Ops.normalize(b,after).records[0].phoneReady,false);
 assert.ok(Ops.normalize(b,after).records[0].gate.includes('วันที่งานผ่านไปแล้ว'));
});
