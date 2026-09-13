const test=require('node:test');
const assert=require('node:assert/strict');
const O=require('../admin/operations-engine.js');

const assets=[
  {asset_id:'PHONE-001',asset_type:'phone',status:'available',rentable_now:true},
  {asset_id:'PHONE-002',asset_type:'phone',status:'available',rentable_now:true},
  {asset_id:'LENS-001',asset_type:'lens',status:'available',rentable_now:true},
  {asset_id:'LENS-004',asset_type:'lens',status:'available',rentable_now:true},
  {asset_id:'LENS-OFF',asset_type:'lens',status:'inactive',rentable_now:false}
];
const booking=(id,date,type,phone,lens,status='confirmed')=>({booking_id:id,event_id:'E-'+date,event_name:'Event '+date,event_date:date,booking_status:status,package_type:type,phone_asset_id:phone||'',lens_asset_id:lens||'',customer_name:id,pickup_time:'12:00'});

test('normalizes Google serial and Thai/ISO dates',()=>{
  assert.equal(O.dateKey(46284),'2026-09-19');
  assert.equal(O.dateKey('19/09/2026'),'2026-09-19');
  assert.equal(O.dateKey('2026-09-19T00:00:00.000Z'),'2026-09-19');
});

test('smart availability counts physical capacity and package demand',()=>{
  const data={assets,bookings:[booking('B1','2026-09-19','phone_lens_bundle','PHONE-001','LENS-001')]};
  const a=O.availabilityForDate(data,'2026-09-19');
  assert.deepEqual({phone_total:a.phone_total,phone_demand:a.phone_demand,phone_free:a.phone_free,lens_total:a.lens_total,lens_demand:a.lens_demand,lens_free:a.lens_free,bundle_free:a.bundle_free,overbooked:a.overbooked},{phone_total:2,phone_demand:1,phone_free:1,lens_total:2,lens_demand:1,lens_free:1,bundle_free:1,overbooked:false});
});

test('same-day capacity exhaustion is visible before overbooking',()=>{
  const data={assets,bookings:[booking('B1','2026-12-05','phone_lens_bundle','PHONE-001','LENS-001'),booking('B2','2026-12-05','phone_only','PHONE-002','')]};
  const a=O.availabilityForDate(data,'2026-12-05');
  assert.equal(a.phone_free,0);
  assert.equal(a.lens_free,1);
  assert.equal(a.bundle_free,0);
  assert.equal(a.overbooked,false);
});

test('detects double booking and capacity exceeded',()=>{
  const data={assets,bookings:[booking('B1','2026-12-05','phone_only','PHONE-001',''),booking('B2','2026-12-05','phone_only','PHONE-001',''),booking('B3','2026-12-05','phone_only','PHONE-002','')]};
  const issues=O.collisions(data);
  assert.ok(issues.some(x=>x.code==='ASSET_DOUBLE_BOOKED'&&x.asset_id==='PHONE-001'));
  assert.ok(issues.some(x=>x.code==='PHONE_CAPACITY_EXCEEDED'));
});

test('detects missing, unknown, wrong-type and non-rentable assignments',()=>{
  const data={assets,bookings:[
    booking('MISSING','2026-09-20','phone_lens_bundle','PHONE-001',''),
    booking('UNKNOWN','2026-09-21','phone_only','PHONE-X',''),
    booking('WRONG','2026-09-22','phone_only','LENS-001',''),
    booking('OFF','2026-09-23','lens_only','','LENS-OFF')
  ]};
  const codes=new Set(O.collisions(data).map(x=>x.code));
  for(const c of ['LENS_UNASSIGNED','UNKNOWN_ASSET','WRONG_ASSET_TYPE','ASSET_NOT_RENTABLE']) assert.ok(codes.has(c),c);
});

test('cancelled/completed bookings do not reserve capacity',()=>{
  const data={assets,bookings:[booking('B1','2026-09-19','phone_lens_bundle','PHONE-001','LENS-001','cancelled'),booking('B2','2026-09-19','phone_lens_bundle','PHONE-002','LENS-004','completed')]};
  const a=O.availabilityForDate(data,'2026-09-19');
  assert.equal(a.booking_count,0); assert.equal(a.phone_free,2); assert.equal(a.lens_free,2);
});

test('calendar sorts operational bookings and excludes final statuses',()=>{
  const data={events:[],assets,bookings:[booking('B2','2026-09-20','phone_only','PHONE-002',''),booking('B1','2026-09-19','phone_only','PHONE-001',''),booking('C','2026-09-18','phone_only','PHONE-001','','completed')]};
  const rows=O.calendar(data,{from:'2026-09-19',to:'2026-09-20'});
  assert.deepEqual(rows.map(x=>x.booking_id),['B1','B2']);
});