'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Quote=require('../server/rental-analytics-booked-quote');
const Core=require('../server/rental-dashboard-core')._test;
const Private=require('../server/legacy/kk-rental-dashboard-v5')._test;
const headers=['booking_id','created_at','booking_status','event_id','customer_name','customer_contact','customer_phone','channel','package_type','phone_asset_id','lens_asset_id','pickup_time','return_time','payment_status','amount_received','return_status','file_transfer_status','drive_link','damage_fee','staff_note','event_name','event_date','customer_id','package_price'];
function row(id,event,status,kind,price){
 const cells=Array(24).fill('');
 cells[0]=id;cells[2]=status;cells[3]=event;cells[8]=kind;cells[23]=price;
 return cells;
}
function csv(rows){return rows.map(r=>r.map(x=>'"'+String(x==null?'':x).replace(/"/g,'""')+'"').join(',')).join('\n');}
function parseCsv(text){
 const out=[];for(const line of String(text).split('\n')){
  const fields=[];let val='',quoted=false;for(let i=0;i<line.length;i++){
   const c=line[i];
   if(c==='"'){if(quoted && line[i+1]==='"'){val+='"';i++;}else quoted=!quoted;}
   else if(c===','&&!quoted){fields.push(val);val='';}else val+=c;
  }fields.push(val);out.push(fields);
 }return out;
}
function booking(id,event,status,kind,received=0){
 return {source:'MASTER',booking_id:id,event_id:event,event_date:'2026-10-18',created_at:'',status,package_type:kind,amount_received:received,customer_key:'phone:PRIVATE',event_name:'Demo event',affiliation:'Unknown',affiliation_source:'unknown',month:'2026-10'};
}
const master=(...data)=>csv([headers,...data]);
test('confirmed unpaid O=0 X=1290 contributes 1290 Future in Core and private CRM',()=>{
 const helper=[booking('BK-1','EV-1','confirmed','phone_lens_bundle',0)];
 const verified=Quote.bookedPriceRows(helper,master(row('BK-1','EV-1','confirmed','phone_lens_bundle','1,290')),parseCsv);
 assert.equal(verified[0].package_price,1290);
 for(const aggregator of [Core.aggregate,Private.aggregate]){
  const result=aggregator(verified);
  assert.equal(result.metrics.actual_revenue,0);
  assert.equal(result.metrics.future_revenue,1290);
  assert.equal(result.metrics.forecast_revenue,1290);
  assert.equal(result.monthly[0].future_revenue,1290);
  assert.equal(result.top_events[0].future_revenue,1290);
  assert.equal(result.affiliation_mix[0].future_revenue,1290);
  assert.equal(JSON.stringify(result).includes('PRIVATE'),false);
 }
});
test('completed cash stays actual; returned cash stays active Future exactly once',()=>{
 const helper=[booking('BK-C','EV-C','completed','phone_only',1090),booking('BK-R','EV-R','returned','phone_only',890)];
 const verified=Quote.bookedPriceRows(helper,master(row('BK-C','EV-C','completed','phone_only',1090),row('BK-R','EV-R','returned','phone_only',890)),parseCsv);
 for(const aggregate of [Core.aggregate,Private.aggregate]){
  const value=aggregate(verified).metrics;
  assert.equal(value.actual_revenue,1090);
  assert.equal(value.future_revenue,890);
  assert.equal(value.forecast_revenue,1980);
 }
});
test('reused booking ID on a different event is never cross-joined',()=>{
 const verified=Quote.bookedPriceRows([booking('SAME','EV-B','confirmed','phone_only')],
  master(row('SAME','EV-A','confirmed','phone_only',590),row('SAME','EV-B','confirmed','phone_only',790)),parseCsv);
 assert.equal(verified[0].package_price,790);
});
test('fail closed on missing, duplicate, nonpositive, malformed and package/status mismatches',()=>{
 const expected={code:'RENTAL_ACTIVE_QUOTE_UNVERIFIED'};
 const b=booking('BK-1','EV-1','confirmed','phone_only',0);
 const attempts=[
  master(),
  master(row('BK-1','EV-1','confirmed','phone_only',0)),
  master(row('BK-1','EV-1','confirmed','phone_only','1,000oops')),
  master(row('BK-1','EV-1','confirmed','phone_only','1,2')),
  master(row('BK-1','EV-1','confirmed','phone_only',790),row('BK-1','EV-1','confirmed','phone_only',790)),
  master(row('BK-1','EV-1','cancelled','phone_only',790)),
  master(row('BK-1','EV-1','confirmed','phone_lens_bundle',790)),
  master(row('BK-1','EV-other','confirmed','phone_only',790))
 ];
 for(const source of attempts)assert.throws(()=>Quote.bookedPriceRows([b],source,parseCsv),e=>e.code===expected.code);
 for(const aggregate of [Core.aggregate,Private.aggregate])
  assert.throws(()=>aggregate([b]),e=>e.code===expected.code);
});
test('excluded cancelled/no_show/blank never use cash or unverified quotes as Future',()=>{
 const rows=[booking('C','EV-C','cancelled','phone_only',1590),booking('N','EV-N','no_show','phone_only',990),booking('B','EV-B','','phone_only',500)];
 const verified=Quote.bookedPriceRows(rows,master(),parseCsv);
 for(const aggregate of [Core.aggregate,Private.aggregate]){
  const m=aggregate(verified).metrics;
  assert.equal(m.future_revenue,0);
  assert.equal(m.actual_revenue,0);
  assert.equal(m.reportable_bookings,0);
 }
});
test('Master header drift rejects unsafe inferred column offsets',()=>{
 assert.throws(()=>Quote.bookedPriceRows([booking('BK-1','EV-1','confirmed','phone_only')],csv([['booking_id','event_id'],['BK-1','EV-1']]),parseCsv),e=>e.code==='RENTAL_MASTER_QUOTE_SCHEMA_INVALID');
});

test('duplicate active helper identity fails closed before Future revenue can be counted twice',()=>{
 const one=booking('BK-DUP','EV-X','confirmed','phone_only',0);
 const source=master(row('BK-DUP','EV-X','confirmed','phone_only',890));
 assert.throws(()=>Quote.bookedPriceRows([one,{...one,created_at:'different'}],source,parseCsv),
  e=>e.code==='RENTAL_ACTIVE_HELPER_DUPLICATE');
 assert.throws(()=>Quote.bookedPriceRows([one,{...one,status:'prepared'}],source,parseCsv),
  e=>e.code==='RENTAL_ACTIVE_HELPER_DUPLICATE'||e.code==='RENTAL_ACTIVE_QUOTE_UNVERIFIED');
});
test('same booking ID on different events remains valid and excluded duplicates do not inflate Future',()=>{
 const a=booking('SHARED','EV-A','confirmed','phone_only',0);
 const b=booking('SHARED','EV-B','confirmed','phone_only',0);
 const cancelled=booking('CANCELLED','EV-C','cancelled','phone_only',500);
 const x=Quote.bookedPriceRows([a,b,cancelled,{...cancelled}],
  master(row('SHARED','EV-A','confirmed','phone_only',590),row('SHARED','EV-B','confirmed','phone_only',790)),parseCsv);
 assert.equal(x[0].package_price,590);
 assert.equal(x[1].package_price,790);
 assert.equal(x[2].package_price,null);
 assert.equal(x[3].package_price,null);
 for(const aggregate of [Core.aggregate,Private.aggregate]){
  const totals=aggregate(x).metrics;
  assert.equal(totals.actual_revenue,0);
  assert.equal(totals.future_revenue,1380);
  assert.equal(totals.forecast_revenue,1380);
 }
});
