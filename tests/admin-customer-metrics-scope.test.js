'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=fs.readFileSync('admin/admin.js','utf8');
function extract(first,last){const a=src.indexOf('  function '+first+'('),b=src.indexOf('  function '+last+'(',a);assert.ok(a>=0&&b>a);return src.slice(a,b);}
const ctx=vm.createContext({state:{data:{}},toNum:v=>Number(v)||0,dateValue:v=>Date.parse(v)||0,textValue:v=>String(v||''),sortedBookings:v=>v,daysFromToday:()=>-1,isUnpaidPayment:()=>false});
vm.runInContext(extract('customerKeyFromRecord','findBookingByRow')+extract('customerAnalytics','customerQualityIssues')+extract('normalizeBookingStatus','isRevenueBooking'),ctx);
function booking(id,status,phone='0800000001'){return {booking_id:id,booking_status:status,customer_phone:phone,customer_name:'Test',event_date:'2026-11-20',amount_received:100,payment_status:'paid'};}
test('Master summary, detail and timeline agree without inflating archive aggregate',()=>{
  const rows=[...Array.from({length:8},(_,i)=>booking('done'+i,'completed')),booking('active','confirmed'),...Array.from({length:4},(_,i)=>booking('cancel'+i,'cancelled'))];
  const stats=[{customer_phone:'0800000001',customer_name:'Test',rental_count:100},{customer_phone:'0800000001',customer_name:'Test',rental_count:100}];
  ctx.state.data={bookings:rows};
  const c=ctx.customerHistoryRows(rows,stats)[0];
  const detail=ctx.customerBookings(c),a=ctx.customerAnalytics(c,detail);
  assert.equal(c.rental_count,8);assert.equal(c.archive_reported_count,100);assert.equal(detail.length,13);
  assert.equal(a.completed_count,8);assert.equal(a.booking_count,13);assert.equal(a.active_count,1);assert.equal(a.cancelled_count,4);
});
test('duplicate ID, absent ID and different identity are not silently merged',()=>{
  const rows=[booking('unique','returned'),booking('dup','completed'),booking('dup','completed'),booking('','completed'),booking('other','completed','0800000002'),booking('anonymous','completed','')];
  ctx.state.data={bookings:rows};
  const c=ctx.customerHistoryRows(rows,[]).find(c=>c.customer_key==='phone:0800000001');
  assert.equal(c.rental_count,1);assert.equal(ctx.customerBookings(c).length,1);
});
test('status whitespace and no show use consistent categories',()=>{
  const rows=[booking('a',' completed '),booking('b','picked_up'),booking('c','no_show')];
  ctx.state.data={bookings:rows};
  const c=ctx.customerHistoryRows(rows,[])[0];const a=ctx.customerAnalytics(c,ctx.customerBookings(c));
  assert.equal(c.rental_count,1);assert.equal(a.completed_count,1);assert.equal(a.active_count,1);assert.equal(a.no_show_count,1);
});

test('archive is accepted only against the same master snapshot; archived rows remain distinct',()=>{
  const master=[{...booking('master','completed'),event_id:'E1'}, {...booking('legacy',''),event_id:''}];
  const historical={...booking('legacy','completed'),event_id:'E2',archived:true};
  const projection={master:[master[0]],archive:[historical]};
  const archive=ctx.reconcileCustomerArchive({bookings:master},projection);
  assert.equal(archive.length,1);
  ctx.state.data={bookings:master};ctx.state.customerArchive=archive;
  const c=ctx.customerHistoryRows(ctx.crmBookingRows(),[])[0];
  assert.equal(c.rental_count,2);
  assert.equal(ctx.customerAnalytics(c,ctx.customerBookings(c)).booking_count,2);
  ctx.state.customerArchive=null;
  assert.equal(ctx.reconcileCustomerArchive({bookings:master},{...projection,master:[]}),null);
  assert.equal(ctx.reconcileCustomerArchive({bookings:master},{...projection,archive:[{...historical,booking_id:'master'}]}),null);
  assert.equal(ctx.reconcileCustomerArchive({bookings:master},{...projection,archive:[historical,historical]}),null);
  assert.equal(ctx.reconcileCustomerArchive({bookings:master},{...projection,archive:[{...master[0],archived:true}]}).length,0);
});
test('archive rows cannot invoke master row mutation actions',()=>{
  assert.match(src,/r\.archived\?'[^']*Archive · อ่านอย่างเดียว/);
});
